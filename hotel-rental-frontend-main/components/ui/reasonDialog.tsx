"use client";

import { ReactNode, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { reasonSchema } from "@/app/utils/schemas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

type Values = z.input<typeof reasonSchema>;

export function ReasonDialog({
  trigger,
  title,
  description,
  confirmLabel,
  reasonLabel = "Reason",
  reasonPlaceholder,
  warning,
  isPending,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  warning?: ReactNode;
  isPending?: boolean;
  onConfirm: (reason: string) => Promise<unknown> | void;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(reasonSchema),
    mode: "onChange",
    defaultValues: { reason: "" },
  });
  const error = form.formState.errors.reason?.message;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await onConfirm((values.reason || "").trim());
      setOpen(false);
      form.reset();
    } catch {
      return;
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) form.reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField id="status-reason" label={reasonLabel} error={error} hint="Optional, up to 300 characters. Recorded in the audit trail.">
            <Textarea
              id="status-reason"
              rows={3}
              placeholder={reasonPlaceholder}
              aria-invalid={!!error}
              {...form.register("reason")}
            />
          </FormField>
          {warning ? (
            <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
              {warning}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Working...
                </>
              ) : (
                confirmLabel
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
