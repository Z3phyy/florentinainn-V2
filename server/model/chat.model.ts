import mongoose, { Schema } from 'mongoose';

const ChatSchema = new Schema({
    clientName: { type: String, required: true },
    status: { type: String, enum: ['active', 'resolved'], default: 'active' },
    convo: { 
        type: [{ 
            user: { type: String, required: true }, 
            message: { type: String, required: true },
            timestamp: { type: Date, default: Date.now },
            seen: { type: Boolean, default: false }
        }], 
        default: [] 
    },
}, { timestamps: true });

export default mongoose.model('Chats', ChatSchema);
