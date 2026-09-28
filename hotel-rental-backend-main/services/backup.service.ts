import crypto from "crypto";
import fs from "fs";
import readline from "readline";
import zlib from "zlib";
import { pipeline } from "stream/promises";
import { Readable, Writable } from "stream";
import mongoose from "mongoose";
import BackupModel, { BackupSource } from "../model/backup.model";
import AccountModel from "../model/account.model";

const { EJSON, ObjectId } = mongoose.mongo.BSON;

export const BACKUP_FORMAT = "florentina-inn-backup";
export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_BUCKET = "backupfiles";
export const RESTORE_CONFIRMATION_PHRASE = "RESTORE";

const STAGING_PREFIX = "__restore_";
const INSERT_BATCH_SIZE = 500;
const STALE_OPERATION_MS = 30 * 60 * 1000;

const BACKUP_EXCLUDED = new Set([
  "backups",
  `${BACKUP_BUCKET}.files`,
  `${BACKUP_BUCKET}.chunks`,
  "loginattempts",
]);

const RESTORE_EXCLUDED = new Set([...BACKUP_EXCLUDED, "admins"]);

const COLLECTION_NAME_PATTERN = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/;

export class BackupError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface BackupSummary {
  collections: { name: string; count: number }[];
  documentCount: number;
}

let activeOperation: string | null = null;

const getDb = () => {
  const db = mongoose.connection.db;
  if (!db || mongoose.connection.readyState !== 1) {
    throw new BackupError("Database connection unavailable", 503);
  }
  return db;
};

const getBucket = () =>
  new mongoose.mongo.GridFSBucket(getDb(), { bucketName: BACKUP_BUCKET });

const isValidCollectionName = (name: unknown): name is string =>
  typeof name === "string" &&
  name.length > 0 &&
  name.length <= 120 &&
  COLLECTION_NAME_PATTERN.test(name) &&
  !name.startsWith("system.") &&
  !name.startsWith(STAGING_PREFIX);

const buildBackupName = () => {
  const stamp = new Date()
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[:]/g, "-");
  return `backup-${stamp}-${crypto.randomBytes(3).toString("hex")}`;
};

const safeErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  return message.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, "[redacted]").slice(0, 500);
};

const writeLine = async (stream: Writable, line: string) => {
  if (stream.destroyed || stream.writableEnded) {
    throw new Error("Backup stream was closed unexpectedly");
  }
  if (stream.write(line + "\n")) return;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      stream.off("drain", onDrain);
      stream.off("close", onClose);
      stream.off("error", onError);
    };
    const onDrain = () => {
      cleanup();
      resolve();
    };
    const onClose = () => {
      cleanup();
      reject(new Error("Backup stream was closed unexpectedly"));
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    stream.on("drain", onDrain);
    stream.on("close", onClose);
    stream.on("error", onError);
  });
};

async function acquireLock(operation: string) {
  if (activeOperation) {
    throw new BackupError(
      `Another backup operation (${activeOperation}) is in progress. Please wait for it to finish.`,
      409,
    );
  }
  activeOperation = operation;
  try {
    const running = await BackupModel.findOne({
      status: "in_progress",
      createdAt: { $gte: new Date(Date.now() - STALE_OPERATION_MS) },
    }).lean();
    if (running) {
      throw new BackupError(
        "Another backup is currently being generated. Please wait for it to finish.",
        409,
      );
    }
  } catch (error) {
    activeOperation = null;
    throw error;
  }
}

function releaseLock() {
  activeOperation = null;
}

async function createRecord(source: BackupSource, createdBy: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await BackupModel.create({
        name: buildBackupName(),
        source,
        createdBy,
        status: "in_progress",
      });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  }
  throw new BackupError("Could not allocate a unique backup name", 500);
}

async function deleteGridFile(fileId: unknown) {
  if (!fileId) return;
  try {
    await getBucket().delete(new ObjectId(String(fileId)));
  } catch {
    return;
  }
}

