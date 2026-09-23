import mongoose, { Schema } from 'mongoose';


const AccountSchema = new Schema({
    name: { type: String, required: true },
    position: { type: String, default: "" },
    permisions: [{ type: String, required: true }],
    email: { type: String, required: true },
    password: { type: String, required: true },
    isApproved : { type: Boolean, required: true },
    isActive : { type: Boolean, default: true },
    isSuspended : { type: Boolean, default: false },
    suspensionReason : { type: String, default: "" },
    suspendedBy : { type: String, default: "" },
    suspendedAt : { type: Date, default: null },
    deactivatedAt : { type: Date, default: null },
    deactivatedBy : { type: String, default: "" },
    rejectionReason : { type: String, default: "" },
    rejectedAt : { type: Date, default: null },
    rejectedBy : { type: String, default: "" },
    sessionVersion : { type: Number, default: 0 },
    lastLogin : { type: Date, default: null },
    notificationPrefs : {
        mutedTypes: { type: [String], default: [] },
        mutedSeverities: { type: [String], default: [] },
    },
    otp : { type: String, required: false },
    otpExpiresAt : { type: Date, required: false },
    otpAttempts : { type: Number, required: false, default: 0 },
});

AccountSchema.index({ email: 1 });
AccountSchema.index({ isApproved: 1, isActive: 1, isSuspended: 1 });

export default mongoose.model('Accounts', AccountSchema)