import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { bookingInterfaceInput, BOOKING_CREATE_STATUSES, BOOKING_UPDATE_STATUSES, ONLINE_RESERVATION_STATUSES, isBookingType } from "../types/bookings.type";
import { BookingService } from "../services/booking.service";
import { RoomService } from "../services/room.service";
import { Paymentservice } from "../services/payment.service";
import { SystemService } from "../services/system.service";
import { logAuditAction } from "../utils/auditLogger";
import { notify } from "../utils/notification";
import { verifyOnlinePayment } from "../utils/verifyPayment";
// import { sendReservationVoucherEmail } from "../utils/sendEmail";
import { localDateStr } from "../utils/date";


// Helper to generate a human-readable folio number for payment records
function generateFolio(bookingId?: string): string {
  const today = localDateStr().replace(/-/g, "");
  const code = bookingId
    ? bookingId.slice(-6).toUpperCase()
    : Math.random().toString(36).slice(2, 8).toUpperCase();
  return `FOL-${today}-${code}`;
}

// Helper to validate arrival date & time (cannot be in the past)
function validateArrivalDateTime(arrivalDate: string, arrivalTime: string): string | null {
  if (!arrivalDate || !arrivalTime) {
    return "Arrival date and arrival time are required";
  }

  const [year, month, day] = arrivalDate.split("-").map(Number);
  const [hours, minutes] = arrivalTime.split(":").map(Number);

  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
    return "Invalid arrival date or time format";
  }

  const arrivalDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const now = new Date();
  
  // 5-minute grace window for clock drift / submission latency
  const graceWindowMs = 5 * 60 * 1000;
  if (arrivalDateTime.getTime() < now.getTime() - graceWindowMs) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const arrivalDay = new Date(year, month - 1, day, 0, 0, 0, 0);

    if (arrivalDay < today) {
      return "Arrival date cannot be in the past";
    }
    return "Arrival time cannot be in the past for today's arrival";
  }

  return null;
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
      const bookings = await BookingService.getAll()
      response.send(bookings)
    } catch (error) {
      console.log("Failed to get bookings: " + (error as Error).message)
      response.status(500).send("Failed to get bookings: " + (error as Error).message)
    }
  }

  static getBooking = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params
      const booking = await BookingService.get(id)
      if (!booking) {
        response.status(404).send("Booking not found")
        return
      }
      response.send(booking)
    } catch (error) {
      console.log("Failed to get booking: " + (error as Error).message)
      response.status(500).send("Failed to get booking")
    }
  }

  static createBooking = async (request: AuthRequest, response: Response) => {
    try {
      const { clientName, clientAddress, clientEmail, clientPhone, type, status, arrivalDate, arrivalTime, room } = request.body;
      console.log(request.body)

      // Validate arrival date & time
      const validationError = validateArrivalDateTime(arrivalDate, arrivalTime);
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

      const bookingData: bookingInterfaceInput = {
        clientName,
        clientAddress,
        clientEmail,
        clientPhone,
        type,
        status,
        arrivalDate,
        arrivalTime,
        room,
      };

      const roomDoc = await RoomService.get(room);
      if (!roomDoc) {
        response.status(404).send("Room not found");
        return;
      }
      if (roomDoc.status !== "available") {
        response.status(409).send(`Room is currently ${roomDoc.status}. Only available rooms can be assigned.`);
        return;
      }

      const booking = await BookingService.create(bookingData);
      await BookingService.reconcileRoomStatus(room);

      await logAuditAction({
        action: "WALK_IN_CHECKIN",
        details: `Walk-in check-in for guest ${clientName} on ${arrivalDate} (${arrivalTime})`,
        targetType: "booking",
        targetId: booking._id ? String(booking._id) : undefined,
      });

      await notify({
        type: "reservation",
        title: `Walk-in Check-in: ${clientName}`,
        message: `Guest checked in for ${arrivalDate} (${arrivalTime})`,
        severity: "info",
        link: "/pages/admin/dashboard",
        targetType: "booking",
        targetId: booking._id ? String(booking._id) : undefined,
      });

      const bookings = await BookingService.getAll();
      response.send(bookings);
    } catch (error) {
      console.log("Failed to create booking: " + (error as Error).message);
      response.status(500).send("Failed to create booking: " + (error as Error).message);
    }
  };

  static updateBooking = async (request: AuthRequest, response: Response) => {
    try {
      const { _id, clientName, clientAddress, clientEmail, clientPhone, type, status, arrivalDate, arrivalTime, room } = request.body

      const existing = await BookingService.get(_id)
      if (!existing) {
        response.status(404).send("Booking not found")
        return
      }

      if (!isBookingType(type)) {
        response.status(400).send("Invalid booking type")
        return
      }

      if (!BOOKING_UPDATE_STATUSES.includes(status as any)) {
        response.status(400).send("Invalid booking status")
        return
      }

      const validationError = validateArrivalDateTime(arrivalDate, arrivalTime);
      if (validationError) {
        response.status(400).send(validationError);
        return;
      }

      const currentRoomId = existing.room?._id ? String(existing.room._id) : String(existing.room ?? "")
      const newRoomId = room || currentRoomId

      if (newRoomId !== currentRoomId) {
        const newRoom = await RoomService.get(newRoomId)
        if (!newRoom) {
          response.status(404).send("Room not found")
          return
        }
        if (newRoom.status !== "available") {
          response.status(409).send(`Room is currently ${newRoom.status}. Only available rooms can be assigned.`)
          return
        }
      }

      await BookingService.update(_id, { clientName, clientAddress, clientEmail, clientPhone, type, status, arrivalDate, arrivalTime, room: newRoomId })

      // Reconcile room status so moved/freed rooms reflect their remaining bookings.
      await BookingService.reconcileRoomStatus(currentRoomId)
      if (newRoomId !== currentRoomId) {
        await BookingService.reconcileRoomStatus(newRoomId)
      }

      const bookings = await BookingService.getAll()
      response.send(bookings)
    } catch (error) {
      console.log("Failed to update booking: " + (error as Error).message)
      response.status(500).send("Failed to update booking: " + (error as Error).message)
    }
  }

  static deleteBooking = async (request: AuthRequest, response: Response) => {
    try {
      const { _id } = request.body

      const booking = await BookingService.get(_id)
      if (!booking) {
        response.status(404).send("Booking not found")
        return
      }

      await BookingService.delete(_id)
      await BookingService.reconcileRoomStatus(booking.room?._id ? String(booking.room._id) : String(booking.room ?? ""))

      await logAuditAction({
        action: "BOOKING_DELETED",
        details: `Deleted booking with ID ${_id}`,
        targetType: "booking",
        targetId: _id,
      });
      const bookings = await BookingService.getAll()
      response.send(bookings)
    } catch (error) {
      console.log("Failed to delete booking: " + (error as Error).message)
      response.status(500).send("Failed to delete booking: " + (error as Error).message)
    }
  }



  static checkOut = async (request: AuthRequest, response: Response) => {
    try {
      const { bookingId, roomId, amount, paymentBy, method, refNumber } = request.body

      const account = request.account

      const paidAmount = Number(amount || 0)

      if (Number.isNaN(paidAmount) || paidAmount < 0 || !Number.isFinite(paidAmount)) {
        response.status(400).send("Invalid payment amount")
        return
      }

      const booking = await BookingService.get(bookingId)

      if (!booking) {
        response.status(400).send("Booking not found")
        return
      }

      const room = booking.room as any
      const roomRef = roomId || String(room._id)

      const discount = room.discount || 0
      const nightly = Math.round(room.price * (1 - discount / 100))
      const nights = nightsSince(booking.arrivalDate)
      const totalAmount = Math.round(nightly * nights)

      const previouslyPaid = Number(booking.paymentAmount) || 0
      const accumulatedPaid = previouslyPaid + paidAmount
      const remainingBalance = Math.max(0, totalAmount - accumulatedPaid)

      if (remainingBalance > 0) {
        response.status(400).send(`Outstanding balance of ₱${remainingBalance} must be settled before checkout. Use partial payment to collect a deposit.`)
        return
      }

      await BookingService.updateStatus(bookingId, "completed")

      await BookingService.reconcileRoomStatus(roomRef)

      const generatedRef = refNumber || (bookingId ? `CHK-${bookingId.slice(-6).toUpperCase()}` : `CHK-${Date.now().toString(36).toUpperCase()}`)

      const generatedFolio = generateFolio(bookingId)

      await BookingService.updatePaymentInfo(bookingId, {
        paymentAmount: Math.min(accumulatedPaid, totalAmount),
        paymentMethod: method || "Cash",
        paymentRefNumber: generatedRef,
        totalAmount,
      })

      await Paymentservice.create({
        amount: paidAmount,
        receivedBy: account?.name || "Staff",
        date: localDateStr(),
        paymentBy: paymentBy,
        method: method || "Cash",
        refNumber: generatedRef,
        folio: generatedFolio,
        balance: remainingBalance,
      })

      const balanceNote = remainingBalance > 0 ? ` Remaining balance of ₱${remainingBalance} recorded on the folio.` : ""

      await logAuditAction({
        action: remainingBalance > 0 ? "GUEST_CHECKOUT_PARTIAL" : "GUEST_CHECKOUT",
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

      response.send("success")

    } catch (error) {
      console.log("Failed to update booking: " + (error as Error).message)
      response.status(500).send("Failed to update booking: " + (error as Error).message)
    }
  }


  static partialPayment = async (request: AuthRequest, response: Response) => {
    try {
      const { bookingId, amount, paymentBy, method, refNumber } = request.body

      const account = request.account

      const paidAmount = Number(amount || 0)

      if (Number.isNaN(paidAmount) || paidAmount <= 0 || !Number.isFinite(paidAmount)) {
        response.status(400).send("Invalid payment amount")
        return
      }

      const booking = await BookingService.get(bookingId)

      if (!booking) {
        response.status(400).send("Booking not found")
        return
      }

      if (booking.status !== "active") {
        response.status(400).send("Only in-house guests can make partial payments")
        return
      }

      const room = booking.room as any
      const discount = room.discount || 0
      const nightly = Math.round(room.price * (1 - discount / 100))
      const totalAmount = Math.round(nightly * nightsSince(booking.arrivalDate))

      const alreadyPaid = Number(booking.paymentAmount) || 0
      const remainingBalance = Math.max(0, totalAmount - alreadyPaid)

      if (paidAmount > remainingBalance) {
        response.status(400).send(`Amount exceeds the remaining balance of ₱${remainingBalance}`)
        return
      }

      const newPaidAmount = alreadyPaid + paidAmount
      const newBalance = Math.max(0, totalAmount - newPaidAmount)

      const generatedRef = refNumber || (bookingId ? `PPY-${bookingId.slice(-6).toUpperCase()}` : `PPY-${Date.now().toString(36).toUpperCase()}`)

      const generatedFolio = generateFolio(bookingId)

      await BookingService.updatePaymentInfo(bookingId, {
        paymentAmount: newPaidAmount,
        paymentMethod: method || "Cash",
        paymentRefNumber: generatedRef,
        totalAmount,
      })

      await Paymentservice.create({
        amount: paidAmount,
        receivedBy: account?.name || "Staff",
        date: localDateStr(),
        paymentBy: paymentBy,
        method: method || "Cash",
        refNumber: generatedRef,
        folio: generatedFolio,
        balance: newBalance,
      })

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

      response.send({ success: true, balance: newBalance, folio: generatedFolio })

    } catch (error) {
      console.log("Failed to process partial payment: " + (error as Error).message)
      response.status(500).send("Failed to process partial payment")
    }
  }


  static reservation = async (request: AuthRequest, response: Response) => {
    try {
      const { clientName, clientAddress, clientEmail, clientPhone, type, status, arrivalDate, arrivalTime, room } = request.body;

      // Validate arrival date & time
      const validationError = validateArrivalDateTime(arrivalDate, arrivalTime);
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

      const bookingData: bookingInterfaceInput = {
        clientName,
        clientAddress,
        clientEmail,
        clientPhone,
        type,
        status: status || "unpaid",
        arrivalDate,
        arrivalTime,
        room,
      };

      const booking = await BookingService.create(bookingData);

      await logAuditAction({
        action: "ONLINE_RESERVATION",
        details: `New online reservation created for guest ${clientName} for arrival on ${arrivalDate}`,
        targetType: "booking",
        targetId: String(booking._id),
      });

      // No notification here — the admin is only alerted once the guest's
      // payment is actually processed (see reservationPayment).

      response.send({ bookingId: booking._id });
    } catch (error) {
      console.log("Failed to create reservation: " + (error as Error).message);
      response.status(500).send("Failed to create reservation");
    }
  };


  static reservationPayment = async (request: AuthRequest, response: Response) => {
    try {
      const { bookingId, amount, paymentBy, method, refNumber, gateway, sessionId } = request.body

      const booking = await BookingService.get(bookingId)

      if (!booking) {
        response.status(500).send("no booking")
        return
      }

      if (booking.status === "completed" || booking.status === "active") {
        response.status(409).send("Booking reservation already confirmed")
        return
      }

      if (booking.status === "reservation") {
        response.send("success")
        return
      }

      const paidAmount = Number(amount || 0)

      if (!paidAmount || paidAmount < 1 || !Number.isFinite(paidAmount)) {
        response.status(400).send("Invalid payment amount")
        return
      }

      const systemDoc = await SystemService.get();
      const minimumDeposit = Number(systemDoc?.paymentMin || 0);
      if (minimumDeposit > 0 && paidAmount < minimumDeposit) {
        response.status(400).send(`Minimum deposit is ₱${minimumDeposit}. Please pay at least the required deposit.`)
        return
      }

      if (!sessionId) {
        response.status(402).send("Payment verification required")
        return
      }

      // Server-side verification with the payment gateway. The success URL,
      // amount, and bookingId can all be forged by the client, so we confirm
      // the session actually exists, belongs to this booking, and was paid.
      let verified;
      try {
        verified = await verifyOnlinePayment(gateway || "paymongo", sessionId);
      } catch (verifyError) {
        console.log("Payment verification service error: " + (verifyError as Error).message);
        response.status(502).send("Unable to verify payment. Please contact the front desk.");
        return;
      }

      if (!verified.paid) {
        response.status(402).send("Payment not confirmed by gateway")
        return
      }

      if (verified.bookingId !== booking._id.toString()) {
        response.status(403).send("Payment session does not match this booking")
        return
      }

      const expectedCents = Math.round(paidAmount * 100)
      if (verified.amountCents !== expectedCents) {
        response.status(403).send("Payment amount does not match session")
        return
      }

      await BookingService.updateStatus(bookingId, "reservation")

      const roomId = booking.room?._id ? String(booking.room._id) : String(booking.room ?? "")
      await BookingService.reconcileRoomStatus(roomId)

      const generatedRef = refNumber || (bookingId ? `RSV-${bookingId.slice(-6).toUpperCase()}` : `RSV-${Date.now().toString(36).toUpperCase()}`)

      const generatedFolio = generateFolio(bookingId)

      await BookingService.updatePaymentInfo(bookingId, {
        paymentAmount: paidAmount,
        paymentMethod: method || "Online Payment",
        paymentRefNumber: generatedRef,
      })

      await Paymentservice.create({
        amount: paidAmount,
        receivedBy: "online payment",
        date: localDateStr(),
        paymentBy: paymentBy,
        method: method || "Online Payment",
        refNumber: generatedRef,
        folio: generatedFolio,
      })

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
      // from their inbox without keeping the browser tab open.
      if (booking.clientEmail) {
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        const voucherUrl = `${frontendUrl}/guest/clientPayment?bookingId=${bookingId}&amount=${paidAmount}&gateway=${gateway || "paymongo"}&session_id=${sessionId}`;
        const roomCategory =
          booking.room && typeof booking.room === "object"
            ? (booking.room as { category?: string }).category
            : undefined;

        try {
          // await sendReservationVoucherEmail({
          //   to: booking.clientEmail,
          //   guestName: booking.clientName,
          //   bookingId: String(bookingId),
          //   voucherUrl,
          //   amount: paidAmount,
          //   roomCategory,
          //   arrivalDate: booking.arrivalDate,
          //   arrivalTime: booking.arrivalTime,
          //   departureDate: booking.departureDate,
          //   refNumber: generatedRef,
          // });
        } catch (emailError) {
          console.log("Voucher email failed: " + (emailError as Error).message);
        }
      }

      response.send("success")

    } catch (error) {
      console.log("Failed to update booking: " + (error as Error).message)
      response.status(500).send("Failed to process payment")
    }
  }




  static reservationActivate = async (request: AuthRequest, response: Response) => {
    try {
      const { bookingId } = request.body

      const booking = await BookingService.get(bookingId)

      if (!booking) {
        response.status(500).send("no booking")
        return
      }

      await BookingService.updateStatus(bookingId, "active")

      const roomId = booking.room?._id ? String(booking.room._id) : String(booking.room ?? "")
      await BookingService.reconcileRoomStatus(roomId)

      await logAuditAction({
        action: "RESERVATION_ACTIVATED",
        details: `Reservation ${bookingId} activated for guest ${booking.clientName}`,
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

      response.send("success")

    } catch (error) {
      console.log("Failed to update booking: " + (error as Error).message)
      response.status(500).send("Failed to update booking: " + (error as Error).message)
    }
  }


  static reservationCancel = async (request: AuthRequest, response: Response) => {
    try {
      const { bookingId } = request.body

      const booking = await BookingService.get(bookingId)

      if (!booking) {
        response.status(500).send("no booking")
        return
      }

      await BookingService.updateStatus(bookingId, "canceled")

      const roomId = booking.room?._id ? String(booking.room._id) : String(booking.room ?? "")
      await BookingService.reconcileRoomStatus(roomId)

      await logAuditAction({
        action: "RESERVATION_CANCELED",
        details: `Reservation ${bookingId} canceled for guest ${booking.clientName}`,
        targetType: "booking",
        targetId: bookingId,
      });

      await notify({
        type: "reservation",
        title: `Reservation Canceled: ${booking.clientName}`,
        message: `Reservation ${bookingId} was canceled`,
        severity: "warning",
        link: "/pages/admin/dashboard",
        targetType: "booking",
        targetId: bookingId,
      });

      response.send("success")

    } catch (error) {
      console.log("Failed to update booking: " + (error as Error).message)
      response.status(500).send("Failed to update booking: " + (error as Error).message)
    }
  }





}
