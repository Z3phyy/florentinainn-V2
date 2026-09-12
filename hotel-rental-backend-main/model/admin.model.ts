import mongoose, { Schema } from 'mongoose';

const AdminSchema = new Schema({
    name: { type: String, required: false, default: "Super Admin" },
    email: { type: String, required: true },
    password: { type: String, required: true },
    otp : { type: String, required: false },
    otpExpiresAt : { type: Date, required: false },
    otpAttempts : { type: Number, required: false, default: 0 },
    type : { type: String, required: true }, // "admin" | "super admin"
});

export default mongoose.model('Admins', AdminSchema);