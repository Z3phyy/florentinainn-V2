import { Types } from "mongoose";
import BookingsModel from "../model/bookings.model";
import ReviewModel from "../model/review.model";
import { CodeLookupError, CodeLookupService } from "./codeLookup.service";

export class ReviewError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const REVIEWABLE_STATUSES = ["completed"];

export interface ReviewIdentity {
  reservationCode?: unknown;
  bookingId?: unknown;
  verificationCode?: unknown;
  roomId?: unknown;
  ip?: string;
}

export function publicGuestName(name: string) {
  const parts = (name || "Guest").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Guest";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

export class ReviewService {
  static async verifyOwnership(input: ReviewIdentity) {
    try {
      const booking = await CodeLookupService.findBooking({
        code: input.reservationCode ?? input.verificationCode,
        bookingId: input.bookingId,
        ip: input.ip,
      });
      if (input.roomId !== undefined && input.roomId !== null && input.roomId !== "") {
        const roomId = typeof input.roomId === "string" ? input.roomId : "";
        const bookedRoom = booking.room?._id ? String(booking.room._id) : String(booking.room || "");
        if (!Types.ObjectId.isValid(roomId) || roomId !== bookedRoom) {
          throw new ReviewError("This reservation code is not for this room. You can only review the room you stayed in.", 403);
        }
      }
      return booking;
    } catch (error) {
      if (error instanceof CodeLookupError) {
        throw new ReviewError(error.message, error.status === 404 ? 403 : error.status);
      }
      throw error;
    }
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

  static async eligibility(identity: ReviewIdentity) {
    const booking = await ReviewService.verifyOwnership(identity);
    const existing = await ReviewModel.findOne({ booking: booking._id }).setOptions({ withDeleted: true }).lean();
    const room = booking.room || {};
    const roomLabel = room.roomNumber ? `Room ${room.roomNumber} · ${room.category}` : room.category || "Room";
    if (existing) {
      return { eligible: false, reason: "already_reviewed", roomLabel, roomId: String(room._id || ""), review: ReviewService.serialize(existing) };
    }
    if (!REVIEWABLE_STATUSES.includes(booking.status)) {
      return {
        eligible: false,
        reason: "not_completed",
        status: booking.status,
        roomLabel,
        roomId: String(room._id || ""),
        message: "You can review your room after you have checked out.",
      };
    }
    return { eligible: true, roomLabel, roomId: String(room._id || "") };
  }

  static async create(input: ReviewIdentity & { rating: unknown; comment: unknown }) {
    const rating = Number(input.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ReviewError("Rating must be a whole number from 1 to 5.");
    }
    const comment = typeof input.comment === "string" ? input.comment.trim() : "";
    if (comment.length < 10) throw new ReviewError("Please write at least 10 characters about your stay.");
    if (comment.length > 1000) throw new ReviewError("Reviews can be at most 1000 characters.");

    const booking = await ReviewService.verifyOwnership(input);
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

  static async listForAdmin(options: { page?: number; limit?: number; search?: string }) {
    const page = Math.max(1, Math.floor(Number(options.page) || 1));
    const limit = Math.min(50, Math.max(1, Math.floor(Number(options.limit) || 15)));
    const search = (options.search || "").trim().slice(0, 100);
    const filter: Record<string, unknown> = {};
    if (search) {
      const re = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      filter.$or = [{ guestName: re }, { comment: re }];
    }
    const [items, total] = await Promise.all([
      ReviewModel.find(filter).populate("room", "roomNumber category").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ReviewModel.countDocuments(filter),
    ]);
    return {
      items: items.map((r: any) => ({
        ...ReviewService.serialize(r),
        status: r.status,
        roomLabel: r.room ? (r.room.roomNumber ? `Room ${r.room.roomNumber} · ${r.room.category}` : r.room.category) : "",
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  static async archive(id: string, actor: string, reason: string) {
    if (!Types.ObjectId.isValid(id)) throw new ReviewError("Invalid review id.");
    const updated = await ReviewModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date(), deletedBy: actor, deleteReason: reason } },
      { new: true },
    );
    if (!updated) throw new ReviewError("Review not found or already archived.", 404);
    return updated;
  }

  static async latest(limit = 4) {
    const l = Math.min(12, Math.max(1, Math.floor(limit) || 4));
    const items = await ReviewModel.find({ status: "published" })
      .sort({ createdAt: -1 })
      .limit(l)
      .populate("room", "category roomNumber")
      .lean();
    const stats = await ReviewModel.aggregate([
      { $match: { status: "published" } },
      { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    return {
      items: items.map((r: any) => ({
        ...ReviewService.serialize(r),
        roomLabel: r.room ? (r.room.roomNumber ? `Room ${r.room.roomNumber} · ${r.room.category}` : r.room.category) : "",
      })),
      averageRating: stats[0] ? Math.round(stats[0].average * 10) / 10 : null,
      reviewCount: stats[0]?.count || 0,
    };
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
