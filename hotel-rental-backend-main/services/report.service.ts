import BookingsModel from "../model/bookings.model";
import RoomModel from "../model/room.model";
import paymentModel from "../model/payment.model";

export class ReportService {

  static async getOccupancyReport() {
    const rooms = await RoomModel.find().sort({ category: 1 });
    return rooms.map((room: any) => ({
      roomId: room._id,
      category: room.category,
      price: room.price,
      status: room.status,
      maintenance: room.maintenance || "",
    }));
  }

  static async getRevenueReport(month: number, year: number) {
    const payments = await paymentModel.find();
    
    // Filter by selected month and year
    const filtered = payments.filter((p: any) => {
      if (!p.date) return false;
      const d = new Date(p.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });

    const totalRevenue = filtered.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    return {
      month,
      year,
      totalRevenue,
      payments: filtered.map((p: any) => ({
        _id: p._id,
        date: p.date,
        amount: p.amount,
        receivedBy: p.receivedBy,
      })),
    };
  }

  static async getReservationReport(month: number, year: number) {
    const bookings = await BookingsModel.find({ type: "reservation" }).populate("room");

    // Filter by selected month and year based on arrivalDate
    const filtered = bookings.filter((b: any) => {
      if (!b.arrivalDate) return false;
      const d = new Date(b.arrivalDate);
      return d.getMonth() === month && d.getFullYear() === year;
    });

    return filtered.map((b: any) => ({
      _id: b._id,
      clientName: b.clientName,
      arrivalDate: b.arrivalDate,
      arrivalTime: b.arrivalTime,
      status: b.status,
      room: b.room ? {
        category: (b.room as any).category,
        price: (b.room as any).price,
      } : null,
    }));
  }

  static async getPopularRoomReport(month: number, year: number) {
    const bookings = await BookingsModel.find().populate("room");

    // Filter by selected month and year
    const filtered = bookings.filter((b: any) => {
      if (!b.arrivalDate) return false;
      const d = new Date(b.arrivalDate);
      return d.getMonth() === month && d.getFullYear() === year;
    });

    // Count bookings per room category
    const roomCountMap: Record<string, { count: number; category: string; price: number }> = {};
    
    for (const b of filtered) {
      const room = (b as any).room;
      if (!room) continue;
      const key = room._id?.toString() || room.category;
      if (!roomCountMap[key]) {
        roomCountMap[key] = { count: 0, category: room.category, price: room.price };
      }
      roomCountMap[key].count++;
    }

    // Sort by count descending
    const sorted = Object.values(roomCountMap).sort((a, b) => b.count - a.count);

    return {
      month,
      year,
      popularRooms: sorted,
    };
  }
}
