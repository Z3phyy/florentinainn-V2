"use client";

import { useState } from "react";
import { roomInterface } from "@/app/types/room.type";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { History } from "lucide-react";

export function HousekeepingHistoryDialog({ room }: { room: roomInterface }) {
  const [open, setOpen] = useState(false);
  const history = room.housekeepingHistory || [];

  const statusColor = (status: string) => {
    switch (status) {
      case "clean":
        return "text-emerald-600";
      case "dirty":
        return "text-amber-600";
      case "cleaning":
        return "text-sky-600";
      case "inspected":
        return "text-violet-600";
      case "out-of-service":
        return "text-red-600";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" title="Housekeeping history">
          <History className="size-3.5 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Housekeeping History</DialogTitle>
          <DialogDescription>
            {room.roomNumber ? `Room ${room.roomNumber}` : "Suite"} (
            {room.category}) cleaning log.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2 max-h-[380px] overflow-y-auto">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No housekeeping activity recorded yet.
            </p>
          ) : (
            [...history].reverse().map((entry, index) => (
              <div
                key={index}
                className="rounded-xl border border-border bg-muted/30 p-3 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold capitalize flex items-center gap-1.5">
                    <span className={statusColor(entry.status)}>
                      ● {entry.status}
                    </span>
                    {entry.from ? (
                      <span className="text-muted-foreground font-normal">
                        (from {entry.from})
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(entry.changedAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {entry.note ? (
                  <p className="text-xs text-muted-foreground">{entry.note}</p>
                ) : null}
                <p className="text-[10px] text-muted-foreground">
                  By {entry.changedBy || "Administrator"}
                </p>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}