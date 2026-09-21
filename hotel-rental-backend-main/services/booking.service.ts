import BookingsModel from "../model/bookings.model";
import { bookingInterfaceInput, isWalkInType } from "../types/bookings.type";
import { RoomService } from "./room.service";

export class BookingService {
  static async getAll() {
    const bookings = BookingsModel.find().populate("room");
    return bookings;
  }

  static async get(id: string) {
    const bookings = BookingsModel.findById(id).populate("room");
    return bookings;
  }

  static async create(data: bookingInterfaceInput) {
    return await BookingsModel.create(data);
  }

  static async update(id: string, data: bookingInterfaceInput) {
    await BookingsModel.findByIdAndUpdate(id, data);
  }

  static async updateStatus(id: string, status: string) {
    await BookingsModel.findByIdAndUpdate(id, { status });
  }

  static async setDepartureDate(id: string, departureDate: string) {
    await BookingsModel.findByIdAndUpdate(id, { departureDate });
  }

  static async findRecentDuplicate(params: {
    room: string;
    clientName: string;
    arrivalDate: string;
    withinMs?: number;
  }) {
    const withinMs = params.withinMs ?? 60 * 1000;
    const since = new Date(Date.now() - withinMs);

    const candidates = await BookingsModel.find({
      room: params.room,
      arrivalDate: params.arrivalDate,
      clientName: params.clientName,
      status: { $nin: ["canceled", "completed"] },
    })
      .sort({ _id: -1 })
      .limit(5);

    return (
      candidates.find((booking: any) => {
        const createdAt = booking._id?.getTimestamp?.();
        return (
          createdAt instanceof Date && createdAt.getTime() >= since.getTime()
        );
      }) || null
    );
  }

  static async updatePaymentInfo(
    id: string,
    data: {
      paymentAmount?: number;
      paymentMethod?: string;
      paymentRefNumber?: string;
      totalAmount?: number;
    },
  ) {
    const updateData: Record<string, any> = {};
    if (data.paymentAmount !== undefined)
      updateData.paymentAmount = data.paymentAmount;
    if (data.paymentMethod) updateData.paymentMethod = data.paymentMethod;
    if (data.paymentRefNumber)
      updateData.paymentRefNumber = data.paymentRefNumber;
    if (data.totalAmount !== undefined)
      updateData.totalAmount = data.totalAmount;
    await BookingsModel.findByIdAndUpdate(id, updateData);
  }

  static async delete(id: string) {
    const booking = BookingsModel.findByIdAndDelete(id);
    return booking;
  }

  static async countByRoom(roomId: string) {
    return BookingsModel.countDocuments({ room: roomId });
  }

  static async getRoomHoldings(roomId: string) {
    return BookingsModel.find({ room: roomId });
  }

  // Recomputed the room status from its bookings so edits/deletes never leave a
  // room stranded as occupied/reserved. An explicit "maintenance" flag set by
  // staff is always preserved. Must be called AFTER the booking write so the
  // persisted bookings are the source of truth.
  static async reconcileRoomStatus(roomId: string) {
    const room = await RoomService.get(roomId);
    if (!room || room.status === "maintenance") return;

    const bookings = await BookingService.getRoomHoldings(roomId);

    const hasActive = bookings.some((b: any) => b.status === "active");
    const hasReserved = bookings.some((b: any) => b.status === "reservation");
    const hasWalkInUnpaid = bookings.some(
      (b: any) => b.status === "unpaid" && isWalkInType(b.type),
    );

    let nextStatus = "available";
    if (hasActive) nextStatus = "occupied";
    else if (hasReserved) nextStatus = "reserved";
    else if (hasWalkInUnpaid) nextStatus = "occupied";

    if (room.status !== nextStatus) {
      await RoomService.updateStatus(roomId, nextStatus);
    }
  }

  static async getTodayArrivals(dateStr: string) {
    return BookingsModel.find({
      arrivalDate: dateStr,
      status: { $in: ["reservation", "unpaid"] },
      arrivalNotified: { $ne: true },
    });
  }

  static async markArrivalNotified(id: string) {
    await BookingsModel.findByIdAndUpdate(id, { arrivalNotified: true });
  }

  // Confirmed reservations whose arrival date has passed without a check-in;
  // used to raise an overdue staff alert exactly once per booking.
  static async getOverdueReservations(dateStr: string) {
    return BookingsModel.find({
      status: "reservation",
      arrivalDate: { $lt: dateStr },
      overdueNotified: { $ne: true },
    });
  }

  static async markOverdueNotified(id: string) {
    await BookingsModel.findByIdAndUpdate(id, { overdueNotified: true });
  }

  static async getTodayGraceCandidates(dateStr: string) {
    return BookingsModel.find({
      arrivalDate: dateStr,
      status: "reservation",
      graceNotified: { $ne: true },
    });
  }

  static async markGraceNotified(id: string) {
    await BookingsModel.findByIdAndUpdate(id, { graceNotified: true });
  }

  static async claimArrivalNotification(id: string): Promise<boolean> {
    const claimed = await BookingsModel.findOneAndUpdate(
      { _id: id, arrivalNotified: { $ne: true } },
      { arrivalNotified: true },
    );
    return !!claimed;
  }

  static async claimOverdueNotification(id: string): Promise<boolean> {
    const claimed = await BookingsModel.findOneAndUpdate(
      { _id: id, overdueNotified: { $ne: true } },
      { overdueNotified: true },
    );
    return !!claimed;
  }

  static async claimGraceNotification(id: string): Promise<boolean> {
    const claimed = await BookingsModel.findOneAndUpdate(
      { _id: id, graceNotified: { $ne: true } },
      { graceNotified: true },
    );
    return !!claimed;
  }
}
