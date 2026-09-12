import { NotificationModel, NotificationType, NotificationSeverity, NotificationAudience } from "../model/notification.model";

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  severity?: NotificationSeverity;
  link?: string;
  targetType?: string;
  targetId?: string;
  audience?: NotificationAudience;
  permission?: string;
}

const ADMIN_AUDIENCES: NotificationAudience[] = ["admin", "all"];

const staffAudienceFilter = (permissions: string[]) => {
  const perms = permissions || [];
  const hasAll = perms.includes("all");
  return {
    audience: { $in: ["staff", "all"] },
    $or: [
      { permission: { $in: perms } },
      { permission: { $exists: false } },
      { permission: null },
      ...(hasAll ? [{ permission: { $exists: true } }] : []),
    ],
  };
};

export class NotificationService {
  static async create(input: CreateNotificationInput) {
    return NotificationModel.create({
      type: input.type,
      title: input.title,
      message: input.message,
      severity: input.severity || "info",
      link: input.link || "",
      targetType: input.targetType,
      targetId: input.targetId,
      audience: input.audience || "admin",
      permission: input.permission,
      read: false,
    });
  }

  static async getAll(limit = 100) {
    return NotificationModel.find().sort({ createdAt: -1 }).limit(limit);
  }

  static async getForAdmin(limit = 100) {
    return NotificationModel.find({ audience: { $in: ADMIN_AUDIENCES } })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  static async getForStaff(permissions: string[], limit = 100) {
    return NotificationModel.find(staffAudienceFilter(permissions))
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  static async getUnread(limit = 100) {
    return NotificationModel.find({ read: false }).sort({ createdAt: -1 }).limit(limit);
  }

  static async getUnreadCount() {
    return NotificationModel.countDocuments({ read: false });
  }

  static async getUnreadCountForAdmin() {
    return NotificationModel.countDocuments({ read: false, audience: { $in: ADMIN_AUDIENCES } });
  }

  static async getUnreadCountForStaff(permissions: string[]) {
    return NotificationModel.countDocuments({ read: false, ...staffAudienceFilter(permissions) });
  }

  static async countByType() {
    return NotificationModel.aggregate<{ _id: string; count: number }>([
      { $match: { read: false, audience: { $in: ADMIN_AUDIENCES } } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);
  }

  static async countByTypeForStaff(permissions: string[]) {
    return NotificationModel.aggregate<{ _id: string; count: number }>([
      { $match: { read: false, ...staffAudienceFilter(permissions) } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);
  }

  static async markAsRead(id: string) {
    return NotificationModel.findByIdAndUpdate(id, { read: true }, { new: true });
  }

  static async markAllAsRead() {
    const result = await NotificationModel.updateMany(
      { read: false, audience: { $in: ADMIN_AUDIENCES } },
      { $set: { read: true } }
    );
    void this.pruneRead(30);
    return result;
  }

  static async markAllAsReadForStaff(permissions: string[]) {
    const result = await NotificationModel.updateMany(
      { read: false, ...staffAudienceFilter(permissions) },
      { $set: { read: true } }
    );
    void this.pruneRead(30);
    return result;
  }

  static async pruneRead(ageDays = 30) {
    const cutoff = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);
    return NotificationModel.deleteMany({ read: true, createdAt: { $lt: cutoff } });
  }

  static async existsByDedupeKey(targetId: string, type: string, title: string) {
    return NotificationModel.exists({ targetId, type, title });
  }

  static async delete(id: string) {
    return NotificationModel.findByIdAndDelete(id);
  }

  static async deleteAllForAdmin() {
    return NotificationModel.deleteMany({ audience: { $in: ADMIN_AUDIENCES } });
  }

  static async deleteAllForStaff(permissions: string[]) {
    return NotificationModel.deleteMany(staffAudienceFilter(permissions));
  }

  static async deleteByTarget(targetType: string, targetId: string) {
    return NotificationModel.deleteMany({ targetType, targetId });
  }
}