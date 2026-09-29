import { FunctionDeclaration } from "@google/genai";
import RoomModel from "../model/room.model";
import { AvailabilityService } from "./availability.service";
import { AddOnError, AddOnService } from "./addOn.service";
import { CodeLookupError, CodeLookupService } from "./codeLookup.service";
import { SystemService } from "./system.service";
import { stayTotal } from "../utils/pricing";
import { MAX_ADVANCE_DAYS, MAX_STAY_NIGHTS } from "../utils/bookingValidation";
import { addDaysToDateStr, daysBetweenDateStr, hotelDateStr, isValidDateStr, HOTEL_TIME_ZONE } from "../utils/hotelTime";
import { normalizeReferenceCode } from "../utils/referenceCode";

export const CHATBOT_TOOLS: FunctionDeclaration[] = [
  {
    name: "check_room_availability",
    description:
      "Live check of which rooms are free for a stay, with current nightly rates, capacity and the room total for the stay. Use for any question about availability (tonight, tomorrow, specific dates) or about available rooms for a number of guests.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        checkInDate: { type: "string", description: "Check-in date, YYYY-MM-DD, in the hotel's timezone." },
        checkOutDate: { type: "string", description: "Check-out date, YYYY-MM-DD. Omit for a one-night stay." },
        guests: { type: "integer", description: "Number of guests, if the guest said it." },
        roomType: { type: "string", description: "Room type or room number the guest asked about, if any." },
      },
      required: ["checkInDate"],
    },
  },
  {
    name: "get_room_rates",
    description:
      "Current room types with live nightly rates, discounts, capacity, bedding and room amenities. Does not check date availability. Use for price or room-type questions without dates.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        roomType: { type: "string", description: "Room type or room number to filter by, if any." },
      },
    },
  },
  {
    name: "get_add_ons",
    description:
      "Live list of extra services/items (e.g. extra bed, towels) with current prices, pricing unit, per-booking limits and stock. Pass dates to check remaining stock for a stay.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        checkInDate: { type: "string", description: "Optional check-in date, YYYY-MM-DD." },
        checkOutDate: { type: "string", description: "Optional check-out date, YYYY-MM-DD." },
      },
    },
  },
  {
    name: "quote_stay",
    description:
      "Backend price estimate for a stay in an available room of a given type, optionally with add-ons. Use when the guest asks how much a stay (or a stay with add-ons) would cost for specific dates.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        checkInDate: { type: "string", description: "Check-in date, YYYY-MM-DD." },
        checkOutDate: { type: "string", description: "Check-out date, YYYY-MM-DD. Omit for one night." },
        guests: { type: "integer", description: "Number of guests, if known." },
        roomType: { type: "string", description: "Room type or room number to quote." },
        addOns: {
          type: "array",
          description: "Add-ons to include.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              quantity: { type: "integer" },
            },
            required: ["name"],
          },
        },
      },
      required: ["checkInDate", "roomType"],
    },
  },
  {
    name: "lookup_booking",
    description:
      "Look up the guest's own reservation by the reservation code they typed (format RES-XXXXX-XXXXX). Returns status, payment status, dates, room and totals. Only use a code the guest wrote in the chat.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        reservationCode: { type: "string", description: "The reservation code exactly as the guest typed it." },
      },
      required: ["reservationCode"],
    },
  },
];

export interface ChatbotToolContext {
  ip?: string;
  allowedCodes: Set<string>;
  bookingLookups: number;
  links: Map<string, { label: string; href: string }>;
}

class ToolInputError extends Error {}

const STATUS_LABELS: Record<string, string> = {
  unpaid: "Awaiting online payment",
  reservation: "Confirmed reservation",
  active: "Checked in",
  completed: "Checked out / completed",
  canceled: "Canceled",
  "no-show": "No-show",
};

const dayLabel = (dateStr: string) =>
  new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

function str(value: unknown, max = 100): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function resolveStay(checkIn: unknown, checkOut: unknown) {
  const arrival = str(checkIn, 10);
  const departureInput = str(checkOut, 10);
  if (!isValidDateStr(arrival)) throw new ToolInputError("checkInDate must be a valid date in YYYY-MM-DD format.");
  const today = hotelDateStr();
  if (arrival < today) throw new ToolInputError(`The check-in date ${arrival} is in the past. Today is ${today}.`);
  if (daysBetweenDateStr(today, arrival) > MAX_ADVANCE_DAYS) {
    throw new ToolInputError(`Reservations can only be made up to ${MAX_ADVANCE_DAYS} days ahead.`);
  }
  const departure = departureInput || addDaysToDateStr(arrival, 1);
  if (!isValidDateStr(departure)) throw new ToolInputError("checkOutDate must be a valid date in YYYY-MM-DD format.");
  const nights = daysBetweenDateStr(arrival, departure);
  if (nights < 1) throw new ToolInputError("The check-out date must be at least one night after check-in.");
  if (nights > MAX_STAY_NIGHTS) throw new ToolInputError(`A single stay cannot exceed ${MAX_STAY_NIGHTS} nights.`);
  return {
    checkInDate: arrival,
    checkInDay: dayLabel(arrival),
    checkOutDate: departure,
    checkOutDay: dayLabel(departure),
    nights,
  };
}

