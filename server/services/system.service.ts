import SystemModel from "../model/system.model";
import { systemInterfaceInput } from "../types/system.type";

export class SystemService {

  static async get() {
    const system = await SystemModel.findOne();
    return system
  }

  static async update(data: Partial<systemInterfaceInput>) {
    const system = await SystemModel.findOneAndUpdate(
      {},
      { $set: data },
      { upsert: true, new: true }
    );
    return system
  }

  static async updateLogo(logo: string) {
    const system = await SystemModel.findOneAndUpdate(
      {},
      { $set: { logo } },
      { upsert: true, new: true }
    );
    return system
  }

  static async updateField(field: string, value: string) {
    const system = await SystemModel.findOneAndUpdate(
      {},
      { $set: { [field]: value } },
      { upsert: true, new: true }
    );
    return system
  }
}
