"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axiosInstance from "@/app/utils/axios";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { backupInterface } from "@/app/types/backup.type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/formField";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, RotateCcw, ShieldAlert } from "lucide-react";

const CONFIRM_PHRASE = "RESTORE";

const restoreSchema = z.object({
  confirmation: z.string().refine((v) => v === CONFIRM_PHRASE, {
    message: `Type ${CONFIRM_PHRASE} exactly to confirm.`,
  }),
  acknowledged: z.boolean().refine((v) => v, {
    message: "You must acknowledge that current data will be overwritten.",
  }),
});

type Values = z.input<typeof restoreSchema>;

export function RestoreBackupModal({ backup, disabled }: { backup: backupInterface; disabled?: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(restoreSchema),
    mode: "onChange",
    defaultValues: { confirmation: "", acknowledged: false },
  });
  const errors = form.formState.errors;

  const mutation = useMutation({
    mutationFn: () =>
      axiosInstance.post(`/system/backups/${backup._id}/restore`, { confirmation: CONFIRM_PHRASE }),
    onSuccess: (res) => {
      const safety = res.data?.safetyBackup?.name;
      successAlert(
        `Backup restored (${res.data?.documentCount ?? 0} records).${safety ? ` A safety backup "${safety}" was created first.` : ""} Staff must sign in again.`,
      );
      setOpen(false);
      form.reset();
      queryClient.invalidateQueries();
    },
    onError: (err) => errorAlert(getApiErrorMessage(err, "Failed to restore backup.")),
  });

  const restorable = backup.collections.filter(
    (c) => !["admins", "loginattempts", "backups"].includes(c.name),
  );
  const restorableCount = restorable.reduce((sum, c) => sum + c.count, 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending) return;
        setOpen(next);
        if (!next) form.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Restore this backup"
          aria-label="Restore this backup"
          disabled={disabled || backup.status !== "completed"}
          onClick={() => setOpen(true)}
        >
          <RotateCcw className="size-3.5 text-destructive" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-destructive" />
            Restore Database Backup
          </DialogTitle>
          <DialogDescription>
            {backup.name} · created {new Date(backup.createdAt).toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-destructive">
            Restoring <strong>replaces all current records</strong> in {restorable.length} collection(s)
            ({restorableCount.toLocaleString()} records) with the data in this backup. Any changes made
            after this backup was created will be lost. Administrator accounts are not modified.
          </p>
          <p className="text-muted-foreground">
            A safety backup of the current data is generated automatically before the restore starts.
            All staff will be signed out and must sign in again.
          </p>
        </div>

        <form
          onSubmit={form.handleSubmit(() => mutation.mutate())}
          className="space-y-4"
          noValidate
        >
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[#900546]"
              {...form.register("acknowledged")}
            />
            <span>I understand that current data will be overwritten.</span>
          </label>
          {errors.acknowledged?.message ? (
            <p className="text-xs font-medium text-destructive">{errors.acknowledged.message}</p>
          ) : null}

          <FormField
            id={`restore-confirm-${backup._id}`}
            label={
              <span>
                Type <span className="font-mono font-bold">{CONFIRM_PHRASE}</span> to confirm
              </span>
            }
            required
            error={errors.confirmation?.message}
          >
            <Input
              id={`restore-confirm-${backup._id}`}
              autoComplete="off"
              className="font-mono"
              aria-invalid={!!errors.confirmation}
              {...form.register("confirmation")}
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={mutation.isPending || !form.formState.isValid}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Restoring...
                </>
              ) : (
                "Restore Backup"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
