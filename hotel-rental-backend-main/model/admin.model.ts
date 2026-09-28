import mongoose, { Schema } from 'mongoose';

const AdminSchema = new Schema({
    name: { type: String, required: false, default: "Super Admin" },
    email: { type: String, required: true },
    password: { type: String, required: true },
    otp : { type: String, required: false },
    otpExpiresAt : { type: Date, required: false },
    otpAttempts : { type: Number, required: false, default: 0 },
    type : { type: String, required: true }, // "admin" | "super admin"
    isActive : { type: Boolean, default: true },
    isSuspended : { type: Boolean, default: false },
    suspensionReason : { type: String, default: "" },
    suspendedBy : { type: String, default: "" },
    suspendedAt : { type: Date, default: null },
    deactivatedAt : { type: Date, default: null },
    deactivatedBy : { type: String, default: "" },
    accessCodeHash : { type: String, default: null, select: false },
    accessCodeUpdatedAt : { type: Date, default: null },
    sessionVersion : { type: Number, default: 0 },
    lastLogin : { type: Date, default: null },
    notificationPrefs : {
        mutedTypes: { type: [String], default: [] },
        mutedSeverities: { type: [String], default: [] },
    },
});

export default mongoose.model('Admins', AdminSchema);