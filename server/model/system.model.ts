import mongoose, { Schema } from 'mongoose';


const FaqSchema = new Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
  },
  { _id: false },
);

const AiKnowledgeSchema = new Schema(
  {
    location: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    frontDesk: { type: String, default: "" },
    support: { type: String, default: "" },
    checkInPolicy: { type: String, default: "" },
    checkOutPolicy: { type: String, default: "" },
    bookingPolicy: { type: String, default: "" },
    cancellationPolicy: { type: String, default: "" },
    refundPolicy: { type: String, default: "" },
    paymentPolicy: { type: String, default: "" },
    idRequirements: { type: String, default: "" },
    houseRules: { type: String, default: "" },
    petPolicy: { type: String, default: "" },
    smokingPolicy: { type: String, default: "" },
    visitorPolicy: { type: String, default: "" },
    otherPolicies: { type: String, default: "" },
    amenities: { type: [String], default: [] },
    faqs: { type: [FaqSchema], default: [] },
    instructions: { type: String, default: "" },
  },
  { _id: false },
);

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
    aiKnowledge: { type: AiKnowledgeSchema, default: () => ({}) },
});


export default mongoose.model('Systems', SystemSchema)