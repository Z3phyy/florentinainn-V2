import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import {
  bookingInterfaceInput,
  BOOKING_CREATE_STATUSES,
  BOOKING_STATUSES,
  BOOKING_UPDATE_STATUSES,
  ONLINE_RESERVATION_STATUSES,
  isBookingType,
} from "../types/bookings.type";
import { BookingService } from "../services/booking.service";
import { AddOnError, AddOnSelection, AddOnService, parseAddOnSelection } from "../services/addOn.service";
import { runAtomic } from "../utils/transaction";
import { generateReferenceCode } from "../utils/referenceCode";
import { CodeLookupError, CodeLookupService } from "../services/codeLookup.service";
import { Types } from "mongoose";
import { ReservationError, ReservationService, ModificationInput } from "../services/reservation.service";
import { AvailabilityService } from "../services/availability.service";
import { arrivalTimeline, resolveGraceMinutes } from "../services/reservationMonitor.service";
import RoomModel from "../model/room.model";
import BookingsModel from "../model/bookings.model";
import { RoomService } from "../services/room.service";
import { Paymentservice } from "../services/payment.service";
import { SystemService } from "../services/system.service";
import { logAuditAction } from "../utils/auditLogger";
import { notify } from "../utils/notification";
import { verifyOnlinePayment } from "../utils/verifyPayment";
import { sendReservationVoucherEmail } from "../utils/sendEmail";
import { localDateStr } from "../utils/date";
import { daysBetweenDateStr, hotelDateStr, isValidDateStr, HOTEL_TIME_ZONE } from "../utils/hotelTime";
import { plannedNights, stayTotal } from "../utils/pricing";
import {
  validateGuestName,
  validateAddress,
  validateContact,
  validateStayDates,
  validateGuestCount,
} from "../utils/bookingValidation";

// Helper to generate a human-readable folio number for payment records
function generateFolio(bookingId?: string): string {
  const today = localDateStr().replace(/-/g, "");
  const code = bookingId
    ? bookingId.slice(-6).toUpperCase()
    : Math.random().toString(36).slice(2, 8).toUpperCase();
  return `FOL-${today}-${code}`;
}


function validateArrivalDateTime(
  arrivalDate: string,
  arrivalTime: string,
  departureDate?: string,
  requireDeparture = false,
): string | null {
  return validateStayDates({
    arrivalDate,
    arrivalTime,
    departureDate,
    requireDeparture,
  });
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validateGuestDetails(input: {
  clientName: string;
  clientAddress: string;
  clientEmail?: string;
  clientPhone?: string;
  guests: unknown;
  maxHead?: number;
  requireEmail: boolean;
}): string | null {
  return (
    validateGuestName(input.clientName) ||
    validateAddress(input.clientAddress) ||
    validateContact(input.clientEmail, input.clientPhone, {
      requireEmail: input.requireEmail,
    }) ||
    validateGuestCount(input.guests, input.maxHead)
  );
}

// Helper to compute nights stayed so far from an arrival date string (YYYY-MM-DD)
function nightsSince(arrivalDate: string): number {
  return Math.max(1, daysBetweenDateStr(arrivalDate, hotelDateStr()));
}

async function createBookingWithAddOns(
  data: bookingInterfaceInput,
  selection: AddOnSelection[],
  roomDoc: any,
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await insertBookingWithAddOns(data, selection, roomDoc, generateReferenceCode());
    } catch (error) {
      const duplicateReference =
        (error as { code?: number; keyPattern?: Record<string, unknown> }).code === 11000 &&
        !!(error as { keyPattern?: Record<string, unknown> }).keyPattern?.referenceCode;
      if (!duplicateReference || attempt >= 4) throw error;
    }
  }
}

async function insertBookingWithAddOns(
  data: bookingInterfaceInput,
  selection: AddOnSelection[],
  roomDoc: any,
  referenceCode: string,
) {
  return runAtomic(async (session) => {
    if (session) {
      await AddOnService.lock(selection.map((s) => s.addOnId), session);
    }
    const priced = await AddOnService.price(
      selection,
      { arrivalDate: data.arrivalDate, departureDate: data.departureDate },
      { session },
    );
    const totals = stayTotal({
      room: roomDoc,
      nights: plannedNights(data.arrivalDate, data.departureDate),
      addOnsTotal: priced.total,
    });
    const [created] = await BookingsModel.create(
      [
        {
          ...data,
          referenceCode,
          addOns: priced.items,
          addOnsTotal: priced.total,
          totalAmount: totals.total,
        },
      ],
      { session },
    );
    return created;
  });
}

async function reservationPricing(booking: any) {
  const roomDoc = booking.room?.price !== undefined ? booking.room : await RoomService.get(String(booking.room));
  const totals = stayTotal({
    room: roomDoc,
    nights: plannedNights(booking.arrivalDate, booking.departureDate),
    addOnsTotal: Number(booking.addOnsTotal) || 0,
  });
  const system = await SystemService.get();
  const paymentMin = Number(system?.paymentMin || 0);
  return {
    ...totals,
    addOns: (booking.addOns || []).map((a: any) => ({
      name: a.name,
      quantity: a.quantity,
      unitPrice: a.unitPrice,
      pricingUnit: a.pricingUnit,
      nights: a.nights,
      subtotal: a.subtotal,
    })),
    depositDue: paymentMin > 0 ? Math.min(paymentMin, totals.total) : totals.total,
  };
}

export class BookingController {
  static getAllBookings = async (request: AuthRequest, response: Response) => {
    try {
      const { status, search } = request.query;
      const bookings = await BookingService.getAll({
        status: typeof status === "string" ? status : undefined,
        search: typeof search === "string" ? search : undefined,
      });
      response.send(bookings);
    } catch (error) {
      console.log("Failed to get bookings: " + (error as Error).message);
      response
        .status(500)
        .send("Failed to get bookings: " + (error as Error).message);
    }
  };

  static reservationHistory = async (request: AuthRequest, response: Response) => {
    try {
      const q = request.query;
      const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
      const status = str(q.status) || "all";
      const paymentStatus = str(q.paymentStatus) || "all";
      const type = str(q.type) || "all";
      const from = str(q.from);
      const to = str(q.to);
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;

      if (status !== "all" && !(BOOKING_STATUSES as readonly string[]).includes(status)) {
        response.status(400).json({ message: "Invalid status filter" });
        return;
      }
      if (!["all", "paid", "partial", "unpaid"].includes(paymentStatus)) {
        response.status(400).json({ message: "Invalid payment status filter" });
        return;
      }
      if (!["all", "walk in", "reservation"].includes(type)) {
        response.status(400).json({ message: "Invalid booking type filter" });
        return;
      }
      if ((from && !datePattern.test(from)) || (to && !datePattern.test(to))) {
        response.status(400).json({ message: "Dates must use the YYYY-MM-DD format" });
        return;
      }
      if (from && to && from > to) {
        response.status(400).json({ message: "The start date must be on or before the end date" });
        return;
      }

      const result = await BookingService.getHistory({
        page: Number(q.page),
        limit: Number(q.limit),
        search: str(q.search).slice(0, 100),
        status,
        paymentStatus,
        type,
        from,
        to,
        sortDir: q.sortDir === "asc" ? "asc" : "desc",
      });
      response.send(result);
    } catch (error) {
      console.log("Failed to get reservation history: " + (error as Error).message);
      response.status(500).json({ message: "Failed to load reservation history" });
    }
  };

