import AdminModel from "../model/admin.model";
import { adminInterfaceInput } from "../types/admin.type";

export class AdminService {

  static async create(data: adminInterfaceInput) {
    const existingAdmin = await AdminModel.findOne({ type: data.type });
    if (existingAdmin) {
      return null;
    }
    return AdminModel.create(data);
  }

  static async getAll() {
    const admins = AdminModel.find();
    return admins;
  }

  static async get(id: string) {
    const admin = AdminModel.findById(id);
    return admin;
  }

  static async getByEmail(email: string) {
    const admin = AdminModel.findOne({ email });
    return admin;
  }

  static async updateOtp(email: string, otp: string) {
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const admin = AdminModel.findOneAndUpdate({ email }, { $set: { otp, otpExpiresAt, otpAttempts: 0 } }, { new: true });
    return admin;
  }

  static async verifyOtp(email: string, inputOtp: string) {
    const admin = await AdminModel.findOne({ email });
    if (!admin) {
      return null;
    }

    if (!admin.otp) {
      return null;
    }

    if (admin.otpExpiresAt && admin.otpExpiresAt.getTime() < Date.now()) {
      await AdminModel.findOneAndUpdate({ email }, { $set: { otp: null, otpExpiresAt: null, otpAttempts: 0 } });
      return null;
    }

    if ((admin.otpAttempts || 0) >= 5) {
      await AdminModel.findOneAndUpdate({ email }, { $set: { otp: null, otpExpiresAt: null, otpAttempts: 0 } });
      return null;
    }

    await AdminModel.findOneAndUpdate({ email }, { $inc: { otpAttempts: 1 } });

    if (admin.otp !== inputOtp) {
      return false;
    }

    await AdminModel.findOneAndUpdate({ email }, { $set: { otpAttempts: 0 } });

    return true;
  }

  static async updatePassword(email: string, password: string) {
    const admin = AdminModel.findOneAndUpdate({ email }, { $set: { password } }, { new: true });
    return admin;
  }

  static async clearOtp(email: string) {
    const admin = AdminModel.findOneAndUpdate({ email }, { $set: { otp: null, otpExpiresAt: null, otpAttempts: 0 } }, { new: true });
    return admin;
  }

  static async updateCredentials(id: string, data: { email?: string; password?: string }) {
    const admin = await AdminModel.findByIdAndUpdate(id, { $set: data }, { new: true });
    return admin;
  }
}