function resolveGuests(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const guests = Number(value);
  if (!Number.isInteger(guests) || guests < 1 || guests > 50) {
    throw new ToolInputError("guests must be a whole number between 1 and 50.");
  }
  return guests;
}

function matchesRoom(room: any, filter: string) {
  if (!filter) return true;
  const needle = filter.toLowerCase().replace(/\broom\b/g, "").trim();
  if (!needle) return true;
  const category = String(room.category || "").toLowerCase();
  const number = String(room.roomNumber || "").toLowerCase();
  return category.includes(needle) || needle.includes(category) || (!!number && needle.replace(/[^a-z0-9]/g, "") === number);
}

function roomLabel(room: any) {
  return room.roomNumber ? `Room ${room.roomNumber} (${room.category})` : room.category;
}

function publicRoom(room: any, nights: number) {
  const totals = stayTotal({ room, nights });
  const discount = Number(room.discount) || 0;
  return {
    room: roomLabel(room),
    roomType: room.category,
    capacity: room.maxHead,
    nightlyRate: totals.nightlyRate,
    ...(discount > 0 ? { regularNightlyRate: room.price, discountPercent: discount } : {}),
    nights: totals.nights,
    roomTotalForStay: totals.roomSubtotal,
    bedding: (room.bedding || []).slice(0, 6),
    roomAmenities: (room.amenities || []).slice(0, 12),
    howToBook: room.status === "available" ? "online booking page" : "front desk (online booking is currently closed for this room)",
  };
}

function addRoomLink(ctx: ChatbotToolContext, room: any) {
  if (room.status !== "available" || ctx.links.size >= 4) return;
  ctx.links.set(String(room._id), { label: `View ${roomLabel(room)}`, href: `/guest/room/${room._id}` });
}

async function activeRooms() {
  return RoomModel.find({ deletedAt: null })
    .select("roomNumber category amenities bedding price discount maxHead status")
    .lean();
}

const byNightlyRate = (a: any, b: any) =>
  stayTotal({ room: a, nights: 1 }).nightlyRate - stayTotal({ room: b, nights: 1 }).nightlyRate;

async function findAvailableRooms(args: Record<string, unknown>) {
  const stay = resolveStay(args.checkInDate, args.checkOutDate);
  const guests = resolveGuests(args.guests);
  const roomType = str(args.roomType, 60);
  const [rooms, conflicts] = await Promise.all([
    activeRooms(),
    AvailabilityService.stayConflicts(stay.checkInDate, stay.checkOutDate),
  ]);
  const typed = rooms.filter((room) => matchesRoom(room, roomType));
  const free = typed.filter((room: any) => room.status !== "maintenance" && !conflicts.has(String(room._id)));
  const fits = free.filter((room: any) => !guests || Number(room.maxHead) >= guests).sort(byNightlyRate);
  return { stay, guests, roomType, rooms, typed, free, fits };
}

async function checkRoomAvailability(args: Record<string, unknown>, ctx: ChatbotToolContext) {
  const { stay, guests, roomType, rooms, typed, free, fits } = await findAvailableRooms(args);
  if (roomType && typed.length === 0) {
    return {
      ok: true,
      stay,
      roomTypeRequested: roomType,
      roomTypeExists: false,
      existingRoomTypes: Array.from(new Set(rooms.map((r: any) => r.category))),
      availableRooms: [],
    };
  }
  fits.slice(0, 4).forEach((room) => addRoomLink(ctx, room));
  return {
    ok: true,
    stay,
    guests,
    roomTypeRequested: roomType || null,
    availableCount: fits.length,
    availableRooms: fits.slice(0, 12).map((room) => publicRoom(room, stay.nights)),
    freeButTooSmallCount: free.length - fits.length,
    largestFreeCapacity: free.reduce((max: number, r: any) => Math.max(max, Number(r.maxHead) || 0), 0),
    unavailableCount: typed.length - free.length,
  };
}

