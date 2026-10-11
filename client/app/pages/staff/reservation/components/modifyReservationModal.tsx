"use client";

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axiosInstance from "@/app/utils/axios";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { getApiErrorMessage } from "@/app/utils/apiError";
import useAvailableAddOns from "@/app/hooks/useAvailableAddOns";
import { AddOnQuantities, peso, toSelection } from "@/app/utils/addOnPricing";
import {
  bookingInterface,
  modificationSummary,
  roomAvailabilityItem,
} from "@/app/types/bookings.type";
import { addOnInterface } from "@/app/types/addOn.type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/formField";
import { AddOnSelector } from "@/components/ui/addOnSelector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertTriangle, ArrowRight, Loader2, PencilLine } from "lucide-react";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const schema = z
  .object({
    roomId: z.string().min(1, "Select a room."),
    arrivalDate: z.string().regex(DATE, "Arrival date is required."),
    arrivalTime: z.string().regex(/^\d{2}:\d{2}$/, "Arrival time is required."),
    departureDate: z.string().regex(DATE, "Departure date is required."),
    guests: z
      .string()
      .trim()
      .min(1, "Guest count is required.")
      .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 20, "Use a whole number from 1 to 20."),
    note: z.string().trim().max(300, "Note must be at most 300 characters."),
  })
  .refine((d) => d.departureDate > d.arrivalDate, {
    path: ["departureDate"],
    message: "Departure must be at least one night after arrival.",
  });

type Values = z.input<typeof schema>;

const FIELD_LABELS: Record<string, string> = {
  room: "Room",
  arrivalDate: "Arrival date",
  arrivalTime: "Arrival time",
  departureDate: "Departure date",
  guests: "Guests",
  addOns: "Add-ons",
  totalAmount: "Stay total (₱)",
};

const roomIdOf = (booking: bookingInterface) =>
  typeof booking.room === "object" && booking.room ? booking.room._id : String(booking.room || "");

const initialQuantities = (booking: bookingInterface): AddOnQuantities =>
  Object.fromEntries((booking.addOns || []).filter((a) => a.addOn).map((a) => [String(a.addOn), a.quantity]));

