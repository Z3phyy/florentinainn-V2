export const PERMISSION_VALUES = [
  "frontdesk management",
  "reservation management",
  "room management",
  "chat management",
  "availability management",
  "housekeeping",
  "maintenance",
  "guest records",
  "reports",
  "payments",
  "notifications",
  "audit logs",
] as const;

export type PermissionValue = (typeof PERMISSION_VALUES)[number];

// Operations each permission unlocks (kept for the permission matrix).
// Backend enforcement maps an endpoint to a required permission below.
export const PERMISSION_MATRIX: Record<PermissionValue, string[]> = {
  "frontdesk management": [
    "check in guests",
    "check out guests",
    "record payments",
    "manage active stays",
  ],
  "reservation management": [
    "view",
    "create",
    "update",
    "cancel",
    "activate",
    "assign room",
    "extend stay",
    "mark no-show",
    "reschedule",
  ],
  "room management": [
    "view",
    "create",
    "update",
    "delete",
    "manage maintenance",
    "set status",
  ],
  "chat management": ["view", "reply", "resolve", "delete"],
  "availability management": ["view calendar", "update availability"],
  housekeeping: ["view tasks", "assign", "update status", "mark inspected"],
  maintenance: ["create request", "assign", "update status", "complete"],
  "guest records": ["view", "update", "view history", "view balances"],
  reports: ["view", "export"],
  payments: ["view payment history", "record payment", "process refund"],
  notifications: ["view", "send"],
  "audit logs": ["view"],
};

// Map route prefixes/paths to the permission required for a staff member.
// Admins/super admins bypass permission checks (they hold "all").
export const ROUTE_PERMISSIONS: { match: string; permission: PermissionValue }[] = [
  { match: "GET /booking", permission: "reservation management" },
  { match: "POST /booking/", permission: "frontdesk management" },
  { match: "PUT /booking", permission: "reservation management" },
  { match: "DELETE /booking", permission: "reservation management" },
  { match: "POST /booking/checkout", permission: "frontdesk management" },
  { match: "POST /booking/partialPayment", permission: "frontdesk management" },
  { match: "POST /booking/reservation/active", permission: "reservation management" },
  { match: "POST /booking/reservation/cancel", permission: "reservation management" },
  { match: "POST /room", permission: "room management" },
  { match: "PUT /room", permission: "room management" },
  { match: "DELETE /room", permission: "room management" },
  { match: "POST /room/images", permission: "room management" },
  { match: "DELETE /room/images", permission: "room management" },
  { match: "PATCH /room/maintenance", permission: "maintenance" },
  { match: "PATCH /room/discount", permission: "room management" },
  { match: "GET /system/chat", permission: "chat management" },
  { match: "GET /system/audit-logs", permission: "audit logs" },
];

export function normalizePermission(value: string): PermissionValue | null {
  const v = (value || "").trim().toLowerCase();
  return (PERMISSION_VALUES as readonly string[]).includes(v)
    ? (v as PermissionValue)
    : null;
}