async function getRoomRates(args: Record<string, unknown>) {
  const roomType = str(args.roomType, 60);
  const rooms = await activeRooms();
  const typed = rooms.filter((room) => matchesRoom(room, roomType));
  const groups = new Map<string, any[]>();
  for (const room of typed) {
    const key = String(room.category);
    groups.set(key, [...(groups.get(key) || []), room]);
  }
  const roomTypes = Array.from(groups.entries()).map(([category, list]) => {
    const rates = list.map((room) => stayTotal({ room, nights: 1 }).nightlyRate);
    const discounted = list.filter((room) => Number(room.discount) > 0);
    return {
      roomType: category,
      numberOfRooms: list.length,
      maxCapacity: Math.max(...list.map((r) => Number(r.maxHead) || 0)),
      nightlyRateFrom: Math.min(...rates),
      nightlyRateTo: Math.max(...rates),
      ...(discounted.length
        ? { discountNote: `${discounted.length} room(s) currently discounted; regular rate from ₱${Math.min(...discounted.map((r) => Number(r.price)))}` }
        : {}),
      bedding: Array.from(new Set(list.flatMap((r) => r.bedding || []))).slice(0, 6),
      roomAmenities: Array.from(new Set(list.flatMap((r) => r.amenities || []))).slice(0, 15),
    };
  });
  roomTypes.sort((a, b) => a.nightlyRateFrom - b.nightlyRateFrom);
  return {
    ok: true,
    note: "These are current rates only. Availability for specific dates must be checked separately.",
    roomTypeRequested: roomType || null,
    roomTypeExists: roomTypes.length > 0,
    ...(roomType && roomTypes.length === 0 ? { existingRoomTypes: Array.from(new Set(rooms.map((r: any) => r.category))) } : {}),
    roomTypes,
  };
}

async function getAddOns(args: Record<string, unknown>) {
  const stay = args.checkInDate ? resolveStay(args.checkInDate, args.checkOutDate) : null;
  const addOns = await AddOnService.listActive(stay?.checkInDate, stay?.checkOutDate);
  return {
    ok: true,
    stay,
    note: "Add-ons are chosen during the online reservation or requested at the front desk. This chat cannot add them to a booking.",
    addOns: addOns.map((a: any) => ({
      name: a.name,
      description: a.description || undefined,
      price: a.price,
      pricing: a.pricingUnit === "per_night" ? "per night" : "per stay",
      maxPerBooking: a.maxPerBooking,
      availability: stay
        ? a.remaining === null
          ? "available"
          : a.remaining === 0
            ? "fully booked for these dates"
            : `${a.remaining} left for these dates`
        : a.stock === null
          ? "available"
          : "limited stock (depends on dates)",
    })),
  };
}

async function quoteStay(args: Record<string, unknown>, ctx: ChatbotToolContext) {
  const { stay, guests, roomType, rooms, typed, fits } = await findAvailableRooms(args);
  if (typed.length === 0) {
    return {
      ok: true,
      stay,
      quote: null,
      reason: `There is no "${roomType}" room type.`,
      existingRoomTypes: Array.from(new Set(rooms.map((r: any) => r.category))),
    };
  }
  const room: any = fits[0];
  if (!room) return { ok: true, stay, guests, quote: null, reason: "No matching room is available for these dates." };

  const requested = Array.isArray(args.addOns) ? args.addOns.slice(0, 10) : [];
  const active = requested.length ? await AddOnService.listActive() : [];
  const selection: { addOnId: string; quantity: number }[] = [];
  const addOnIssues: string[] = [];
  for (const item of requested as any[]) {
    const name = str(item?.name, 60).toLowerCase();
    const quantity = item?.quantity === undefined ? 1 : Number(item.quantity);
    if (!name) continue;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      addOnIssues.push(`Invalid quantity for "${item?.name}".`);
      continue;
    }
    const match: any =
      active.find((a: any) => a.name.toLowerCase() === name) ||
      active.find((a: any) => a.name.toLowerCase().includes(name) || name.includes(a.name.toLowerCase()));
    if (!match) {
      addOnIssues.push(`"${item?.name}" is not an available add-on.`);
      continue;
    }
    selection.push({ addOnId: match._id, quantity });
  }

  let priced = { items: [] as any[], total: 0 };
  if (selection.length) {
    try {
      priced = await AddOnService.price(selection, { arrivalDate: stay.checkInDate, departureDate: stay.checkOutDate });
    } catch (error) {
      if (!(error instanceof AddOnError)) throw error;
      addOnIssues.push(error.message);
    }
  }
  const totals = stayTotal({ room, nights: stay.nights, addOnsTotal: priced.total });
  const system: any = await SystemService.get();
  addRoomLink(ctx, room);
  return {
    ok: true,
    stay,
    guests,
    quote: {
      room: roomLabel(room),
      capacity: room.maxHead,
      nightlyRate: totals.nightlyRate,
      nights: totals.nights,
      roomSubtotal: totals.roomSubtotal,
      addOns: priced.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        pricing: i.pricingUnit === "per_night" ? "per night" : "per stay",
        subtotal: i.subtotal,
      })),
      addOnsTotal: totals.addOnsTotal,
      estimatedTotal: totals.total,
      minimumOnlinePayment: Number(system?.paymentMin) > 0 ? Number(system.paymentMin) : undefined,
      howToBook: publicRoom(room, stay.nights).howToBook,
    },
    addOnIssues,
    note: "Estimate from the hotel system. The final amount is confirmed on the booking page.",
  };
}

