export type NotificationType = "account" | "reservation" | "maintenance" | "chat" | "payment" | "inquiry" | "system" | "housekeeping";
export type NotificationSeverity = "info" | "success" | "warning" | "danger";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  status: string;
  read: boolean;
  timestamp: string;
  link: string;
}

export interface NotificationPrefs {
  mutedTypes: string[];
  mutedSeverities: string[];
}

export interface NotificationResponse {
  totalUnread: number;
  pendingAccountsCount: number;
  recentBookingsCount: number;
  maintenanceCount: number;
  activeChatsCount: number;
  items: NotificationItem[];
}

export interface AuditLog {
  _id: string;
  action: string;
  details: string;
  actorName: string;
  actorRole: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}