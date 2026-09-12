import paymentModel from "../model/payment.model";
import { paymentInterface, paymentInterfaceInput } from "../types/payment.type";

export class Paymentservice {

  static async getAll() {
    const payments = await paymentModel.find().sort({ _id: -1 });
    return payments;
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

  

  static async delete(id : string) {
    const payment= paymentModel.findByIdAndDelete(id);
    return payment  
}

 
  
}