async function lookupBooking(args: Record<string, unknown>, ctx: ChatbotToolContext) {
  const code = normalizeReferenceCode(args.reservationCode);
  if (!code) {
    return { ok: false, error: "That is not a valid reservation code. Codes look like RES-XXXXX-XXXXX." };
  }
  if (!ctx.allowedCodes.has(code)) {
    return { ok: false, error: "Ask the guest to type their reservation code in the chat before looking it up." };
  }
  if (ctx.bookingLookups >= 1) {
    return { ok: false, error: "Only one reservation can be looked up per message." };
  }
  ctx.bookingLookups += 1;
  try {
    const booking = await CodeLookupService.findBooking({ code, ip: ctx.ip });
    const summary = await CodeLookupService.trackingSummary(booking);
    ctx.links.set("track", { label: "Open booking tracker", href: "/guest/track-booking" });
    return {
      ok: true,
      booking: {
        reference: summary.reference,
        status: STATUS_LABELS[summary.status] || summary.status,
        paymentStatus: summary.paymentStatus,
        room: summary.room.label,
        checkInDate: summary.arrivalDate,
        checkInDay: summary.arrivalDate ? dayLabel(summary.arrivalDate) : "",
        expectedArrivalTime: summary.arrivalTime,
        checkOutDate: summary.departureDate,
        nights: summary.nights,
        guests: summary.guests,
        addOns: summary.addOns,
        addOnsTotal: summary.addOnsTotal,
        total: summary.total,
        amountPaid: summary.amountPaid,
        balanceDue: summary.balanceDue,
        nonRefundable: summary.nonRefundable,
      },
    };
  } catch (error) {
    if (error instanceof CodeLookupError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function executeChatbotTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ChatbotToolContext,
): Promise<Record<string, unknown>> {
  try {
    switch (name) {
      case "check_room_availability":
        return await checkRoomAvailability(args, ctx);
      case "get_room_rates":
        return await getRoomRates(args);
      case "get_add_ons":
        return await getAddOns(args);
      case "quote_stay":
        return await quoteStay(args, ctx);
      case "lookup_booking":
        return await lookupBooking(args, ctx);
      default:
        return { ok: false, error: "Unknown lookup." };
    }
  } catch (error) {
    if (error instanceof ToolInputError) return { ok: false, error: error.message };
    console.error(`Chatbot tool ${name} failed:`, (error as Error).message);
    return {
      ok: false,
      error: "LIVE_DATA_UNAVAILABLE",
      message: "The live hotel system could not be reached. Do not guess; tell the guest you cannot check this right now.",
    };
  }
}

export function extractReservationCodes(texts: string[]): Set<string> {
  const codes = new Set<string>();
  const pattern = /RES[\s_-]*[0-9A-Z]{5}[\s_-]*[0-9A-Z]{5}/gi;
  for (const text of texts) {
    for (const match of text.match(pattern) || []) {
      const code = normalizeReferenceCode(match);
      if (code) codes.add(code);
    }
  }
  return codes;
}

export function hotelDateContext(now: Date = new Date()) {
  const today = hotelDateStr(now);
  const time = now.toLocaleTimeString("en-US", { timeZone: HOTEL_TIME_ZONE, hour: "numeric", minute: "2-digit" });
  const calendar = Array.from({ length: 21 }, (_, i) => {
    const date = addDaysToDateStr(today, i);
    const weekday = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long" });
    return `${date} ${weekday}${i === 0 ? " (today)" : i === 1 ? " (tomorrow)" : ""}`;
  });
  return { today, time, calendar };
}
