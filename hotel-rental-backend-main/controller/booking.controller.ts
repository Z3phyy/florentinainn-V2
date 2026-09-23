import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import {
  bookingInterfaceInput,
  BOOKING_CREATE_STATUSES,
  BOOKING_UPDATE_STATUSES,
  ONLINE_RESERVATION_STATUSES,
  isBookingType,
} from "../types/bookings.type";
import { BookingService } from "../services/booking.service";
import BookingsModel from "../model/bookings.model";
import { RoomService } from "../services/room.service";
import { Paymentservice } from "../services/payment.service";
import { SystemService } from "../services/system.service";
import { logAuditAction } from "../utils/auditLogger";
import { notify } from "../utils/notification";
import { verifyOnlinePayment } from "../utils/verifyPayment";
import { sendReservationVoucherEmail } from "../utils/sendEmail";
import { localDateStr } from "../utils/date";
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

function generateVerificationCode(bookingId: string): string {
  const suffix = bookingId.slice(-4).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${suffix}-${random}`;
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
  const [year, month, day] = arrivalDate.split("-").map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return 1;
  const arrival = new Date(year, month - 1, day);
  const now = new Date();
  const diffMs = now.getTime() - arrival.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  return Math.max(1, diffDays);
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

  static getBooking = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      const booking = await BookingService.get(id);
      if (!booking) {
        response.status(404).send("Booking not found");
        return;
      }
      const publicBooking = { ...booking };
      delete (publicBooking as Record<string, unknown>).clientAddress;
      delete (publicBooking as Record<string, unknown>).clientEmail;
      delete (publicBooking as Record<string, unknown>).clientPhone;
      response.send(publicBooking);
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
      const { key, clientName, clientEmail, clientPhone, clientAddress } =
        request.body;

      if (!key || typeof key !== "string") {
        response.status(400).send("Guest identifier is required");
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
        clientName:
          clientName !== undefined ? String(clientName).trim() : undefined,
        clientEmail:
          clientEmail !== undefined ? String(clientEmail).trim() : undefined,
        clientPhone:
          clientPhone !== undefined ? String(clientPhone).trim() : undefined,
        clientAddress:
          clientAddress !== undefined ? String(clientAddress).trim() : undefined,
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
    try {
      const { bookingId, verificationCode } = request.body;

      if (!bookingId || typeof bookingId !== "string") {
        response.status(400).send("Booking reference is required");
        return;
      }

      if (!verificationCode || typeof verificationCode !== "string") {
        response
          .status(400)
          .send("The verification code from your confirmation email is required");
        return;
      }

      const booking = await BookingService.get(bookingId);
      if (!booking) {
        response.status(404).send("Booking not found");
        return;
      }

      if (!booking.verificationCode) {
        response
          .status(403)
          .send(
            "This booking has no verification code on record. Contact the front desk to verify your reservation.",
          );
        return;
      }

      if (verificationCode.trim().toUpperCase() !== booking.verificationCode) {
        response.status(403).send("Incorrect verification code");
        return;
      }

      const roomLabel =
        booking.room && typeof booking.room === "object"
          ? `${(booking.room as { roomNumber?: string }).roomNumber ? `Room ${(booking.room as { roomNumber?: string }).roomNumber} · ` : ""}${(booking.room as { category?: string }).category || "Room"}`
          : "Room";

      response.send({
        status: booking.status,
        type: booking.type,
        clientName: booking.clientName,
        room: roomLabel,
        arrivalDate: booking.arrivalDate,
        arrivalTime: booking.arrivalTime,
        departureDate: booking.departureDate || "",
        guests: booking.guests,
        amountPaid: Number(booking.paymentAmount) || 0,
        totalAmount: Number(booking.totalAmount) || 0,
        paymentMethod: booking.paymentMethod || "",
        paymentRefNumber: booking.paymentRefNumber || "",
        nonRefundable: booking.nonRefundable === true,
        policyAcceptedAt: booking.policyAcceptedAt || null,
        noShowAt: booking.noShowAt || null,
        canceledAt: booking.canceledAt || null,
        cancellationReason: booking.cancellationReason || "",
        checkedOutAt: booking.checkedOutAt || null,
      });
    } catch (error) {
      console.log("Failed to look up booking: " + (error as Error).message);
      response.status(500).send("Failed to look up booking");
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

      const roomDoc = await RoomService.get(room);
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

      const booking = await BookingService.create(bookingData);
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

      let newRoomDoc: any = null;
      if (newRoomId !== currentRoomId) {
        const newRoom = await RoomService.get(newRoomId);
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
      const { _id } = request.body;

      const booking = await BookingService.get(_id);
      if (!booking) {
        response.status(404).send("Booking not found");
        return;
      }

      await BookingService.delete(_id);
      await BookingService.reconcileRoomStatus(
        booking.room?._id
          ? String(booking.room._id)
          : String(booking.room ?? ""),
      );

      await logAuditAction({
        action: "BOOKING_DELETED",
        details: `Deleted booking with ID ${_id}`,
        actorName: request.account?.name || "Staff",
        actorRole: request.account?.type || "employee",
        targetType: "booking",
        targetId: _id,
      });
      const bookings = await BookingService.getAll();
      response.send(bookings);
    } catch (error) {
      console.log("Failed to delete booking: " + (error as Error).message);
      response
        .status(500)
        .send("Failed to delete booking: " + (error as Error).message);
    }
  };

  static checkOut = async (request: AuthRequest, response: Response) => {
    try {
      const { bookingId, roomId, amount, paymentBy, method, refNumber } =
        request.body;

      const account = request.account;

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
        response.status(400).send("Booking not found");
        return;
      }

      const room = booking.room as any;
      const roomRef = roomId || String(room._id);

      const discount = room.discount || 0;
      const nightly = Math.round(room.price * (1 - discount / 100));
      const nights = nightsSince(booking.arrivalDate);
      const totalAmount = Math.round(nightly * nights);

      const previouslyPaid = Number(booking.paymentAmount) || 0;
      const accumulatedPaid = previouslyPaid + paidAmount;
      const remainingBalance = Math.max(0, totalAmount - accumulatedPaid);

      if (remainingBalance > 0) {
        response
          .status(400)
          .send(
            `Outstanding balance of ₱${remainingBalance} must be settled before checkout. Use partial payment to collect a deposit.`,
          );
        return;
      }

      await BookingService.updateStatus(bookingId, "completed");

      const departureDate = localDateStr();
      await BookingService.setDepartureDate(bookingId, departureDate);

      const wasScheduledDeparture =
        booking.departureDate && booking.departureDate > departureDate;
      await BookingsModel.findByIdAndUpdate(bookingId, {
        checkedOutAt: new Date(),
        earlyCheckout: wasScheduledDeparture === true,
      });

      await BookingService.recordModification(bookingId, {
        field: "status",
        from: booking.status,
        to: "completed",
        note: wasScheduledDeparture
          ? `Early checkout on ${departureDate} (scheduled departure ${booking.departureDate})`
          : `Checked out on ${departureDate}`,
        changedBy: account?.name || "Staff",
        changedAt: new Date(),
      });

      await BookingService.reconcileRoomStatus(roomRef);

      await RoomService.markHousekeepingDirty(
        roomRef,
        account?.name || "Staff",
        "Guest checked out — needs cleaning",
      );

      const generatedRef =
        refNumber ||
        (bookingId
          ? `CHK-${bookingId.slice(-6).toUpperCase()}`
          : `CHK-${Date.now().toString(36).toUpperCase()}`);

      const generatedFolio = generateFolio(bookingId);

      await BookingService.updatePaymentInfo(bookingId, {
        paymentAmount: Math.min(accumulatedPaid, totalAmount),
        paymentMethod: method || "Cash",
        paymentRefNumber: generatedRef,
        totalAmount,
      });

      await Paymentservice.create({
        amount: paidAmount,
        receivedBy: account?.name || "Staff",
        date: localDateStr(),
        paymentBy: paymentBy,
        method: method || "Cash",
        refNumber: generatedRef,
        folio: generatedFolio,
        balance: remainingBalance,
      });

      const balanceNote =
        remainingBalance > 0
          ? ` Remaining balance of ₱${remainingBalance} recorded on the folio.`
          : "";

      await logAuditAction({
        action:
          remainingBalance > 0 ? "GUEST_CHECKOUT_PARTIAL" : "GUEST_CHECKOUT",
        details: `Guest ${paymentBy} checked out. Total ${totalAmount}₱, paid now ${paidAmount}₱ via ${method || "Cash"} (Ref: ${generatedRef}, Folio: ${generatedFolio}). Remaining balance ${remainingBalance}₱.`,
        actorName: account?.name || "Staff",
        targetType: "booking",
        targetId: bookingId,
      });

      await notify({
        type: "payment",
        title: `Checkout & Payment: ${paymentBy}`,
        message: `Payment of ₱${paidAmount} received via ${method || "Cash"} (Ref: ${generatedRef}, Folio: ${generatedFolio}).${balanceNote}`,
        severity: remainingBalance > 0 ? "warning" : "success",
        link: "/pages/admin/payments",
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
      const discount = room.discount || 0;
      const nightly = Math.round(room.price * (1 - discount / 100));
      const totalAmount = Math.round(
        nightly * nightsSince(booking.arrivalDate),
      );

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

      await BookingService.updatePaymentInfo(bookingId, {
        paymentAmount: newPaidAmount,
        paymentMethod: method || "Cash",
        paymentRefNumber: generatedRef,
        totalAmount,
      });

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

      const roomDoc = await RoomService.get(room);
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

      const duplicate = await BookingService.findRecentDuplicate({
        room,
        clientName,
        arrivalDate,
      });
      if (duplicate) {
        response.send({ bookingId: duplicate._id, duplicate: true });
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

      const booking = await BookingService.create(bookingData);
      const verificationCode = generateVerificationCode(String(booking._id));
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
        nonRefundable: true,
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
        paymentBy,
        method,
        refNumber,
        gateway,
        sessionId,
      } = request.body;

      const booking = await BookingService.get(bookingId);

      if (!booking) {
        response.status(404).send("Booking not found");
        return;
      }

      if (booking.status === "completed" || booking.status === "active") {
        response.status(409).send("Booking reservation already confirmed");
        return;
      }

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
      const minimumDeposit = Number(systemDoc?.paymentMin || 0);
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
        const voucherUrl = `${frontendUrl}/guest/clientPayment?bookingId=${bookingId}&amount=${paidAmount}&gateway=${effectiveGateway}`;
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
    try {
      const { bookingId, arrivalDate, arrivalTime, departureDate, note } =
        request.body;

      const booking = await BookingService.get(bookingId);
      if (!booking) {
        response.status(404).send("Booking not found");
        return;
      }

      const validationError = validateArrivalDateTime(
        text(arrivalDate),
        text(arrivalTime),
        text(departureDate),
        true,
      );
      if (validationError) {
        response.status(400).send(validationError);
        return;
      }

      const account = request.account;
      const changedBy = account?.name || "Staff";

      await BookingService.update(bookingId, {
        clientName: booking.clientName,
        clientAddress: booking.clientAddress,
        type: booking.type,
        status: booking.status,
        arrivalDate: text(arrivalDate),
        arrivalTime: text(arrivalTime),
        departureDate: text(departureDate),
        wasRescheduled: true,
        room: booking.room?._id ? String(booking.room._id) : String(booking.room ?? ""),
      });

      const history: any[] = [];
      if (booking.arrivalDate !== text(arrivalDate)) {
        history.push({
          field: "arrivalDate",
          from: booking.arrivalDate,
          to: text(arrivalDate),
          changedBy,
          changedAt: new Date(),
        });
      }
      if (booking.arrivalTime !== text(arrivalTime)) {
        history.push({
          field: "arrivalTime",
          from: booking.arrivalTime,
          to: text(arrivalTime),
          changedBy,
          changedAt: new Date(),
        });
      }
      if ((booking.departureDate || "") !== text(departureDate)) {
        history.push({
          field: "departureDate",
          from: booking.departureDate || "",
          to: text(departureDate),
          changedBy,
          changedAt: new Date(),
        });
      }
      for (const entry of history) {
        await BookingService.recordModification(bookingId, {
          ...entry,
          note: note || "",
        });
      }

      const roomId = booking.room?._id
        ? String(booking.room._id)
        : String(booking.room ?? "");
      await BookingService.reconcileRoomStatus(roomId);

      await logAuditAction({
        action: "RESERVATION_RESCHEDULED",
        details: `Reservation ${bookingId} rescheduled by ${changedBy}: arrival ${booking.arrivalDate} (${booking.arrivalTime}) → ${text(arrivalDate)} (${text(arrivalTime)})${note ? ` · ${note}` : ""}`,
        actorName: changedBy,
        actorRole: account?.type || "employee",
        targetType: "booking",
        targetId: bookingId,
      });

      await notify({
        type: "reservation",
        title: `Reservation Rescheduled: ${booking.clientName}`,
        message: `New arrival ${text(arrivalDate)} (${text(arrivalTime)})`,
        severity: "info",
        link: "/pages/admin/dashboard",
        targetType: "booking",
        targetId: bookingId,
      });

      response.send({ success: true });
    } catch (error) {
      console.log("Failed to reschedule booking: " + (error as Error).message);
      response
        .status(500)
        .send("Failed to reschedule booking: " + (error as Error).message);
    }
  };

  static extendStay = async (request: AuthRequest, response: Response) => {
    try {
      const { bookingId, departureDate, note } = request.body;

      const booking = await BookingService.get(bookingId);
      if (!booking) {
        response.status(404).send("Booking not found");
        return;
      }

      const newDeparture = text(departureDate);
      if (!newDeparture) {
        response.status(400).send("New departure date is required");
        return;
      }

      const error = validateArrivalDateTime(
        booking.arrivalDate,
        booking.arrivalTime,
        newDeparture,
        true,
      );
      if (error) {
        response.status(400).send(error);
        return;
      }

      const account = request.account;
      const changedBy = account?.name || "Staff";

      await BookingService.update(bookingId, {
        clientName: booking.clientName,
        clientAddress: booking.clientAddress,
        type: booking.type,
        status: booking.status,
        arrivalDate: booking.arrivalDate,
        arrivalTime: booking.arrivalTime,
        departureDate: newDeparture,
        room: booking.room?._id ? String(booking.room._id) : String(booking.room ?? ""),
      });

      await BookingService.recordModification(bookingId, {
        field: "departureDate",
        from: booking.departureDate || "",
        to: newDeparture,
        note: note ? `Stay extended: ${note}` : "Stay extended",
        changedBy,
        changedAt: new Date(),
      });

      await logAuditAction({
        action: "STAY_EXTENDED",
        details: `Booking ${bookingId} extended by ${changedBy}: departure ${booking.departureDate || "-"} → ${newDeparture}${note ? ` · ${note}` : ""}`,
        actorName: changedBy,
        actorRole: account?.type || "employee",
        targetType: "booking",
        targetId: bookingId,
      });

      response.send({ success: true });
    } catch (error) {
      console.log("Failed to extend stay: " + (error as Error).message);
      response
        .status(500)
        .send("Failed to extend stay: " + (error as Error).message);
    }
  };
}
