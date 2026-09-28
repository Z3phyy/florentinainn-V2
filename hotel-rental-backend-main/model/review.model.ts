import mongoose, { Schema } from "mongoose";

const ReviewSchema = new Schema(
  {
    booking: { type: Schema.Types.ObjectId, ref: "Bookings", required: true, unique: true },
    room: { type: Schema.Types.ObjectId, ref: "Rooms", required: true },
    guestName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, maxlength: 1000 },
    stayArrivalDate: { type: String, default: "" },
    stayDepartureDate: { type: String, default: "" },
    status: { type: String, enum: ["published", "hidden"], default: "published" },
  },
  { timestamps: true },
);

ReviewSchema.index({ room: 1, status: 1, createdAt: -1 });

export default mongoose.model("Reviews", ReviewSchema);
