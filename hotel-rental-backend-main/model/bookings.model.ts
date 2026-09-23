import mongoose, { Schema } from "mongoose";

const BookingModificationSchema = new Schema(
  {
    field: { type: String, required: true },
    from: { type: String, default: "" },
    to: { type: String, default: "" },
    note: { type: String, default: "" },
    changedBy: { type: String, default: "" },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const BookingsSchema = new Schema({
  clientName: { type: String, required: true },
  clientAddress: { type: String, required: true },
  clientEmail: { type: String, default: "" },
  clientPhone: { type: String, default: "" },
  paymentAmount: { type: Number, default: 0 },
  paymentMethod: { type: String, default: "" },
  paymentRefNumber: { type: String, default: "" },
  paymentSessionId: { type: String, default: "" },
  paymentGateway: { type: String, default: "" },
  totalAmount: { type: Number, default: 0 },
  type: { type: String, required: true },
  status: { type: String, required: true },
  guests: { type: Number, default: 1 },
  nonRefundable: { type: Boolean, default: false },
  policyAcceptedAt: { type: Date, default: null },
  arrivalDate: { type: String, required: true },
  departureDate: { type: String, default: "" },
  arrivalTime: { type: String, required: true },
  arrivalNotified: { type: Boolean, default: false },
  overdueNotified: { type: Boolean, default: false },
  graceNotified: { type: Boolean, default: false },
  noShowAt: { type: Date, default: null },
  noShowBy: { type: String, default: "" },
  noShowReason: { type: String, default: "" },
  canceledAt: { type: Date, default: null },
  canceledBy: { type: String, default: "" },
  cancellationReason: { type: String, default: "" },
  checkedOutAt: { type: Date, default: null },
  earlyCheckout: { type: Boolean, default: false },
  wasRescheduled: { type: Boolean, default: false },
  verificationCode: { type: String, default: "" },
  modificationHistory: { type: [BookingModificationSchema], default: [] },
  room: {
    type: Schema.Types.ObjectId,
    ref: "Rooms",
    required: true,
  },
});

export default mongoose.model("Bookings", BookingsSchema);