async function writeBackup(record: InstanceType<typeof BackupModel>) {
  const db = getDb();
  const bucket = getBucket();
  const collectionInfos = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .filter((name) => isValidCollectionName(name) && !BACKUP_EXCLUDED.has(name))
    .sort();

  const gzip = zlib.createGzip();
  const upload = bucket.openUploadStream(`${record.name}.ndjson.gz`, {
    metadata: { backupId: String(record._id), format: BACKUP_FORMAT },
  });
  let uploadError: unknown = null;
  const uploadDone = pipeline(gzip, upload).catch((error) => {
    uploadError = error;
  });

  const counts: { name: string; count: number }[] = [];
  let documentCount = 0;

  try {
    await writeLine(
      gzip,
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: BACKUP_FORMAT_VERSION,
        createdAt: new Date().toISOString(),
        collections: collectionInfos,
      }),
    );

    for (const name of collectionInfos) {
      let count = 0;
      const cursor = db.collection(name).find({}, { batchSize: 500 });
      for await (const doc of cursor) {
        await writeLine(gzip, EJSON.stringify({ c: name, d: doc }, { relaxed: false }));
        count += 1;
      }
      counts.push({ name, count });
      documentCount += count;
    }
    gzip.end();
    await uploadDone;
    if (uploadError) throw uploadError;
  } catch (error) {
    gzip.destroy();
    await uploadDone;
    await deleteGridFile(upload.id);
    throw uploadError || error;
  }

  return { fileId: upload.id, size: upload.length, collections: counts, documentCount };
}

async function validateStream(input: Readable): Promise<BackupSummary> {
  const gunzip = zlib.createGunzip();
  const lines = readline.createInterface({
    input: input.pipe(gunzip),
    crlfDelay: Infinity,
  });
  input.on("error", (err) => gunzip.destroy(err));

  let header: { format?: string; version?: number; collections?: unknown } | null = null;
  const counts = new Map<string, number>();
  let documentCount = 0;
  let lineNumber = 0;

  try {
    for await (const line of lines) {
      lineNumber += 1;
      if (!line.trim()) continue;
      if (!header) {
        try {
          header = JSON.parse(line);
        } catch {
          throw new BackupError("Backup file header is not valid JSON.");
        }
        if (
          header?.format !== BACKUP_FORMAT ||
          header?.version !== BACKUP_FORMAT_VERSION ||
          !Array.isArray(header?.collections) ||
          !(header.collections as unknown[]).every(isValidCollectionName)
        ) {
          throw new BackupError("File is not a supported Florentina Inn backup.");
        }
        for (const name of header.collections as string[]) counts.set(name, 0);
        continue;
      }

      let entry: { c?: unknown; d?: unknown };
      try {
        entry = EJSON.parse(line, { relaxed: false }) as { c?: unknown; d?: unknown };
      } catch {
        throw new BackupError(`Backup file is corrupted (line ${lineNumber}).`);
      }
      if (
        !isValidCollectionName(entry.c) ||
        !counts.has(entry.c) ||
        !entry.d ||
        typeof entry.d !== "object" ||
        Array.isArray(entry.d) ||
        !("_id" in (entry.d as object))
      ) {
        throw new BackupError(`Backup file contains an invalid record (line ${lineNumber}).`);
      }
      counts.set(entry.c, (counts.get(entry.c) || 0) + 1);
      documentCount += 1;
    }
  } catch (error) {
    if (error instanceof BackupError) throw error;
    throw new BackupError("Backup file could not be read. It may be corrupted or not gzip-compressed.");
  }

  if (!header) {
    throw new BackupError("Backup file is empty.");
  }

  return {
    collections: Array.from(counts.entries()).map(([name, count]) => ({ name, count })),
    documentCount,
  };
}

async function dropStaging(names: string[]) {
  const db = getDb();
  for (const name of names) {
    try {
      await db.collection(name).drop();
    } catch {
      continue;
    }
  }
}

