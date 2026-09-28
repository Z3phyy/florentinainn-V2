"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import useNotificationStream from "@/app/hooks/useNotificationStream";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { formatHotelDate, hotelDateKey } from "@/app/utils/hotelTime";
import { peso } from "@/app/utils/addOnPricing";
import {
  arrivalState,
  reservationBoard,
  reservationBoardItem,
} from "@/app/types/bookings.type";
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
  UserX,
  PackagePlus,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { confirmAlert, errorAlert, successAlert } from "@/app/utils/alert";
import { formatTime12hr } from "@/app/utils/customFunction";
import { ModifyReservationModal } from "./components/modifyReservationModal";
import { BookingHistoryDialog } from "./components/bookingHistoryDialog";

export default function Page() {
  const queryClient = useQueryClient();
  const [clockOffsetMs, setClockOffsetMs] = useState(0);

  const { data: board, isLoading, isError, refetch, isFetching } = useQuery<reservationBoard>({
    queryKey: ["reservation-board"],
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const requestedAt = Date.now();
      const res = await axiosInstance.get("/booking/reservations/board");
      const receivedAt = Date.now();
      const serverMs = new Date(res.data.serverTime).getTime();
      if (Number.isFinite(serverMs)) {
        setClockOffsetMs(serverMs - (requestedAt + receivedAt) / 2);
      }
      return res.data;
    },
  });
  const bookings = board?.items;

  useNotificationStream("staff", () => {
    queryClient.invalidateQueries({ queryKey: ["reservation-board"] });
  });

  const refreshBoard = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["reservation-board"] }),
    [queryClient],
  );

  const activateMutation = useMutation({
    mutationFn: (bookingId: string) =>
      axiosInstance.post("/booking/reservation/active", { bookingId }),
    onSuccess: () => {
      successAlert("Guest checked in.");
      refreshBoard();
      queryClient.invalidateQueries({ queryKey: ["active-bookings"] });
    },
    onError: (err) => {
      errorAlert(getApiErrorMessage(err, "Failed to check in the guest."));
      refreshBoard();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason?: string }) =>
      axiosInstance.post("/booking/reservation/cancel", { bookingId, reason }),
    onSuccess: () => {
      successAlert("Reservation canceled.");
      refreshBoard();
    },
    onError: (err) => {
      errorAlert(getApiErrorMessage(err, "Failed to cancel the reservation."));
      refreshBoard();
    },
  });

  const noShowMutation = useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason?: string }) =>
      axiosInstance.post("/booking/reservation/no-show", {
        bookingId,
        reason,
      }),
    onSuccess: () => {
      successAlert("Reservation marked as no-show.");
      refreshBoard();
    },
    onError: (err) => {
      errorAlert(getApiErrorMessage(err, "Failed to mark as no-show."));
      refreshBoard();
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
              : `${bookings?.length ?? 0} pending reservation${(bookings?.length ?? 0) !== 1 ? "s" : ""} scheduled · grace period ${formatGrace(board?.graceMinutes ?? 120)}`}
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

      {!isLoading && isError && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-destructive/30 bg-destructive/5 py-16 text-center">
          <AlertTriangle className="size-8 text-destructive" />
          <p className="text-sm font-medium text-destructive">Reservations could not be loaded.</p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-xl border border-[#D9C3C3] px-4 py-2 text-xs font-semibold"
          >
            Try again
          </button>
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
              onCancel={({ id, reason }) =>
                cancelMutation.mutate({ bookingId: id, reason })
              }
              onNoShow={({ id, reason }) =>
                noShowMutation.mutate({ bookingId: id, reason })
              }
              isActivating={activateMutation.isPending}
              isCanceling={cancelMutation.isPending}
              isNoShowing={noShowMutation.isPending}
              clockOffsetMs={clockOffsetMs}
              onStateChange={refreshBoard}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Individual Reservation Card ─── */

const formatGrace = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h} hr${h === 1 ? "" : "s"}`;
  return `${m} min`;
};

const fmtDuration = (ms: number): string => {
  if (ms <= 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
};

function resolveState(booking: reservationBoardItem, nowMs: number): arrivalState {
  const arrivalMs = booking.arrivalAt ? new Date(booking.arrivalAt).getTime() : NaN;
  const graceEndMs = booking.graceEndsAt ? new Date(booking.graceEndsAt).getTime() : NaN;
  if (!Number.isFinite(arrivalMs) || !Number.isFinite(graceEndMs)) return booking.arrivalState;
  if (nowMs >= graceEndMs) return "overdue";
  if (nowMs >= arrivalMs) return "grace";
  if (booking.arrivalState === "arriving" || hotelDateKey(new Date(nowMs)) === booking.arrivalDate) return "arriving";
  return "upcoming";
}

function ReservationCard({
  booking,
  onActivate,
  onCancel,
  onNoShow,
  isActivating,
  isCanceling,
  isNoShowing,
  clockOffsetMs,
  onStateChange,
}: {
  booking: reservationBoardItem;
  onActivate: (id: string) => void;
  onCancel: (params: { id: string; reason?: string }) => void;
  onNoShow: (params: { id: string; reason?: string }) => void;
  isActivating: boolean;
  isCanceling: boolean;
  isNoShowing: boolean;
  clockOffsetMs: number;
  onStateChange: () => void;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now() + clockOffsetMs);

  useEffect(() => {
    const tick = () => setNowMs(Date.now() + clockOffsetMs);
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [clockOffsetMs]);

  const state = resolveState(booking, nowMs);
  const serverState = booking.arrivalState;

  const requestedFor = useRef("");
  useEffect(() => {
    if (state !== serverState && requestedFor.current !== state) {
      requestedFor.current = state;
      onStateChange();
    }
  }, [state, serverState, onStateChange]);

  const arrivalMs = booking.arrivalAt ? new Date(booking.arrivalAt).getTime() : 0;
  const graceEndMs = booking.graceEndsAt ? new Date(booking.graceEndsAt).getTime() : 0;
  const timeRemaining =
    state === "arriving"
      ? `Arrives in ${fmtDuration(arrivalMs - nowMs)}`
      : state === "grace"
        ? `Grace ends in ${fmtDuration(graceEndMs - nowMs)}`
        : state === "overdue"
          ? `Overdue by ${fmtDuration(nowMs - graceEndMs)}`
          : "";
  const isLate = state === "overdue";
  const isToday = state === "arriving" || state === "grace";
  const timerVariant = state === "grace" ? "grace" : state === "arriving" ? "arriving" : null;

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
            {state === "grace" ? (
              <div className="flex items-center gap-1.5 rounded-full bg-amber-500/95 backdrop-blur-sm px-3 py-1 text-xs font-bold text-white shadow-sm">
                <Clock className="size-3.5" />
                Grace Period
              </div>
            ) : isLate ? (
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
          {timeRemaining && (isToday || isLate) && (
            <div
              className={`absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full backdrop-blur-sm px-3 py-1 text-xs font-semibold shadow-sm ${
                isLate
                  ? "bg-rose-600 text-white border border-rose-500"
                  : timerVariant === "grace"
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
            <BookingHistoryDialog booking={booking} />
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
                Arrival: {formatHotelDate(booking.arrivalDate)}
                {booking.departureDate ? ` → ${formatHotelDate(booking.departureDate)}` : ""}
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
            {(booking.addOns || []).length > 0 && (
              <div className="flex items-start gap-2 text-[#5C454B] dark:text-gray-400">
                <PackagePlus className="size-3.5 text-[#618685] shrink-0 mt-0.5" />
                <span>
                  {(booking.addOns || []).map((a) => `${a.quantity}× ${a.name}`).join(", ")} · {peso(booking.addOnsTotal || 0)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-[#5C454B] dark:text-gray-400">
              <Wallet className="size-3.5 text-[#618685] shrink-0" />
              <span>
                Stay total {peso(booking.plannedTotal)}
                {booking.balanceDue > 0 ? ` · balance ${peso(booking.balanceDue)}` : ""}
                {booking.creditDue > 0 ? ` · credit ${peso(booking.creditDue)}` : ""}
              </span>
            </div>
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
      <div className="p-5 pt-0 flex flex-col gap-2.5">
        <div className="flex gap-2.5">
          <button
            onClick={() => {
              confirmAlert("Are you sure you want to approve this reservation?", "Approve Check-In", () => {
                onActivate(booking._id);
              });
            }}
            disabled={isActivating || isCanceling || isNoShowing}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#900546] hover:bg-[#720336] disabled:opacity-50 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <CheckCircle2 className="size-4" />
            <span>Check-In</span>
          </button>
          <ModifyReservationModal booking={booking} />
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={() => {
              confirmAlert("Are you sure you want to reject this reservation?", "Reject", () => {
                onCancel({ id: booking._id });
              });
            }}
            disabled={isActivating || isCanceling || isNoShowing}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#FAF5F5] dark:bg-[#25121B] border border-[#D9C3C3] dark:border-white/10 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-[#5C454B] hover:text-rose-600 text-xs font-semibold py-2.5 px-3 rounded-xl transition-all cursor-pointer"
          >
            <XCircle className="size-4" />
            <span>Cancel</span>
          </button>
          <button
            onClick={() => {
              const reason = window.prompt(
                "Mark this reservation as no-show? Optionally enter a reason (press OK to confirm, or Cancel to abort).",
              );
              if (reason === null) return;
              onNoShow({ id: booking._id, reason: reason.trim() || undefined });
            }}
            disabled={isActivating || isCanceling || isNoShowing}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#FAF5F5] dark:bg-[#25121B] border border-[#D9C3C3] dark:border-white/10 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-[#5C454B] hover:text-amber-600 text-xs font-semibold py-2.5 px-3 rounded-xl transition-all cursor-pointer"
          >
            <UserX className="size-4" />
            <span>No-Show</span>
          </button>
        </div>
      </div>
    </div>
  );
}
