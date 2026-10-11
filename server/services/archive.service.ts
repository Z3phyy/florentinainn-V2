import { Types } from "mongoose";
import BookingsModel from "../model/bookings.model";
import AccountModel from "../model/account.model";
import AdminModel from "../model/admin.model";
import ReviewModel from "../model/review.model";
import RoomModel from "../model/room.model";
import { AvailabilityService } from "./availability.service";
import { BookingService } from "./booking.service";
import { HOLDING_STATUSES } from "../types/bookings.type";

export const ARCHIVE_TYPES = ["rooms", "reservations", "staff", "reviews"] as const;
export type ArchiveType = (typeof ARCHIVE_TYPES)[number];

export class ArchiveError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const escape = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export class ArchiveService {
  static async list(type: ArchiveType, options: { search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Math.floor(Number(options.page) || 1));
    const limit = Math.min(50, Math.max(1, Math.floor(Number(options.limit) || 15)));
    const search = (options.search || "").trim().slice(0, 100);
    const re = search ? { $regex: escape(search), $options: "i" } : null;
    const skip = (page - 1) * limit;

    if (type === "rooms") {
      const filter: Record<string, unknown> = { deletedAt: { $ne: null } };
      if (re) filter.$or = [{ roomNumber: re }, { category: re }];
      const [items, total] = await Promise.all([
        RoomModel.find(filter).sort({ deletedAt: -1 }).skip(skip).limit(limit).lean(),
        RoomModel.countDocuments(filter),
      ]);
      return {
        items: items.map((r: any) => ({
          _id: String(r._id),
          type,
          name: r.roomNumber ? `Room ${r.roomNumber} · ${r.category}` : r.category,
          detail: `₱${Number(r.price || 0).toLocaleString()} / night · max ${r.maxHead} guests`,
          deletedAt: r.deletedAt,
          deletedBy: r.deletedBy || "",
          deleteReason: r.deleteReason || "",
        })),
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    }

    if (type === "reservations") {
      const filter: Record<string, unknown> = { deletedAt: { $ne: null } };
      if (re) filter.$or = [{ clientName: re }, { referenceCode: re }, { clientEmail: re }];
      const [items, total] = await Promise.all([
        BookingsModel.find(filter).setOptions({ withDeleted: true }).populate("room", "roomNumber category").sort({ deletedAt: -1 }).skip(skip).limit(limit).lean(),
        BookingsModel.countDocuments(filter).setOptions({ withDeleted: true }),
      ]);
      return {
        items: items.map((b: any) => ({
          _id: String(b._id),
          type,
          name: `${b.clientName} · ${b.referenceCode || String(b._id).slice(-8).toUpperCase()}`,
          detail: `${b.room?.roomNumber ? `Room ${b.room.roomNumber}` : b.room?.category || "Room"} · ${b.arrivalDate} → ${b.departureDate || "open"} · ${b.status}`,
          deletedAt: b.deletedAt,
          deletedBy: b.deletedBy || "",
          deleteReason: b.deleteReason || "",
        })),
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    }

    if (type === "staff") {
      const filter: Record<string, unknown> = { deletedAt: { $ne: null } };
      if (re) filter.$or = [{ name: re }, { email: re }];
      const [items, total] = await Promise.all([
        AccountModel.find(filter).setOptions({ withDeleted: true }).sort({ deletedAt: -1 }).skip(skip).limit(limit).lean(),
        AccountModel.countDocuments(filter).setOptions({ withDeleted: true }),
      ]);
      return {
        items: items.map((a: any) => ({
          _id: String(a._id),
          type,
          name: a.name,
          detail: `${a.email}${a.position ? ` · ${a.position}` : ""}`,
          deletedAt: a.deletedAt,
          deletedBy: a.deletedBy || "",
          deleteReason: a.deleteReason || "",
        })),
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    }

    const filter: Record<string, unknown> = { deletedAt: { $ne: null } };
    if (re) filter.$or = [{ guestName: re }, { comment: re }];
    const [items, total] = await Promise.all([
      ReviewModel.find(filter).setOptions({ withDeleted: true }).populate("room", "roomNumber category").sort({ deletedAt: -1 }).skip(skip).limit(limit).lean(),
      ReviewModel.countDocuments(filter).setOptions({ withDeleted: true }),
    ]);
    return {
      items: items.map((r: any) => ({
        _id: String(r._id),
        type,
        name: `${r.guestName} · ${r.rating}/5`,
        detail: `${r.room?.roomNumber ? `Room ${r.room.roomNumber}` : r.room?.category || "Room"} · "${String(r.comment).slice(0, 80)}"`,
        deletedAt: r.deletedAt,
        deletedBy: r.deletedBy || "",
        deleteReason: r.deleteReason || "",
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  static async restore(type: ArchiveType, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new ArchiveError("Invalid record id.");
    const clear = { $set: { deletedAt: null, deletedBy: "", deleteReason: "" } };

    if (type === "rooms") {
      const room: any = await RoomModel.findOne({ _id: id, deletedAt: { $ne: null } }).lean();
      if (!room) throw new ArchiveError("Archived room not found.", 404);
      if (room.roomNumber) {
        const clash = await RoomModel.exists({
          _id: { $ne: room._id },
          deletedAt: null,
          roomNumber: { $regex: `^${escape(room.roomNumber)}$`, $options: "i" },
        });
        if (clash) throw new ArchiveError(`Another active room already uses number ${room.roomNumber}. Rename it before restoring.`, 409);
      }
      const restored = await RoomModel.findOneAndUpdate({ _id: id, deletedAt: { $ne: null } }, clear, { new: true });
      if (!restored) throw new ArchiveError("Room was already restored.", 409);
      await BookingService.reconcileRoomStatus(id);
      return { label: room.roomNumber ? `Room ${room.roomNumber}` : room.category };
    }

    if (type === "reservations") {
      const booking: any = await BookingsModel.findOne({ _id: id, deletedAt: { $ne: null } }).setOptions({ withDeleted: true }).lean();
      if (!booking) throw new ArchiveError("Archived reservation not found.", 404);
      const roomId = String(booking.room || "");
      const room: any = await RoomModel.findById(roomId).lean();
      if ((HOLDING_STATUSES as readonly string[]).includes(booking.status)) {
        if (!room || room.deletedAt) {
          throw new ArchiveError("This reservation's room is archived or missing. Restore the room first.", 409);
        }
        const conflicts = await AvailabilityService.roomConflicts(roomId, booking.arrivalDate, booking.departureDate, id);
        if (conflicts.length > 0) {
          throw new ArchiveError("The room has since been booked for these dates, so this reservation cannot be restored as-is.", 409);
        }
      }
      const restored = await BookingsModel.findOneAndUpdate(
        { _id: id, deletedAt: { $ne: null } },
        clear,
        { new: true },
      ).setOptions({ withDeleted: true });
      if (!restored) throw new ArchiveError("Reservation was already restored.", 409);
      if (roomId) await BookingService.reconcileRoomStatus(roomId);
      return { label: `${booking.clientName} (${booking.referenceCode || id})` };
    }

    if (type === "staff") {
      const account: any = await AccountModel.findOne({ _id: id, deletedAt: { $ne: null } }).setOptions({ withDeleted: true }).lean();
      if (!account) throw new ArchiveError("Archived staff account not found.", 404);
      const emailRe = { $regex: `^${escape(account.email)}$`, $options: "i" };
      const [otherStaff, admin] = await Promise.all([
        AccountModel.exists({ _id: { $ne: account._id }, email: emailRe }),
        AdminModel.exists({ email: emailRe }),
      ]);
      if (otherStaff || admin) {
        throw new ArchiveError(`The email ${account.email} is now used by another account, so this account cannot be restored.`, 409);
      }
      const restored = await AccountModel.findOneAndUpdate(
        { _id: id, deletedAt: { $ne: null } },
        clear,
        { new: true },
      ).setOptions({ withDeleted: true });
      if (!restored) throw new ArchiveError("Account was already restored.", 409);
      return { label: `${account.name} (${account.email})` };
    }

    const review: any = await ReviewModel.findOne({ _id: id, deletedAt: { $ne: null } }).setOptions({ withDeleted: true }).lean();
    if (!review) throw new ArchiveError("Archived review not found.", 404);
    const restored = await ReviewModel.findOneAndUpdate({ _id: id, deletedAt: { $ne: null } }, clear, { new: true }).setOptions({ withDeleted: true });
    if (!restored) throw new ArchiveError("Review was already restored.", 409);
    return { label: `${review.guestName}'s review` };
  }
}
