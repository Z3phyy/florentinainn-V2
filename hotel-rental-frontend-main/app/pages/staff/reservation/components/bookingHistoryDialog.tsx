"use client";

import { useState } from "react";
import { bookingInterface } from "@/app/types/bookings.type";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { History, ArrowRight } from "lucide-react";

const FIELD_LABELS: Record<string, string> = {
  status: "Status",
  arrivalDate: "Arrival Date",
  arrivalTime: "Arrival Time",
  departureDate: "Departure Date",
  room: "Room",
  guests: "Guests",
};

export function BookingHistoryDialog({ booking }: { booking: bookingInterface }) {
  const [open, setOpen] = useState(false);
  const history = booking.modificationHistory || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" title="Reservation history" onClick={() => setOpen(true)}>
          <History className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reservation History</DialogTitle>
          <DialogDescription>
            {history.length === 0
              ? "No modifications recorded for this reservation."
              : `${history.length} modification${history.length !== 1 ? "s" : ""} recorded.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Lifecycle changes such as check-in, rescheduling, extensions, cancellations, and no-shows appear here.
            </p>
          )}
          {history.map((entry, index) => (
            <div
              key={index}
              className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#900546] dark:text-[#F968AC] uppercase tracking-wide">
                  {FIELD_LABELS[entry.field] || entry.field}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {entry.changedAt
                    ? new Date(entry.changedAt).toLocaleString()
                    : ""}
                </span>
              </div>
              {entry.from !== undefined && entry.from !== "" && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="truncate">{entry.from}</span>
                  <ArrowRight className="size-3 shrink-0" />
                  <span className="truncate font-medium text-foreground">{entry.to}</span>
                </div>
              )}
              {entry.note && (
                <p className="text-xs text-muted-foreground">“{entry.note}”</p>
              )}
              {entry.changedBy && (
                <p className="text-[10px] text-muted-foreground">by {entry.changedBy}</p>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}