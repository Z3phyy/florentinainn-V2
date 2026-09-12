export type NotificationType = "account" | "reservation" | "maintenance" | "chat" | "payment" | "inquiry" | "system";
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
  metadata?: Record<string, any>;
  createdAt: string;
}