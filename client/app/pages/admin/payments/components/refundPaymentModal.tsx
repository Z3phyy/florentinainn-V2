"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axiosInstance from "@/app/utils/axios";
import { paymentInterface } from "@/app/types/payment.type";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { refundSchema } from "@/app/utils/schemas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/formField";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, RotateCcw, Undo2 } from "lucide-react";

export function RefundPaymentModal({ payment }: { payment: paymentInterface }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const form = useForm<z.input<typeof refundSchema>>({
    resolver: zodResolver(refundSchema),
    mode: "onTouched",
    defaultValues: { reason: "", note: "" },
  });
  const errors = form.formState.errors;
  const isRefunded = payment.status === "refunded";

  const refundMutation = useMutation({
    mutationFn: (data: { paymentId: string; reason: string; note?: string }) =>
      axiosInstance.post("/system/payments/refund", data),
    onSuccess: () => {
      successAlert("Refund recorded.");
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setOpen(false);
      form.reset();
    },
    onError: (err) => errorAlert(getApiErrorMessage(err, "Failed to record refund.")),
  });

  const restoreMutation = useMutation({
    mutationFn: (paymentId: string) =>
      axiosInstance.post("/system/payments/restore", { paymentId }),
    onSuccess: () => {
      successAlert("Payment restored.");
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setOpen(false);
    },
    onError: (err) => errorAlert(getApiErrorMessage(err, "Failed to restore payment.")),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) form.reset();
      }}
    >
      {isRefunded ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="h-7 px-2 text-[11px] gap-1 font-medium"
          title="Restore refunded payment"
        >
          <Undo2 className="size-3 text-muted-foreground" />
          <span>Restore</span>
        </Button>
      ) : (
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px] gap-1 font-medium"
            title="Record a refund for this payment"
          >
            <RotateCcw className="size-3 text-destructive" />
            <span>Refund</span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isRefunded ? "Restore Payment" : "Record Refund"}
          </DialogTitle>
          <DialogDescription>
            {isRefunded
              ? `Undo the refund on ${payment.paymentBy || "Guest"}'s ${payment.method || "Cash"} payment of ₱${Number(payment.amount || 0).toLocaleString()}.`
              : `Mark the ${payment.method || "Cash"} payment of ₱${Number(payment.amount || 0).toLocaleString()} as refunded.`}
          </DialogDescription>
        </DialogHeader>
        {isRefunded ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Refunded {payment.refundedAt ? new Date(payment.refundedAt).toLocaleString() : ""}
              {payment.refundedBy ? ` by ${payment.refundedBy}` : ""}
              {payment.refundReason ? ` — ${payment.refundReason}` : ""}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  restoreMutation.mutate(payment._id);
                }}
                disabled={restoreMutation.isPending}
                className="bg-[#900546] hover:bg-[#720336] text-white"
              >
                {restoreMutation.isPending && (
                  <Loader2 className="size-4 animate-spin mr-2" />
                )}
                Restore Payment
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            onSubmit={form.handleSubmit((values) =>
              refundMutation.mutate({
                paymentId: payment._id,
                reason: values.reason.trim(),
                note: (values.note || "").trim(),
              }),
            )}
            className="space-y-4"
            noValidate
          >
            <FormField id="refundReason" label="Refund Reason" required error={errors.reason?.message}>
              <Textarea
                id="refundReason"
                rows={2}
                placeholder="e.g. Guest canceled, duplicate payment, overcharge"
                aria-invalid={!!errors.reason}
                {...form.register("reason")}
              />
            </FormField>
            <FormField id="refundRef" label="Reference No." error={errors.note?.message} hint="Optional — bank transaction or voucher reference.">
              <Input
                id="refundRef"
                placeholder="e.g. bank transaction or voucher ref"
                aria-invalid={!!errors.note}
                {...form.register("note")}
              />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={refundMutation.isPending}
                className="bg-[#900546] hover:bg-[#720336] text-white"
              >
                {refundMutation.isPending && (
                  <Loader2 className="size-4 animate-spin mr-2" />
                )}
                Confirm Refund
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}