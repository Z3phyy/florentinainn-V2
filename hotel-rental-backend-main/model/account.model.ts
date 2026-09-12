import mongoose, { Schema } from 'mongoose';


const AccountSchema = new Schema({
    name: { type: String, required: true },
    permisions: [{ type: String, required: true }],
    email: { type: String, required: true },
    password: { type: String, required: true },
    isApproved : { type: Boolean, required: true },
    otp : { type: String, required: false },
    otpExpiresAt : { type: Date, required: false },
    otpAttempts : { type: Number, required: false, default: 0 },
});

export default mongoose.model('Accounts', AccountSchema)