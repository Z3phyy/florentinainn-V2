"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axiosInstance from "@/app/utils/axios";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { isLegacyReservationCode, trackBookingSchema } from "@/app/utils/schemas";
import { formatHotelDate, formatHotelDateTime } from "@/app/utils/hotelTime";
import { formatTime12hr } from "@/app/utils/customFunction";
import { peso } from "@/app/utils/addOnPricing";
import { trackedBooking } from "@/app/types/tracking.type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/formField";
import { RoomReviewPanel } from "@/components/ui/roomReviewPanel";
import {
  AlertTriangle,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  Clock,
  Home,
  Loader2,
  Search,
  Users,
  Wallet,
} from "lucide-react";

type Values = z.input<typeof trackBookingSchema>;

const STATUS_META: Record<string, { label: string; cls: string; note: string }> = {
  unpaid: { label: "Awaiting payment", cls: "bg-amber-500/10 text-amber-700 border-amber-500/30", note: "Your reservation is waiting for its online payment to be confirmed." },
  reservation: { label: "Confirmed", cls: "bg-blue-600/10 text-blue-700 border-blue-600/30", note: "Your reservation is confirmed. Present this code at the front desk when you arrive." },
  active: { label: "Checked in", cls: "bg-emerald-600/10 text-emerald-700 border-emerald-600/30", note: "You are currently checked in. Enjoy your stay!" },
  completed: { label: "Checked out", cls: "bg-gray-500/10 text-gray-700 border-gray-500/30", note: "Thank you for staying with us." },
  canceled: { label: "Canceled", cls: "bg-rose-600/10 text-rose-700 border-rose-600/30", note: "This reservation was canceled." },
  "no-show": { label: "No-show", cls: "bg-rose-600/10 text-rose-700 border-rose-600/30", note: "This reservation was marked as a no-show." },
};

const PAYMENT_LABEL: Record<string, string> = { paid: "Fully paid", partial: "Partially paid", unpaid: "Not yet paid" };

