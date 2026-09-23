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

export interface NotificationPrefs {
  mutedTypes?: string[];
  mutedSeverities?: string[];
}

// Excludes notification types/severities the user has muted. Empty prefs
// (or a non-persisted account) leave the feed completely unfiltered.
const emptyPrefs = (prefs?: NotificationPrefs) => ({
  mutedTypes: prefs?.mutedTypes || [],
  mutedSeverities: prefs?.mutedSeverities || [],
});

const prefsFilter = (prefs?: NotificationPrefs) => {
  const { mutedTypes, mutedSeverities } = emptyPrefs(prefs);
  const filter: Record<string, unknown> = {};
  if (mutedTypes.length > 0) filter.type = { $nin: mutedTypes };
  if (mutedSeverities.length > 0) filter.severity = { $nin: mutedSeverities };
  return filter;
};

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

  static async getForAdmin(prefs?: NotificationPrefs, limit = 100) {
    return NotificationModel.find({
      audience: { $in: ADMIN_AUDIENCES },
      ...prefsFilter(prefs),
    })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  static async getForStaff(permissions: string[], prefs?: NotificationPrefs, limit = 100) {
    return NotificationModel.find({
      ...staffAudienceFilter(permissions),
      ...prefsFilter(prefs),
    })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  static async getUnread(limit = 100) {
    return NotificationModel.find({ read: false }).sort({ createdAt: -1 }).limit(limit);
  }

  static async getUnreadCount() {
    return NotificationModel.countDocuments({ read: false });
  }

  static async getUnreadCountForAdmin(prefs?: NotificationPrefs) {
    return NotificationModel.countDocuments({
      read: false,
      audience: { $in: ADMIN_AUDIENCES },
      ...prefsFilter(prefs),
    });
  }

  static async getUnreadCountForStaff(permissions: string[], prefs?: NotificationPrefs) {
    return NotificationModel.countDocuments({
      read: false,
      ...staffAudienceFilter(permissions),
      ...prefsFilter(prefs),
    });
  }

  static async countByType(prefs?: NotificationPrefs) {
    return NotificationModel.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          read: false,
          audience: { $in: ADMIN_AUDIENCES },
          ...prefsFilter(prefs),
        },
      },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);
  }

  static async countByTypeForStaff(permissions: string[], prefs?: NotificationPrefs) {
    return NotificationModel.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          read: false,
          ...staffAudienceFilter(permissions),
          ...prefsFilter(prefs),
        },
      },
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