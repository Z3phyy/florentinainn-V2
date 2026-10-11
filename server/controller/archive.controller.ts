import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { ARCHIVE_TYPES, ArchiveError, ArchiveService, ArchiveType } from "../services/archive.service";
import { logAuditAction } from "../utils/auditLogger";

const parseType = (value: unknown): ArchiveType | null =>
  typeof value === "string" && (ARCHIVE_TYPES as readonly string[]).includes(value) ? (value as ArchiveType) : null;

const ensureAllowed = (request: AuthRequest, response: Response, type: ArchiveType) => {
  if (type === "staff" && request.account?.type !== "super admin") {
    response.status(403).json({ message: "Only the super admin can view or restore archived staff accounts." });
    return false;
  }
  return true;
};

export class ArchiveController {
  static list = async (request: AuthRequest, response: Response) => {
    const type = parseType(request.params.type);
    if (!type) {
      response.status(400).json({ message: "Unknown archive type." });
      return;
    }
    if (!ensureAllowed(request, response, type)) return;
    try {
      response.send(
        await ArchiveService.list(type, {
          search: typeof request.query.search === "string" ? request.query.search : "",
          page: Number(request.query.page),
          limit: Number(request.query.limit),
        }),
      );
    } catch (error) {
      console.log("Failed to list archive: " + (error as Error).message);
      response.status(500).json({ message: "Failed to load archived records" });
    }
  };

  static restore = async (request: AuthRequest, response: Response) => {
    const type = parseType(request.params.type);
    if (!type) {
      response.status(400).json({ message: "Unknown archive type." });
      return;
    }
    if (!ensureAllowed(request, response, type)) return;
    const id = String(request.params.id || "");
    try {
      const result = await ArchiveService.restore(type, id);
      await logAuditAction({
        action: "RECORD_RESTORED",
        details: `Restored archived ${type.replace(/s$/, "")}: ${result.label}`,
        actorName: request.account?.name || "Administrator",
        actorRole: request.account?.type || "admin",
        targetType: type,
        targetId: id,
      });
      response.send({ message: `${result.label} restored.` });
    } catch (error) {
      if (error instanceof ArchiveError) {
        response.status(error.status).json({ message: error.message });
        return;
      }
      console.log("Failed to restore record: " + (error as Error).message);
      response.status(500).json({ message: "Failed to restore record" });
    }
  };
}
