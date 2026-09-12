import AccountModel from "../model/account.model"
import { accountInterface, accountInterfaceInput } from "../types/accounts.type";


export class AccountService {

  static async create(data : accountInterfaceInput) {
    return await AccountModel.create(data)
  }

  static async getAll() {
    const accounts = AccountModel.find();
    return accounts
  }

  static async get(id : string) {
    const account = AccountModel.findById(id);
    return account
  }

  static async delete(id : string) {
    const account = AccountModel.findByIdAndDelete(id);
    return account
  }

  static async update(id : string, data : accountInterfaceInput) {
    await AccountModel.findByIdAndUpdate(id, data);
  }

  static async approve(id : string) {
    await AccountModel.findByIdAndUpdate(id, { isApproved: true });
  }

  static async checkEmail(email: string) {
    const account = AccountModel.findOne({ email });
    return account
  }

  static async changeCredentials(id: string, data: { name?: string; email?: string; password?: string }) {
    const updateData: Record<string, string> = {};
    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email;
    if (data.password) updateData.password = data.password;
    const account = await AccountModel.findByIdAndUpdate(id, updateData, { new: true });
    return account;
  }


  static async updateOtp(email: string, otp: string) {
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const account = AccountModel.findOneAndUpdate({ email }, { $set: { otp, otpExpiresAt, otpAttempts: 0 } }, { new: true });
    return account;
  }

  static async verifyOtp(email: string, inputOtp: string) {
    const account = await AccountModel.findOne({ email });
    if (!account) {
      return null;
    }

    if (!account.otp) {
      return null;
    }

    if (account.otpExpiresAt && account.otpExpiresAt.getTime() < Date.now()) {
      await AccountModel.findOneAndUpdate({ email }, { $set: { otp: null, otpExpiresAt: null, otpAttempts: 0 } });
      return null;
    }

    if ((account.otpAttempts || 0) >= 5) {
      await AccountModel.findOneAndUpdate({ email }, { $set: { otp: null, otpExpiresAt: null, otpAttempts: 0 } });
      return null;
    }

    await AccountModel.findOneAndUpdate({ email }, { $inc: { otpAttempts: 1 } });

    if (account.otp !== inputOtp) {
      return false;
    }

    await AccountModel.findOneAndUpdate({ email }, { $set: { otpAttempts: 0 } });

    return true;
  }

  static async updatePassword(email: string, password: string) {
    const account = AccountModel.findOneAndUpdate({ email }, { $set: { password } }, { new: true });
    return account;
  }

  static async clearOtp(email: string) {
    const account = AccountModel.findOneAndUpdate({ email }, { $set: { otp: null, otpExpiresAt: null, otpAttempts: 0 } }, { new: true });
    return account;
  }


}
