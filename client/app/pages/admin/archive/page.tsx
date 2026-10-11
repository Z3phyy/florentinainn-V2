"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { confirmAlert, errorAlert, successAlert } from "@/app/utils/alert";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { formatHotelDateTime } from "@/app/utils/hotelTime";
import useUserStore from "@/app/store/useUserStore";
import { adminReviewListResult, archiveListResult, archiveType } from "@/app/types/archive.type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StarRating } from "@/components/ui/starRating";
import { ReasonDialog } from "@/components/ui/reasonDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Archive, ChevronLeft, ChevronRight, RotateCcw, Search } from "lucide-react";

type Tab = archiveType | "moderation";

const TABS: { id: Tab; label: string; superOnly?: boolean }[] = [
  { id: "rooms", label: "Rooms" },
  { id: "reservations", label: "Reservations" },
  { id: "reviews", label: "Reviews" },
  { id: "staff", label: "Staff Accounts", superOnly: true },
  { id: "moderation", label: "Moderate Reviews" },
];

const RESTORE_NOTES: Record<archiveType, string> = {
  rooms: "The room becomes bookable again with its current status.",
  reservations: "Upcoming or in-house reservations are only restored if their room is still free for those dates.",
  reviews: "The review becomes visible on the room page again.",
  staff: "The account returns to Staff Management with its previous status. Existing sessions stay signed out.",
};

function Pager({ page, totalPages, onChange, total }: { page: number; totalPages: number; total: number; onChange: (p: number) => void }) {
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-muted-foreground">{total} record{total === 1 ? "" : "s"}</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-xs text-muted-foreground">Page {page} / {totalPages}</span>
        <Button variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Next page">
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function ArchivedList({ type }: { type: archiveType }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<archiveListResult>({
    queryKey: ["archive", type, debounced, page],
    placeholderData: keepPreviousData,
    queryFn: async () => (await axiosInstance.get(`/archive/${type}`, { params: { search: debounced || undefined, page, limit: 15 } })).data,
  });

  const restore = useMutation({
    mutationFn: (id: string) => axiosInstance.post(`/archive/${type}/${id}/restore`),
    onSuccess: (res) => {
      successAlert(res.data?.message || "Record restored.");
      queryClient.invalidateQueries({ queryKey: ["archive"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      queryClient.invalidateQueries({ queryKey: ["reservation-history"] });
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
    onError: (err) => errorAlert(getApiErrorMessage(err, "Failed to restore record.")),
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input placeholder="Search archived records..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" aria-label="Search archive" />
      </div>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 py-10 text-center">
          <AlertTriangle className="size-6 text-destructive" />
          <p className="text-sm text-destructive">{getApiErrorMessage(error, "Failed to load archived records.")}</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-12 text-center">
          <Archive className="size-7 text-muted-foreground/60" />
          <p className="mt-2 text-sm font-medium">Nothing archived here</p>
          <p className="text-xs text-muted-foreground">{debounced ? "No archived records match your search." : "Archived records will appear here."}</p>
        </div>
      ) : (
        <div className={`overflow-x-auto rounded-2xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] ${isFetching ? "opacity-70" : ""}`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Record</TableHead>
                <TableHead>Archived</TableHead>
                <TableHead>By / reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
                <TableRow key={item._id}>
                  <TableCell className="min-w-[200px]">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground break-words">{item.detail}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{formatHotelDateTime(item.deletedAt)}</TableCell>
                  <TableCell className="text-xs">
                    {item.deletedBy || "—"}
                    {item.deleteReason ? <span className="block text-[11px] text-muted-foreground">{item.deleteReason}</span> : null}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex rounded-full border border-gray-500/30 bg-gray-500/10 px-2 py-0.5 text-[11px] font-medium text-gray-600">Archived</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={restore.isPending}
                      onClick={() =>
                        confirmAlert(`Restore "${item.name}"? ${RESTORE_NOTES[type]}`, "Restore", () => restore.mutate(item._id))
                      }
                    >
                      <RotateCcw className="size-3.5" />
                      Restore
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {data && <Pager page={page} totalPages={data.totalPages} total={data.total} onChange={setPage} />}
    </div>
  );
}

function ReviewModeration() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useQuery<adminReviewListResult>({
    queryKey: ["admin-reviews", page],
    placeholderData: keepPreviousData,
    queryFn: async () => (await axiosInstance.get("/review/manage", { params: { page, limit: 15 } })).data,
  });
  const archive = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => axiosInstance.delete(`/review/${id}`, { data: { reason } }),
    onSuccess: () => {
      successAlert("Review archived. It is no longer shown to guests.");
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["archive"] });
    },
    onError: (err) => errorAlert(getApiErrorMessage(err, "Failed to archive review.")),
  });

  if (isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;
  if (isError)
    return (
      <div className="flex items-center gap-3 text-sm text-destructive">
        Failed to load reviews. <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  if (!data || data.items.length === 0)
    return <p className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">No published reviews.</p>;

  return (
    <div className="space-y-3">
      {data.items.map((review) => (
        <div key={review._id} className="flex flex-col gap-2 rounded-2xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{review.guestName}</span>
              <StarRating value={review.rating} readOnly size="sm" />
              <span className="text-[11px] text-muted-foreground">{review.roomLabel} · {formatHotelDateTime(review.createdAt)}</span>
            </div>
            <p className="text-sm text-[#5C454B] dark:text-gray-300 break-words">{review.comment}</p>
          </div>
          <ReasonDialog
            trigger={
              <Button size="sm" variant="outline" className="shrink-0">
                <Archive className="size-3.5" />
                Archive
              </Button>
            }
            title="Archive this review?"
            description="The review is hidden from guests. It stays in the Archive and can be restored."
            confirmLabel="Archive Review"
            isPending={archive.isPending}
            onConfirm={(reason) => archive.mutateAsync({ id: review._id, reason })}
          />
        </div>
      ))}
      <Pager page={page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
    </div>
  );
}

export default function Page() {
  const user = useUserStore((s) => s.user);
  const isSuperAdmin = user?.type === "super admin";
  const tabs = TABS.filter((t) => !t.superOnly || isSuperAdmin);
  const [tab, setTab] = useState<Tab>("rooms");

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3 py-1 text-xs font-semibold text-[#900546] dark:text-[#F968AC] mb-2">
          <Archive className="size-3.5" />
          Records & Recovery
        </div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-[#130005] dark:text-white">Archive</h1>
        <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-1 max-w-2xl">
          Deleted rooms, reservations, reviews and staff accounts are archived instead of erased, so history stays intact. Payments and audit logs are never deleted.
        </p>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
              tab === t.id
                ? "border-[#900546] bg-[#900546] text-white"
                : "border-[#D9C3C3] dark:border-white/10 text-[#5C454B] dark:text-gray-300 hover:border-[#900546]/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "moderation" ? <ReviewModeration /> : <ArchivedList key={tab} type={tab} />}
    </div>
  );
}
