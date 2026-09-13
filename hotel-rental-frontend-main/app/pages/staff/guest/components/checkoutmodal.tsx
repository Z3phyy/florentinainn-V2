"use client";

import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { bookingInterface } from "@/app/types/bookings.type";
import { getDaysFromDate, formatTime12hr } from "@/app/utils/customFunction";
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
import {
  Loader2,
  LogOut,
  ReceiptText,
  Wallet,
  Bed,
  User,
  CalendarDays,
  Clock,
  Printer,
  CheckCircle2,
  Banknote,
  Smartphone,
  Globe,
  Building2,
  RotateCcw,
} from "lucide-react";
import { systemInterface } from "@/app/types/system.type";
import useUserStore from "@/app/store/useUserStore";

interface Props {
  booking: bookingInterface;
}

type PaymentMethod = "Cash" | "GCash" | "Online Payment";

interface ReceiptSnapshot {
  receiptNo: string;
  checkoutDate: string;
  guestName: string;
  roomCategory: string;
  roomPrice: number;
  nights: number;
  discount: number;
  downPayment: number;
  totalBill: number;
  balanceDue: number;
  amountPaid: number;
  change: number;
  method: PaymentMethod;
  refNumber?: string;
  cashierName: string;
}

export function CheckoutModal({ booking }: Props) {
  const queryClient = useQueryClient();
  const { user } = useUserStore();
  const [open, setOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [refNumber, setRefNumber] = useState("");
  const [step, setStep] = useState<"billing" | "review" | "completed">("billing");
  const [receiptData, setReceiptData] = useState<ReceiptSnapshot | null>(null);

  const { data: systemInfo } = useQuery<systemInterface>({
    queryKey: ["systeminfo"],
    queryFn: async (): Promise<systemInterface> => {
      const response = await axiosInstance.get("/system");
      return response.data;
    },
  });

  const room = booking.room;
  const daysStayed = useMemo(() => getDaysFromDate(booking.arrivalDate), [booking.arrivalDate]);
  const nights = Math.max(1, daysStayed);

  // Apply discount if room has one
  const discountedPrice = room.price * (1 - (room.discount || 0) / 100);

  // Full bill with discount applied (deposit / prior payments tracked separately)
  const totalBill = Math.max(0, discountedPrice * nights);

  // Amount already paid toward this stay (online reservation deposit, prior partials)
  const alreadyPaid = Math.max(0, booking.paymentAmount || 0);

  // Amount still owed at checkout
  const balanceDue = Math.max(0, totalBill - alreadyPaid);

  const paidNow = parseFloat(paymentAmount) || 0;

  // Auto-fill exact remaining balance for GCash / Online Payment
  useEffect(() => {
    if (paymentMethod === "GCash" || paymentMethod === "Online Payment") {
      setPaymentAmount(balanceDue.toString());
    } else {
      setPaymentAmount("");
    }
  }, [paymentMethod, balanceDue]);

  const change = useMemo(() => {
    return Math.max(0, paidNow - balanceDue);
  }, [paidNow, balanceDue]);

  const isShortPayment = paidNow > 0 && paidNow < balanceDue;

  const isPaymentValid = useMemo(() => {
    return paidNow > 0 && paidNow >= balanceDue;
  }, [paidNow, balanceDue]);

  const checkoutMutation = useMutation({
    mutationFn: (data: {
      bookingId: string;
      roomId: string;
      amount: number;
      paymentBy: string;
      method: string;
      refNumber?: string;
    }) => axiosInstance.post("/booking/checkout", data),
    onSuccess: () => {
      successAlert("Guest checked out successfully.");
      queryClient.invalidateQueries({ queryKey: ["active-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });

      // Save receipt snapshot for immediate printing
      const snapshot: ReceiptSnapshot = {
        receiptNo: refNumber.trim() || `CHK-${booking._id.slice(-6).toUpperCase()}`,
        checkoutDate: new Date().toLocaleDateString("en-PH", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        guestName: booking.clientName,
        roomCategory: room.category,
        roomPrice: room.price,
        nights,
        discount: room.discount || 0,
        downPayment: alreadyPaid,
        totalBill,
        balanceDue,
        amountPaid: paidNow || totalBill,
        change,
        method: paymentMethod,
        refNumber: refNumber.trim() || undefined,
        cashierName: user?.name || "Front Desk Staff",
      };

      setReceiptData(snapshot);
      setStep("completed");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      const message = err.response?.data?.message || "Failed to checkout guest.";
      errorAlert(message);
    },
  });

  const resetForm = () => {
    setPaymentMethod("Cash");
    setPaymentAmount("");
    setRefNumber("");
    setStep("billing");
    setReceiptData(null);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPaymentValid) {
      errorAlert(`Payment must cover the full balance due of ${formatCurrency(balanceDue)}. To collect a deposit without checking out, use the Pay Partial Payment button.`);
      return;
    }
    setStep("review");
  };

  const handleConfirmCheckout = () => {
    checkoutMutation.mutate({
      bookingId: booking._id,
      roomId: room._id,
      amount: paidNow,
      paymentBy: booking.clientName,
      method: paymentMethod,
      refNumber: refNumber.trim() || undefined,
    });
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const formatCurrency = (value: number) =>
    `₱${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) {
            resetForm();
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
            <LogOut className="size-3.5" />
            Checkout
          </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto p-0 gap-0">
          {/* Print stylesheet for Receipt */}
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #printable-checkout-receipt,
              #printable-checkout-receipt * {
                visibility: visible !important;
              }
              #printable-checkout-receipt {
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 24px !important;
                background: white !important;
                color: black !important;
                box-shadow: none !important;
                border: none !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>

          <DialogHeader className="p-6 pb-4 border-b border-border bg-card">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <ReceiptText className="size-5 text-primary" />
              {step === "completed" ? "Checkout Successful" : "Billing & Checkout"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {step === "completed"
                ? `Payment recorded for ${booking.clientName}. Receipt is ready to print.`
                : `Review stay details, select payment method, and process checkout for ${booking.clientName}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-5">
            {/* ── STEP 1: BILLING & PAYMENT FORM ── */}
            {step === "billing" && (
              <>
                {/* Guest & Stay Card */}
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
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(room.price)} / night
                      </p>
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
                    <div className="flex items-center gap-2">
                      <Clock className="size-3.5 text-muted-foreground shrink-0" />
                      <span>{formatTime12hr(booking.arrivalTime)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wallet className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="font-semibold text-primary">
                        {nights} night{nights !== 1 ? "s" : ""} stayed
                      </span>
                    </div>
                  </div>
                </div>

                {/* Itemized Bill Breakdown */}
                <div className="rounded-xl border border-border p-4 space-y-2 bg-card text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Room Rate ({nights} night{nights !== 1 ? "s" : ""} × {formatCurrency(room.price)})
                    </span>
                    <span className="font-medium">{formatCurrency(room.price * nights)}</span>
                  </div>

                  {room.discount > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                      <span>Room Discount ({room.discount}%)</span>
                      <span>-{formatCurrency(room.price * nights - discountedPrice * nights)}</span>
                    </div>
                  )}

                  {alreadyPaid > 0 && (
                    <div className="flex justify-between text-blue-600 dark:text-blue-400 font-medium">
                      <span>Less: Amount Already Paid</span>
                      <span>-{formatCurrency(alreadyPaid)}</span>
                    </div>
                  )}

                  <div className="flex justify-between font-bold text-sm pt-2 border-t border-border">
                    <span>Total Bill</span>
                    <span className="font-mono">{formatCurrency(totalBill)}</span>
                  </div>

                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-muted-foreground">Balance Due</span>
                    <span className="text-primary font-mono text-base font-extrabold">
                      {formatCurrency(balanceDue)}
                    </span>
                  </div>
                </div>

                {/* Payment Method Selector & Inputs */}
                <form onSubmit={handlePaymentSubmit} className="space-y-4">
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

                  {/* Cash Tendered Input */}
                  {paymentMethod === "Cash" ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="payment" className="text-xs">
                        Amount Received (₱) <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                          ₱
                        </span>
                        <Input
                          id="payment"
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder={formatCurrency(balanceDue)}
                          className="pl-7 text-xs font-mono h-9.5"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          required
                        />
                      </div>
                      {isShortPayment && (
                        <p className="text-[11px] text-destructive font-medium">
                          Insufficient amount. Balance due is {formatCurrency(balanceDue)}. Use the Pay Partial Payment button to collect a deposit without checking out.
                        </p>
                      )}
                      {paymentAmount && paidNow > balanceDue && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Change due: {formatCurrency(change)}.
                        </p>
                      )}
                    </div>
                  ) : (
                    /* GCash / Online Reference Number */
                    <div className="space-y-1.5">
                      <Label htmlFor="refNo" className="text-xs">
                        {paymentMethod} Reference No. (Optional)
                      </Label>
                      <Input
                        id="refNo"
                        placeholder="e.g. 1002349120"
                        className="text-xs font-mono h-9.5"
                        value={refNumber}
                        onChange={(e) => setRefNumber(e.target.value)}
                      />
                    </div>
                  )}

                  <DialogFooter className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setOpen(false)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!paymentAmount || !isPaymentValid}
                      className="text-xs font-semibold gap-1.5"
                    >
                      <Wallet className="size-3.5" />
                      Review Payment
                    </Button>
                  </DialogFooter>
                </form>
              </>
            )}

            {/* ── STEP 2: PAYMENT REVIEW & CONFIRMATION ── */}
            {step === "review" && (
              <div className="space-y-4">
                <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold text-xs uppercase tracking-wider">
                      <ReceiptText className="size-4" />
                      Payment Summary
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                      {paymentMethod}
                    </span>
                  </div>

                  <div className="h-px bg-emerald-500/20" />

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Guest Name</span>
                      <span className="font-semibold">{booking.clientName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Room</span>
                      <span className="font-medium">{room.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Bill</span>
                      <span className="font-bold">{formatCurrency(totalBill)}</span>
                    </div>
                    {alreadyPaid > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Already Paid (deposit)</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          {formatCurrency(alreadyPaid)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Balance Due</span>
                      <span className="font-bold">{formatCurrency(balanceDue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount Paid Now ({paymentMethod})</span>
                      <span className="font-mono font-bold">
                        {formatCurrency(paidNow)}
                      </span>
                    </div>
                    {paymentMethod === "Cash" && change > 0 && (
                      <div className="flex justify-between text-sm font-bold pt-2 border-t border-emerald-500/20">
                        <span>Change Due</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-mono text-base">
                          {formatCurrency(change)}
                        </span>
                      </div>
                    )}
                    {refNumber && (
                      <div className="flex justify-between text-[11px] text-muted-foreground pt-1">
                        <span>Reference ID</span>
                        <span className="font-mono">{refNumber}</span>
                      </div>
                    )}
                  </div>
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setStep("billing")}
                    disabled={checkoutMutation.isPending}
                    className="text-xs"
                  >
                    Adjust Payment
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleConfirmCheckout}
                    disabled={checkoutMutation.isPending}
                    className="text-xs font-semibold gap-1.5"
                  >
                    {checkoutMutation.isPending ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <LogOut className="size-3.5" />
                        Confirm Checkout
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            )}

            {/* ── STEP 3: COMPLETED RECEIPT & PRINT ── */}
            {step === "completed" && receiptData && (
              <div className="space-y-4">
                {/* Printable Receipt Card */}
                <div
                  id="printable-checkout-receipt"
                  className="rounded-xl border border-border bg-card p-5 space-y-4 text-xs font-sans shadow-xs"
                >
                  {/* Receipt Header */}
                  <div className="text-center space-y-1 border-b border-border pb-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <Building2 className="size-4 text-primary" />
                      <h2 className="font-bold text-sm tracking-tight text-foreground uppercase">
                        {systemInfo?.systemName || "Hotel Management"}
                      </h2>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Official Guest Checkout Folio & Receipt
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground">
                      Ref: {receiptData.receiptNo} · {receiptData.checkoutDate}
                    </p>
                  </div>

                  {/* Guest & Stay Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs border-b border-border pb-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Guest Name</p>
                      <p className="font-bold">{receiptData.guestName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Room / Category</p>
                      <p className="font-medium">
                        {room.roomNumber ? `Room ${room.roomNumber} (${receiptData.roomCategory})` : receiptData.roomCategory}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Nights Stayed</p>
                      <p className="font-medium">{receiptData.nights} Night(s)</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Payment Method</p>
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {receiptData.method}
                      </p>
                    </div>
                  </div>

                  {/* Pricing Breakdown */}
                  <div className="space-y-1.5 text-xs border-b border-border pb-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Room Rate ({receiptData.nights} × {formatCurrency(receiptData.roomPrice)})
                      </span>
                      <span>{formatCurrency(receiptData.roomPrice * receiptData.nights)}</span>
                    </div>

                    {receiptData.discount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Discount ({receiptData.discount}%)</span>
                        <span>
                          -{formatCurrency(
                            receiptData.roomPrice * receiptData.nights * (receiptData.discount / 100)
                          )}
                        </span>
                      </div>
                    )}

                    {receiptData.downPayment > 0 && (
                      <div className="flex justify-between text-blue-600">
                        <span>Already Paid (deposit)</span>
                        <span>-{formatCurrency(receiptData.downPayment)}</span>
                      </div>
                    )}

                    <div className="flex justify-between font-bold text-sm pt-1 border-t border-border/60">
                      <span>Total Bill</span>
                      <span className="font-mono">{formatCurrency(receiptData.totalBill)}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Balance Due</span>
                      <span className="font-mono">{formatCurrency(receiptData.balanceDue)}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount Tendered</span>
                      <span className="font-mono">{formatCurrency(receiptData.amountPaid)}</span>
                    </div>

                    {receiptData.method === "Cash" && (
                      <div className="flex justify-between font-semibold text-emerald-600">
                        <span>Change Given</span>
                        <span className="font-mono">{formatCurrency(receiptData.change)}</span>
                      </div>
                    )}
                  </div>

                  {/* Signatures / Footer */}
                  <div className="pt-2 flex justify-between items-end text-[10px] text-muted-foreground">
                    <div>
                      <p>Processed By: {receiptData.cashierName}</p>
                      <p>Thank you for staying with us!</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="size-3" /> PAID
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Toolbar */}
                <DialogFooter className="flex-row items-center justify-between sm:justify-between gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handlePrintReceipt}
                    className="text-xs gap-1.5"
                  >
                    <Printer className="size-3.5 text-primary" />
                    Print Receipt
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setOpen(false);
                      resetForm();
                    }}
                    className="text-xs gap-1.5"
                  >
                    <CheckCircle2 className="size-3.5" />
                    Done / Close
                  </Button>
                </DialogFooter>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