function TrackBookingContent() {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<{ booking: trackedBooking; code: string; bookingId: string } | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(trackBookingSchema),
    mode: "onTouched",
    defaultValues: {
      code: (searchParams.get("code") || "").toUpperCase(),
      bookingId: searchParams.get("bookingId") || "",
    },
  });
  const errors = form.formState.errors;
  const codeValue = useWatch({ control: form.control, name: "code" }) || "";
  const legacy = isLegacyReservationCode(codeValue);

  const lookup = useMutation({
    mutationFn: async (values: Values) =>
      (await axiosInstance.post("/booking/track", {
        code: values.code.trim(),
        ...(legacy && values.bookingId ? { bookingId: values.bookingId.trim() } : {}),
      })).data as trackedBooking,
    onSuccess: (booking, values) => setResult({ booking, code: values.code.trim().toUpperCase(), bookingId: values.bookingId.trim() }),
    onError: () => setResult(null),
  });

  const booking = result?.booking;
  const meta = booking ? STATUS_META[booking.status] || { label: booking.status, cls: "border-border", note: "" } : null;

  return (
    <div className="min-h-screen bg-[#FAF5F5] dark:bg-[#130005] px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#900546]/10 text-[#900546]">
            <Search className="size-6" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-[#130005] dark:text-white">Track My Booking</h1>
          <p className="text-sm text-[#5C454B] dark:text-gray-400">
            Enter the reservation code from your confirmation email or voucher.
          </p>
        </div>

        <form
          onSubmit={form.handleSubmit((values) => lookup.mutate(values))}
          noValidate
          className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 space-y-4"
        >
          <FormField id="track-code" label="Reservation code" required error={errors.code?.message}>
            <Input
              id="track-code"
              placeholder="RES-XXXXX-XXXXX"
              autoComplete="off"
              maxLength={20}
              className="h-11 font-mono uppercase tracking-wider"
              aria-invalid={!!errors.code}
              {...form.register("code")}
            />
          </FormField>
          {legacy && (
            <FormField
              id="track-booking-id"
              label="Booking reference"
              required
              error={errors.bookingId?.message}
              hint="Older confirmations use a short code. Also enter the 24-character booking reference shown in your voucher link (bookingId=…)."
            >
              <Input id="track-booking-id" autoComplete="off" maxLength={24} className="h-11 font-mono" aria-invalid={!!errors.bookingId} {...form.register("bookingId")} />
            </FormField>
          )}
          {lookup.isError && (
            <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              {getApiErrorMessage(lookup.error, "We couldn't look up that booking. Please try again.")}
            </p>
          )}
          <Button type="submit" disabled={lookup.isPending} className="h-11 w-full rounded-xl bg-[#900546] hover:bg-[#720336] text-white">
            {lookup.isPending ? <><Loader2 className="size-4 animate-spin" /> Looking up...</> : "Track Booking"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            For your privacy we only show booking details, never contact or payment card information.
          </p>
        </form>

        {booking && meta && (
          <section className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Reservation</p>
                <p className="font-mono text-lg font-bold text-[#130005] dark:text-white">{booking.reference || result?.code}</p>
                <p className="text-xs text-muted-foreground">Guest: {booking.guestName} · booked {formatHotelDate(booking.createdAt)}</p>
              </div>
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${meta.cls}`}>{meta.label}</span>
            </div>
            {meta.note && <p className="text-sm text-[#5C454B] dark:text-gray-300">{meta.note}</p>}

            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div className="flex items-start gap-2">
                <BedDouble className="mt-0.5 size-4 text-[#618685]" />
                <span>{booking.room.label}</span>
              </div>
              <div className="flex items-start gap-2">
                <Users className="mt-0.5 size-4 text-[#618685]" />
                <span>{booking.guests} guest{booking.guests === 1 ? "" : "s"}</span>
              </div>
              <div className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 size-4 text-[#618685]" />
                <span>
                  Check-in {formatHotelDate(booking.arrivalDate)} · {formatTime12hr(booking.arrivalTime)}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="mt-0.5 size-4 text-[#618685]" />
                <span>
                  Check-out {booking.departureDate ? formatHotelDate(booking.departureDate) : "—"} · {booking.nights} night{booking.nights === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-[#D9C3C3] dark:border-white/10 bg-[#FAF5F5] dark:bg-[#130005] p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Room</span><span>{peso(booking.roomSubtotal)}</span></div>
              {booking.addOns.map((a, i) => (
                <div key={`${a.name}-${i}`} className="flex justify-between">
                  <span className="text-muted-foreground">{a.quantity}× {a.name}</span>
                  <span>{peso(a.subtotal)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-[#D9C3C3] dark:border-white/10 pt-1.5 font-semibold">
                <span>Booking total</span>
                <span>{peso(booking.total)}</span>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span>{peso(booking.amountPaid)}</span></div>
              {booking.balanceDue > 0 && (
                <div className="flex justify-between font-semibold text-amber-700"><span>Balance due at the front desk</span><span>{peso(booking.balanceDue)}</span></div>
              )}
              <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                <Wallet className="size-3.5" /> {PAYMENT_LABEL[booking.paymentStatus]}
                {booking.nonRefundable ? " · non-refundable reservation" : ""}
              </p>
            </div>

            {booking.checkedOutAt && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="size-4 text-emerald-600" /> Checked out {formatHotelDateTime(booking.checkedOutAt)}
              </p>
            )}

            {(booking.canReview || booking.reviewed) && result && (
              <RoomReviewPanel
                key={result.code}
                reservationCode={result.code}
                bookingId={legacy ? result.bookingId : undefined}
                onDone={() => lookup.mutate({ code: result.code, bookingId: result.bookingId })}
              />
            )}
          </section>
        )}

        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#900546] dark:text-[#F968AC] hover:underline">
            <Home className="size-3.5" /> Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TrackBookingContent />
    </Suspense>
  );
}
