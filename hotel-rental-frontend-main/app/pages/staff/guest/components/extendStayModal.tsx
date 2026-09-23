"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { bookingInterface } from "@/app/types/bookings.type";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, CalendarRange } from "lucide-react";

export function ExtendStayModal({ booking }: { booking: bookingInterface }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const [departureDate, setDepartureDate] = useState("");
  const [note, setNote] = useState("");

  const extendMutation = useMutation({
    mutationFn: (data: { bookingId: string; departureDate: string; note?: string }) =>
      axiosInstance.post("/booking/extend", data),
    onSuccess: () => {
      successAlert("Stay extended.");
      queryClient.invalidateQueries({ queryKey: ["active-bookings"] });
      setOpen(false);
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      errorAlert(err.response?.data?.message || "Failed to extend stay."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!departureDate) {
      errorAlert("New departure date is required.");
      return;
    }
    extendMutation.mutate({ bookingId: booking._id, departureDate, note });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setDepartureDate(booking.departureDate || "");
            setNote("");
            setOpen(true);
          }}
        >
          <CalendarRange className="size-3.5" />
          Extend Stay
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Extend Stay</DialogTitle>
          <DialogDescription>
            Extend the guest&apos;s departure date. The extension is recorded in the reservation history.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="departureDate">New Departure Date</Label>
            <Input
              id="departureDate"
              type="date"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Notes (optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Reason for extension"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={extendMutation.isPending}
              className="bg-[#900546] hover:bg-[#720336] text-white"
            >
              {extendMutation.isPending && (
                <Loader2 className="size-4 animate-spin mr-2" />
              )}
              Extend Stay
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}