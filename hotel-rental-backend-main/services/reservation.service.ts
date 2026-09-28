import { Types } from "mongoose";
import BookingsModel from "../model/bookings.model";
import RoomModel from "../model/room.model";
import { AvailabilityService } from "./availability.service";
import { AddOnError, AddOnService, parseAddOnSelection } from "./addOn.service";
import { BookingService } from "./booking.service";
import { RoomService } from "./room.service";
import { runAtomic } from "../utils/transaction";
import { plannedNights, repriceAddOns, stayTotal, sumAddOns, PricedAddOn } from "../utils/pricing";
import { validateGuestCount, validateStayDates } from "../utils/bookingValidation";
import { hotelDateStr } from "../utils/hotelTime";

export class ReservationError extends Error {
  status: number;
  details?: Record<string, unknown>;
  constructor(message: string, status = 400, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const MODIFIABLE_STATUSES = ["unpaid", "reservation", "active"];

export interface ModificationInput {
  revision?: number;
  roomId?: string;
  arrivalDate?: string;
  arrivalTime?: string;
  departureDate?: string;
  guests?: number;
  addOns?: unknown;
  note?: string;
  reason?: string;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const idOf = (value: any) => (value?._id ? String(value._id) : String(value ?? ""));

function roomLabel(room: any) {
  if (!room) return "—";
  return room.roomNumber ? `Room ${room.roomNumber} (${room.category || "Room"})` : room.category || "Room";
}

function describeAddOns(items: { name: string; quantity: number }[]) {
  return items.length === 0 ? "none" : items.map((i) => `${i.quantity}× ${i.name}`).join(", ");
}

export class ReservationService {
  static async modify(
    bookingId: string,
    input: ModificationInput,
    actor: { name: string; role: string },
    options: { preview?: boolean } = {},
  ) {
    if (!Types.ObjectId.isValid(bookingId)) {
      throw new ReservationError("A valid booking id is required.");
    }

    const booking: any = await BookingsModel.findById(bookingId).populate("room").lean();
    if (!booking) throw new ReservationError("Booking not found", 404);

    if (!MODIFIABLE_STATUSES.includes(booking.status)) {
      throw new ReservationError(
        `This booking is ${booking.status} and can no longer be modified.`,
        409,
      );
    }

    const currentRevision = Number(booking.revision) || 0;
    if (input.revision !== undefined && Number(input.revision) !== currentRevision) {
      throw new ReservationError(
        "This reservation was changed by someone else. Refresh and review the latest details before modifying it.",
        409,
      );
    }

    const currentRoom = booking.room;
    const currentRoomId = idOf(currentRoom);

    const target = {
      roomId: str(input.roomId) || currentRoomId,
      arrivalDate: str(input.arrivalDate) || booking.arrivalDate,
      arrivalTime: str(input.arrivalTime) || booking.arrivalTime,
      departureDate: input.departureDate !== undefined ? str(input.departureDate) : booking.departureDate || "",
      guests:
        input.guests !== undefined && input.guests !== null && String(input.guests) !== ""
          ? Number(input.guests)
          : Number(booking.guests) || 1,
    };

    if (!Types.ObjectId.isValid(target.roomId)) {
      throw new ReservationError("Please select a valid room.");
    }

    const arrivalChanged =
      target.arrivalDate !== booking.arrivalDate || target.arrivalTime !== booking.arrivalTime;
    const departureChanged = target.departureDate !== (booking.departureDate || "");
    const roomChanged = target.roomId !== currentRoomId;
    const guestsChanged = target.guests !== (Number(booking.guests) || 1);

    if (booking.status === "active" && arrivalChanged) {
      throw new ReservationError("The guest has already checked in, so the arrival date and time cannot change.");
    }

    const dateError = validateStayDates({
      arrivalDate: target.arrivalDate,
      arrivalTime: target.arrivalTime,
      departureDate: target.departureDate,
      requireDeparture: true,
      allowPastArrival: !arrivalChanged,
    });
    if (dateError) throw new ReservationError(dateError);

    if (booking.status === "active" && target.departureDate < hotelDateStr()) {
      throw new ReservationError("The check-out date cannot be earlier than today for an in-house guest.");
    }

    const targetRoom: any = roomChanged ? await RoomModel.findById(target.roomId).lean() : currentRoom;
    if (!targetRoom) throw new ReservationError("The selected room no longer exists.", 404);
    if (roomChanged && targetRoom.status === "maintenance") {
      throw new ReservationError(
        `${roomLabel(targetRoom)} is under maintenance and cannot be assigned.`,
        409,
      );
    }

    const guestError = validateGuestCount(target.guests, targetRoom.maxHead);
    if (guestError) throw new ReservationError(guestError);

    const conflicts = await AvailabilityService.roomConflicts(
      target.roomId,
      target.arrivalDate,
      target.departureDate,
      bookingId,
    );
    if (conflicts.length > 0) {
      const first: any = conflicts[0];
      throw new ReservationError(
        `${roomLabel(targetRoom)} is already booked from ${first.arrivalDate} to ${first.departureDate || "open-ended"} and is not available for these dates.`,
        409,
        { conflicts: conflicts.map((c: any) => ({ arrivalDate: c.arrivalDate, departureDate: c.departureDate })) },
      );
    }

    const nights = plannedNights(target.arrivalDate, target.departureDate);
    const existingAddOns: PricedAddOn[] = (booking.addOns || []).map((item: any) => ({
      addOn: String(item.addOn),
      name: item.name,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      pricingUnit: item.pricingUnit,
      nights: item.nights,
      subtotal: item.subtotal,
    }));

    let newAddOns: PricedAddOn[] = existingAddOns;
    let addOnsChanged = false;
    let addOnIdsToLock: string[] = [];

    try {
      if (input.addOns !== undefined) {
        const selection = parseAddOnSelection(input.addOns);
        const priced = await AddOnService.price(
          selection,
          { arrivalDate: target.arrivalDate, departureDate: target.departureDate },
          { excludeBookingId: bookingId, allowInactiveIds: existingAddOns.map((a) => a.addOn) },
        );
        newAddOns = priced.items;
        addOnIdsToLock = selection.map((s) => s.addOnId);
        const before = JSON.stringify(existingAddOns.map((a) => [a.addOn, a.quantity]).sort());
        const after = JSON.stringify(newAddOns.map((a) => [a.addOn, a.quantity]).sort());
        addOnsChanged = before !== after;
      }
      if (!addOnsChanged && (arrivalChanged || departureChanged) && existingAddOns.length > 0) {
        await AddOnService.price(
          existingAddOns.map((a) => ({ addOnId: a.addOn, quantity: a.quantity })),
          { arrivalDate: target.arrivalDate, departureDate: target.departureDate },
          { excludeBookingId: bookingId, allowInactiveIds: existingAddOns.map((a) => a.addOn) },
        );
        newAddOns = repriceAddOns(existingAddOns, nights);
        addOnIdsToLock = existingAddOns.map((a) => a.addOn);
      } else if (!addOnsChanged && input.addOns !== undefined) {
        newAddOns = repriceAddOns(existingAddOns, nights);
      }
    } catch (error) {
      if (error instanceof AddOnError) throw new ReservationError(error.message, error.status);
      throw error;
    }

    const newAddOnsTotal = sumAddOns(newAddOns);
    const previous = stayTotal({
      room: currentRoom,
      nights: plannedNights(booking.arrivalDate, booking.departureDate),
      addOnsTotal: Number(booking.addOnsTotal) || sumAddOns(existingAddOns),
    });
    const next = stayTotal({ room: targetRoom, nights, addOnsTotal: newAddOnsTotal });
    const amountPaid = Number(booking.paymentAmount) || 0;
    const payment = {
      previousTotal: previous.total,
      newTotal: next.total,
      difference: next.total - previous.total,
      amountPaid,
      balanceDue: Math.max(0, next.total - amountPaid),
      creditDue: Math.max(0, amountPaid - next.total),
    };

    const changedAt = new Date();
    const note = str(input.note).slice(0, 300);
    const history: Record<string, unknown>[] = [];
    const push = (field: string, from: string, to: string) =>
      history.push({ field, from, to, note, changedBy: actor.name, changedAt });

    if (roomChanged) push("room", roomLabel(currentRoom), roomLabel(targetRoom));
    if (target.arrivalDate !== booking.arrivalDate) push("arrivalDate", booking.arrivalDate, target.arrivalDate);
    if (target.arrivalTime !== booking.arrivalTime) push("arrivalTime", booking.arrivalTime, target.arrivalTime);
    if (departureChanged) push("departureDate", booking.departureDate || "", target.departureDate);
    if (guestsChanged) push("guests", String(booking.guests || 1), String(target.guests));
    if (addOnsChanged) push("addOns", describeAddOns(existingAddOns), describeAddOns(newAddOns));
    if (payment.difference !== 0) {
      push("totalAmount", String(payment.previousTotal), String(payment.newTotal));
    }

    const summary = {
      bookingId,
      revision: currentRevision,
      changes: history.map((h) => ({ field: h.field, from: h.from, to: h.to })),
      room: { _id: target.roomId, label: roomLabel(targetRoom), nightlyRate: next.nightlyRate },
      nights,
      roomSubtotal: next.roomSubtotal,
      addOns: newAddOns,
      addOnsTotal: newAddOnsTotal,
      payment,
    };

    if (history.length === 0) {
      throw new ReservationError("No changes to save.", 400, { summary });
    }

    if (options.preview) return { preview: true, ...summary };

    const reason = str(input.reason) || (roomChanged ? "room_change" : "modification");
    const set: Record<string, unknown> = {
      room: new Types.ObjectId(target.roomId),
      arrivalDate: target.arrivalDate,
      arrivalTime: target.arrivalTime,
      departureDate: target.departureDate,
      guests: target.guests,
      addOns: newAddOns.map((a) => ({ ...a, addOn: new Types.ObjectId(a.addOn) })),
      addOnsTotal: newAddOnsTotal,
      totalAmount: next.total,
    };
    if (arrivalChanged || departureChanged) set.wasRescheduled = true;
    if (arrivalChanged) {
      set.arrivalNotified = false;
      set.graceNotified = false;
      set.overdueNotified = false;
    }

    const updated = await runAtomic(async (session) => {
      if (session) {
        await RoomModel.updateOne({ _id: target.roomId }, { $inc: { bookingVersion: 1 } }, { session });
        await AddOnService.lock(addOnIdsToLock, session);
        const recheck = await AvailabilityService.roomConflicts(
          target.roomId,
          target.arrivalDate,
          target.departureDate,
          bookingId,
          session,
        );
        if (recheck.length > 0) {
          throw new ReservationError(`${roomLabel(targetRoom)} was just booked by another reservation. Choose a different room.`, 409);
        }
        if (addOnIdsToLock.length > 0) {
          try {
            await AddOnService.price(
              newAddOns.map((a) => ({ addOnId: a.addOn, quantity: a.quantity })),
              { arrivalDate: target.arrivalDate, departureDate: target.departureDate },
              { excludeBookingId: bookingId, session, allowInactiveIds: existingAddOns.map((a) => a.addOn) },
            );
          } catch (error) {
            if (error instanceof AddOnError) throw new ReservationError(error.message, error.status);
            throw error;
          }
        }
      }

      const push: Record<string, unknown> = { modificationHistory: { $each: history } };
      if (payment.difference !== 0) {
        push.billingAdjustments = {
          reason,
          ...payment,
          note,
          changedBy: actor.name,
          changedAt,
        };
      }

      return BookingsModel.findOneAndUpdate(
        {
          _id: bookingId,
          status: booking.status,
          revision: currentRevision === 0 ? { $in: [0, null] } : currentRevision,
        },
        { $set: set, $inc: { revision: 1 }, $push: push },
        { new: true, session },
      );
    });

    if (!updated) {
      throw new ReservationError(
        "This reservation was changed by another request. Refresh and try again.",
        409,
      );
    }

    await BookingService.reconcileRoomStatus(currentRoomId);
    if (roomChanged) {
      await BookingService.reconcileRoomStatus(target.roomId);
      if (booking.status === "active") {
        await RoomService.markHousekeepingDirty(
          currentRoomId,
          actor.name,
          `Guest moved to ${roomLabel(targetRoom)} — needs cleaning`,
        );
      }
    }

    return {
      ...summary,
      revision: Number(updated.revision) || currentRevision + 1,
      booking: updated,
      previousRoomLabel: roomLabel(currentRoom),
    };
  }
}
