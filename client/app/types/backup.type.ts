export interface backupInterface {
  _id: string;
  name: string;
  status: "in_progress" | "completed" | "failed";
  source: "manual" | "pre-restore" | "upload";
  size: number;
  documentCount: number;
  collections: { name: string; count: number }[];
  createdBy: string;
  error: string;
  createdAt: string;
  completedAt: string | null;
  lastRestoredAt: string | null;
  lastRestoredBy: string;
  restoreCount: number;
}

export interface backupListResult {
  items: backupInterface[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
