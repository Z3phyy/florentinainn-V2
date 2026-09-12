import mongoose, { Schema } from 'mongoose';


const RoomSchema = new Schema({
    roomNumber: { type: String, default: "" },
    category: { type: String, required: true },
    amenities: [{ type: String, required: true }],
    bedding: [{ type: String, default: [] }],
    price: { type: Number, required: true },
    description: { type: String, required: true },
    discount: { type: Number, required: true },
    image: { type: String, required: true },
    images: [{ type: String, required: true }],
    status: { type: String, required: true },
    maintenance: { type: String },
    maxHead: { type: Number, required: true },
    housekeeping: [{ type: String, required: true }],
});

export default mongoose.model('Rooms', RoomSchema)