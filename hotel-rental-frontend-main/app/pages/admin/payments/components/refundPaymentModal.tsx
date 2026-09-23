"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { paymentInterface } from "@/app/types/payment.type";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const isRefunded = payment.status === "refunded";

  const refundMutation = useMutation({
    mutationFn: (data: { paymentId: string; reason: string; note?: string }) =>
      axiosInstance.post("/system/payments/refund", data),
    onSuccess: () => {
      successAlert("Refund recorded.");
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setOpen(false);
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      errorAlert(err.response?.data?.message || "Failed to record refund."),
  });

  const restoreMutation = useMutation({
    mutationFn: (paymentId: string) =>
      axiosInstance.post("/system/payments/restore", { paymentId }),
    onSuccess: () => {
      successAlert("Payment restored.");
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setOpen(false);
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      errorAlert(err.response?.data?.message || "Failed to restore payment."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            onSubmit={(e) => {
              e.preventDefault();
              refundMutation.mutate({ paymentId: payment._id, reason, note });
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="refundReason">Refund Reason</Label>
              <Textarea
                id="refundReason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="e.g. Guest canceled, duplicate payment, overcharge"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="refundRef">Reference No. (optional)</Label>
              <Input
                id="refundRef"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. bank transaction or voucher ref"
              />
            </div>
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