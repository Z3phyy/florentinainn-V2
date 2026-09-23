import mongoose, { Schema } from 'mongoose';

const HousekeepingHistorySchema = new Schema(
  {
    status: { type: String, required: true },
    from: { type: String, default: "" },
    note: { type: String, default: "" },
    changedBy: { type: String, default: "" },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const MaintenanceHistorySchema = new Schema(
  {
    action: { type: String, required: true },
    note: { type: String, default: "" },
    changedBy: { type: String, default: "" },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const RoomSchema = new Schema({
    roomNumber: { type: String, default: "" },
    category: { type: String, required: true },
    amenities: [{ type: String, required: true }],
    bedding: [{ type: String, default: [] }],
    price: { type: Number, required: true },
    description: { type: String, required: true },
    discount: { type: Number, required: true },
    image: { type: String, required: true },
    images: [{ type: String, required: true }],
    status: { type: String, required: true },
    maintenance: { type: String },
    maxHead: { type: Number, required: true },
    housekeeping: [{ type: String, required: true }],
    housekeepingStatus: {
      type: String,
      enum: ["clean", "dirty", "cleaning", "inspected", "out-of-service"],
      default: "clean",
    },
    assignedHousekeeper: { type: String, default: "" },
    housekeepingStartedAt: { type: Date, default: null },
    housekeepingUpdatedAt: { type: Date, default: null },
    housekeepingNotes: { type: String, default: "" },
    housekeepingHistory: { type: [HousekeepingHistorySchema], default: [] },
    maintenanceReason: { type: String, default: "" },
    assignedMaintainer: { type: String, default: "" },
    maintenanceStartedAt: { type: Date, default: null },
    maintenanceCompletedAt: { type: Date, default: null },
    maintenanceNotes: { type: String, default: "" },
    maintenanceHistory: { type: [MaintenanceHistorySchema], default: [] },
});

export default mongoose.model('Rooms', RoomSchema)