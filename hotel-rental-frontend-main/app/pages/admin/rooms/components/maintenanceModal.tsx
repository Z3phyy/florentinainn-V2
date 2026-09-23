"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { roomInterface } from "@/app/types/room.type";
import { errorAlert, successAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Wrench, History } from "lucide-react";

export function MaintenanceModal({ room }: { room: roomInterface }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [assignedMaintainer, setAssignedMaintainer] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const isMaintenance = room.status === "maintenance";

  useEffect(() => {
    if (open) {
      setReason(room.maintenanceReason || "");
      setAssignedMaintainer(room.assignedMaintainer || "");
      setNotes("");
    }
  }, [open, room]);

  const toggleMutation = useMutation({
    mutationFn: () =>
      axiosInstance.patch("/room/maintenance", {
        _id: room._id,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...(assignedMaintainer.trim()
          ? { assignedMaintainer: assignedMaintainer.trim() }
          : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      }),
    onSuccess: () => {
      successAlert(
        isMaintenance
          ? "Maintenance details updated."
          : "Room flagged for maintenance.",
      );
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setOpen(false);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      const message =
        err.response?.data?.message || "Failed to update maintenance.";
      errorAlert(message);
    },
  });

  const history = room.maintenanceHistory || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          title={isMaintenance ? "Manage maintenance" : "Flag for maintenance"}
        >
          <Wrench
            className={`size-3.5 ${
              isMaintenance ? "text-rose-600" : "text-muted-foreground"
            }`}
          />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="size-4" />
            {isMaintenance ? "Manage Maintenance" : "Flag for Maintenance"}
          </DialogTitle>
          <DialogDescription>
            {room.roomNumber ? `Room ${room.roomNumber}` : "Suite"} (
            {room.category})
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2 max-h-[420px] overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="maintenance-reason">Reason</Label>
            <Input
              id="maintenance-reason"
              placeholder="e.g. AC not cooling, plumbing issue"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maintenance-assignee">Assigned Maintainer</Label>
            <Input
              id="maintenance-assignee"
              placeholder="e.g. John the technician"
              value={assignedMaintainer}
              onChange={(e) => setAssignedMaintainer(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maintenance-notes">Notes</Label>
            <Input
              id="maintenance-notes"
              placeholder={
                isMaintenance
                  ? "Update progress / resolution details"
                  : "Optional details"
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {isMaintenance && history.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold flex items-center gap-1.5 text-[#5C454B] dark:text-gray-400">
                <History className="size-3" />
                Maintenance History
              </p>
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                {[...history]
                  .reverse()
                  .map((entry, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-border bg-muted/30 p-2.5 space-y-0.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold capitalize">
                          {entry.action}
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
                        <p className="text-xs text-muted-foreground">
                          {entry.note}
                        </p>
                      ) : null}
                      <p className="text-[10px] text-muted-foreground">
                        By {entry.changedBy || "Administrator"}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
            variant={isMaintenance ? "secondary" : "destructive"}
          >
            {toggleMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving...
              </>
            ) : isMaintenance ? (
              "Update Details"
            ) : (
              "Flag for Maintenance"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}