  static getBooking = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (typeof id !== "string" || !/^[a-f\d]{24}$/i.test(id)) {
        response.status(404).send("Booking not found");
        return;
      }
      const booking: any = await BookingsModel.findById(id).populate("room").lean();
      if (!booking) {
        response.status(404).send("Booking not found");
        return;
      }
      const room = booking.room || {};
      const plannedTotal = stayTotal({
        room,
        nights: plannedNights(booking.arrivalDate, booking.departureDate),
        addOnsTotal: Number(booking.addOnsTotal) || 0,
      });
      const nameParts = String(booking.clientName || "Guest").trim().split(/\s+/);
      response.send({
        _id: String(booking._id),
        clientName:
          nameParts.length > 1
            ? `${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0).toUpperCase()}.`
            : nameParts[0],
        type: booking.type,
        status: booking.status,
        guests: booking.guests,
        arrivalDate: booking.arrivalDate,
        arrivalTime: booking.arrivalTime,
        departureDate: booking.departureDate || "",
        paymentAmount: Number(booking.paymentAmount) || 0,
        paymentMethod: booking.paymentMethod || "",
        paymentRefNumber: booking.paymentRefNumber || "",
        totalAmount: Number(booking.totalAmount) || plannedTotal.total,
        roomSubtotal: plannedTotal.roomSubtotal,
        nights: plannedTotal.nights,
        addOns: (booking.addOns || []).map((a: any) => ({
          name: a.name,
          quantity: a.quantity,
          unitPrice: a.unitPrice,
          pricingUnit: a.pricingUnit,
          nights: a.nights,
          subtotal: a.subtotal,
        })),
        addOnsTotal: Number(booking.addOnsTotal) || 0,
        nonRefundable: booking.nonRefundable === true,
        checkedOutAt: booking.checkedOutAt || null,
        room: {
          _id: room._id ? String(room._id) : "",
          roomNumber: room.roomNumber || "",
          category: room.category || "",
          price: room.price,
          discount: room.discount,
          image: room.image || "",
          maxHead: room.maxHead,
          amenities: room.amenities || [],
          bedding: room.bedding || [],
          description: room.description || "",
        },
      });
    } catch (error) {
      console.log("Failed to get booking: " + (error as Error).message);
      response.status(500).send("Failed to get booking");
    }
  };

  static guestDirectory = async (request: AuthRequest, response: Response) => {
    try {
      const guests = await BookingService.getGuestDirectory();
      response.send(guests);
    } catch (error) {
      console.log("Failed to get guest directory: " + (error as Error).message);
      response.status(500).send("Failed to get guest directory");
    }
  };

  static updateGuestRecord = async (request: AuthRequest, response: Response) => {
    try {
      const { key } = request.body || {};
      const clientName = text(request.body?.clientName);
      const clientEmail = text(request.body?.clientEmail);
      const clientPhone = text(request.body?.clientPhone);
      const clientAddress = text(request.body?.clientAddress);

      if (!key || typeof key !== "string") {
        response.status(400).send("Guest identifier is required");
        return;
      }

      const inputError =
        validateGuestName(clientName) ||
        validateAddress(clientAddress) ||
        validateContact(clientEmail, clientPhone, { requireEmail: false });
      if (inputError) {
        response.status(400).send(inputError);
        return;
      }

      const guests = await BookingService.getGuestDirectory();
      const guest = guests.find((g: any) => g.key === key);
      if (!guest) {
        response.status(404).send("Guest not found");
        return;
      }

      const match: {
        clientEmail?: string;
        clientPhone?: string;
        clientName?: string;
      } = {};
      if (guest.email) {
        match.clientEmail = guest.email;
      } else if (guest.phone) {
        match.clientPhone = guest.phone;
      } else {
        match.clientName = guest.name;
      }

      const result = await BookingService.updateGuestIdentity(match, {
        clientName,
        clientEmail,
        clientPhone,
        clientAddress,
      });

      await logAuditAction({
        action: "GUEST_RECORD_UPDATED",
        details: `Updated guest record for "${guest.name}" (${result.modifiedCount || 0} booking record${result.modifiedCount === 1 ? "" : "s"} updated)`,
        actorName: request.account?.name || "Staff",
        actorRole: request.account?.type || "employee",
        targetType: "guest",
      });

      const updated = await BookingService.getGuestDirectory();
      response.send(updated);
    } catch (error) {
      console.log("Failed to update guest record: " + (error as Error).message);
      response.status(500).send("Failed to update guest record");
    }
  };

  static guestStatusLookup = async (request: AuthRequest, response: Response) => {
    request.body = {
      code: request.body?.verificationCode,
      bookingId: request.body?.bookingId,
    };
    await BookingController.trackBooking(request, response);
  };

  static trackBooking = async (request: AuthRequest, response: Response) => {
    try {
      const booking = await CodeLookupService.findBooking({
        code: request.body?.code,
        bookingId: request.body?.bookingId,
        ip: request.ip,
      });
      response.send(await CodeLookupService.trackingSummary(booking));
    } catch (error) {
      if (error instanceof CodeLookupError) {
        if (error.retryAfterSeconds) response.setHeader("Retry-After", String(error.retryAfterSeconds));
        response.status(error.status).json({ message: error.message });
        return;
      }
      console.log("Failed to track booking: " + (error as Error).message);
      response.status(500).json({ message: "Failed to look up booking" });
    }
  };

  static createBooking = async (request: AuthRequest, response: Response) => {
    try {
      const { type, status, room, guests } = request.body;

      const clientName = text(request.body?.clientName);
      const clientAddress = text(request.body?.clientAddress);
      const clientEmail = text(request.body?.clientEmail);
      const clientPhone = text(request.body?.clientPhone);
      const arrivalDate = text(request.body?.arrivalDate);
      const arrivalTime = text(request.body?.arrivalTime);
      const departureDate = text(request.body?.departureDate);

      const validationError = validateArrivalDateTime(
        arrivalDate,
        arrivalTime,
        departureDate,
        true,
      );
      if (validationError) {
        response.status(400).send(validationError);
        return;
      }

      if (!isBookingType(type)) {
        response.status(400).send("Invalid booking type");
        return;
      }

      if (!BOOKING_CREATE_STATUSES.includes(status as any)) {
        response.status(400).send("Invalid booking status");
        return;
      }

      if (!room || typeof room !== "string") {
        response.status(400).send("Please select a room for this check-in.");
        return;
      }

      const roomDoc = await RoomService.getActive(room);
      if (!roomDoc) {
        response.status(404).send("Room not found");
        return;
      }
      if (roomDoc.status !== "available") {
        response
          .status(409)
          .send(
            `Room is currently ${roomDoc.status}. Only available rooms can be assigned.`,
          );
        return;
      }

      const guestCount =
        guests === undefined || guests === null || guests === "" ? 1 : guests;

      const guestError = validateGuestDetails({
        clientName,
        clientAddress,
        clientEmail,
        clientPhone,
        guests: guestCount,
        maxHead: roomDoc.maxHead,
        requireEmail: false,
      });
      if (guestError) {
        response.status(400).send(guestError);
        return;
      }

      let addOnSelection;
      try {
        addOnSelection = parseAddOnSelection(request.body?.addOns);
      } catch (error) {
        response.status(400).send((error as Error).message);
        return;
      }

      const duplicate = await BookingService.findRecentDuplicate({
        room,
        clientName,
        arrivalDate,
      });
      if (duplicate) {
        response
          .status(409)
          .send(
            "This guest was just checked into this room. Refresh to see the existing record.",
          );
        return;
      }

      const bookingData: bookingInterfaceInput = {
        clientName,
        clientAddress,
        clientEmail,
        clientPhone,
        type,
        status,
        guests: Number(guestCount),
        arrivalDate,
        departureDate,
        arrivalTime,
        room,
      };

      let booking;
      try {
        booking = await createBookingWithAddOns(bookingData, addOnSelection, roomDoc);
      } catch (error) {
        if (error instanceof AddOnError) {
          response.status(error.status).send(error.message);
          return;
        }
        throw error;
      }
      await BookingService.reconcileRoomStatus(room);

      await logAuditAction({
        action: "WALK_IN_CHECKIN",
        details: `Walk-in check-in for guest ${clientName} on ${arrivalDate} (${arrivalTime}) until ${departureDate || "open-ended"} · ${guestCount} guest(s)`,
        actorName: request.account?.name || "Staff",
        actorRole: request.account?.type || "employee",
        targetType: "booking",
        targetId: booking._id ? String(booking._id) : undefined,
      });

      await notify({
        type: "reservation",
        title: `Walk-in Check-in: ${clientName}`,
        message: `Guest checked in for ${arrivalDate} (${arrivalTime})${departureDate ? ` · check-out ${departureDate}` : ""}`,
        severity: "info",
        link: "/pages/admin/dashboard",
        targetType: "booking",
        targetId: booking._id ? String(booking._id) : undefined,
      });

      const bookings = await BookingService.getAll();
      response.send(bookings);
    } catch (error) {
      console.log("Failed to create booking: " + (error as Error).message);
      response
        .status(500)
        .send("Failed to create booking: " + (error as Error).message);
    }
  };

  static updateBooking = async (request: AuthRequest, response: Response) => {
    try {
      const {
        _id,
        clientName,
        clientAddress,
        clientEmail,
        clientPhone,
        type,
        status,
        arrivalDate,
        arrivalTime,
        room,
        guests,
      } = request.body;
      const departureDate = text(request.body?.departureDate);

      const existing = await BookingService.get(_id);
      if (!existing) {
        response.status(404).send("Booking not found");
        return;
      }

      if (!isBookingType(type)) {
        response.status(400).send("Invalid booking type");
        return;
      }

      if (!BOOKING_UPDATE_STATUSES.includes(status as any)) {
        response.status(400).send("Invalid booking status");
        return;
      }

      const validationError = validateArrivalDateTime(
        arrivalDate,
        arrivalTime,
        departureDate,
        false,
      );
      if (validationError) {
        response.status(400).send(validationError);
        return;
      }

      const currentRoomId = existing.room?._id
        ? String(existing.room._id)
        : String(existing.room ?? "");
      const newRoomId = room || currentRoomId;

      if (
        newRoomId !== currentRoomId ||
        text(arrivalDate) !== existing.arrivalDate ||
        text(arrivalTime) !== existing.arrivalTime ||
        (departureDate && departureDate !== (existing.departureDate || ""))
      ) {
        response
          .status(400)
          .send(
            "Room and date changes must use the reservation modification endpoint (POST /booking/reservation/modify) so availability and pricing are verified.",
          );
        return;
      }

      let newRoomDoc: any = null;
      if (newRoomId !== currentRoomId) {
        const newRoom = await RoomService.getActive(newRoomId);
        if (!newRoom) {
          response.status(404).send("Room not found");
          return;
        }
        if (newRoom.status !== "available") {
          response
            .status(409)
            .send(
              `Room is currently ${newRoom.status}. Only available rooms can be assigned.`,
            );
          return;
        }
        newRoomDoc = newRoom;
      }

      const updatePayload: bookingInterfaceInput = {
        clientName,
        clientAddress,
        clientEmail,
        clientPhone,
        type,
        status,
        arrivalDate,
        arrivalTime,
        room: newRoomId,
      };

      if (departureDate) updatePayload.departureDate = departureDate;
      if (guests !== undefined && guests !== null && guests !== "") {
        const guestError = validateGuestCount(
          guests,
          (existing.room as any)?.maxHead,
        );
        if (guestError) {
          response.status(400).send(guestError);
          return;
        }
        updatePayload.guests = Number(guests);
      }

      if (existing.status !== "completed" && existing.status !== "canceled") {
        const account = request.account;
        const changedBy = account?.name || "Staff";
        const history: any[] = [];

        if (newRoomId !== currentRoomId) {
          history.push({
            field: "room",
            from: (existing.room as any)?.roomNumber || currentRoomId,
            to: newRoomDoc?.roomNumber || newRoomId,
            changedBy,
            changedAt: new Date(),
          });
        }
        if (existing.arrivalDate !== text(arrivalDate)) {
          history.push({
            field: "arrivalDate",
            from: existing.arrivalDate,
            to: text(arrivalDate),
            changedBy,
            changedAt: new Date(),
          });
        }
        if (existing.arrivalTime !== text(arrivalTime)) {
          history.push({
            field: "arrivalTime",
            from: existing.arrivalTime,
            to: text(arrivalTime),
            changedBy,
            changedAt: new Date(),
          });
        }
        if (
          departureDate &&
          (existing.departureDate || "") !== departureDate
        ) {
          history.push({
            field: "departureDate",
            from: existing.departureDate || "",
            to: departureDate,
            changedBy,
            changedAt: new Date(),
          });
        }
        if (existing.status !== text(status)) {
          history.push({
            field: "status",
            from: existing.status,
            to: text(status),
            note: "Booking edited",
            changedBy,
            changedAt: new Date(),
          });
        }
        for (const entry of history) {
          await BookingService.recordModification(_id, entry);
        }
      }

      await BookingService.update(_id, updatePayload);

      // Reconcile room status so moved/freed rooms reflect their remaining bookings.
      await BookingService.reconcileRoomStatus(currentRoomId);
      if (newRoomId !== currentRoomId) {
        await BookingService.reconcileRoomStatus(newRoomId);
      }

      const bookings = await BookingService.getAll();
      response.send(bookings);
    } catch (error) {
      console.log("Failed to update booking: " + (error as Error).message);
      response
        .status(500)
        .send("Failed to update booking: " + (error as Error).message);
    }
  };

  static deleteBooking = async (request: AuthRequest, response: Response) => {
    try {
      const { _id } = request.body || {};
      const reason = text(request.body?.reason).slice(0, 300);
      if (typeof _id !== "string" || !Types.ObjectId.isValid(_id)) {
        response.status(400).send("A valid booking id is required");
        return;
      }

      const booking = await BookingService.get(_id);
      if (!booking) {
        response.status(404).send("Booking not found");
        return;
      }

      const archived = await BookingsModel.findOneAndUpdate(
        { _id, deletedAt: null },
        {
          $set: {
            deletedAt: new Date(),
            deletedBy: request.account?.name || "Staff",
            deleteReason: reason,
          },
        },
        { new: true },
      );
      if (!archived) {
        response.status(409).send("Booking was already archived");
        return;
      }
      await BookingService.reconcileRoomStatus(
        booking.room?._id
          ? String(booking.room._id)
          : String(booking.room ?? ""),
      );

      await logAuditAction({
        action: "BOOKING_ARCHIVED",
        details: `Archived booking ${booking.referenceCode || _id} for ${booking.clientName} (${booking.status})${reason ? ` — ${reason}` : ""}`,
        actorName: request.account?.name || "Staff",
        actorRole: request.account?.type || "employee",
        targetType: "booking",
        targetId: _id,
      });
      const bookings = await BookingService.getAll();
      response.send(bookings);
    } catch (error) {
      console.log("Failed to archive booking: " + (error as Error).message);
      response.status(500).send("Failed to archive booking");
    }
  };

  static checkOut = async (request: AuthRequest, response: Response) => {
    try {
      const { bookingId, amount, method, refNumber } = request.body || {};

      const account = request.account;
      const staffName = account?.name || "Staff";

      if (typeof bookingId !== "string" || !/^[a-f\d]{24}$/i.test(bookingId)) {
        response.status(400).send("A valid booking id is required");
        return;
      }

      const paidAmount = Number(amount || 0);

      if (
        Number.isNaN(paidAmount) ||
        paidAmount < 0 ||
        !Number.isFinite(paidAmount)
      ) {
        response.status(400).send("Invalid payment amount");
        return;
      }

      const booking = await BookingService.get(bookingId);

      if (!booking) {
        response.status(404).send("Booking not found");
        return;
      }

      if (booking.status === "completed") {
        response.status(409).send("This guest has already been checked out");
        return;
      }

      if (booking.status !== "active") {
        response
          .status(400)
          .send("Only checked-in (in-house) guests can be checked out");
        return;
      }

      const room = booking.room as any;
      if (!room?._id) {
        response.status(400).send("The room for this booking no longer exists");
        return;
      }
      const roomRef = String(room._id);
      const paymentBy = booking.clientName;
      const paymentMethod = text(method) || "Cash";

      const nights = nightsSince(booking.arrivalDate);
      const totalAmount = stayTotal({
        room,
        nights,
        addOnsTotal: Number((booking as any).addOnsTotal) || 0,
      }).total;

      const previouslyPaid = Number(booking.paymentAmount) || 0;
      const balanceBefore = Math.max(0, totalAmount - previouslyPaid);
      const appliedAmount = Math.min(paidAmount, balanceBefore);
      const changeDue = Math.max(0, paidAmount - balanceBefore);
      const remainingBalance = Math.max(0, balanceBefore - appliedAmount);

      if (remainingBalance > 0) {
        response
          .status(400)
          .send(
            `Outstanding balance of ₱${remainingBalance} must be settled before checkout. Use partial payment to collect a deposit.`,
          );
        return;
      }

      const departureDate = localDateStr();
      const wasScheduledDeparture =
        !!booking.departureDate && booking.departureDate > departureDate;
      const checkedOutAt = new Date();

      const generatedRef =
        text(refNumber) || `CHK-${bookingId.slice(-6).toUpperCase()}`;
      const generatedFolio = generateFolio(bookingId);

      const claimed = await BookingsModel.findOneAndUpdate(
        {
          _id: bookingId,
          status: "active",
          paymentAmount: previouslyPaid === 0 ? { $in: [0, null] } : previouslyPaid,
        },
        {
          $set: {
            status: "completed",
            departureDate,
            checkedOutAt,
            earlyCheckout: wasScheduledDeparture,
            paymentAmount: previouslyPaid + appliedAmount,
            paymentMethod,
            paymentRefNumber: generatedRef,
            totalAmount,
          },
          $push: {
            modificationHistory: {
              field: "status",
              from: booking.status,
              to: "completed",
              note: wasScheduledDeparture
                ? `Early checkout on ${departureDate} (scheduled departure ${booking.departureDate})`
                : `Checked out on ${departureDate}`,
              changedBy: staffName,
              changedAt: checkedOutAt,
            },
          },
        },
        { new: true },
      );

      if (!claimed) {
        response
          .status(409)
          .send(
            "This booking was updated by another request. Refresh the guest list and try again.",
          );
        return;
      }

      if (appliedAmount > 0) {
        await Paymentservice.create({
          amount: appliedAmount,
          receivedBy: staffName,
          date: departureDate,
          paymentBy,
          method: paymentMethod,
          refNumber: generatedRef,
          folio: generatedFolio,
          balance: 0,
        });
      }

      await BookingService.reconcileRoomStatus(roomRef);

      await RoomService.markHousekeepingDirty(
        roomRef,
        staffName,
        "Guest checked out — needs cleaning",
      );

      await logAuditAction({
        action: "GUEST_CHECKOUT",
        details: `Guest ${paymentBy} checked out. Total ${totalAmount}₱, previously paid ${previouslyPaid}₱, collected now ${appliedAmount}₱ via ${paymentMethod}${
          changeDue > 0 ? ` (tendered ${paidAmount}₱, change ${changeDue}₱)` : ""
        } (Ref: ${generatedRef}, Folio: ${generatedFolio}).`,
        actorName: staffName,
        actorRole: account?.type || "employee",
        targetType: "booking",
        targetId: bookingId,
      });

      await notify({
        type: "payment",
        title: `Checkout & Payment: ${paymentBy}`,
        message:
          appliedAmount > 0
            ? `Payment of ₱${appliedAmount} received via ${paymentMethod} (Ref: ${generatedRef}, Folio: ${generatedFolio}).`
            : `Guest checked out with the balance already settled (Ref: ${generatedRef}).`,
        severity: "success",
        link: "/pages/admin/payments",
        targetType: "booking",
        targetId: bookingId,
      });

      response.send({
        success: true,
        bookingId,
        status: claimed.status,
        checkedOutAt,
        departureDate,
        nights,
        totalAmount,
        previouslyPaid,
        amountCollected: appliedAmount,
        amountTendered: paidAmount,
        change: changeDue,
        balance: 0,
        refNumber: generatedRef,
        folio: generatedFolio,
        paymentMethod,
      });
    } catch (error) {
      console.log("Failed to check out guest: " + (error as Error).message);
      response.status(500).send("Failed to check out guest");
    }
  };

  static partialPayment = async (request: AuthRequest, response: Response) => {
    try {
      const { bookingId, amount, paymentBy, method, refNumber } = request.body;

      const account = request.account;

      const paidAmount = Number(amount || 0);

      if (
        Number.isNaN(paidAmount) ||
        paidAmount <= 0 ||
        !Number.isFinite(paidAmount)
      ) {
        response.status(400).send("Invalid payment amount");
        return;
      }

      const booking = await BookingService.get(bookingId);

      if (!booking) {
        response.status(400).send("Booking not found");
        return;
      }

      if (booking.status !== "active") {
        response
          .status(400)
          .send("Only in-house guests can make partial payments");
        return;
      }

      const room = booking.room as any;
      const totalAmount = stayTotal({
        room,
        nights: nightsSince(booking.arrivalDate),
        addOnsTotal: Number((booking as any).addOnsTotal) || 0,
      }).total;

      const alreadyPaid = Number(booking.paymentAmount) || 0;
      const remainingBalance = Math.max(0, totalAmount - alreadyPaid);

      if (paidAmount > remainingBalance) {
        response
          .status(400)
          .send(`Amount exceeds the remaining balance of ₱${remainingBalance}`);
        return;
      }

      const newPaidAmount = alreadyPaid + paidAmount;
      const newBalance = Math.max(0, totalAmount - newPaidAmount);

      const generatedRef =
        refNumber ||
        (bookingId
          ? `PPY-${bookingId.slice(-6).toUpperCase()}`
          : `PPY-${Date.now().toString(36).toUpperCase()}`);

      const generatedFolio = generateFolio(bookingId);

      const claimed = await BookingsModel.findOneAndUpdate(
        {
          _id: bookingId,
          status: "active",
          paymentAmount: alreadyPaid === 0 ? { $in: [0, null] } : alreadyPaid,
        },
        {
          $set: {
            paymentAmount: newPaidAmount,
            paymentMethod: method || "Cash",
            paymentRefNumber: generatedRef,
            totalAmount,
          },
        },
      );

      if (!claimed) {
        response
          .status(409)
          .send(
            "This booking was updated by another request. Refresh and try again.",
          );
        return;
      }

      await Paymentservice.create({
        amount: paidAmount,
        receivedBy: account?.name || "Staff",
        date: localDateStr(),
        paymentBy: paymentBy,
        method: method || "Cash",
        refNumber: generatedRef,
        folio: generatedFolio,
        balance: newBalance,
      });

      await logAuditAction({
        action: "PARTIAL_PAYMENT",
        details: `Partial payment of ₱${paidAmount} received from guest ${paymentBy}. Total ${totalAmount}₱, paid so far ${newPaidAmount}₱, remaining ${newBalance}₱ (Ref: ${generatedRef}, Folio: ${generatedFolio})`,
        actorName: account?.name || "Staff",
        targetType: "booking",
        targetId: bookingId,
      });

      await notify({
        type: "payment",
        title: `Partial Payment: ${paymentBy}`,
        message: `Partial payment of ₱${paidAmount} received via ${method || "Cash"} (Ref: ${generatedRef}, Folio: ${generatedFolio}). Remaining balance ₱${newBalance}.`,
        severity: newBalance > 0 ? "info" : "success",
        link: "/pages/admin/payments",
        targetType: "booking",
        targetId: bookingId,
      });

      response.send({
        success: true,
        balance: newBalance,
        folio: generatedFolio,
      });
    } catch (error) {
      console.log(
        "Failed to process partial payment: " + (error as Error).message,
      );
      response.status(500).send("Failed to process partial payment");
    }
  };

  static reservation = async (request: AuthRequest, response: Response) => {
    try {
      const { type, status, room, guests, policyAccepted } = request.body;

      const clientName = text(request.body?.clientName);
      const clientAddress = text(request.body?.clientAddress);
      const clientEmail = text(request.body?.clientEmail);
      const clientPhone = text(request.body?.clientPhone);
      const arrivalDate = text(request.body?.arrivalDate);
      const arrivalTime = text(request.body?.arrivalTime);
      const departureDate = text(request.body?.departureDate);

      const validationError = validateArrivalDateTime(
        arrivalDate,
        arrivalTime,
        departureDate,
        true,
      );
      if (validationError) {
        response.status(400).send(validationError);
        return;
      }

      if (!isBookingType(type)) {
        response.status(400).send("Invalid booking type");
        return;
      }

      if (!ONLINE_RESERVATION_STATUSES.includes(status as any)) {
        response.status(400).send("Invalid booking status");
        return;
      }

      if (!room || typeof room !== "string") {
        response.status(400).send("Please select a room to reserve.");
        return;
      }

      if (policyAccepted !== true) {
        response
          .status(400)
          .send(
            "You must accept the non-refundable reservation policy before reserving.",
          );
        return;
      }

      const roomDoc = await RoomService.getActive(room);
      if (!roomDoc) {
        response.status(404).send("Room not found");
        return;
      }
      if (roomDoc.status !== "available") {
        response
          .status(409)
          .send(
            `This room is currently ${roomDoc.status} and can no longer be reserved. Please choose another room.`,
          );
        return;
      }

      const guestCount =
        guests === undefined || guests === null || guests === "" ? 1 : guests;

      const guestError = validateGuestDetails({
        clientName,
        clientAddress,
        clientEmail,
        clientPhone,
        guests: guestCount,
        maxHead: roomDoc.maxHead,
        requireEmail: true,
      });
      if (guestError) {
        response.status(400).send(guestError);
        return;
      }

      let addOnSelection;
      try {
        addOnSelection = parseAddOnSelection(request.body?.addOns);
      } catch (error) {
        response.status(400).send((error as Error).message);
        return;
      }

      const duplicate = await BookingService.findRecentDuplicate({
        room,
        clientName,
        arrivalDate,
      });
      if (duplicate) {
        response.send({
          bookingId: duplicate._id,
          duplicate: true,
          pricing: await reservationPricing(duplicate),
        });
        return;
      }

      const bookingData: bookingInterfaceInput = {
        clientName,
        clientAddress,
        clientEmail,
        clientPhone,
        type,
        status: status || "unpaid",
        guests: Number(guestCount),
        nonRefundable: true,
        policyAcceptedAt: new Date(),
        arrivalDate,
        departureDate,
        arrivalTime,
        room,
      };

      let booking;
      try {
        booking = await createBookingWithAddOns(bookingData, addOnSelection, roomDoc);
      } catch (error) {
        if (error instanceof AddOnError) {
          response.status(error.status).send(error.message);
          return;
        }
        throw error;
      }
      const verificationCode = booking.referenceCode as string;
      await BookingService.setVerificationCode(
        String(booking._id),
        verificationCode,
      );
      await BookingService.reconcileRoomStatus(room);

      await logAuditAction({
        action: "ONLINE_RESERVATION",
        details: `New online reservation created for guest ${clientName} for arrival on ${arrivalDate} (check-out ${departureDate}, ${guestCount} guest(s)) — non-refundable policy accepted`,
        actorName: clientName || "Guest",
        actorRole: "guest",
        targetType: "booking",
        targetId: String(booking._id),
      });

      // No notification here — the admin is only alerted once the guest's
      // payment is actually processed (see reservationPayment).

      response.send({
        bookingId: booking._id,
        verificationCode,
        referenceCode: verificationCode,
        nonRefundable: true,
        pricing: await reservationPricing(booking),
      });
    } catch (error) {
      console.log("Failed to create reservation: " + (error as Error).message);
      response.status(500).send("Failed to create reservation");
    }
  };

  static reservationSession = async (
    request: AuthRequest,
    response: Response,
  ) => {
    try {
      const { bookingId, sessionId, gateway } = request.body;

      if (!bookingId || typeof bookingId !== "string") {
        response.status(400).send("Missing booking reference");
        return;
      }
      if (!sessionId || typeof sessionId !== "string") {
        response.status(400).send("Missing payment session reference");
        return;
      }

      const booking = await BookingService.get(bookingId);
      if (!booking) {
        response.status(404).send("Booking not found");
        return;
      }

      if (booking.status !== "unpaid") {
        response.send("ok");
        return;
      }

      await BookingService.setPaymentSession(bookingId, {
        sessionId,
        gateway: gateway === "stripe" ? "stripe" : "paymongo",
      });

      response.send("ok");
    } catch (error) {
      console.log(
        "Failed to attach payment session: " + (error as Error).message,
      );
      response.status(500).send("Failed to attach payment session");
    }
  };

  static reservationPayment = async (
    request: AuthRequest,
    response: Response,
  ) => {
    try {
      const {
        bookingId,
        amount,
        method,
        refNumber,
        gateway,
        sessionId,
      } = request.body;

      if (typeof bookingId !== "string" || !Types.ObjectId.isValid(bookingId)) {
        response.status(400).send("Invalid booking reference");
        return;
      }

      const booking = await BookingService.get(bookingId);

      if (!booking) {
        response.status(404).send("Booking not found");
        return;
      }

      if (booking.status === "completed" || booking.status === "active") {
        response.status(409).send("Booking reservation already confirmed");
        return;
      }

      const paymentBy = booking.clientName;

      if (booking.status === "reservation") {
        response.send("success");
        return;
      }

      const paidAmount = Number(amount || 0);

      if (!paidAmount || paidAmount < 1 || !Number.isFinite(paidAmount)) {
        response.status(400).send("Invalid payment amount");
        return;
      }

      const systemDoc = await SystemService.get();
      const plannedBill = stayTotal({
        room: booking.room as any,
        nights: plannedNights(booking.arrivalDate, booking.departureDate),
        addOnsTotal: Number((booking as any).addOnsTotal) || 0,
      }).total;
      const configuredMinimum = Number(systemDoc?.paymentMin || 0);
      const minimumDeposit =
        configuredMinimum > 0 ? Math.min(configuredMinimum, plannedBill) : 0;
      if (minimumDeposit > 0 && paidAmount < minimumDeposit) {
        response
          .status(400)
          .send(
            `Minimum deposit is ₱${minimumDeposit}. Please pay at least the required deposit.`,
          );
        return;
      }

      const effectiveGateway =
        (booking as any).paymentGateway || gateway || "paymongo";
      const effectiveSessionId = (booking as any).paymentSessionId || sessionId;

      if (!effectiveSessionId) {
        response.status(402).json({
          status: "failed",
          message:
            "No payment session is on record for this booking. Please restart checkout.",
        });
        return;
      }

      // Server-side verification with the payment gateway. The success URL,
      // amount, and bookingId can all be forged by the client, so we confirm
      // the session actually exists, belongs to this booking, and was paid.
      let verified;
      try {
        verified = await verifyOnlinePayment(
          effectiveGateway,
          effectiveSessionId,
        );
      } catch (verifyError) {
        console.log(
          "Payment verification service error: " +
            (verifyError as Error).message,
        );
        response
          .status(502)
          .send("Unable to verify payment. Please contact the front desk.");
        return;
      }

      if (!verified.paid) {
        if (verified.status === "failed") {
          response.status(402).json({
            status: "failed",
            message:
              "Payment was not completed by the gateway. Please try again or contact the front desk.",
          });
        } else {
          response.status(402).json({
            status: "pending",
            message:
              "Your payment is still being confirmed. Please wait a moment and refresh this page.",
          });
        }
        return;
      }

      if (verified.bookingId !== booking._id.toString()) {
        response
          .status(403)
          .send("Payment session does not match this booking");
        return;
      }

      const expectedCents = Math.round(paidAmount * 100);
      if (verified.amountCents !== expectedCents) {
        response.status(403).send("Payment amount does not match session");
        return;
      }

      const claimedBooking =
        await BookingService.claimReservationPayment(bookingId);
      if (!claimedBooking) {
        response.send("success");
        return;
      }

      const roomId = booking.room?._id
        ? String(booking.room._id)
        : String(booking.room ?? "");
      await BookingService.reconcileRoomStatus(roomId);

      const generatedRef =
        refNumber ||
        (bookingId
          ? `RSV-${bookingId.slice(-6).toUpperCase()}`
          : `RSV-${Date.now().toString(36).toUpperCase()}`);

      const generatedFolio = generateFolio(bookingId);

      await BookingService.updatePaymentInfo(bookingId, {
        paymentAmount: paidAmount,
        paymentMethod: method || "Online Payment",
        paymentRefNumber: generatedRef,
      });

      await Paymentservice.create({
        amount: paidAmount,
        receivedBy: "online payment",
        date: localDateStr(),
        paymentBy: paymentBy,
        method: method || "Online Payment",
        refNumber: generatedRef,
        folio: generatedFolio,
      });

      await logAuditAction({
        action: "RESERVATION_PAID",
        details: `Online payment of ₱${paidAmount} received for reservation ${bookingId} via ${method || "Online Payment"} (Ref: ${generatedRef}, Folio: ${generatedFolio})`,
        actorName: paymentBy || "Guest",
        targetType: "booking",
        targetId: bookingId,
      });

      await notify({
        type: "payment",
        title: `Reservation Payment: ${paymentBy}`,
        message: `Online payment of ₱${paidAmount} received (Ref: ${generatedRef})`,
        severity: "success",
        link: "/pages/admin/payments",
        targetType: "booking",
        targetId: bookingId,
      });

      await notify({
        type: "reservation",
        title: `New Reservation: ${booking.clientName}`,
        message: `Payment verified — reservation confirmed for ${booking.arrivalDate} (${booking.arrivalTime})`,
        severity: "success",
        link: "/pages/admin/dashboard",
        targetType: "booking",
        targetId: bookingId,
      });

      // Email the guest their printable payment voucher so it can be reopened
      if (booking.clientEmail) {
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        const voucherUrl = `${frontendUrl}/guest/clientPayment?bookingId=${bookingId}&amount=${paidAmount}&gateway=${effectiveGateway}${
          booking.verificationCode ? `&code=${encodeURIComponent(booking.verificationCode)}` : ""
        }`;
        const roomCategory =
          booking.room && typeof booking.room === "object"
            ? (booking.room as { category?: string }).category
            : undefined;

        try {
          await sendReservationVoucherEmail({
            to: booking.clientEmail,
            guestName: booking.clientName,
            bookingId: String(bookingId),
            voucherUrl,
            amount: paidAmount,
            roomCategory,
            arrivalDate: booking.arrivalDate,
            arrivalTime: booking.arrivalTime,
            departureDate: booking.departureDate,
            refNumber: generatedRef,
            verificationCode: booking.verificationCode || undefined,
            totalAmount: plannedBill,
            addOns: ((booking as any).addOns || []).map((a: any) => ({
              name: a.name,
              quantity: a.quantity,
              subtotal: a.subtotal,
            })),
          });
        } catch (emailError) {
          console.log("Voucher email failed: " + (emailError as Error).message);
        }
      }

      response.send("success");
    } catch (error) {
      console.log("Failed to update booking: " + (error as Error).message);
      response.status(500).send("Failed to process payment");
    }
  };

  static reservationActivate = async (
    request: AuthRequest,
    response: Response,
  ) => {
    try {
      const { bookingId } = request.body;

      const booking = await BookingService.get(bookingId);

      if (!booking) {
        response.status(404).send("Booking not found");
        return;
      }

      await BookingService.updateStatus(bookingId, "active");

      await BookingService.recordModification(bookingId, {
        field: "status",
        from: booking.status,
        to: "active",
        note: "Reservation activated / guest checked in",
        changedBy: request.account?.name || "Staff",
        changedAt: new Date(),
      });

      const roomId = booking.room?._id
        ? String(booking.room._id)
        : String(booking.room ?? "");
      await BookingService.reconcileRoomStatus(roomId);

      await logAuditAction({
        action: "RESERVATION_ACTIVATED",
        details: `Reservation ${bookingId} activated for guest ${booking.clientName}`,
        actorName: request.account?.name || "Staff",
        actorRole: request.account?.type || "employee",
        targetType: "booking",
        targetId: bookingId,
      });

      await notify({
        type: "reservation",
        title: `Reservation Activated: ${booking.clientName}`,
        message: `Reservation activated and room held for the guest`,
        severity: "success",
        link: "/pages/admin/dashboard",
        targetType: "booking",
        targetId: bookingId,
      });

      response.send("success");
    } catch (error) {
      console.log("Failed to update booking: " + (error as Error).message);
      response
        .status(500)
        .send("Failed to update booking: " + (error as Error).message);
    }
  };

  static reservationCancel = async (
    request: AuthRequest,
    response: Response,
  ) => {
    try {
      const { bookingId, reason } = request.body;

      const booking = await BookingService.get(bookingId);

      if (!booking) {
        response.status(404).send("Booking not found");
        return;
      }

      const account = request.account;
      const canceledBy = account?.name || "Staff";

      await BookingService.updateStatus(bookingId, "canceled");
      await BookingService.update(bookingId, {
        clientName: booking.clientName,
        clientAddress: booking.clientAddress,
        type: booking.type,
        status: "canceled",
        arrivalDate: booking.arrivalDate,
        arrivalTime: booking.arrivalTime,
        room: booking.room?._id ? String(booking.room._id) : String(booking.room ?? ""),
      });
      await BookingsModel.findByIdAndUpdate(bookingId, {
        canceledAt: new Date(),
        canceledBy,
        cancellationReason: reason || "",
      });

      await BookingService.recordModification(bookingId, {
        field: "status",
        from: booking.status,
        to: "canceled",
        note: reason ? `Cancellation reason: ${reason}` : "",
        changedBy: canceledBy,
        changedAt: new Date(),
      });

      const roomId = booking.room?._id
        ? String(booking.room._id)
        : String(booking.room ?? "");
      await BookingService.reconcileRoomStatus(roomId);

      const amountPaid = Number(booking.paymentAmount) || 0;
      const refundEligible = booking.nonRefundable !== true;
      const refundNote =
        booking.nonRefundable === true
          ? amountPaid > 0
            ? ` Non-refundable reservation — the ₱${amountPaid} already paid is not refundable.`
            : " Non-refundable reservation — no refund is due."
          : "";

      await logAuditAction({
        action: "RESERVATION_CANCELED",
        details: `Reservation ${bookingId} canceled for guest ${booking.clientName} by ${canceledBy}.${reason ? ` Reason: ${reason}.` : ""}${refundNote}`,
        actorName: canceledBy,
        actorRole: account?.type || "employee",
        targetType: "booking",
        targetId: bookingId,
      });

      await notify({
        type: "reservation",
        title: `Reservation Canceled: ${booking.clientName}`,
        message: `Reservation ${bookingId} was canceled${reason ? ` — ${reason}` : ""}.${refundNote}`,
        severity: "warning",
        link: "/pages/admin/dashboard",
        targetType: "booking",
        targetId: bookingId,
      });

      response.send({
        success: true,
        nonRefundable: booking.nonRefundable === true,
        refundEligible,
        amountPaid,
      });
    } catch (error) {
      console.log("Failed to update booking: " + (error as Error).message);
      response
        .status(500)
        .send("Failed to update booking: " + (error as Error).message);
    }
  };

  static markNoShow = async (request: AuthRequest, response: Response) => {
    try {
      const { bookingId, reason } = request.body;

      const booking = await BookingService.get(bookingId);

      if (!booking) {
        response.status(404).send("Booking not found");
        return;
      }

      if (booking.status === "active") {
        response
          .status(400)
          .send("Guest is currently checked in and cannot be marked as no-show");
        return;
      }

      const account = request.account;
      const noShowBy = account?.name || "Staff";

      await BookingService.updateStatus(bookingId, "no-show");
      await BookingsModel.findByIdAndUpdate(bookingId, {
        noShowAt: new Date(),
        noShowBy,
        noShowReason: reason || "",
      });

      await BookingService.recordModification(bookingId, {
        field: "status",
        from: booking.status,
        to: "no-show",
        note: reason ? `No-show reason: ${reason}` : "",
        changedBy: noShowBy,
        changedAt: new Date(),
      });

      const roomId = booking.room?._id
        ? String(booking.room._id)
        : String(booking.room ?? "");
      await BookingService.reconcileRoomStatus(roomId);

      const wasPaid = Number(booking.paymentAmount) || 0;

      await logAuditAction({
        action: "RESERVATION_NO_SHOW",
        details: `Reservation ${bookingId} marked as no-show for guest ${booking.clientName} by ${noShowBy}.${reason ? ` Reason: ${reason}.` : ""}`,
        actorName: noShowBy,
        actorRole: account?.type || "employee",
        targetType: "booking",
        targetId: bookingId,
      });

      await notify({
        type: "reservation",
        title: `No-Show: ${booking.clientName}`,
        message: `Guest did not arrive — reservation marked as no-show${reason ? ` (${reason})` : ""}.`,
        severity: "warning",
        link: "/pages/admin/dashboard",
        targetType: "booking",
        targetId: bookingId,
      });

      response.send({
        success: true,
        wasPaid,
        nonRefundable: booking.nonRefundable === true,
      });
    } catch (error) {
      console.log("Failed to mark no-show: " + (error as Error).message);
      response
        .status(500)
        .send("Failed to mark no-show: " + (error as Error).message);
    }
  };

  static rescheduleBooking = async (
    request: AuthRequest,
    response: Response,
  ) => {
    const { bookingId, arrivalDate, arrivalTime, departureDate, note } =
      request.body || {};
    await BookingController.applyModification(
      request,
      response,
      String(bookingId || ""),
      {
        arrivalDate: text(arrivalDate),
        arrivalTime: text(arrivalTime),
        departureDate: text(departureDate),
        note: text(note),
        reason: "reschedule",
      },
      "RESERVATION_RESCHEDULED",
    );
  };

  static extendStay = async (request: AuthRequest, response: Response) => {
    const { bookingId, departureDate, note } = request.body || {};
    if (!text(departureDate)) {
      response.status(400).send("New departure date is required");
      return;
    }
    await BookingController.applyModification(
      request,
      response,
      String(bookingId || ""),
      {
        departureDate: text(departureDate),
        note: text(note) ? `Stay extended: ${text(note)}` : "Stay extended",
        reason: "extend_stay",
      },
      "STAY_EXTENDED",
    );
  };

  static modifyReservation = async (request: AuthRequest, response: Response) => {
    const body = request.body || {};
    const input: ModificationInput = {
      revision: body.revision !== undefined ? Number(body.revision) : undefined,
      roomId: text(body.roomId) || undefined,
      arrivalDate: text(body.arrivalDate) || undefined,
      arrivalTime: text(body.arrivalTime) || undefined,
      departureDate: body.departureDate !== undefined ? text(body.departureDate) : undefined,
      guests: body.guests !== undefined && body.guests !== "" ? Number(body.guests) : undefined,
      addOns: body.addOns,
      note: text(body.note),
    };
    if (input.revision !== undefined && !Number.isInteger(input.revision)) {
      response.status(400).json({ message: "Invalid revision" });
      return;
    }
    if (input.guests !== undefined && !Number.isInteger(input.guests)) {
      response.status(400).json({ message: "Guest count must be a whole number" });
      return;
    }
    await BookingController.applyModification(
      request,
      response,
      String(body.bookingId || ""),
      input,
      "RESERVATION_MODIFIED",
      body.preview === true,
    );
  };

  private static applyModification = async (
    request: AuthRequest,
    response: Response,
    bookingId: string,
    input: ModificationInput,
    auditAction: string,
    preview = false,
  ) => {
    const actor = {
      name: request.account?.name || "Staff",
      role: request.account?.type || "employee",
    };
    try {
      const result: any = await ReservationService.modify(bookingId, input, actor, { preview });
      if (preview) {
        response.send(result);
        return;
      }
      const booking = result.booking;
      const changeText = result.changes
        .map((c: any) => `${c.field}: ${c.from || "—"} → ${c.to || "—"}`)
        .join("; ");
      const paymentText =
        result.payment.difference !== 0
          ? ` Total ₱${result.payment.previousTotal} → ₱${result.payment.newTotal}; paid ₱${result.payment.amountPaid}; ${
              result.payment.balanceDue > 0
                ? `balance due ₱${result.payment.balanceDue}`
                : result.payment.creditDue > 0
                  ? `overpayment/credit ₱${result.payment.creditDue} (no refund issued automatically)`
                  : "fully settled"
            }.`
          : "";
      await logAuditAction({
        action: auditAction,
        details: `Booking ${bookingId} for ${booking.clientName} modified by ${actor.name}: ${changeText}.${paymentText}${input.note ? ` Note: ${input.note}` : ""}`,
        actorName: actor.name,
        actorRole: actor.role,
        targetType: "booking",
        targetId: bookingId,
      });
      await notify({
        type: "reservation",
        title: `Reservation Updated: ${booking.clientName}`,
        message: `${changeText}${paymentText}`.slice(0, 400),
        severity: result.payment.creditDue > 0 || result.payment.balanceDue > 0 ? "warning" : "info",
        link: "/pages/admin/dashboard",
        targetType: "booking",
        targetId: bookingId,
      });
      const { booking: _omit, ...summary } = result;
      response.send({ success: true, ...summary });
    } catch (error) {
      if (error instanceof ReservationError) {
        response.status(error.status).json({ message: error.message, ...(error.details || {}) });
        return;
      }
      console.log("Failed to modify booking: " + (error as Error).message);
      response.status(500).json({ message: "Failed to modify booking" });
    }
  };

  static roomAvailability = async (request: AuthRequest, response: Response) => {
    try {
      const arrivalDate = text(request.query.arrivalDate);
      const departureDate = text(request.query.departureDate);
      const excludeBookingId = text(request.query.excludeBookingId);
      if (!isValidDateStr(arrivalDate) || (departureDate && !isValidDateStr(departureDate))) {
        response.status(400).json({ message: "Valid arrivalDate (and optional departureDate) are required" });
        return;
      }
      if (excludeBookingId && !/^[a-f\d]{24}$/i.test(excludeBookingId)) {
        response.status(400).json({ message: "Invalid booking id" });
        return;
      }
      const [rooms, conflicts]: [any[], Map<string, any>] = await Promise.all([
        RoomModel.find({ deletedAt: null }).sort({ roomNumber: 1, category: 1 }).lean(),
        AvailabilityService.stayConflicts(arrivalDate, departureDate, excludeBookingId || undefined),
      ]);
      const result = rooms.map((room) => {
        const conflict = conflicts.get(String(room._id));
        const available = room.status !== "maintenance" && !conflict;
        return {
          _id: String(room._id),
          roomNumber: room.roomNumber || "",
          category: room.category,
          price: room.price,
          discount: room.discount || 0,
          nightlyRate: stayTotal({ room, nights: 1 }).nightlyRate,
          maxHead: room.maxHead,
          status: room.status,
          image: room.image || "",
          available,
          reason:
            room.status === "maintenance"
              ? "Under maintenance"
              : conflict
                ? `Booked ${conflict.arrivalDate} → ${conflict.departureDate || "open"}`
                : "",
        };
      });
      response.send(result);
    } catch (error) {
      console.log("Failed to check room availability: " + (error as Error).message);
      response.status(500).json({ message: "Failed to check room availability" });
    }
  };

  static reservationBoard = async (request: AuthRequest, response: Response) => {
    try {
      const system = await SystemService.get();
      const graceMinutes = resolveGraceMinutes(system);
      const now = new Date();
      const bookings: any[] = await BookingsModel.find({ status: "reservation" })
        .populate("room")
        .sort({ arrivalDate: 1, arrivalTime: 1 })
        .lean();
      const items = bookings.map((booking) => {
        const timeline = arrivalTimeline(booking, graceMinutes, now);
        const planned = stayTotal({
          room: booking.room,
          nights: plannedNights(booking.arrivalDate, booking.departureDate),
          addOnsTotal: Number(booking.addOnsTotal) || 0,
        });
        const { verificationCode, paymentSessionId, ...rest } = booking;
        return {
          ...rest,
          revision: Number(booking.revision) || 0,
          arrivalState: timeline?.state || "upcoming",
          arrivalAt: timeline?.arrivalAt?.toISOString() || null,
          graceEndsAt: timeline?.graceEndsAt?.toISOString() || null,
          plannedTotal: planned.total,
          balanceDue: Math.max(0, planned.total - (Number(booking.paymentAmount) || 0)),
          creditDue: Math.max(0, (Number(booking.paymentAmount) || 0) - planned.total),
        };
      });
      response.send({
        serverTime: now.toISOString(),
        timeZone: HOTEL_TIME_ZONE,
        graceMinutes,
        items,
      });
    } catch (error) {
      console.log("Failed to load reservation board: " + (error as Error).message);
      response.status(500).json({ message: "Failed to load reservations" });
    }
  };
}
