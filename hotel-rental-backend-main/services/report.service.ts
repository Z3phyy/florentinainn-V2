import BookingsModel from "../model/bookings.model";
import RoomModel from "../model/room.model";
import paymentModel from "../model/payment.model";

export type ReportMonth = number | "all";

function monthYearOf(value: string): { month: number; year: number } | null {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    return { year: Number(match[1]), month: Number(match[2]) - 1 };
  }

  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return null;
  return { month: parsed.getMonth(), year: parsed.getFullYear() };
}

function inPeriod(value: string, month: ReportMonth, year: number): boolean {
  const parts = monthYearOf(value);
  if (!parts) return false;
  if (parts.year !== year) return false;
  return month === "all" ? true : parts.month === month;
}

export class ReportService {
  static async getOccupancyReport() {
    const rooms = await RoomModel.find().sort({ category: 1 });
    return rooms.map((room: any) => ({
      roomId: room._id,
      roomNumber: room.roomNumber || "",
      category: room.category,
      price: room.price,
      status: room.status,
      maintenance: room.maintenance || "",
    }));
  }

  static async getRevenueReport(month: ReportMonth, year: number) {
    const payments = await paymentModel.find();

    const filtered = payments.filter((p: any) => inPeriod(p.date, month, year));

    const totalRevenue = filtered.reduce(
      (sum: number, p: any) => sum + (p.amount || 0),
      0,
    );

    const refundedAmount = filtered.reduce(
      (sum: number, p: any) =>
        sum +
        (p.status === "refunded" ? (p.amount || 0) : 0) +
        (p.refundedAt ? 0 : 0),
      0,
    );

    const methodBreakdown: Record<string, { count: number; amount: number }> = {};
    for (const p of filtered) {
      const method = (p.method || "Cash").trim() || "Cash";
      if (!methodBreakdown[method]) {
        methodBreakdown[method] = { count: 0, amount: 0 };
      }
      methodBreakdown[method].count++;
      methodBreakdown[method].amount += p.amount || 0;
    }

    const refundedCount = filtered.filter(
      (p: any) => p.status === "refunded",
    ).length;

    return {
      month,
      year,
      totalRevenue,
      refundedAmount,
      netRevenue: Math.max(0, totalRevenue - refundedAmount),
      refundedCount,
      paymentCount: filtered.length,
      methodBreakdown,
      payments: filtered.map((p: any) => ({
        _id: p._id,
        date: p.date,
        amount: p.amount,
        receivedBy: p.receivedBy,
        paymentBy: p.paymentBy,
        method: p.method,
        refNumber: p.refNumber,
        folio: p.folio,
        balance: p.balance,
        status: p.status,
        refundedAt: p.refundedAt || null,
        refundReason: p.refundReason || "",
      })),
    };
  }

  static async getReservationReport(month: ReportMonth, year: number) {
    const bookings = await BookingsModel.find({ type: "reservation" }).populate(
      "room",
    );

    const filtered = bookings.filter((b: any) =>
      inPeriod(b.arrivalDate, month, year),
    );

    return filtered.map((b: any) => ({
      _id: b._id,
      clientName: b.clientName,
      clientAddress: b.clientAddress,
      arrivalDate: b.arrivalDate,
      departureDate: b.departureDate || "",
      arrivalTime: b.arrivalTime,
      guests: b.guests || 1,
      nonRefundable: b.nonRefundable === true,
      status: b.status,
      room: b.room
        ? {
            category: (b.room as any).category,
            price: (b.room as any).price,
          }
        : null,
    }));
  }

  static async getPopularRoomReport(month: ReportMonth, year: number) {
    const bookings = await BookingsModel.find().populate("room");

    // Filter by selected period
    const filtered = bookings.filter((b: any) =>
      inPeriod(b.arrivalDate, month, year),
    );

    // Count bookings per room category
    const roomCountMap: Record<
      string,
      { count: number; category: string; price: number }
    > = {};

    for (const b of filtered) {
      const room = (b as any).room;
      if (!room) continue;
      const key = room._id?.toString() || room.category;
      if (!roomCountMap[key]) {
        roomCountMap[key] = {
          count: 0,
          category: room.category,
          price: room.price,
        };
      }
      roomCountMap[key].count++;
    }

    // Sort by count descending
    const sorted = Object.values(roomCountMap).sort(
      (a, b) => b.count - a.count,
    );

    return {
      month,
      year,
      popularRooms: sorted,
    };
  }
}
