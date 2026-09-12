"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { bookingInterface } from "@/app/types/bookings.type";
import { getDaysFromDate } from "@/app/utils/customFunction";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
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
import { Coins, Loader2, Wallet, Banknote, Smartphone, Globe, ReceiptText, User, CalendarDays, Bed } from "lucide-react";
import useUserStore from "@/app/store/useUserStore";

interface Props {
  booking: bookingInterface;
}

type PaymentMethod = "Cash" | "GCash" | "Online Payment";

export function PartialPaymentModal({ booking }: Props) {
  const queryClient = useQueryClient();
  const { user } = useUserStore();
  const [open, setOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [refNumber, setRefNumber] = useState("");

  const room = booking.room;
  const nights = Math.max(1, getDaysFromDate(booking.arrivalDate));

  const discountedPrice = room.price * (1 - (room.discount || 0) / 100);
  const totalBill = Math.max(0, discountedPrice * nights);
  const alreadyPaid = Math.max(0, booking.paymentAmount || 0);
  const remainingBalance = Math.max(0, totalBill - alreadyPaid);

  const paidNow = parseFloat(paymentAmount) || 0;

  const isAmountValid = useMemo(() => {
    return paidNow > 0 && paidNow <= remainingBalance;
  }, [paidNow, remainingBalance]);

  const partialPaymentMutation = useMutation({
    mutationFn: (data: {
      bookingId: string;
      amount: number;
      paymentBy: string;
      method: string;
      refNumber?: string;
    }) => axiosInstance.post("/booking/partialPayment", data),
    onSuccess: (response: { data?: { balance?: number; folio?: string } }) => {
      queryClient.invalidateQueries({ queryKey: ["active-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      const balance = response?.data?.balance ?? 0;
      successAlert(
        balance > 0
          ? `Partial payment recorded. Remaining balance is ₱${balance.toLocaleString()}.`
          : "Payment recorded. Balance is now fully settled."
      );
      setOpen(false);
      setPaymentAmount("");
      setRefNumber("");
      setPaymentMethod("Cash");
    },
    onError: (err: { response?: { data?: string | { message?: string } } }) => {
      const message =
        typeof err.response?.data === "string"
          ? err.response.data
          : err.response?.data?.message || "Failed to record partial payment.";
      errorAlert(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAmountValid) {
      errorAlert(`Enter an amount up to the remaining balance of ₱${remainingBalance.toLocaleString()}.`);
      return;
    }
    partialPaymentMutation.mutate({
      bookingId: booking._id,
      amount: paidNow,
      paymentBy: booking.clientName,
      method: paymentMethod,
      refNumber: refNumber.trim() || undefined,
    });
  };

  if (remainingBalance <= 0) return null;

  const formatCurrency = (value: number) =>
    `₱${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          setPaymentAmount("");
          setRefNumber("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full flex items-center gap-2 mt-2 font-medium"
          onClick={() => setOpen(true)}
        >
          <Coins className="size-3.5 text-amber-600" />
          Pay Partial Payment
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b border-border bg-card">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Wallet className="size-5 text-primary" />
            Pay Partial Payment
          </DialogTitle>
          <DialogDescription className="text-xs">
            Collect a deposit or partial amount toward {booking.clientName}&apos;s folio without checking out.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-5">
          {/* Guest & Folio Summary */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-3">
              {room.image ? (
                <img
                  src={room.image}
                  alt={room.category}
                  className="size-12 rounded-lg object-cover shrink-0 border border-border"
                />
              ) : (
                <div className="size-12 rounded-lg bg-muted flex items-center justify-center shrink-0 border border-border">
                  <Bed className="size-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="font-semibold text-sm">
                  {room.roomNumber ? `Room ${room.roomNumber} · ` : ""}{room.category}
                </p>
                <p className="text-xs text-muted-foreground">{formatCurrency(room.price)} / night</p>
              </div>
            </div>

            <div className="h-px bg-border/60" />

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="flex items-center gap-2">
                <User className="size-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium truncate">{booking.clientName}</span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarDays className="size-3.5 text-muted-foreground shrink-0" />
                <span>
                  Arrived:{" "}
                  {new Date(booking.arrivalDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Bill Status */}
          <div className="rounded-xl border border-border p-4 space-y-2 bg-card text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Bill</span>
              <span className="font-medium">{formatCurrency(totalBill)}</span>
            </div>
            <div className="flex justify-between text-blue-600 dark:text-blue-400 font-medium">
              <span>Already Paid</span>
              <span>-{formatCurrency(alreadyPaid)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm pt-2 border-t border-border">
              <span>Remaining Balance</span>
              <span className="text-primary font-mono text-base font-extrabold">
                {formatCurrency(remainingBalance)}
              </span>
            </div>
          </div>

          {/* Payment Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">
                Payment Method <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("Cash")}
                  className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                    paymentMethod === "Cash"
                      ? "bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-400 font-semibold ring-1 ring-emerald-500"
                      : "border-border bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  <Banknote className="size-4 text-emerald-600" />
                  <span>Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("GCash")}
                  className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                    paymentMethod === "GCash"
                      ? "bg-blue-500/15 border-blue-500 text-blue-700 dark:text-blue-400 font-semibold ring-1 ring-blue-500"
                      : "border-border bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  <Smartphone className="size-4 text-blue-600" />
                  <span>GCash</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("Online Payment")}
                  className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all ${
                    paymentMethod === "Online Payment"
                      ? "bg-purple-500/15 border-purple-500 text-purple-700 dark:text-purple-400 font-semibold ring-1 ring-purple-500"
                      : "border-border bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  <Globe className="size-4 text-purple-600" />
                  <span>Online</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="partial-amount" className="text-xs">
                Amount to Pay (₱) <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                  ₱
                </span>
                <Input
                  id="partial-amount"
                  type="number"
                  min={0}
                  max={remainingBalance}
                  step="0.01"
                  placeholder={formatCurrency(remainingBalance)}
                  className="pl-7 text-xs font-mono h-9.5"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                />
              </div>
              {paymentAmount && !isAmountValid && (
                <p className="text-[11px] text-destructive font-medium">
                  Enter an amount up to the remaining balance of {formatCurrency(remainingBalance)}.
                </p>
              )}
              {isAmountValid && paidNow < remainingBalance && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  Deposit payment — remaining balance after this payment: {formatCurrency(remainingBalance - paidNow)}.
                </p>
              )}
              {isAmountValid && paidNow === remainingBalance && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  This fully settles the folio. You can then check out the guest.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="partial-ref" className="text-xs">
                {paymentMethod === "Cash" ? "Reference No. (Optional)" : `${paymentMethod} Reference No. (Optional)`}
              </Label>
              <Input
                id="partial-ref"
                placeholder={paymentMethod === "Cash" ? "Optional" : "e.g. 1002349120"}
                className="text-xs font-mono h-9.5"
                value={refNumber}
                onChange={(e) => setRefNumber(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={partialPaymentMutation.isPending}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!paymentAmount || !isAmountValid || partialPaymentMutation.isPending}
                className="text-xs font-semibold gap-1.5"
              >
                {partialPaymentMutation.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <ReceiptText className="size-3.5" />
                    Record Payment
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}