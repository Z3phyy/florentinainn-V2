import mongoose, { Schema } from 'mongoose';


const SystemSchema = new Schema({
    systemInfo: { type: String, required: true },
    paymentMin : { type: Number, required: true },
    gracePeriodHours: { type: Number, default: 2 },
    gracePeriodMinutes: { type: Number, default: 120, min: 1, max: 1440 },
    logo : { type: String, required: true },
    systemName : { type: String, required: true },
    header : { type: String, required: true },
    description : { type: String, required: true },
    heroBackground: { type: String, default: "" },
    facebook: { type: String, default: "" },
    contactEmail: { type: String, default: "" },
    securityAlertEmail: { type: String, default: "" },
    securityAlertScope: { type: String, enum: ["off", "admins", "all"], default: "admins" },
    aboutImg1: { type: String, default: "" },
    aboutImg2: { type: String, default: "" },
    aboutImg3: { type: String, default: "" },
    aboutImg4: { type: String, default: "" },
});


export default mongoose.model('Systems', SystemSchema)