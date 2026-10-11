import mongoose, { Schema } from "mongoose";

export type BackupStatus = "in_progress" | "completed" | "failed";
export type BackupSource = "manual" | "pre-restore" | "upload";

const BackupCollectionSchema = new Schema(
  {
    name: { type: String, required: true },
    count: { type: Number, default: 0 },
  },
  { _id: false },
);

const BackupSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["in_progress", "completed", "failed"],
      default: "in_progress",
    },
    source: {
      type: String,
      enum: ["manual", "pre-restore", "upload"],
      default: "manual",
    },
    fileId: { type: Schema.Types.ObjectId, default: null },
    size: { type: Number, default: 0 },
    documentCount: { type: Number, default: 0 },
    collections: { type: [BackupCollectionSchema], default: [] },
    createdBy: { type: String, default: "" },
    error: { type: String, default: "" },
    completedAt: { type: Date, default: null },
    lastRestoredAt: { type: Date, default: null },
    lastRestoredBy: { type: String, default: "" },
    restoreCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

BackupSchema.index({ createdAt: -1 });

export default mongoose.model("Backups", BackupSchema);
