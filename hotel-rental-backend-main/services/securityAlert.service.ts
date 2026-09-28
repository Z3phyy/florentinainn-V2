import { SystemService } from "./system.service";
import { notify } from "../utils/notification";
import { logAuditAction } from "../utils/auditLogger";
import { describeEmailFailure, sendSecurityLoginEmail } from "../utils/sendEmail";
import { HOTEL_TIME_ZONE } from "../utils/hotelTime";

export type SecurityRole = "employee" | "admin" | "super admin";

export function summarizeUserAgent(userAgent: unknown): string {
  const ua = typeof userAgent === "string" ? userAgent.slice(0, 400) : "";
  if (!ua) return "Unknown device";
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\/|Opera/.test(ua) ? "Opera" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Safari\//.test(ua) ? "Safari" :
    /curl\//i.test(ua) ? "curl" :
    "Unknown browser";
  const os =
    /Windows/.test(ua) ? "Windows" :
    /Android/.test(ua) ? "Android" :
    /iPhone|iPad|iPod/.test(ua) ? "iOS" :
    /Mac OS X|Macintosh/.test(ua) ? "macOS" :
    /Linux/.test(ua) ? "Linux" :
    "Unknown OS";
  return `${browser} on ${os}`;
}

export function sanitizeIp(ip: unknown): string {
  const value = typeof ip === "string" ? ip.replace(/^::ffff:/, "").trim() : "";
  return /^[0-9a-fA-F:.]{2,45}$/.test(value) ? value : "Unknown";
}

const ROLE_LABELS: Record<SecurityRole, string> = {
  employee: "Staff",
  admin: "Admin",
  "super admin": "Super Admin",
};

export class SecurityAlertService {
  static async loginSucceeded(input: {
    accountId: string;
    name: string;
    email: string;
    role: SecurityRole;
    ip: unknown;
    userAgent: unknown;
    at?: Date;
  }) {
    const at = input.at || new Date();
    const roleLabel = ROLE_LABELS[input.role] || "Staff";
    const ipAddress = sanitizeIp(input.ip);
    const device = summarizeUserAgent(input.userAgent);
    const occurredAt = `${at.toLocaleString("en-PH", {
      timeZone: HOTEL_TIME_ZONE,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })} (${HOTEL_TIME_ZONE})`;
    const name = input.name || roleLabel;

    await logAuditAction({
      action: "LOGIN_SUCCESS",
      details: `${roleLabel} ${name} (${input.email}) signed in from ${ipAddress} · ${device}`,
      actorName: name,
      actorRole: input.role,
      targetType: input.role === "employee" ? "staff" : "admin",
      targetId: input.accountId,
      metadata: { ipAddress, device },
    });

    await notify({
      type: "security",
      title: `Security Alert: ${roleLabel} signed in`,
      message: `${name} (${input.email}) signed in successfully at ${occurredAt} from ${ipAddress} · ${device}.`,
      severity: input.role === "employee" ? "info" : "warning",
      link: input.role === "employee" ? "/pages/admin/staff" : "/pages/admin/settings",
      targetType: input.role === "employee" ? "staff" : "admin",
      targetId: input.accountId,
      audience: "admin",
    });

    const system: any = await SystemService.get();
    const scope = system?.securityAlertScope || "admins";
    const shouldEmail = scope === "all" || (scope === "admins" && input.role !== "employee");
    const recipient = String(system?.securityAlertEmail || system?.contactEmail || process.env.HOTEL_ADMIN_EMAIL || "").trim();
    if (!shouldEmail || !recipient) return { emailed: false };

    sendSecurityLoginEmail({
      to: recipient,
      accountName: name,
      accountEmail: input.email,
      roleLabel,
      occurredAt,
      ipAddress,
      device,
    }).catch((error) => {
      const failure = describeEmailFailure(error);
      console.log(`[security] login alert email failed code=${failure.code}`);
    });
    return { emailed: true };
  }
}
