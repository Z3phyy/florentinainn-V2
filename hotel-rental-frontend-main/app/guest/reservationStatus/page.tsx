"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import {
  Search,
  Loader2,
  Calendar,
  Clock,
  User,
  Bed,
  Wallet,
  CheckCircle2,
  XCircle,
  Clock3,
  AlertTriangle,
  Home,
} from "lucide-react";

interface LookupResult {
  status: string;
  type: string;
  clientName: string;
  room: string;
  arrivalDate: string;
  arrivalTime: string;
  departureDate: string;
  guests: number;
  amountPaid: number;
  totalAmount: number;
  paymentMethod: string;
  paymentRefNumber: string;
  nonRefundable: boolean;
  policyAcceptedAt?: string | null;
  noShowAt?: string | null;
  canceledAt?: string | null;
  cancellationReason?: string;
  checkedOutAt?: string | null;
}

function statusMeta(status: string): {
  label: string;
  tone: "active" | "done" | "canceled" | "pending";
} {
  switch (status) {
    case "active":
      return { label: "Guest Checked In", tone: "active" };
    case "reservation":
      return { label: "Reservation Confirmed", tone: "active" };
    case "unpaid":
      return { label: "Pending Payment", tone: "pending" };
    case "completed":
      return { label: "Stay Completed", tone: "done" };
    case "canceled":
      return { label: "Canceled", tone: "canceled" };
    case "no-show":
      return { label: "No-Show", tone: "canceled" };
    default:
      return { label: status, tone: "pending" };
  }
}

export default function Page() {
  const [bookingId, setBookingId] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);

  const lookupMutation = useMutation({
    mutationFn: (data: { bookingId: string; verificationCode?: string }) =>
      axiosInstance.post("/booking/status/lookup", data).then((r) => r.data),
    onSuccess: (data: LookupResult) => setResult(data),
  });

  const errorMessage =
    lookupMutation.isError &&
    (lookupMutation.error as { response?: { data?: string } })?.response?.data;

  const meta = result ? statusMeta(result.status) : null;

  return (
    <div className="min-h-screen bg-[#FAF5F5] dark:bg-[#130005]">
      {/* Header */}
      <div className="border-b border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13]">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3 py-0.5 text-[11px] font-bold text-[#900546] dark:text-[#F968AC] mb-3">
            <Search className="size-3.5" />
            Reservation Status
          </div>
          <h1 className="font-serif text-3xl font-bold text-[#130005] dark:text-white">
            Check Your Reservation
          </h1>
          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-1">
            Enter your booking reference and the verification code from your
            confirmation to view your reservation status.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 shadow-xs">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!bookingId.trim()) return;
              setResult(null);
              lookupMutation.mutate({
                bookingId: bookingId.trim(),
                verificationCode: verificationCode.trim() || undefined,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="bookingId" className="text-xs font-bold text-[#130005] dark:text-white">
                Booking Reference
              </Label>
              <Input
                id="bookingId"
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                placeholder="Paste your booking reference / ID"
                required
                className="rounded-xl bg-[#FAF5F5] dark:bg-[#130005] border-[#D9C3C3] text-xs font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="verificationCode" className="text-xs font-bold text-[#130005] dark:text-white">
                Verification Code (optional)
              </Label>
              <Input
                id="verificationCode"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="e.g. ABC1-XXXX"
                className="rounded-xl bg-[#FAF5F5] dark:bg-[#130005] border-[#D9C3C3] text-xs font-medium"
              />
              <p className="text-[11px] text-[#5C454B] dark:text-gray-400">
                If you have the code from your confirmation email, entering it
                protects your reservation details.
              </p>
            </div>
            <Button
              type="submit"
              disabled={lookupMutation.isPending}
              className="w-full rounded-xl bg-[#900546] hover:bg-[#720336] text-white text-xs font-bold py-2.5"
            >
              {lookupMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Looking up...
                </>
              ) : (
                <>
                  <Search className="size-4 mr-2" />
                  Check Status
                </>
              )}
            </Button>
          </form>

          {errorMessage && typeof errorMessage === "string" && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-600 dark:text-rose-400">
              <AlertTriangle className="size-4 shrink-0" />
              {errorMessage}
            </div>
          )}

          {result && meta && (
            <div className="mt-6 space-y-4">
              {/* Status banner */}
              <div
                className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-bold ${
                  meta.tone === "active"
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                    : meta.tone === "done"
                      ? "bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-400"
                      : meta.tone === "canceled"
                        ? "bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400"
                        : "bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400"
                }`}
              >
                {meta.tone === "active" || meta.tone === "done" ? (
                  <CheckCircle2 className="size-5 shrink-0" />
                ) : (
                  <XCircle className="size-5 shrink-0" />
                )}
                {meta.label}
              </div>

              {/* Reservation card */}
              <div className="rounded-2xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-5 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[#130005] dark:text-white">
                  <Bed className="size-4 text-[#900546] shrink-0" />
                  {result.room}
                </div>
                <div className="h-px bg-[#D9C3C3]/40 dark:bg-white/10" />
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-[#130005] dark:text-white font-semibold">
                    <User className="size-3.5 text-[#618685] shrink-0" />
                    <span>{result.clientName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#5C454B] dark:text-gray-400">
                    <Calendar className="size-3.5 text-[#618685] shrink-0" />
                    <span>
                      Arrival: {new Date(result.arrivalDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {result.departureDate &&
                        ` · Departure: ${new Date(result.departureDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[#5C454B] dark:text-gray-400">
                    <Clock className="size-3.5 text-[#618685] shrink-0" />
                    <span>Expected arrival: {result.arrivalTime}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#5C454B] dark:text-gray-400">
                    <Clock3 className="size-3.5 text-[#618685] shrink-0" />
                    <span>{result.guests} guest(s) · {result.type}</span>
                  </div>
                  {(result.amountPaid > 0 || result.paymentMethod) && (
                    <div className="flex items-center gap-2 text-[#5C454B] dark:text-gray-400">
                      <Wallet className="size-3.5 text-[#618685] shrink-0" />
                      <span>
                        Paid: ₱{Number(result.amountPaid).toLocaleString()}
                        {result.paymentMethod ? ` via ${result.paymentMethod}` : ""}
                        {result.paymentRefNumber ? ` · Ref: ${result.paymentRefNumber}` : ""}
                      </span>
                    </div>
                  )}
                  {result.cancellationReason && (
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                      <AlertTriangle className="size-3.5 shrink-0" />
                      <span>Reason: {result.cancellationReason}</span>
                    </div>
                  )}
                </div>
              </div>

              {result.nonRefundable && result.status === "unpaid" && (
                <p className="text-[11px] text-[#5C454B] dark:text-gray-400 text-center">
                  This reservation is non-refundable once paid.
                </p>
              )}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-[#D9C3C3]/40 dark:border-white/10 flex justify-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#900546] dark:text-[#F968AC] hover:underline"
            >
              <Home className="size-3.5" />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}