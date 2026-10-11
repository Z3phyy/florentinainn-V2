export const PERMISSION_VALUES = [
  "frontdesk management",
  "reservation management",
  "room management",
  "chat management",
  "availability management",
  "housekeeping",
  "maintenance",
  "guest records",
  "reservation history",
] as const;

export type PermissionValue = (typeof PERMISSION_VALUES)[number];

// Operations each permission unlocks (kept for the permission matrix).
export const PERMISSION_MATRIX: Record<PermissionValue, string[]> = {
  "frontdesk management": [
    "check in guests",
    "check out guests",
    "record payments",
    "manage active stays",
  ],
  "reservation management": [
    "view",
    "update",
    "cancel",
    "activate",
    "assign room",
    "mark no-show",
    "reschedule",
  ],
  "room management": [
    "view",
    "create",
    "update",
    "delete",
    "set status",
  ],
  "chat management": ["view", "reply", "resolve", "delete"],
  "availability management": ["view calendar"],
  housekeeping: ["view board", "update status", "assign housekeeper", "mark dirty"],
  maintenance: ["toggle room maintenance"],
  "guest records": ["view", "update", "view history", "view balances"],
  "reservation history": ["view past reservations", "search & filter history"],
};

export function normalizePermission(value: string): PermissionValue | null {
  const v = (value || "").trim().toLowerCase();
  return (PERMISSION_VALUES as readonly string[]).includes(v)
    ? (v as PermissionValue)
    : null;
}

export function sanitizePermissions(value: unknown): PermissionValue[] {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((p) => (typeof p === "string" ? normalizePermission(p) : null))
    .filter((p): p is PermissionValue => !!p);
  return [...new Set(normalized)];
}
