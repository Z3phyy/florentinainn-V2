import mongoose, { Schema } from 'mongoose';


const PaymentSchema = new Schema({
    date: { type: String, required: true },
    amount: { type: Number, required: true },
    receivedBy: { type: String, required: true },
    paymentBy: { type: String, required: true },
    method: { type: String, default: "Cash" },
    refNumber: { type: String, default: "" },
    folio: { type: String, default: "" },
    balance: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model('Payments', PaymentSchema)