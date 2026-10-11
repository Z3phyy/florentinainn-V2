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
import { Loader2, SprayCan } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "clean", label: "Clean" },
  { value: "dirty", label: "Dirty" },
  { value: "cleaning", label: "Cleaning" },
  { value: "inspected", label: "Inspected" },
  { value: "out-of-service", label: "Out of Service" },
];

export function UpdateHousekeepingModal({ room }: { room: roomInterface }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("clean");
  const [assignedHousekeeper, setAssignedHousekeeper] = useState("");
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setStatus(room.housekeepingStatus || "clean");
      setAssignedHousekeeper(room.assignedHousekeeper || "");
      setNote("");
    }
  }, [open, room]);

  const updateMutation = useMutation({
    mutationFn: () =>
      axiosInstance.patch("/room/housekeeping", {
        _id: room._id,
        housekeepingStatus: status,
        ...(assignedHousekeeper.trim() ? { assignedHousekeeper: assignedHousekeeper.trim() } : {}),
        ...(note.trim() ? { housekeepingNotes: note.trim() } : {}),
      }),
    onSuccess: () => {
      successAlert("Housekeeping status updated.");
      queryClient.invalidateQueries({ queryKey: ["housekeeping-report"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setOpen(false);
    },
    onError: (err: { response?: { data?: string } }) => {
      const message =
        typeof err.response?.data === "string"
          ? err.response.data
          : "Failed to update housekeeping status.";
      errorAlert(message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" title="Update housekeeping">
          <SprayCan className="size-3.5 text-sky-600" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SprayCan className="size-4" />
            Update Housekeeping
          </DialogTitle>
          <DialogDescription>
            Advance {room.roomNumber ? `Room ${room.roomNumber}` : "suite"} (
            {room.category}) along the cleaning cycle.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Status</Label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatus(option.value)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition-colors cursor-pointer ${
                    status === option.value
                      ? "bg-[#900546] text-white border-[#900546]"
                      : "border-[#D9C3C3] text-[#5C454B] dark:text-gray-300 hover:bg-[#FAF5F5] dark:hover:bg-[#1A0E13]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assignee">Assigned Housekeeper</Label>
            <Input
              id="assignee"
              placeholder="e.g. Maria Santos"
              value={assignedHousekeeper}
              onChange={(e) => setAssignedHousekeeper(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Notes</Label>
            <Input
              id="note"
              placeholder="Optional note for this status change"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving...
              </>
            ) : (
              "Save Status"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}