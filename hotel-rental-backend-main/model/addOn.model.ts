import mongoose, { Schema } from "mongoose";

const AddOnSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    pricingUnit: { type: String, enum: ["per_stay", "per_night"], default: "per_stay" },
    maxPerBooking: { type: Number, default: 1, min: 1 },
    stock: { type: Number, default: null, min: 0 },
    isActive: { type: Boolean, default: true },
    lockVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

AddOnSchema.index({ isActive: 1, name: 1 });

export default mongoose.model("AddOns", AddOnSchema);
