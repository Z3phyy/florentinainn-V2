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
    await AccountModel.findByIdAndUpdate(id, { isApproved: true, rejectedAt: null, rejectedReason: "" });
  }

  static async deactivate(id: string, byName: string) {
    await AccountModel.findByIdAndUpdate(id, {
      isActive: false,
      isSuspended: false,
      suspensionReason: "",
      deactivatedAt: new Date(),
      deactivatedBy: byName,
      $inc: { sessionVersion: 1 },
    });
  }

  static async reactivate(id: string) {
    await AccountModel.findByIdAndUpdate(id, {
      isActive: true,
      deactivatedAt: null,
      deactivatedBy: "",
    });
  }

  static async suspend(id: string, reason: string, byName: string) {
    await AccountModel.findByIdAndUpdate(id, {
      isSuspended: true,
      suspensionReason: reason || "",
      suspendedBy: byName,
      suspendedAt: new Date(),
      $inc: { sessionVersion: 1 },
    });
  }

  static async unsuspend(id: string) {
    await AccountModel.findByIdAndUpdate(id, {
      isSuspended: false,
      suspensionReason: "",
      suspendedBy: "",
      suspendedAt: null,
    });
  }

  static async reject(id: string, reason: string, byName: string) {
    await AccountModel.findByIdAndUpdate(id, {
      isApproved: false,
      rejectionReason: reason || "",
      rejectedAt: new Date(),
      rejectedBy: byName,
      $inc: { sessionVersion: 1 },
    });
  }

  static async bumpSessionVersion(id: string) {
    await AccountModel.findByIdAndUpdate(id, { $inc: { sessionVersion: 1 } });
  }

  static async touchLastLogin(id: string) {
    await AccountModel.findByIdAndUpdate(id, { lastLogin: new Date() });
  }

  static async resetPassword(id: string, passwordHash: string) {
    await AccountModel.findByIdAndUpdate(id, {
      password: passwordHash,
      $inc: { sessionVersion: 1 },
    });
  }

  static async list(filter: {
    search?: string;
    status?: string;
    permission?: string;
    page?: number;
    limit?: number;
    sortField?: string;
    sortDir?: "asc" | "desc";
  }) {
    const {
      search,
      status,
      permission,
      page,
      limit,
      sortField = "name",
      sortDir = "asc",
    } = filter;
    const query: Record<string, unknown> = {};

    if (search && search.trim()) {
      const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ name: rx }, { email: rx }, { position: rx }];
    }

    if (permission && permission.trim()) {
      query.permisions = permission.trim();
    }

    if (status && status !== "all") {
      if (status === "active") {
        query.isApproved = true;
        query.isActive = true;
        query.isSuspended = false;
      } else if (status === "pending") {
        query.isApproved = false;
        query.rejectedAt = null;
      } else if (status === "rejected") {
        query.rejectedAt = { $ne: null };
      } else if (status === "inactive") {
        query.isApproved = true;
        query.isActive = false;
      } else if (status === "suspended") {
        query.isApproved = true;
        query.isSuspended = true;
      }
    }

    const sort: Record<string, 1 | -1> =
      sortDir === "desc" ? { [sortField]: -1 } : { [sortField]: 1 };
    sort._id = sortDir === "desc" ? -1 : 1;

    const hasPaging = typeof page === "number" || typeof limit === "number";
    if (hasPaging) {
      const p = Math.max(1, page || 1);
      const l = Math.min(100, Math.max(1, limit || 10));
      const total = await AccountModel.countDocuments(query);
      const items = await AccountModel.find(query)
        .sort(sort)
        .skip((p - 1) * l)
        .limit(l);
      return { items, total, page: p, limit: l, totalPages: Math.ceil(total / l) };
    }

    return AccountModel.find(query).sort(sort);
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
