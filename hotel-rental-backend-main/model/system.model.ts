import mongoose, { Schema } from 'mongoose';


const SystemSchema = new Schema({
    systemInfo: { type: String, required: true },
    paymentMin : { type: Number, required: true },
    logo : { type: String, required: true },
    systemName : { type: String, required: true },
    header : { type: String, required: true },
    description : { type: String, required: true },
    heroBackground: { type: String, default: "" },
    facebook: { type: String, default: "" },
    contactEmail: { type: String, default: "" },
    aboutImg1: { type: String, default: "" },
    aboutImg2: { type: String, default: "" },
    aboutImg3: { type: String, default: "" },
    aboutImg4: { type: String, default: "" },
});


export default mongoose.model('Systems', SystemSchema)