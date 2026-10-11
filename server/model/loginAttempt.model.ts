import mongoose, { Schema } from "mongoose";

export interface LoginAttemptDoc {
  key: string;
  scope: string;
  failedAttempts: number;
  firstFailedAt: Date | null;
  lastFailedAt: Date | null;
  lockedUntil: Date | null;
  expiresAt: Date;
}

const LoginAttemptSchema = new Schema<LoginAttemptDoc>(
  {
    key: { type: String, required: true, unique: true },
    scope: { type: String, required: true },
    failedAttempts: { type: Number, default: 0 },
    firstFailedAt: { type: Date, default: null },
    lastFailedAt: { type: Date, default: null },
    lockedUntil: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

LoginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("LoginAttempts", LoginAttemptSchema);
