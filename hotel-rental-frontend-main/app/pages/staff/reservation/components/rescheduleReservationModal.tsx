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
import { Loader2, CalendarClock } from "lucide-react";

export function RescheduleReservationModal({ booking }: { booking: bookingInterface }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const [arrivalDate, setArrivalDate] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [note, setNote] = useState("");

  const rescheduleMutation = useMutation({
    mutationFn: (data: {
      bookingId: string;
      arrivalDate: string;
      arrivalTime: string;
      departureDate: string;
      note?: string;
    }) => axiosInstance.post("/booking/reservation/reschedule", data),
    onSuccess: () => {
      successAlert("Reservation rescheduled.");
      queryClient.invalidateQueries({ queryKey: ["reservation-bookings"] });
      setOpen(false);
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      errorAlert(err.response?.data?.message || "Failed to reschedule."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!arrivalDate || !arrivalTime) {
      errorAlert("Arrival date and time are required.");
      return;
    }
    rescheduleMutation.mutate({
      bookingId: booking._id,
      arrivalDate,
      arrivalTime,
      departureDate,
      note,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setArrivalDate(booking.arrivalDate || "");
            setArrivalTime(booking.arrivalTime || "");
            setDepartureDate(booking.departureDate || "");
            setNote("");
            setOpen(true);
          }}
        >
          <CalendarClock className="size-3.5" />
          Reschedule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule Reservation</DialogTitle>
          <DialogDescription>
            Move the guest&apos;s arrival to new dates. Changes are recorded in the reservation history.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="arrivalDate">New Arrival Date</Label>
              <Input
                id="arrivalDate"
                type="date"
                value={arrivalDate}
                onChange={(e) => setArrivalDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="arrivalTime">New Arrival Time</Label>
              <Input
                id="arrivalTime"
                type="time"
                value={arrivalTime}
                onChange={(e) => setArrivalTime(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="departureDate">New Departure Date</Label>
            <Input
              id="departureDate"
              type="date"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Notes (optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Reason for rescheduling"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={rescheduleMutation.isPending}
              className="bg-[#900546] hover:bg-[#720336] text-white"
            >
              {rescheduleMutation.isPending && (
                <Loader2 className="size-4 animate-spin mr-2" />
              )}
              Reschedule Reservation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}