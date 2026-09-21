import mongoose, { Schema } from "mongoose";

const BookingsSchema = new Schema({
  clientName: { type: String, required: true },
  clientAddress: { type: String, required: true },
  clientEmail: { type: String, default: "" },
  clientPhone: { type: String, default: "" },
  paymentAmount: { type: Number, default: 0 },
  paymentMethod: { type: String, default: "" },
  paymentRefNumber: { type: String, default: "" },
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
  room: {
    type: Schema.Types.ObjectId,
    ref: "Rooms",
    required: true,
  },
});

export default mongoose.model("Bookings", BookingsSchema);
