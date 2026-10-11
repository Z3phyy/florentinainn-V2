"use client";

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { roomInterface } from "@/app/types/room.type";
import { errorAlert, successAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, ShieldCheck, RefreshCw, Ban, Loader2 } from "lucide-react";
import { UpdateHousekeepingModal } from "./components/updateHousekeepingModal";
import { HousekeepingHistoryDialog } from "./components/housekeepingHistoryDialog";

interface HousekeepingReport {
  rooms: (roomInterface & {
    housekeepingStatus: string;
    assignedHousekeeper: string;
    housekeepingStartedAt?: string | null;
    housekeepingUpdatedAt?: string | null;
    housekeepingNotes: string;
    housekeepingHistory: Array<{
      status: string;
      from: string;
      note: string;
      changedBy: string;
      changedAt: string;
    }>;
  })[];
  summary: {
    total: number;
    clean: number;
    dirty: number;
    cleaning: number;
    inspected: number;
    outOfService: number;
  };
}

const housekeepingVariant = (status: string) => {
  switch (status) {
    case "clean":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800";
    case "dirty":
      return "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800";
    case "cleaning":
      return "bg-sky-500/10 text-sky-600 border-sky-200 dark:border-sky-800";
    case "inspected":
      return "bg-violet-500/10 text-violet-600 border-violet-200 dark:border-violet-800";
    case "out-of-service":
      return "bg-red-500/10 text-red-600 border-red-200 dark:border-red-800";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

export default function Page() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["housekeeping-report"],
    queryFn: async (): Promise<HousekeepingReport> => {
      const response = await axiosInstance.get("/room/housekeeping/report");
      return response.data;
    },
  });

  const markDirtyMutation = useMutation({
    mutationFn: (id: string) =>
      axiosInstance.post("/room/housekeeping/dirty", { _id: id }),
    onSuccess: () => {
      successAlert("Room marked dirty for cleaning.");
      queryClient.invalidateQueries({ queryKey: ["housekeeping-report"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      const message =
        err.response?.data?.message || "Failed to mark room dirty.";
      errorAlert(message);
    },
  });

  const summaryCards = useMemo(
    () =>
      data?.summary
        ? [
            { label: "Clean", value: data.summary.clean, tone: "text-emerald-600" },
            { label: "Dirty", value: data.summary.dirty, tone: "text-amber-600" },
            { label: "Cleaning", value: data.summary.cleaning, tone: "text-sky-600" },
            { label: "Inspected", value: data.summary.inspected, tone: "text-violet-600" },
            { label: "Out of Service", value: data.summary.outOfService, tone: "text-red-600" },
            { label: "Total Suites", value: data.summary.total, tone: "text-[#900546]" },
          ]
        : [],
    [data],
  );

  const formatTime = (value?: string | null) => {
    if (!value) return "—";
    return new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3 py-1 text-xs font-semibold text-[#900546] dark:text-[#F968AC] mb-2">
          Housekeeping Board
        </div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-[#130005] dark:text-white">
          Housekeeping Workflow
        </h1>
        <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5">
          Track the room cleaning cycle: dirty → cleaning → clean → inspected → out-of-service.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-4 text-center shadow-xs"
          >
            <p className={`text-2xl font-bold ${card.tone}`}>{card.value}</p>
            <p className="text-[11px] text-[#5C454B] dark:text-gray-400 mt-0.5">
              {card.label}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load housekeeping data.</p>
      ) : data?.rooms && data.rooms.length > 0 ? (
        <div className="rounded-2xl border border-[#D9C3C3] dark:border-white/10 overflow-hidden shadow-xs bg-white dark:bg-[#1A0E13]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned Housekeeper</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-[190px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rooms.map((room) => (
                <TableRow key={room._id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        {room.roomNumber ? `Room ${room.roomNumber}` : "Suite"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {room.category} · {room.status}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${housekeepingVariant(room.housekeepingStatus)}`}
                    >
                      {room.housekeepingStatus || "clean"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {room.assignedHousekeeper || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatTime(room.housekeepingStartedAt)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatTime(room.housekeepingUpdatedAt)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                    {room.housekeepingNotes || <span>—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <HousekeepingHistoryDialog room={room} />
                      <UpdateHousekeepingModal room={room} />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Mark dirty"
                        disabled={
                          room.housekeepingStatus === "dirty" ||
                          markDirtyMutation.isPending
                        }
                        onClick={() => markDirtyMutation.mutate(room._id)}
                      >
                        {markDirtyMutation.isPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="size-3.5 text-amber-600" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Sparkles className="size-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No rooms found.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add rooms to start tracking housekeeping.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <ShieldCheck className="size-3.5" />
        Status changes are audited and notified in real time.
        <Ban className="size-3.5 mx-1" />
        Only rooms in "clean", "dirty", "cleaning", "inspected", or "out-of-service" can transition along the cycle.
      </div>
    </div>
  );
}