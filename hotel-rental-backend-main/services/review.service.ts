import crypto from "crypto";
import { Types } from "mongoose";
import BookingsModel from "../model/bookings.model";
import ReviewModel from "../model/review.model";

export class ReviewError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const REVIEWABLE_STATUSES = ["completed"];

function codesMatch(expected: string, provided: string) {
  const a = Buffer.from(expected.trim().toUpperCase());
  const b = Buffer.from(provided.trim().toUpperCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function publicGuestName(name: string) {
  const parts = (name || "Guest").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Guest";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

export class ReviewService {
  static async verifyOwnership(bookingId: unknown, verificationCode: unknown) {
    if (typeof bookingId !== "string" || !Types.ObjectId.isValid(bookingId)) {
      throw new ReviewError("A valid booking reference is required.");
    }
    if (typeof verificationCode !== "string" || !verificationCode.trim()) {
      throw new ReviewError("The verification code from your confirmation email is required.");
    }
    const booking: any = await BookingsModel.findById(bookingId).populate("room").lean();
    if (!booking || !booking.verificationCode || !codesMatch(booking.verificationCode, verificationCode)) {
      throw new ReviewError("Booking reference or verification code is incorrect.", 403);
    }
    return booking;
  }

  static serialize(review: any) {
    return {
      _id: String(review._id),
      rating: review.rating,
      comment: review.comment,
      guestName: review.guestName,
      stayArrivalDate: review.stayArrivalDate,
      stayDepartureDate: review.stayDepartureDate,
      createdAt: review.createdAt,
    };
  }

  static async eligibility(bookingId: unknown, verificationCode: unknown) {
    const booking = await ReviewService.verifyOwnership(bookingId, verificationCode);
    const existing = await ReviewModel.findOne({ booking: booking._id }).lean();
    const room = booking.room || {};
    const roomLabel = room.roomNumber ? `Room ${room.roomNumber} · ${room.category}` : room.category || "Room";
    if (existing) {
      return { eligible: false, reason: "already_reviewed", roomLabel, review: ReviewService.serialize(existing) };
    }
    if (!REVIEWABLE_STATUSES.includes(booking.status)) {
      return {
        eligible: false,
        reason: "not_completed",
        status: booking.status,
        roomLabel,
        message: "You can review your room after you have checked out.",
      };
    }
    return { eligible: true, roomLabel };
  }

  static async create(input: { bookingId: unknown; verificationCode: unknown; rating: unknown; comment: unknown }) {
    const rating = Number(input.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ReviewError("Rating must be a whole number from 1 to 5.");
    }
    const comment = typeof input.comment === "string" ? input.comment.trim() : "";
    if (comment.length < 10) throw new ReviewError("Please write at least 10 characters about your stay.");
    if (comment.length > 1000) throw new ReviewError("Reviews can be at most 1000 characters.");

    const booking = await ReviewService.verifyOwnership(input.bookingId, input.verificationCode);
    if (!REVIEWABLE_STATUSES.includes(booking.status)) {
      throw new ReviewError("You can review your room after you have checked out.", 409);
    }
    if (!booking.room?._id) {
      throw new ReviewError("The room for this booking no longer exists.", 409);
    }
    try {
      const review = await ReviewModel.create({
        booking: booking._id,
        room: booking.room._id,
        guestName: publicGuestName(booking.clientName),
        rating,
        comment,
        stayArrivalDate: booking.arrivalDate,
        stayDepartureDate: booking.departureDate || "",
      });
      return { review: ReviewService.serialize(review.toObject()), booking };
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ReviewError("A review has already been submitted for this reservation.", 409);
      }
      throw error;
    }
  }

  static async listForRoom(roomId: string, page = 1, limit = 10) {
    if (!Types.ObjectId.isValid(roomId)) throw new ReviewError("Invalid room id.");
    const p = Math.max(1, Math.floor(page) || 1);
    const l = Math.min(50, Math.max(1, Math.floor(limit) || 10));
    const filter = { room: new Types.ObjectId(roomId), status: "published" };
    const [items, total, stats] = await Promise.all([
      ReviewModel.find(filter).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).lean(),
      ReviewModel.countDocuments(filter),
      ReviewModel.aggregate([{ $match: filter }, { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } }]),
    ]);
    return {
      items: items.map(ReviewService.serialize),
      total,
      page: p,
      limit: l,
      totalPages: Math.max(1, Math.ceil(total / l)),
      averageRating: stats[0] ? Math.round(stats[0].average * 10) / 10 : null,
      reviewCount: stats[0]?.count || 0,
    };
  }
}
