"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { bookingInterface } from "@/app/types/bookings.type";
import { systemInterface } from "@/app/types/system.type";
import {
  Loader2,
  Bed,
  CalendarDays,
  User,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  Mail,
  Phone,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { confirmAlert } from "@/app/utils/alert";
import { formatTime12hr } from "@/app/utils/customFunction";

export default function Page() {
  const queryClient = useQueryClient();

  const { data: systemInfo } = useQuery<systemInterface>({
    queryKey: ["systeminfo"],
    queryFn: async () => {
      const res = await axiosInstance.get("/system");
      return res.data;
    },
  });

  const { data: bookings, isLoading } = useQuery<bookingInterface[]>({
    queryKey: ["reservation-bookings"],
    queryFn: async () => {
      const res = await axiosInstance.get("/booking");
      const all: bookingInterface[] = res.data;
      return all.filter((b) => b.status === "reservation");
    },
  });

  const activateMutation = useMutation({
    mutationFn: (bookingId: string) =>
      axiosInstance.post("/booking/reservation/active", { bookingId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservation-bookings"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (bookingId: string) =>
      axiosInstance.post("/booking/reservation/cancel", { bookingId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservation-bookings"] });
    },
  });

  return (
    <div className="w-full min-h-screen p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D9C3C3] dark:border-white/10">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3 py-0.5 text-[11px] font-bold text-[#900546] dark:text-[#F968AC] mb-1.5">
            <Sparkles className="size-3.5" />
            Advance Reservations
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#130005] dark:text-white">
            Upcoming Guest Reservations
          </h1>
          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5">
            {isLoading
              ? "Loading reservations..."
              : `${bookings?.length ?? 0} pending reservation${(bookings?.length ?? 0) !== 1 ? "s" : ""} scheduled`}
          </p>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <div className="flex items-center gap-3 text-[#5C454B] dark:text-gray-400 text-sm">
            <Loader2 className="size-6 animate-spin text-[#900546]" />
            <span>Loading upcoming reservations...</span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && bookings && bookings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-[#5C454B] dark:text-gray-400 bg-white dark:bg-[#1A0E13] rounded-3xl border border-[#D9C3C3] dark:border-white/10 p-8 shadow-xs">
          <div className="size-16 rounded-full bg-[#900546]/10 text-[#900546] flex items-center justify-center mb-4">
            <CalendarDays className="size-8" />
          </div>
          <h3 className="font-serif text-lg font-bold text-[#130005] dark:text-white">
            No Pending Reservations
          </h3>
          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-1 max-w-sm text-center">
            There are no pending online reservations awaiting check-in at this time.
          </p>
        </div>
      )}

      {/* Bookings Grid */}
      {!isLoading && bookings && bookings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {bookings.map((booking) => (
            <ReservationCard
              key={booking._id}
              booking={booking}
              onActivate={(id) => activateMutation.mutate(id)}
              onCancel={(id) => cancelMutation.mutate(id)}
              isActivating={activateMutation.isPending}
              isCanceling={cancelMutation.isPending}
              gracePeriodHours={systemInfo?.gracePeriodHours}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Individual Reservation Card ─── */

function ReservationCard({
  booking,
  onActivate,
  onCancel,
  isActivating,
  isCanceling,
  gracePeriodHours,
}: {
  booking: bookingInterface;
  onActivate: (id: string) => void;
  onCancel: (id: string) => void;
  isActivating: boolean;
  isCanceling: boolean;
  gracePeriodHours?: number;
}) {
  const graceHrs = gracePeriodHours ?? 2;
  const [timeRemaining, setTimeRemaining] = useState<string>("");  const [isLate, setIsLate] = useState(false);
  const [isToday, setIsToday] = useState(false);
  const [timerVariant, setTimerVariant] = useState<"arriving" | "grace" | null>(null);

  const fmtDuration = (ms: number): string => {
    if (ms <= 0) return "0s";
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
    if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
    return `${s}s`;
  };

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const [hours, minutes] = (booking.arrivalTime || "14:00").split(":").map(Number);
      const arrivalMs = new Date(booking.arrivalDate).setHours(hours || 14, minutes || 0, 0, 0);

      const today = new Date();
      const isArrivalToday =
        arrivalMs > 0 &&
        new Date(arrivalMs).getFullYear() === today.getFullYear() &&
        new Date(arrivalMs).getMonth() === today.getMonth() &&
        new Date(arrivalMs).getDate() === today.getDate();

      setIsToday(isArrivalToday);

      const nowMs = now.getTime();
      const deadlineMs = arrivalMs + graceHrs * 60 * 60 * 1000;

      if (!isArrivalToday) {
        setTimeRemaining("");
        setIsLate(false);
        setTimerVariant(null);
        return;
      }

      if (nowMs < arrivalMs) {
        setIsLate(false);
        setTimerVariant("arriving");
        setTimeRemaining(`Arrives in ${fmtDuration(arrivalMs - nowMs)}`);
      } else if (nowMs < deadlineMs) {
        setIsLate(false);
        setTimerVariant("grace");
        setTimeRemaining(`Grace ends in ${fmtDuration(deadlineMs - nowMs)}`);
      } else {
        setIsLate(true);
        setTimerVariant(null);
        setTimeRemaining("");
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [booking.arrivalDate, booking.arrivalTime]);

  const room = booking.room;

  return (
    <div className="group rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-[#900546]/40 flex flex-col justify-between">
      <div>
        {/* ── Room Image ── */}
        <div className="relative h-48 w-full bg-[#FAF5F5] dark:bg-[#25121B] overflow-hidden">
          {room?.image ? (
            <img
              src={room.image}
              alt={room?.category ?? "Room"}
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Bed className="size-10 text-[#5C454B]/30" />
            </div>
          )}

          {/* Status badge */}
          <div className="absolute top-3 left-3">
            {isLate ? (
              <div className="flex items-center gap-1.5 rounded-full bg-rose-600/95 backdrop-blur-sm px-3 py-1 text-xs font-bold text-white shadow-sm">
                <AlertTriangle className="size-3.5" />
                OVERDUE
              </div>
            ) : isToday ? (
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-600/95 backdrop-blur-sm px-3 py-1 text-xs font-bold text-white shadow-sm">
                <span className="size-1.5 rounded-full bg-white animate-pulse" />
                Arrival Today
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full bg-[#618685]/95 backdrop-blur-sm px-3 py-1 text-xs font-bold text-white shadow-sm">
                <CalendarDays className="size-3.5" />
                Upcoming
              </div>
            )}
          </div>

          {/* Countdown Timer */}
          {isToday && !isLate && timerVariant && timeRemaining && (
            <div
              className={`absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full backdrop-blur-sm px-3 py-1 text-xs font-semibold shadow-sm ${
                timerVariant === "grace"
                  ? "bg-amber-500 text-white border border-amber-400"
                  : "bg-white/95 dark:bg-[#130005]/95 text-[#900546] dark:text-[#F968AC] border border-[#D9C3C3]"
              }`}
            >
              <Clock className="size-3.5" />
              <span>{timeRemaining}</span>
            </div>
          )}
        </div>

        {/* ── Card Body ── */}
        <div className="p-5 space-y-3.5">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-serif text-base font-bold text-[#130005] dark:text-white">
                {room?.roomNumber ? `Room ${room.roomNumber} · ` : ""}{room?.category ?? "Room"}
              </p>
              <p className="text-xs font-semibold text-[#900546] dark:text-[#F968AC] mt-0.5">
                ₱{(room?.price ?? 0).toLocaleString()}/day
              </p>
            </div>
          </div>

          <div className="h-px bg-[#D9C3C3]/40 dark:bg-white/10" />

          {/* Guest details */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-[#130005] dark:text-white font-semibold">
              <User className="size-3.5 text-[#618685] shrink-0" />
              <span className="truncate">{booking.clientName}</span>
            </div>
            <div className="flex items-center gap-2 text-[#5C454B] dark:text-gray-400">
              <CalendarDays className="size-3.5 text-[#618685] shrink-0" />
              <span>
                Arrival: {new Date(booking.arrivalDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[#5C454B] dark:text-gray-400">
              <Clock className="size-3.5 text-[#618685] shrink-0" />
              <span>Expected Time: {formatTime12hr(booking.arrivalTime)}</span>
            </div>
            {booking.clientEmail && (
              <div className="flex items-center gap-2 text-[#5C454B] dark:text-gray-400">
                <Mail className="size-3.5 text-[#618685] shrink-0" />
                <span className="truncate">{booking.clientEmail}</span>
              </div>
            )}
            {booking.clientPhone && (
              <div className="flex items-center gap-2 text-[#5C454B] dark:text-gray-400">
                <Phone className="size-3.5 text-[#618685] shrink-0" />
                <span className="truncate">{booking.clientPhone}</span>
              </div>
            )}
            {(booking.paymentAmount ?? 0) > 0 && (
              <div className="flex items-center gap-2 text-[#5C454B] dark:text-gray-400">
                <Wallet className="size-3.5 text-[#618685] shrink-0" />
                <span className="truncate">
                  Deposit Paid: ₱{Number(booking.paymentAmount).toLocaleString()}
                  {booking.paymentMethod ? ` via ${booking.paymentMethod}` : ""}
                  {booking.paymentRefNumber ? ` · Ref: ${booking.paymentRefNumber}` : ""}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-5 pt-0 flex gap-2.5">
        <button
          onClick={() => {
            confirmAlert("Are you sure you want to approve this reservation?", "Approve Check-In", () => {
              onActivate(booking._id);
            });
          }}
          disabled={isActivating || isCanceling}
          className="flex-1 flex items-center justify-center gap-1.5 bg-[#900546] hover:bg-[#720336] disabled:opacity-50 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition-all shadow-xs cursor-pointer"
        >
          <CheckCircle2 className="size-4" />
          <span>Check-In</span>
        </button>
        <button
          onClick={() => {
            confirmAlert("Are you sure you want to reject this reservation?", "Reject", () => {
              onCancel(booking._id);
            });
          }}
          disabled={isActivating || isCanceling}
          className="flex-1 flex items-center justify-center gap-1.5 bg-[#FAF5F5] dark:bg-[#25121B] border border-[#D9C3C3] dark:border-white/10 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-[#5C454B] hover:text-rose-600 text-xs font-semibold py-2.5 px-3 rounded-xl transition-all cursor-pointer"
        >
          <XCircle className="size-4" />
          <span>Cancel</span>
        </button>
      </div>
    </div>
  );
}
