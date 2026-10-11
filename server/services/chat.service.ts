import ChatModel from "../model/chat.model";

export class ChatService {

  static async getAll() {
    return await ChatModel.find().sort({ createdAt: -1 });
  }

  static async get(id: string) {
    return await ChatModel.findById(id);
  }

  static async sendMessage(id: string, user: string, message: string) {
    const updateQuery: Record<string, any> = {
      $push: { convo: { user, message, timestamp: new Date() } }
    };
    // Re-activate conversation if client sends a new message
    if (user === "client") {
      updateQuery.$set = { status: "active" };
    }
    return await ChatModel.findByIdAndUpdate(id, updateQuery, { new: true });
  }

  static async updateStatus(id: string, status: "active" | "resolved") {
    return await ChatModel.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    );
  }

  static async create(clientName: string) {
    return await ChatModel.create({ clientName, status: "active", convo: [] });
  }

  static async delete(id: string) {
    return await ChatModel.findByIdAndDelete(id);
  }

  static async markAsSeen(id: string, viewer: "client" | "staff") {
    // If viewer is staff, mark all client messages as seen.
    // If viewer is client, mark all staff messages as seen.
    const targetSender = viewer === "staff" ? "client" : "staff";
    return await ChatModel.findByIdAndUpdate(
      id,
      { $set: { "convo.$[elem].seen": true } },
      {
        arrayFilters: [{ "elem.user": targetSender, "elem.seen": { $ne: true } }],
        new: true,
      }
    );
  }
}
