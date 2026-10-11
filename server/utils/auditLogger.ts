import { AuditLogModel } from "../model/audit.model";

interface LogAuditParams {
  action: string;
  details: string;
  actorName?: string;
  actorRole?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, any>;
}

export async function logAuditAction(params: LogAuditParams): Promise<void> {
  try {
    await AuditLogModel.create({
      action: params.action,
      details: params.details,
      actorName: params.actorName || "Administrator",
      actorRole: params.actorRole || "admin",
      targetType: params.targetType || "system",
      targetId: params.targetId,
      metadata: params.metadata || {},
    });
  } catch (err) {
    console.error("Audit logging error:", err);
  }
}
