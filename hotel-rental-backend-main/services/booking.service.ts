import BookingsModel from "../model/bookings.model";
import { bookingInterfaceInput, bookingModification, isWalkInType } from "../types/bookings.type";
import { RoomService } from "./room.service";

export class BookingService {
  static async getAll(options: { status?: string; search?: string } = {}) {
    const filter: Record<string, unknown> = {};
    if (options.status) filter.status = options.status;
    if (options.search) {
      const re = {
        $regex: options.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      };
      filter.$or = [
        { clientName: re },
        { clientPhone: re },
        { clientEmail: re },
      ];
    }
    const bookings = BookingsModel.find(filter).populate("room");
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

  static async recordModification(id: string, entry: bookingModification) {
    await BookingsModel.findByIdAndUpdate(id, {
      $push: { modificationHistory: entry },
    });
  }

  static async setVerificationCode(id: string, code: string) {
    await BookingsModel.findByIdAndUpdate(id, { verificationCode: code });
  }

  static async setPaymentSession(
    id: string,
    data: { sessionId: string; gateway: string },
  ) {
    await BookingsModel.findByIdAndUpdate(id, {
      paymentSessionId: data.sessionId,
      paymentGateway: data.gateway,
    });
  }

  static async claimReservationPayment(id: string) {
    return BookingsModel.findOneAndUpdate(
      { _id: id, status: "unpaid" },
      { status: "reservation" },
      { new: true },
    ).populate("room");
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

  // Aggregate all bookings into a guest directory keyed by guest identity.
  // A guest is identified by the strongest contact we have (email > phone > name).
  static async getGuestDirectory() {
    const bookings = await BookingsModel.find().populate("room").sort({ _id: -1 });

    const guests: Map<string, any> = new Map();

    for (const booking of bookings as any[]) {
      const email = (booking.clientEmail || "").trim().toLowerCase();
      const phone = (booking.clientPhone || "").trim();
      const name = (booking.clientName || "").trim();

      const key = email || phone || name;
      if (!key) continue;

      let guest = guests.get(key);
      if (!guest) {
        guest = {
          key,
          name,
          email: email || "",
          phone,
          address: booking.clientAddress || "",
          stays: [],
          totalStays: 0,
          totalSpent: 0,
          outstandingBalance: 0,
          lastStayAt: null,
        };
        guests.set(key, guest);
      }

      const room = booking.room as any;
      const nights = Math.max(
        1,
        Math.round(
          (new Date(booking.departureDate || booking.arrivalDate).getTime() -
            new Date(booking.arrivalDate).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );
      const nightlyRate = Math.round(
        (room?.price || 0) * (1 - (room?.discount || 0) / 100),
      );
      const stayTotal = Math.round(nightlyRate * nights);
      const amountPaid = Number(booking.paymentAmount) || 0;

      guest.stays.push({
        bookingId: booking._id,
        roomId: room?._id,
        roomNumber: room?.roomNumber || "",
        category: room?.category || "",
        type: booking.type,
        status: booking.status,
        arrivalDate: booking.arrivalDate,
        departureDate: booking.departureDate,
        nights,
        stayTotal,
        amountPaid,
        balance: Math.max(0, stayTotal - amountPaid),
        createdAt: booking.createdAt,
      });

      guest.totalStays = guest.stays.length;
      guest.totalSpent += amountPaid;
      guest.outstandingBalance = guest.stays
        .filter(
          (s: any) => !["canceled", "completed"].includes(s.status),
        )
        .reduce((sum: number, s: any) => sum + s.balance, 0);

      const stayDate = booking.createdAt || booking.arrivalDate;
      if (!guest.lastStayAt || new Date(stayDate) > new Date(guest.lastStayAt)) {
        guest.lastStayAt = stayDate;
      }
    }

    return Array.from(guests.values()).sort(
      (a, b) =>
        new Date(b.lastStayAt).getTime() - new Date(a.lastStayAt).getTime(),
    );
  }

  static async updateGuestIdentity(
    match: { clientEmail?: string; clientPhone?: string; clientName?: string },
    data: {
      clientName?: string;
      clientEmail?: string;
      clientPhone?: string;
      clientAddress?: string;
    },
  ) {
    const query: any = {};
    if (match.clientEmail) query.clientEmail = match.clientEmail;
    else if (match.clientPhone) query.clientPhone = match.clientPhone;

    const update: any = {};
    if (data.clientName !== undefined) update.clientName = data.clientName;
    if (data.clientEmail !== undefined) update.clientEmail = data.clientEmail;
    if (data.clientPhone !== undefined) update.clientPhone = data.clientPhone;
    if (data.clientAddress !== undefined)
      update.clientAddress = data.clientAddress;

    if (Object.keys(update).length === 0) return { modifiedCount: 0 };

    const result = await BookingsModel.updateMany(query, { $set: update });
    return result;
  }
}
