import { ClientSession, Types } from "mongoose";
import BookingsModel from "../model/bookings.model";
import { HOLDING_STATUSES } from "../types/bookings.type";
import { addDaysToDateStr } from "../utils/hotelTime";

export function stayWindow(arrivalDate: string, departureDate?: string) {
  return {
    start: arrivalDate,
    end: departureDate && departureDate > arrivalDate ? departureDate : addDaysToDateStr(arrivalDate, 1),
  };
}

export function overlapFilter(arrivalDate: string, departureDate?: string) {
  const { start, end } = stayWindow(arrivalDate, departureDate);
  return {
    status: { $in: [...HOLDING_STATUSES] },
    arrivalDate: { $lt: end },
    $or: [
      { departureDate: { $gt: start } },
      { departureDate: "" },
      { departureDate: { $exists: false } },
      { departureDate: null },
    ],
  };
}

export class AvailabilityService {
  static async roomConflicts(
    roomId: string,
    arrivalDate: string,
    departureDate: string | undefined,
    excludeBookingId?: string,
    session?: ClientSession,
  ) {
    const filter: Record<string, unknown> = {
      ...overlapFilter(arrivalDate, departureDate),
      room: new Types.ObjectId(roomId),
    };
    if (excludeBookingId) filter._id = { $ne: new Types.ObjectId(excludeBookingId) };
    return BookingsModel.find(filter)
      .select("_id clientName arrivalDate departureDate status")
      .session(session || null)
      .lean();
  }

  static async addOnUsage(
    addOnIds: string[],
    arrivalDate: string,
    departureDate: string | undefined,
    excludeBookingId?: string,
    session?: ClientSession,
  ): Promise<Map<string, number>> {
    const usage = new Map<string, number>();
    if (addOnIds.length === 0) return usage;
    const ids = addOnIds.map((id) => new Types.ObjectId(id));
    const match: Record<string, unknown> = {
      ...overlapFilter(arrivalDate, departureDate),
      "addOns.addOn": { $in: ids },
    };
    if (excludeBookingId) match._id = { $ne: new Types.ObjectId(excludeBookingId) };
    const rows = await BookingsModel.aggregate([
      { $match: match },
      { $unwind: "$addOns" },
      { $match: { "addOns.addOn": { $in: ids } } },
      { $group: { _id: "$addOns.addOn", used: { $sum: "$addOns.quantity" } } },
    ]).session(session || null);
    for (const row of rows) usage.set(String(row._id), row.used);
    return usage;
  }
}
