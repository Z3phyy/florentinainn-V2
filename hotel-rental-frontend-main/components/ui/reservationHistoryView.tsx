"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";
import useUserStore from "@/app/store/useUserStore";
import { errorAlert, successAlert } from "@/app/utils/alert";
import { ReasonDialog } from "@/components/ui/reasonDialog";
import axiosInstance from "@/app/utils/axios";
import { getApiErrorMessage } from "@/app/utils/apiError";
import {
  reservationHistoryItem,
  reservationHistoryResult,
} from "@/app/types/bookings.type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookingHistoryDialog } from "@/app/pages/staff/reservation/components/bookingHistoryDialog";
import {
  AlertTriangle,
  Archive,
  ChevronLeft,
  ChevronRight,
  History,
  RotateCcw,
  Search,
} from "lucide-react";

const PAGE_SIZE = 15;

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "completed", label: "Checked out" },
  { value: "active", label: "In-house" },
  { value: "reservation", label: "Confirmed reservation" },
  { value: "unpaid", label: "Unpaid / pending" },
  { value: "canceled", label: "Canceled" },
  { value: "no-show", label: "No-show" },
];

const PAYMENT_OPTIONS = [
  { value: "all", label: "All payments" },
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partially paid" },
  { value: "unpaid", label: "Unpaid" },
];

const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "reservation", label: "Online reservation" },
  { value: "walk in", label: "Walk-in" },
];

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  completed: { label: "Checked out", cls: "bg-gray-500/10 text-gray-700 border-gray-500/30 dark:text-gray-300" },
  active: { label: "In-house", cls: "bg-green-600/10 text-green-700 border-green-600/30" },
  reservation: { label: "Reserved", cls: "bg-blue-600/10 text-blue-700 border-blue-600/30" },
  unpaid: { label: "Unpaid", cls: "bg-amber-600/10 text-amber-700 border-amber-600/30" },
  canceled: { label: "Canceled", cls: "bg-red-500/10 text-red-600 border-red-500/30" },
  "no-show": { label: "No-show", cls: "bg-rose-600/10 text-rose-700 border-rose-600/30" },
};

const PAYMENT_BADGES: Record<string, { label: string; cls: string }> = {
  paid: { label: "Paid", cls: "bg-green-600/10 text-green-700 border-green-600/30" },
  partial: { label: "Partial", cls: "bg-amber-600/10 text-amber-700 border-amber-600/30" },
  unpaid: { label: "Unpaid", cls: "bg-red-500/10 text-red-600 border-red-500/30" },
};

const peso = (value: number) =>
  `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

function Badge({ map, value }: { map: Record<string, { label: string; cls: string }>; value: string }) {
  const badge = map[value] || { label: value, cls: "border-border text-muted-foreground" };
  return (
    <span className={`inline-flex whitespace-nowrap items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>
      {badge.label}
    </span>
  );
}

