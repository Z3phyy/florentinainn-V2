import fs from "fs";
import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import {
  BackupService,
  BackupError,
  RESTORE_CONFIRMATION_PHRASE,
} from "../services/backup.service";
import { logAuditAction } from "../utils/auditLogger";
import { isValidObjectId } from "../utils/validation";

const handleError = (response: Response, error: unknown, fallback: string) => {
  if (error instanceof BackupError) {
    response.status(error.status).json({ message: error.message });
    return;
  }
  console.log(`${fallback}: ` + (error as Error).message);
  response.status(500).json({ message: fallback });
};

const safeFileName = (name: string) => name.replace(/[^A-Za-z0-9._-]/g, "_");

export class BackupController {
  static list = async (request: AuthRequest, response: Response) => {
    try {
      response.send(
        await BackupService.list({
          page: Number(request.query.page),
          limit: Number(request.query.limit),
        }),
      );
    } catch (error) {
      handleError(response, error, "Failed to load backups");
    }
  };

  static create = async (request: AuthRequest, response: Response) => {
    const actorName = request.account?.name || "Administrator";
    try {
      const record = await BackupService.create(actorName);
      await logAuditAction({
        action: "BACKUP_CREATED",
        details: `Generated backup ${record.name} (${record.documentCount} document(s) across ${record.collections.length} collection(s))`,
        actorName,
        actorRole: request.account?.type || "admin",
        targetType: "backup",
        targetId: String(record._id),
      });
      response.status(201).send(BackupService.serialize(record));
    } catch (error) {
      await logAuditAction({
        action: "BACKUP_FAILED",
        details: `Backup generation failed: ${(error as Error).message}`,
        actorName,
        actorRole: request.account?.type || "admin",
        targetType: "backup",
      });
      handleError(response, error, "Failed to generate backup");
    }
  };

  static download = async (request: AuthRequest, response: Response) => {
    try {
      const id = String(request.params.id || "");
      if (!isValidObjectId(id)) {
        response.status(400).json({ message: "Invalid backup id" });
        return;
      }
      const { record, length, stream } = await BackupService.openDownload(id);
      await logAuditAction({
        action: "BACKUP_DOWNLOADED",
        details: `Downloaded backup ${record.name}`,
        actorName: request.account?.name || "Administrator",
        actorRole: request.account?.type || "admin",
        targetType: "backup",
        targetId: id,
      });
      response.setHeader("Content-Type", "application/gzip");
      response.setHeader("Content-Length", String(length));
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeFileName(record.name)}.ndjson.gz"`,
      );
      response.setHeader("Cache-Control", "no-store");
      stream.on("error", () => {
        if (!response.headersSent) {
          response.status(500).json({ message: "Failed to read backup file" });
        } else {
          response.destroy();
        }
      });
      stream.pipe(response);
    } catch (error) {
      handleError(response, error, "Failed to download backup");
    }
  };

  static upload = async (request: AuthRequest, response: Response) => {
    const file = request.file;
    if (!file) {
      response.status(400).json({ message: "Select a backup file (.ndjson.gz) to upload." });
      return;
    }
    const actorName = request.account?.name || "Administrator";
    try {
      const record = await BackupService.importUpload(file.path, actorName);
      await logAuditAction({
        action: "BACKUP_UPLOADED",
        details: `Uploaded backup file as ${record.name} (${record.documentCount} document(s))`,
        actorName,
        actorRole: request.account?.type || "admin",
        targetType: "backup",
        targetId: String(record._id),
      });
      response.status(201).send(BackupService.serialize(record));
    } catch (error) {
      handleError(response, error, "Failed to upload backup");
    } finally {
      fs.promises.unlink(file.path).catch(() => undefined);
    }
  };

  static restore = async (request: AuthRequest, response: Response) => {
    const id = String(request.params.id || "");
    const actorName = request.account?.name || "Administrator";
    try {
      if (!isValidObjectId(id)) {
        response.status(400).json({ message: "Invalid backup id" });
        return;
      }
      if (request.body?.confirmation !== RESTORE_CONFIRMATION_PHRASE) {
        response.status(400).json({
          message: `Type ${RESTORE_CONFIRMATION_PHRASE} to confirm the restore.`,
        });
        return;
      }
      const result = await BackupService.restore(id, actorName);
      await logAuditAction({
        action: "BACKUP_RESTORED",
        details: `Restored backup ${result.backup.name}: ${result.documentCount} document(s) across ${result.restoredCollections.length} collection(s). Safety backup: ${result.safetyBackup.name}`,
        actorName,
        actorRole: request.account?.type || "admin",
        targetType: "backup",
        targetId: id,
      });
      response.send({
        message: "Backup restored successfully",
        restoredCollections: result.restoredCollections,
        documentCount: result.documentCount,
        safetyBackup: BackupService.serialize(result.safetyBackup),
      });
    } catch (error) {
      await logAuditAction({
        action: "BACKUP_RESTORE_FAILED",
        details: `Restore of backup ${id} failed: ${(error as Error).message}`,
        actorName,
        actorRole: request.account?.type || "admin",
        targetType: "backup",
        targetId: id,
      });
      handleError(response, error, "Failed to restore backup");
    }
  };

  static remove = async (request: AuthRequest, response: Response) => {
    try {
      const id = String(request.params.id || "");
      if (!isValidObjectId(id)) {
        response.status(400).json({ message: "Invalid backup id" });
        return;
      }
      const record = await BackupService.remove(id);
      await logAuditAction({
        action: "BACKUP_DELETED",
        details: `Deleted backup ${record.name}`,
        actorName: request.account?.name || "Administrator",
        actorRole: request.account?.type || "admin",
        targetType: "backup",
        targetId: id,
      });
      response.send({ message: "Backup deleted" });
    } catch (error) {
      handleError(response, error, "Failed to delete backup");
    }
  };
}