export function ModifyReservationModal({ booking }: { booking: bookingInterface }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [addOnQuantities, setAddOnQuantities] = useState<AddOnQuantities>(() => initialQuantities(booking));
  const isInHouse = booking.status === "active";

  const defaults = (): Values => ({
    roomId: roomIdOf(booking),
    arrivalDate: booking.arrivalDate,
    arrivalTime: booking.arrivalTime,
    departureDate: booking.departureDate || "",
    guests: String(booking.guests || 1),
    note: "",
  });

  const form = useForm<Values>({ resolver: zodResolver(schema), mode: "all", defaultValues: defaults() });
  const errors = form.formState.errors;
  const watched = useWatch({ control: form.control });
  const [debounced, setDebounced] = useState(watched);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(watched), 400);
    return () => window.clearTimeout(t);
  }, [watched]);

  const arrivalDate = watched.arrivalDate || "";
  const departureDate = watched.departureDate || "";
  const datesValid = DATE.test(arrivalDate) && DATE.test(departureDate) && departureDate > arrivalDate;
  const nights = datesValid
    ? Math.round((Date.UTC(...(departureDate.split("-").map(Number) as [number, number, number])) - Date.UTC(...(arrivalDate.split("-").map(Number) as [number, number, number]))) / 86400000)
    : 1;

  const rooms = useQuery<roomAvailabilityItem[]>({
    queryKey: ["room-availability", booking._id, arrivalDate, departureDate],
    enabled: open && datesValid,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await axiosInstance.get("/booking/room-availability", {
        params: { arrivalDate, departureDate, excludeBookingId: booking._id },
      })).data,
  });

  const addOnsQuery = useAvailableAddOns(arrivalDate, departureDate, open);
  const addOnOptions = useMemo<addOnInterface[]>(() => {
    const list = [...(addOnsQuery.data || [])];
    for (const item of booking.addOns || []) {
      if (item.addOn && !list.some((o) => o._id === String(item.addOn))) {
        list.push({
          _id: String(item.addOn),
          name: item.name,
          description: "No longer offered",
          price: item.unitPrice,
          pricingUnit: item.pricingUnit,
          maxPerBooking: item.quantity,
          stock: null,
          isActive: false,
        });
      }
    }
    return list;
  }, [addOnsQuery.data, booking.addOns]);

  const selection = toSelection(addOnQuantities);
  const payload = {
    bookingId: booking._id,
    revision: booking.revision ?? 0,
    roomId: debounced.roomId,
    arrivalDate: debounced.arrivalDate,
    arrivalTime: debounced.arrivalTime,
    departureDate: debounced.departureDate,
    guests: Number(debounced.guests),
    addOns: selection,
  };
  const previewEnabled = open && schema.safeParse({ ...debounced, note: "" }).success;

  const preview = useQuery<modificationSummary>({
    queryKey: ["modification-preview", payload],
    enabled: previewEnabled,
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: async () => (await axiosInstance.post("/booking/reservation/modify", { ...payload, preview: true })).data,
  });

  const previewError = preview.isError ? getApiErrorMessage(preview.error, "Unable to preview this change.") : "";
  const noChanges = previewError === "No changes to save.";

  const mutation = useMutation({
    mutationFn: (values: Values) =>
      axiosInstance.post("/booking/reservation/modify", {
        bookingId: booking._id,
        revision: booking.revision ?? 0,
        roomId: values.roomId,
        arrivalDate: values.arrivalDate,
        arrivalTime: values.arrivalTime,
        departureDate: values.departureDate,
        guests: Number(values.guests),
        addOns: toSelection(addOnQuantities),
        note: values.note,
      }),
    onSuccess: (res) => {
      const payment = res.data?.payment;
      successAlert(
        payment?.balanceDue > 0
          ? `Reservation updated. Balance due: ${peso(payment.balanceDue)}.`
          : payment?.creditDue > 0
            ? `Reservation updated. Guest overpaid by ${peso(payment.creditDue)} — no refund was issued automatically.`
            : "Reservation updated.",
      );
      queryClient.invalidateQueries({ queryKey: ["reservation-board"] });
      queryClient.invalidateQueries({ queryKey: ["active-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["reservation-history"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setOpen(false);
    },
    onError: (err) => {
      errorAlert(getApiErrorMessage(err, "Failed to update the reservation."));
      if ((err as { response?: { status?: number } })?.response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: ["reservation-board"] });
        queryClient.invalidateQueries({ queryKey: ["active-bookings"] });
        queryClient.invalidateQueries({ queryKey: ["room-availability"] });
      }
    },
  });

  const selectedRoom = rooms.data?.find((r) => r._id === watched.roomId);
  const payment = preview.data?.payment;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          form.reset(defaults());
          setAddOnQuantities(initialQuantities(booking));
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex-1 flex items-center justify-center gap-1.5 bg-[#FAF5F5] dark:bg-[#25121B] border border-[#D9C3C3] dark:border-white/10 hover:border-[#900546]/50 text-[#5C454B] hover:text-[#900546] text-xs font-semibold py-2.5 px-3 rounded-xl transition-all cursor-pointer"
        >
          <PencilLine className="size-4" />
          <span>Modify</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Modify Reservation</DialogTitle>
          <DialogDescription>
            {booking.clientName} · changes are checked for availability and repriced by the server before saving.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField id="mod-arrival" label="Arrival date" required error={errors.arrivalDate?.message}>
              <Input id="mod-arrival" type="date" disabled={isInHouse} aria-invalid={!!errors.arrivalDate} {...form.register("arrivalDate")} />
            </FormField>
            <FormField id="mod-time" label="Arrival time" required error={errors.arrivalTime?.message}>
              <Input id="mod-time" type="time" disabled={isInHouse} aria-invalid={!!errors.arrivalTime} {...form.register("arrivalTime")} />
            </FormField>
            <FormField id="mod-departure" label="Departure date" required error={errors.departureDate?.message}>
              <Input id="mod-departure" type="date" min={arrivalDate || undefined} aria-invalid={!!errors.departureDate} {...form.register("departureDate")} />
            </FormField>
          </div>
          {isInHouse && (
            <p className="text-[11px] text-muted-foreground">The guest is already checked in, so only the room, departure, guests and add-ons can change.</p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <FormField id="mod-room" label="Room" required error={errors.roomId?.message}>
                <Controller
                  control={form.control}
                  name="roomId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={!datesValid}>
                      <SelectTrigger id="mod-room" className="w-full">
                        <SelectValue placeholder={rooms.isLoading ? "Checking availability..." : "Select a room"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(rooms.data || []).map((room) => (
                          <SelectItem key={room._id} value={room._id} disabled={!room.available && room._id !== roomIdOf(booking)}>
                            {room.roomNumber ? `Room ${room.roomNumber} · ` : ""}
                            {room.category} — {peso(room.nightlyRate)}/night
                            {!room.available ? ` (${room.reason || "unavailable"})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
              {rooms.isError && <p className="text-xs text-destructive mt-1">Room availability could not be loaded.</p>}
              {selectedRoom && !selectedRoom.available && (
                <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                  <AlertTriangle className="size-3.5" />
                  This room is not available for the selected dates.
                </p>
              )}
            </div>
            <FormField id="mod-guests" label="Guests" required error={errors.guests?.message} hint={selectedRoom ? `Max ${selectedRoom.maxHead}` : undefined}>
              <Input id="mod-guests" type="number" min={1} max={selectedRoom?.maxHead || 20} step={1} aria-invalid={!!errors.guests} {...form.register("guests")} />
            </FormField>
          </div>

          <div className="space-y-2">
            <Label>Add-ons</Label>
            <AddOnSelector
              options={addOnOptions}
              value={addOnQuantities}
              onChange={setAddOnQuantities}
              nights={nights}
              isLoading={addOnsQuery.isLoading}
              isError={addOnsQuery.isError}
              ownQuantities={initialQuantities(booking)}
            />
          </div>

          <FormField id="mod-note" label="Reason / note" error={errors.note?.message} hint="Recorded in the reservation history and audit trail.">
            <Textarea id="mod-note" rows={2} placeholder="e.g. Guest requested a larger room" aria-invalid={!!errors.note} {...form.register("note")} />
          </FormField>

          <div className="rounded-2xl border border-[#D9C3C3] dark:border-white/10 bg-[#FAF5F5] dark:bg-[#25121B] p-4 space-y-2 text-xs">
            <p className="font-semibold text-[#130005] dark:text-white">Change summary</p>
            {!previewEnabled ? (
              <p className="text-muted-foreground">Complete the fields above to preview the change.</p>
            ) : preview.isLoading ? (
              <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Checking availability and pricing...</p>
            ) : preview.isError ? (
              <p className={noChanges ? "text-muted-foreground" : "text-destructive"}>{previewError}</p>
            ) : preview.data ? (
              <>
                <ul className="space-y-1">
                  {preview.data.changes.filter((c) => c.field !== "totalAmount").map((change) => (
                    <li key={change.field} className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{FIELD_LABELS[change.field] || change.field}:</span>
                      <span className="text-muted-foreground">{change.from || "—"}</span>
                      <ArrowRight className="size-3" />
                      <span>{change.to || "—"}</span>
                    </li>
                  ))}
                </ul>
                {payment && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-[#D9C3C3] dark:border-white/10 pt-2">
                    <span className="text-muted-foreground">Previous total</span>
                    <span className="text-right tabular-nums">{peso(payment.previousTotal)}</span>
                    <span className="text-muted-foreground">New total</span>
                    <span className="text-right font-semibold tabular-nums">{peso(payment.newTotal)}</span>
                    <span className="text-muted-foreground">Already paid</span>
                    <span className="text-right tabular-nums">{peso(payment.amountPaid)}</span>
                    {payment.balanceDue > 0 && (
                      <>
                        <span className="font-medium text-amber-700">Balance due</span>
                        <span className="text-right font-semibold tabular-nums text-amber-700">{peso(payment.balanceDue)}</span>
                      </>
                    )}
                    {payment.creditDue > 0 && (
                      <>
                        <span className="font-medium text-emerald-700">Overpayment / credit</span>
                        <span className="text-right font-semibold tabular-nums text-emerald-700">{peso(payment.creditDue)}</span>
                      </>
                    )}
                  </div>
                )}
                {payment && payment.balanceDue > 0 && (
                  <p className="text-[11px] text-muted-foreground">The balance is collected at the front desk through partial payment or checkout.</p>
                )}
                {payment && payment.creditDue > 0 && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    No refund is issued automatically and recorded payments are not changed. Online deposits are non-refundable per policy; if the hotel returns money, record it in Payment Records.
                  </p>
                )}
              </>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !preview.data || preview.isFetching || preview.isError}
            >
              {mutation.isPending ? <><Loader2 className="size-4 animate-spin" /> Saving...</> : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