export function ReservationHistoryView() {
  const queryClient = useQueryClient();
  const user = useUserStore((s) => s.user);
  const isAdmin = user?.type === "admin" || user?.type === "super admin";
  const archiveMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => axiosInstance.delete("/booking", { data: { _id: id, reason } }),
    onSuccess: () => {
      successAlert("Reservation archived. You can restore it from the Archive.");
      queryClient.invalidateQueries({ queryKey: ["reservation-history"] });
      queryClient.invalidateQueries({ queryKey: ["archive"] });
    },
    onError: (err) => errorAlert(getApiErrorMessage(err, "Failed to archive reservation.")),
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const dateError = from && to && from > to ? "Start date must be on or before the end date." : "";

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery<reservationHistoryResult>({
    queryKey: ["reservation-history", { debouncedSearch, status, paymentStatus, type, from, to, page }],
    enabled: !dateError,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: PAGE_SIZE, status, paymentStatus, type };
      if (debouncedSearch) params.search = debouncedSearch;
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await axiosInstance.get("/booking/history", { params });
      return res.data;
    },
  });

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const hasFilters =
    !!search || status !== "all" || paymentStatus !== "all" || type !== "all" || !!from || !!to;

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatus("all");
    setPaymentStatus("all");
    setType("all");
    setFrom("");
    setTo("");
    setPage(1);
  };

  const summary = useMemo(() => {
    const counts = data?.statusCounts || {};
    return [
      { label: "Checked out", value: counts.completed || 0 },
      { label: "In-house", value: counts.active || 0 },
      { label: "Canceled", value: counts.canceled || 0 },
      { label: "No-show", value: counts["no-show"] || 0 },
    ];
  }, [data?.statusCounts]);

  const withReset = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const errorStatus = (error as { response?: { status?: number } } | null)?.response?.status;

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3 py-1 text-xs font-semibold text-[#900546] dark:text-[#F968AC] mb-2">
          <History className="size-3.5" />
          Records & Auditing
        </div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-[#130005] dark:text-white">
          Reservation History
        </h1>
        <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-1">
          Review every reservation and walk-in stay, including payments, status changes, and the staff involved.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summary.map((s) => (
          <div key={s.label} className="rounded-2xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5C454B] dark:text-gray-400">{s.label}</p>
            <div className="mt-1 text-2xl font-bold tabular-nums text-[#130005] dark:text-white">
              {isLoading ? <Skeleton className="h-7 w-10" /> : s.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search guest, email, phone, room, reference, or payment ref..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
            maxLength={100}
            aria-label="Search reservation history"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select value={status} onValueChange={withReset(setStatus)}>
            <SelectTrigger className="w-full" aria-label="Status filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={paymentStatus} onValueChange={withReset(setPaymentStatus)}>
            <SelectTrigger className="w-full" aria-label="Payment status filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={withReset(setType)}>
            <SelectTrigger className="w-full" aria-label="Booking type filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-1">
            <Label htmlFor="history-from" className="text-[11px] text-muted-foreground">Arrival from</Label>
            <Input id="history-from" type="date" value={from} max={to || undefined} onChange={(e) => withReset(setFrom)(e.target.value)} aria-invalid={!!dateError} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="history-to" className="text-[11px] text-muted-foreground">Arrival to</Label>
            <Input id="history-to" type="date" value={to} min={from || undefined} onChange={(e) => withReset(setTo)(e.target.value)} aria-invalid={!!dateError} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {dateError ? <p className="text-xs font-medium text-destructive">{dateError}</p> : <span />}
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <RotateCcw className="size-3.5" />
              Reset filters
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 py-12 text-center">
          <AlertTriangle className="size-8 text-destructive" />
          <p className="text-sm font-medium text-destructive">
            {errorStatus === 403
              ? "You no longer have permission to view reservation history."
              : getApiErrorMessage(error, "Failed to load reservation history.")}
          </p>
          {errorStatus !== 403 && (
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              Try again
            </Button>
          )}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
          <History className="size-8 text-muted-foreground/60" />
          <p className="mt-2 text-sm font-medium">No reservations found</p>
          <p className="text-xs text-muted-foreground">
            {hasFilters ? "Try adjusting or resetting the filters." : "Reservations will appear here once guests book."}
          </p>
        </div>
      ) : (
        <div className={`overflow-x-auto rounded-2xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] ${isFetching ? "opacity-70" : ""}`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Stay</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Handled by</TableHead>
                <TableHead>Created / Updated</TableHead>
                <TableHead className="text-right">Log</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: reservationHistoryItem) => (
                <TableRow key={item.bookingId}>
                  <TableCell>
                    <p className="font-mono text-xs font-semibold">{item.reference}</p>
                    <p className="text-[11px] capitalize text-muted-foreground">{item.type === "walk-in" ? "walk in" : item.type}</p>
                  </TableCell>
                  <TableCell className="min-w-[160px]">
                    <p className="text-sm font-medium">{item.clientName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {[item.clientEmail, item.clientPhone].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {item.room?.roomNumber ? `Room ${item.room.roomNumber}` : "—"}
                    <span className="block text-[11px] text-muted-foreground">{item.room?.category || ""}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatDate(item.arrivalDate)} → {formatDate(item.departureDate || null)}
                    <span className="block text-[11px] text-muted-foreground">
                      {item.nights} night{item.nights === 1 ? "" : "s"}
                      {item.checkedOutAt ? ` · out ${formatDateTime(item.checkedOutAt)}` : ""}
                      {item.earlyCheckout ? " · early" : ""}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge map={STATUS_BADGES} value={item.status} />
                    {item.cancellationReason ? (
                      <p className="mt-1 max-w-[160px] truncate text-[11px] text-muted-foreground" title={item.cancellationReason}>
                        {item.cancellationReason}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge map={PAYMENT_BADGES} value={item.paymentStatus} />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {item.paymentMethod || "—"}
                      {item.paymentRefNumber ? ` · ${item.paymentRefNumber}` : ""}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">
                    <p className="font-semibold">{peso(item.billTotal)}</p>
                    {(item.addOnsTotal || 0) > 0 ? (
                      <p className="text-[11px] text-muted-foreground" title={(item.addOns || []).map((a) => `${a.quantity}× ${a.name}`).join(", ")}>
                        incl. add-ons {peso(item.addOnsTotal || 0)}
                      </p>
                    ) : null}
                    <p className="text-[11px] text-muted-foreground">Paid {peso(item.amountPaid)}</p>
                    {item.balance > 0 && !["canceled", "no-show"].includes(item.status) ? (
                      <p className="text-[11px] text-amber-700">Due {peso(item.balance)}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs">
                    {item.handledBy?.length ? item.handledBy.join(", ") : <span className="text-muted-foreground">Guest / online</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-[11px] text-muted-foreground">
                    <p>{formatDateTime(item.createdAt)}</p>
                    <p>{formatDateTime(item.updatedAt)}</p>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <BookingHistoryDialog booking={{ modificationHistory: item.modificationHistory }} />
                      {isAdmin && (
                        <ReasonDialog
                          trigger={
                            <Button variant="ghost" size="icon-sm" title="Archive reservation" aria-label="Archive reservation">
                              <Archive className="size-3.5 text-muted-foreground" />
                            </Button>
                          }
                          title={`Archive ${item.reference}?`}
                          description="The reservation is hidden from history and reports and releases its room. Payment records are kept. Restore it any time from the Archive."
                          confirmLabel="Archive Reservation"
                          isPending={archiveMutation.isPending}
                          onConfirm={(reason) => archiveMutation.mutateAsync({ id: item.bookingId, reason })}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!isLoading && !isError && items.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + items.length} of {data?.total ?? 0} records
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} / {totalPages}
            </span>
            <Button variant="outline" size="icon-sm" disabled={page >= totalPages || isFetching} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
