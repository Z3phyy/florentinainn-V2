import mongoose, { Schema } from "mongoose";

const UsedChallengeSchema = new Schema({
  jti: { type: String, required: true, unique: true },
  accountId: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});

UsedChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("UsedChallenges", UsedChallengeSchema);
