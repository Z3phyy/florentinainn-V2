"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { successAlert, errorAlert, confirmAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Database, Download, Upload, ShieldAlert } from "lucide-react";

interface BackupPayload {
  exportedAt: string;
  database: string;
  collections: Record<string, unknown[]>;
}

export function BackupRestore() {
  const queryClient = useQueryClient();
  const [backup, setBackup] = useState<BackupPayload | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);

  const createBackupMutation = useMutation({
    mutationFn: async (): Promise<BackupPayload> => {
      const response = await axiosInstance.get("/system/backup");
      return response.data;
    },
    onSuccess: (payload) => {
      setBackup(payload);
      const keys = Object.keys(payload.collections || {});
      successAlert(
        `Backup exported — ${keys.length} collection(s) from "${payload.database}".`,
      );
    },
    onError: (err: { response?: { data?: string } }) => {
      const message =
        typeof err.response?.data === "string"
          ? err.response.data
          : "Failed to create backup.";
      errorAlert(message);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () =>
      axiosInstance.post("/system/backup/restore", {
        collections: backup?.collections,
      }),
    onSuccess: () => {
      successAlert("Backup restored. Reloading data...");
      setRestoreDialogOpen(false);
      queryClient.clear();
    },
    onError: (err: { response?: { data?: string } }) => {
      const message =
        typeof err.response?.data === "string"
          ? err.response.data
          : "Failed to restore backup.";
      errorAlert(message);
    },
  });

  const downloadBackup = () => {
    if (!backup) return;
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `florentina-backup-${backup.exportedAt.replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const collectionCount = backup ? Object.keys(backup.collections || {}).length : 0;

  return (
    <section className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 space-y-5 shadow-xs">
      <div>
        <h2 className="font-serif text-lg font-bold text-[#130005] dark:text-white flex items-center gap-2">
          <Database className="size-4.5 text-[#900546]" />
          Backup & Restore
        </h2>
        <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5">
          Export the full database as JSON or restore from a previous export.
          Admin and staff login collections are excluded from restore.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => createBackupMutation.mutate()}
          disabled={createBackupMutation.isPending}
          className="rounded-2xl px-5 py-2.5 bg-[#900546] hover:bg-[#720336] text-white font-semibold text-xs shadow-md shadow-[#900546]/20 cursor-pointer"
        >
          {createBackupMutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin mr-2" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="size-4 mr-2" />
              Export Backup
            </>
          )}
        </Button>

        {backup && (
          <>
            <Button
              onClick={downloadBackup}
              variant="outline"
              className="rounded-2xl px-5 py-2.5 text-xs font-semibold cursor-pointer"
            >
              <Upload className="size-4 mr-2" />
              Save Backup File
            </Button>
            <span className="text-xs text-[#5C454B] dark:text-gray-400">
              {collectionCount} collection(s) exported at{" "}
              {new Date(backup.exportedAt).toLocaleString()}
            </span>
          </>
        )}
      </div>

      {backup && (
        <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="destructive"
              className="rounded-2xl px-5 py-2.5 text-xs font-semibold cursor-pointer"
            >
              <ShieldAlert className="size-4 mr-2" />
              Restore This Backup
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle>Restore Database Backup?</DialogTitle>
              <DialogDescription>
                This will overwrite all current records (except admin and staff
                login accounts) with the data from the backup exported at{" "}
                {new Date(backup.exportedAt).toLocaleString()}. This action
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
              We recommend exporting a fresh backup before restoring, so you can
              recover current data if needed.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={restoreMutation.isPending}
                onClick={() =>
                  confirmAlert(
                    "Restore this backup and overwrite all current records?",
                    "Yes, Restore",
                    () => restoreMutation.mutate(),
                  )
                }
              >
                {restoreMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Restoring...
                  </>
                ) : (
                  "Restore Backup"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}