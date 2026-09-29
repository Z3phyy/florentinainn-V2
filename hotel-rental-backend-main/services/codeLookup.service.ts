import crypto from "crypto";
import { Types } from "mongoose";
import BookingsModel from "../model/bookings.model";
import { LoginAttemptService } from "./loginAttempt.service";
import { LoginPolicy } from "../config/loginPolicy";
import ReviewModel from "../model/review.model";
import { isLegacyVerificationCode, normalizeReferenceCode } from "../utils/referenceCode";
import { plannedNights, stayTotal } from "../utils/pricing";

export const CODE_GUESS_POLICY: LoginPolicy = {
  maxAttempts: 10,
  lockoutMs: 15 * 60 * 1000,
  windowMs: 15 * 60 * 1000,
};

export class CodeLookupError extends Error {
  status: number;
  retryAfterSeconds?: number;
  constructor(message: string, status = 400, retryAfterSeconds?: number) {
    super(message);
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export const NOT_FOUND_MESSAGE = "We couldn't find a reservation with that code. Check the code in your confirmation and try again.";

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a.trim().toUpperCase());
  const right = Buffer.from(b.trim().toUpperCase());
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export class CodeLookupService {
  static async findBooking(input: { code?: unknown; bookingId?: unknown; ip?: string }) {
    const key = `code-ip:${input.ip || "unknown"}`;
    const status = await LoginAttemptService.getStatus(key, CODE_GUESS_POLICY);
    if (status.locked) {
      throw new CodeLookupError(
        `Too many unsuccessful attempts. Please try again in ${Math.ceil(status.retryAfterSeconds / 60)} minute(s).`,
        429,
        status.retryAfterSeconds,
      );
    }

    const reference = normalizeReferenceCode(input.code);
    const rawCode = typeof input.code === "string" ? input.code.trim() : "";
    let booking: any = null;

    if (reference) {
      booking = await BookingsModel.findOne({ referenceCode: reference }).populate("room").lean();
    } else if (isLegacyVerificationCode(rawCode)) {
      if (typeof input.bookingId !== "string" || !Types.ObjectId.isValid(input.bookingId)) {
        throw new CodeLookupError("This is an older confirmation code. Please also enter the booking reference from your confirmation.", 400);
      }
      const candidate: any = await BookingsModel.findById(input.bookingId).populate("room").lean();
      if (candidate?.verificationCode && safeEqual(candidate.verificationCode, rawCode)) {
        booking = candidate;
      }
    } else {
      throw new CodeLookupError("Enter your reservation code in the format RES-XXXXX-XXXXX.", 400);
    }

    if (!booking) {
      const failure = await LoginAttemptService.registerFailure(key, "code-lookup", CODE_GUESS_POLICY);
      if (failure.locked) {
        throw new CodeLookupError(
          `Too many unsuccessful attempts. Please try again in ${Math.ceil(failure.retryAfterSeconds / 60)} minute(s).`,
          429,
          failure.retryAfterSeconds,
        );
      }
      throw new CodeLookupError(NOT_FOUND_MESSAGE, 404);
    }
    return booking;
  }

  static async trackingSummary(booking: any) {
    const room = booking.room || {};
    const planned = stayTotal({
      room,
      nights: plannedNights(booking.arrivalDate, booking.departureDate),
      addOnsTotal: Number(booking.addOnsTotal) || 0,
    });
    const total = Number(booking.totalAmount) > 0 ? Number(booking.totalAmount) : planned.total;
    const amountPaid = Number(booking.paymentAmount) || 0;
    const reviewed = await ReviewModel.exists({ booking: booking._id }).setOptions({ withDeleted: true });
    const nameParts = String(booking.clientName || "Guest").trim().split(/\s+/);
    return {
      reference: booking.referenceCode || "",
      status: booking.status,
      type: booking.type,
      guestName:
        nameParts.length > 1
          ? `${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0).toUpperCase()}.`
          : nameParts[0],
      room: {
        label: room.roomNumber ? `Room ${room.roomNumber} · ${room.category || "Room"}` : room.category || "Room",
        category: room.category || "",
        image: room.image || "",
      },
      arrivalDate: booking.arrivalDate,
      arrivalTime: booking.arrivalTime,
      departureDate: booking.departureDate || "",
      nights: planned.nights,
      guests: booking.guests || 1,
      roomSubtotal: planned.roomSubtotal,
      addOns: (booking.addOns || []).map((a: any) => ({
        name: a.name,
        quantity: a.quantity,
        subtotal: a.subtotal,
      })),
      addOnsTotal: Number(booking.addOnsTotal) || 0,
      total,
      amountPaid,
      balanceDue: ["canceled", "no-show"].includes(booking.status) ? 0 : Math.max(0, total - amountPaid),
      paymentStatus: amountPaid <= 0 ? "unpaid" : amountPaid >= total ? "paid" : "partial",
      nonRefundable: booking.nonRefundable === true,
      createdAt: new Types.ObjectId(String(booking._id)).getTimestamp(),
      checkedOutAt: booking.checkedOutAt || null,
      canceledAt: booking.canceledAt || null,
      noShowAt: booking.noShowAt || null,
      canReview: booking.status === "completed" && !reviewed,
      reviewed: !!reviewed,
    };
  }
}