export class BackupService {
  static serialize(doc: any) {
    return {
      _id: String(doc._id),
      name: doc.name,
      status: doc.status,
      source: doc.source,
      size: doc.size || 0,
      documentCount: doc.documentCount || 0,
      collections: (doc.collections || []).map((c: { name: string; count: number }) => ({
        name: c.name,
        count: c.count,
      })),
      createdBy: doc.createdBy || "",
      error: doc.error || "",
      createdAt: doc.createdAt,
      completedAt: doc.completedAt,
      lastRestoredAt: doc.lastRestoredAt,
      lastRestoredBy: doc.lastRestoredBy || "",
      restoreCount: doc.restoreCount || 0,
    };
  }

  static async recoverInterrupted() {
    const interrupted = await BackupModel.find({ status: "in_progress" });
    for (const record of interrupted) {
      try {
        const files = await getBucket()
          .find({ "metadata.backupId": String(record._id) })
          .toArray();
        for (const file of files) {
          await deleteGridFile(file._id);
        }
      } catch {
        continue;
      }
      record.set({
        status: "failed",
        fileId: null,
        error: "Interrupted before completion (server restarted).",
        completedAt: new Date(),
      });
      await record.save();
    }
    return interrupted.length;
  }

  static async list(options: { page?: number; limit?: number } = {}) {
    const page = Math.max(1, Math.floor(Number(options.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(options.limit) || 20)));
    const [items, total] = await Promise.all([
      BackupModel.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      BackupModel.countDocuments(),
    ]);
    return {
      items: items.map(BackupService.serialize),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  static async get(id: string) {
    return BackupModel.findById(id);
  }

  private static async runBackup(source: BackupSource, createdBy: string) {
    const record = await createRecord(source, createdBy);
    try {
      const result = await writeBackup(record);
      record.set({
        status: "completed",
        fileId: result.fileId,
        size: result.size,
        collections: result.collections,
        documentCount: result.documentCount,
        completedAt: new Date(),
        error: "",
      });
      await record.save();
      return record;
    } catch (error) {
      record.set({ status: "failed", error: safeErrorMessage(error), completedAt: new Date() });
      await record.save().catch(() => undefined);
      throw new BackupError(`Backup failed: ${safeErrorMessage(error)}`, 500);
    }
  }

  static async create(createdBy: string) {
    await acquireLock("backup");
    try {
      return await BackupService.runBackup("manual", createdBy);
    } finally {
      releaseLock();
    }
  }

  static async openDownload(id: string) {
    const record = await BackupModel.findById(id);
    if (!record) throw new BackupError("Backup not found", 404);
    if (record.status !== "completed" || !record.fileId) {
      throw new BackupError("Only completed backups can be downloaded", 409);
    }
    const files = await getBucket().find({ _id: record.fileId }).toArray();
    if (files.length === 0) {
      throw new BackupError("Backup file is missing from storage", 410);
    }
    return {
      record,
      length: files[0].length,
      stream: getBucket().openDownloadStream(record.fileId),
    };
  }

  static async importUpload(filePath: string, createdBy: string) {
    await acquireLock("upload");
    const record = await createRecord("upload", createdBy);
    try {
      const summary = await validateStream(fs.createReadStream(filePath));
      const upload = getBucket().openUploadStream(`${record.name}.ndjson.gz`, {
        metadata: { backupId: String(record._id), format: BACKUP_FORMAT },
      });
      await pipeline(fs.createReadStream(filePath), upload);
      record.set({
        status: "completed",
        fileId: upload.id,
        size: upload.length,
        collections: summary.collections,
        documentCount: summary.documentCount,
        completedAt: new Date(),
      });
      await record.save();
      return record;
    } catch (error) {
      await BackupModel.findByIdAndDelete(record._id).catch(() => undefined);
      if (error instanceof BackupError) throw error;
      throw new BackupError(`Upload failed: ${safeErrorMessage(error)}`, 500);
    } finally {
      releaseLock();
    }
  }

  static async remove(id: string) {
    if (activeOperation) {
      throw new BackupError("A backup operation is in progress. Try again shortly.", 409);
    }
    const record = await BackupModel.findById(id);
    if (!record) throw new BackupError("Backup not found", 404);
    if (record.status === "in_progress") {
      throw new BackupError("A backup that is still being generated cannot be deleted", 409);
    }
    await deleteGridFile(record.fileId);
    await BackupModel.findByIdAndDelete(id);
    return record;
  }

  static async restore(id: string, actorName: string) {
    await acquireLock("restore");
    const stagingNames: string[] = [];
    try {
      const record = await BackupModel.findById(id);
      if (!record) throw new BackupError("Backup not found", 404);
      if (record.status !== "completed" || !record.fileId) {
        throw new BackupError("Only completed backups can be restored", 409);
      }

      const bucket = getBucket();
      const summary = await validateStream(bucket.openDownloadStream(record.fileId));
      const restorable = summary.collections.filter((c) => !RESTORE_EXCLUDED.has(c.name));
      if (restorable.length === 0) {
        throw new BackupError("Backup does not contain any restorable collections.");
      }

      const safetyBackup = await BackupService.runBackup(
        "pre-restore",
        `${actorName} (automatic, before restore)`,
      );

      const db = getDb();
      const stagingSuffix = Date.now().toString(36);
      const stagingFor = (name: string) => `${STAGING_PREFIX}${stagingSuffix}_${name}`;
      const batches = new Map<string, unknown[]>();

      const flush = async (name: string) => {
        const docs = batches.get(name);
        if (!docs || docs.length === 0) return;
        await db.collection(stagingFor(name)).insertMany(docs as any[], { ordered: true });
        batches.set(name, []);
      };

      const restorableNames = new Set(restorable.map((c) => c.name));
      const gunzip = zlib.createGunzip();
      const download = bucket.openDownloadStream(record.fileId);
      download.on("error", (err) => gunzip.destroy(err));
      const lines = readline.createInterface({ input: download.pipe(gunzip), crlfDelay: Infinity });

      let headerSkipped = false;
      try {
        for await (const line of lines) {
          if (!line.trim()) continue;
          if (!headerSkipped) {
            headerSkipped = true;
            continue;
          }
          const entry = EJSON.parse(line, { relaxed: false }) as { c: string; d: unknown };
          if (!restorableNames.has(entry.c)) continue;
          if (!stagingNames.includes(stagingFor(entry.c))) {
            stagingNames.push(stagingFor(entry.c));
          }
          const batch = batches.get(entry.c) || [];
          batch.push(entry.d);
          batches.set(entry.c, batch);
          if (batch.length >= INSERT_BATCH_SIZE) {
            await flush(entry.c);
          }
        }
        for (const name of restorableNames) {
          await flush(name);
        }
      } catch (error) {
        await dropStaging(stagingNames);
        throw new BackupError(
          `Restore aborted before any data was changed: ${safeErrorMessage(error)}`,
          500,
        );
      }

      const restoredCollections: string[] = [];
      try {
        for (const { name } of restorable) {
          const staging = stagingFor(name);
          if (stagingNames.includes(staging)) {
            await db.renameCollection(staging, name, { dropTarget: true });
          } else {
            await db.collection(name).deleteMany({});
          }
          restoredCollections.push(name);
        }
      } catch (error) {
        await dropStaging(stagingNames);
        throw new BackupError(
          `Restore failed after ${restoredCollections.length} collection(s) were replaced. ` +
            `Restore the automatic safety backup "${safetyBackup.name}" to recover. Details: ${safeErrorMessage(error)}`,
          500,
        );
      }

      await Promise.all(
        Object.values(mongoose.models).map((model) =>
          model.createIndexes().catch(() => undefined),
        ),
      );

      await AccountModel.updateMany({}, { $inc: { sessionVersion: 1 } });

      record.set({
        lastRestoredAt: new Date(),
        lastRestoredBy: actorName,
        restoreCount: (record.restoreCount || 0) + 1,
      });
      await record.save();

      return {
        backup: record,
        safetyBackup,
        restoredCollections,
        documentCount: restorable.reduce((sum, c) => sum + c.count, 0),
      };
    } finally {
      releaseLock();
    }
  }
}
