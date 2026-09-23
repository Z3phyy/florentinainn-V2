import paymentModel from "../model/payment.model";
import { paymentInterface, paymentInterfaceInput } from "../types/payment.type";

export class Paymentservice {

  static async getAll() {
    const payments = await paymentModel.find().sort({ _id: -1 });
    return payments;
  }

  static async list(options: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}) {
    const page = Math.max(Number(options.page) || 1, 1);
    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 200);
    const search = (options.search || "").trim();

    const filter: Record<string, unknown> = {};
    if (search) {
      const re = {
        $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      };
      filter.$or = [
        { paymentBy: re },
        { receivedBy: re },
        { refNumber: re },
        { folio: re },
        { method: re },
      ];
    }

    const [items, total] = await Promise.all([
      paymentModel
        .find(filter)
        .sort({ _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      paymentModel.countDocuments(filter),
    ]);
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  static async get( id : string) {
    const payment = paymentModel.findById(id);
    return payment
  }

  static async create(data : paymentInterfaceInput) {
    await paymentModel.create(data)
  }

  static async update(id : string, data : paymentInterfaceInput) {
    await paymentModel.findByIdAndUpdate(id, data);
  }

  static async markRefunded(id: string, data: {
    refundedBy: string;
    refundReason: string;
    refundRef?: string;
  }) {
    const payment = await paymentModel.findByIdAndUpdate(id, {
      status: "refunded",
      refundedAt: new Date(),
      refundedBy: data.refundedBy,
      refundReason: data.refundReason,
      refundRef: data.refundRef || "",
    });
    return payment;
  }

  

  static async delete(id : string) {
    const payment= paymentModel.findByIdAndDelete(id);
    return payment  
}

 
  
}
