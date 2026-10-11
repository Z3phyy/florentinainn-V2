import { Request, Response, NextFunction } from "express";
import os from "os";
import path from "path";
import crypto from "crypto";
import multer from "multer";

export const backupUpload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (request, file, cb) => {
      cb(null, `florentina-backup-upload-${crypto.randomBytes(12).toString("hex")}.gz`);
    },
  }),
  limits: { fileSize: 512 * 1024 * 1024, files: 1 },
  fileFilter: (request, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (ext !== ".gz") {
      cb(new Error("INVALID_BACKUP_FILE"));
      return;
    }
    cb(null, true);
  },
});

export const handleBackupUpload = (
  request: Request,
  response: Response,
  next: NextFunction,
) => {
  backupUpload.single("file")(request, response, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      response.status(413).json({ message: "Backup file is too large (maximum 512 MB)." });
      return;
    }
    if (error instanceof Error && error.message === "INVALID_BACKUP_FILE") {
      response.status(400).json({ message: "Only .ndjson.gz backup files are accepted." });
      return;
    }
    response.status(400).json({ message: "Backup upload failed." });
  });
};
