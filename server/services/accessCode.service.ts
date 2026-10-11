import bcrypt from "bcrypt";
import AccountModel from "../model/account.model";
import AdminModel from "../model/admin.model";
import { normalizeAccessCode } from "../utils/validation";

export type AccessCodeOwner = "staff" | "admin";

const modelFor = (owner: AccessCodeOwner) =>
  owner === "admin" ? AdminModel : AccountModel;

export class AccessCodeService {
  static async hasAccessCode(owner: AccessCodeOwner, id: string): Promise<boolean> {
    const doc = await (modelFor(owner) as typeof AccountModel)
      .findById(id)
      .select("+accessCodeHash")
      .lean();
    return !!(doc as { accessCodeHash?: string | null } | null)?.accessCodeHash;
  }

  static async verify(owner: AccessCodeOwner, id: string, code: string): Promise<boolean> {
    const doc = await (modelFor(owner) as typeof AccountModel)
      .findById(id)
      .select("+accessCodeHash")
      .lean();
    const hash = (doc as { accessCodeHash?: string | null } | null)?.accessCodeHash;
    const normalized = normalizeAccessCode(code);
    if (!hash || !normalized) {
      return false;
    }
    return bcrypt.compare(normalized, hash);
  }

  static async set(owner: AccessCodeOwner, id: string, code: string) {
    const accessCodeHash = await bcrypt.hash(normalizeAccessCode(code), 12);
    const accessCodeUpdatedAt = new Date();
    await (modelFor(owner) as typeof AccountModel).findByIdAndUpdate(id, {
      $set: { accessCodeHash, accessCodeUpdatedAt },
    });
    return { accessCodeUpdatedAt };
  }

  static async setIfMissing(owner: AccessCodeOwner, id: string, code: string) {
    const accessCodeHash = await bcrypt.hash(normalizeAccessCode(code), 12);
    const accessCodeUpdatedAt = new Date();
    const updated = await (modelFor(owner) as typeof AccountModel).findOneAndUpdate(
      {
        _id: id,
        $or: [{ accessCodeHash: null }, { accessCodeHash: { $exists: false } }],
      },
      { $set: { accessCodeHash, accessCodeUpdatedAt } },
    );
    return !!updated;
  }
}
