import mongoose, { Schema, Document } from "mongoose";

export type NotificationType = "account" | "reservation" | "maintenance" | "chat" | "payment" | "inquiry" | "system";
export type NotificationAudience = "admin" | "staff" | "all";
export type NotificationSeverity = "info" | "success" | "warning" | "danger";

export interface INotification extends Document {
  type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  link?: string;
  targetType?: string;
  targetId?: string;
  audience: NotificationAudience;
  permission?: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ["account", "reservation", "maintenance", "chat", "payment", "inquiry", "system"],
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    severity: {
      type: String,
      default: "info",
      enum: ["info", "success", "warning", "danger"],
    },
    link: { type: String, default: "" },
    targetType: { type: String },
    targetId: { type: String },
    audience: {
      type: String,
      default: "admin",
      enum: ["admin", "staff", "all"],
    },
    permission: { type: String },
    read: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

NotificationSchema.index({ read: 1, audience: 1, createdAt: -1 });

export const NotificationModel = mongoose.model<INotification>("Notification", NotificationSchema);