"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { successAlert, errorAlert, confirmAlert } from "@/app/utils/alert";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { backupInterface, backupListResult } from "@/app/types/backup.type";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RestoreBackupModal } from "./restoreBackupModal";
import {
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

const PAGE_SIZE = 10;

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

const STATUS_STYLES: Record<backupInterface["status"], { label: string; cls: string }> = {
  completed: { label: "Completed", cls: "bg-green-600/10 text-green-700 border-green-600/30" },
  in_progress: { label: "In progress", cls: "bg-blue-600/10 text-blue-700 border-blue-600/30" },
  failed: { label: "Failed", cls: "bg-red-500/10 text-red-600 border-red-500/30" },
};

const SOURCE_LABELS: Record<backupInterface["source"], string> = {
  manual: "Manual",
  "pre-restore": "Auto (before restore)",
  upload: "Uploaded",
};

export function BackupRestore() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<backupListResult>({
    queryKey: ["backups", page],
    queryFn: async () => {
      const res = await axiosInstance.get("/system/backups", { params: { page, limit: PAGE_SIZE } });
      return res.data;
    },
    refetchInterval: (query) =>
      query.state.data?.items.some((b) => b.status === "in_progress") ? 5000 : false,
  });

  const createMutation = useMutation({
    mutationFn: () => axiosInstance.post("/system/backups"),
    onSuccess: (res) => {
      successAlert(`Backup "${res.data?.name}" generated (${formatBytes(res.data?.size || 0)}).`);
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (err) => {
      errorAlert(getApiErrorMessage(err, "Failed to generate backup."));
      queryClient.invalidateQueries({ queryKey: ["backups"] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return axiosInstance.post("/system/backups/upload", formData);
    },
    onSuccess: (res) => {
      successAlert(`Backup file validated and stored as "${res.data?.name}".`);
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (err) => errorAlert(getApiErrorMessage(err, "Failed to upload backup file.")),
    onSettled: () => {
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axiosInstance.delete(`/system/backups/${id}`),
    onSuccess: () => {
      successAlert("Backup deleted.");
      queryClient.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (err) => errorAlert(getApiErrorMessage(err, "Failed to delete backup.")),
  });

  const handleDownload = async (backup: backupInterface) => {
    if (downloadingId) return;
    setDownloadingId(backup._id);
    try {
      const res = await axiosInstance.get(`/system/backups/${backup._id}/download`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data as Blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${backup.name}.ndjson.gz`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      let message = "Failed to download backup.";
      const blob = (err as { response?: { data?: unknown } })?.response?.data;
      if (blob instanceof Blob) {
        try {
          const parsed = JSON.parse(await blob.text());
          if (typeof parsed?.message === "string") message = parsed.message;
        } catch {}
      }
      errorAlert(message);
    } finally {
      setDownloadingId(null);
    }
  };

  const busy = createMutation.isPending || uploadMutation.isPending;
  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <section className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 space-y-5 shadow-xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-serif text-lg font-bold text-[#130005] dark:text-white flex items-center gap-2">
            <Database className="size-4.5 text-[#900546]" />
            Backup & Restore
          </h2>
          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5 max-w-2xl">
            Backups are generated on the server and stored securely in the database. Download copies
            to keep an off-site archive. Administrator accounts and login-attempt records are never
            overwritten by a restore.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".gz,application/gzip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (!file.name.toLowerCase().endsWith(".gz")) {
                errorAlert("Only .ndjson.gz backup files are accepted.");
                e.target.value = "";
                return;
              }
              if (file.size > 512 * 1024 * 1024) {
                errorAlert("Backup file is too large (maximum 512 MB).");
                e.target.value = "";
                return;
              }
              uploadMutation.mutate(file);
            }}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="rounded-2xl px-4 text-xs font-semibold cursor-pointer"
          >
            {uploadMutation.isPending ? (
              <Loader2 className="size-4 animate-spin mr-1" />
            ) : (
              <Upload className="size-4 mr-1" />
            )}
            Upload Backup File
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={busy}
            className="rounded-2xl px-5 bg-[#900546] hover:bg-[#720336] text-white font-semibold text-xs shadow-md shadow-[#900546]/20 cursor-pointer"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin mr-1" />
                Generating...
              </>
            ) : (
              <>
                <Plus className="size-4 mr-1" />
                Generate Backup
              </>
            )}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-destructive">Failed to load backups.</p>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            Retry
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-10 text-center">
          <Database className="size-8 text-muted-foreground/60" />
          <p className="mt-2 text-sm font-medium">No backups yet</p>
          <p className="text-xs text-muted-foreground">Generate your first backup to protect hotel data.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Backup</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((backup) => {
                const status = STATUS_STYLES[backup.status];
                return (
                  <TableRow key={backup._id}>
                    <TableCell>
                      <p className="font-mono text-xs font-medium">{backup.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {SOURCE_LABELS[backup.source]}
                        {backup.createdBy ? ` · ${backup.createdBy}` : ""}
                      </p>
                      {backup.lastRestoredAt ? (
                        <p className="text-[11px] text-amber-700 dark:text-amber-400">
                          Last restored {new Date(backup.lastRestoredAt).toLocaleString()}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(backup.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{formatBytes(backup.size)}</TableCell>
                    <TableCell className="text-xs">
                      {backup.documentCount.toLocaleString()}
                      <span className="block text-[11px] text-muted-foreground">
                        {backup.collections.length} collection(s)
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${status.cls}`}>
                        {status.label}
                      </span>
                      {backup.status === "failed" && backup.error ? (
                        <p className="mt-1 max-w-[220px] truncate text-[11px] text-destructive" title={backup.error}>
                          {backup.error}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Download backup"
                          aria-label="Download backup"
                          disabled={backup.status !== "completed" || downloadingId !== null}
                          onClick={() => handleDownload(backup)}
                        >
                          {downloadingId === backup._id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Download className="size-3.5 text-[#900546]" />
                          )}
                        </Button>
                        <RestoreBackupModal backup={backup} disabled={busy} />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Delete backup"
                          aria-label="Delete backup"
                          disabled={backup.status === "in_progress" || deleteMutation.isPending}
                          onClick={() =>
                            confirmAlert(
                              `Delete backup "${backup.name}"? This cannot be undone.`,
                              "Delete",
                              () => deleteMutation.mutate(backup._id),
                            )
                          }
                        >
                          <Trash2 className="size-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {items.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{data?.total ?? 0} backup(s)</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} / {totalPages}
            </span>
            <Button variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
