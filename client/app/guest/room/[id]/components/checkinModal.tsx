"use client";

import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axiosInstance from "@/app/utils/axios";
import useAvailableAddOns from "@/app/hooks/useAvailableAddOns";
import { AddOnQuantities, addOnLineTotal, addOnsEstimate, peso, toSelection } from "@/app/utils/addOnPricing";
import { AddOnSelector } from "@/components/ui/addOnSelector";
import { roomInterface } from "@/app/types/room.type";
import { errorAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Loader2,
  LogIn,
  CreditCard,
  Smartphone,
  Check,
  Bed,
  ShieldAlert,
} from "lucide-react";
import { stripeBooking } from "@/app/utils/stripe";
import { paymongoBooking } from "@/app/utils/paymongo";
import { systemInterface } from "@/app/types/system.type";
import { todayDateStr, apiErrorMessage } from "@/app/utils/bookingValidation";
import { guestReservationSchema } from "@/app/utils/schemas";

type ReservationValues = z.input<ReturnType<typeof guestReservationSchema>>;

function getTodayDate() {
  return todayDateStr();
}

function getNextIncrementedTime(intervalMinutes = 5) {
  const now = new Date();
  const ms = 1000 * 60 * intervalMinutes;
  const rounded = new Date(Math.ceil(now.getTime() / ms) * ms);
  const hh = String(rounded.getHours()).padStart(2, "0");
  const mm = String(rounded.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[11px] font-medium text-destructive">{message}</p>;
}

export function CheckinModal({
  selectedRoom,
}: {
  selectedRoom: roomInterface;
}) {
  const [open, setOpen] = useState(false);

  const { data: systemInfo } = useQuery({
    queryKey: ["systeminfo"],
    queryFn: async (): Promise<systemInterface> => {
      const response = await axiosInstance.get("/system");
      return response.data;
    },
  });

  const [paymentMode, setPaymentmode] = useState("paymongo");
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [addOnQuantities, setAddOnQuantities] = useState<AddOnQuantities>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLock = useRef(false);

  const schema = useMemo(
    () => guestReservationSchema(selectedRoom.maxHead),
    [selectedRoom.maxHead],
  );

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    trigger,
    control,
    formState: { errors },
  } = useForm<ReservationValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      clientName: "",
      clientAddress: "",
      clientEmail: "",
      clientPhone: "",
      arrivalDate: getTodayDate(),
      arrivalTime: getNextIncrementedTime(5),
      guests: "1",
    },
  });

  const arrivalDate = useWatch({ control, name: "arrivalDate" });

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) return;
    reset({
      ...getValues(),
      arrivalDate: getTodayDate(),
      arrivalTime: getNextIncrementedTime(5),
    });
    setPolicyAccepted(false);
    setAddOnQuantities({});
    setIsSubmitting(false);
    submitLock.current = false;
  };

  const nightlyRate = Math.round(
    selectedRoom.price * (1 - (selectedRoom.discount || 0) / 100),
  );
  const addOnsQuery = useAvailableAddOns(arrivalDate, "", open);
  const addOnOptions = addOnsQuery.data ?? [];
  const addOnsTotal = addOnsEstimate(addOnOptions, addOnQuantities, 1);
  const estimatedTotal = nightlyRate + addOnsTotal;
  const configuredDeposit = Number(systemInfo?.paymentMin || 0);
  const depositDue = configuredDeposit > 0 ? Math.min(configuredDeposit, estimatedTotal) : 0;

  const handleArrivalDateChange = (newDate: string) => {
    if (newDate === getTodayDate()) {
      const now = new Date();
      const [h, m] = getValues("arrivalTime").split(":").map(Number);
      if (
        h < now.getHours() ||
        (h === now.getHours() && m < now.getMinutes())
      ) {
        setValue("arrivalTime", getNextIncrementedTime(5));
      }
    }
    trigger("arrivalTime");
  };

  const createBookingMutation = useMutation({
    mutationFn: (data: {
      clientName: string;
      clientAddress: string;
      clientEmail?: string;
      clientPhone?: string;
      type: string;
      status: string;
      arrivalDate: string;
      arrivalTime: string;
      guests: number;
      policyAccepted: boolean;
      room: string;
      addOns: { addOnId: string; quantity: number }[];
    }) => axiosInstance.post("/booking/reservation", data),
    onSuccess: (response) => {
      const bookingId = response.data?.bookingId;
      if (!bookingId) {
        errorAlert("Reservation could not be created. Please try again.");
        setIsSubmitting(false);
        submitLock.current = false;
        return;
      }

      try {
        if (response.data?.verificationCode) {
          sessionStorage.setItem(
            `reservation_code_${bookingId}`,
            response.data.verificationCode,
          );
        }
      } catch {}

      const serverDeposit = Number(response.data?.pricing?.depositDue);
      if (!Number.isFinite(serverDeposit) || serverDeposit <= 0) {
        errorAlert("Could not determine the amount due. Please try again.");
        setIsSubmitting(false);
        submitLock.current = false;
        return;
      }
      const amount = String(Math.round(serverDeposit));
      if (paymentMode === "stripe") {
        stripeBooking(amount, bookingId);
      } else {
        paymongoBooking(amount, bookingId);
      }
    },
    onError: (err: unknown) => {
      errorAlert(
        apiErrorMessage(
          err,
          "Failed to create your reservation. Please try again.",
        ),
      );
      setIsSubmitting(false);
      submitLock.current = false;
    },
  });

  const onValidSubmit = async (values: ReservationValues) => {
    if (submitLock.current || isSubmitting || createBookingMutation.isPending)
      return;

    if (!policyAccepted) {
      errorAlert(
        "Please acknowledge the non-refundable reservation policy to continue.",
      );
      return;
    }

    submitLock.current = true;
    setIsSubmitting(true);

    try {
      const fresh = await axiosInstance.get(`/room/${selectedRoom._id}`);
      const status = fresh.data?.status;
      if (status && status !== "available") {
        errorAlert(
          `This room is no longer available (currently ${status}). Please choose another room.`,
        );
        setIsSubmitting(false);
        submitLock.current = false;
        return;
      }
    } catch {
      errorAlert("Could not confirm room availability. Please try again.");
      setIsSubmitting(false);
      submitLock.current = false;
      return;
    }

    createBookingMutation.mutate({
      clientName: values.clientName.trim(),
      clientAddress: values.clientAddress.trim(),
      clientEmail: values.clientEmail.trim(),
      clientPhone: values.clientPhone.trim(),
      type: "reservation",
      status: "unpaid",
      arrivalDate: values.arrivalDate,
      arrivalTime: values.arrivalTime,
      guests: Number(values.guests),
      policyAccepted: true,
      room: selectedRoom._id,
      addOns: toSelection(addOnQuantities),
    });
  };

  const onInvalidSubmit = () => {
    errorAlert("Please correct the highlighted fields before continuing.");
  };

  const submitDisabled =
    isSubmitting || createBookingMutation.isPending || !policyAccepted;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          className="w-full bg-[#900546] hover:bg-[#720336] text-white rounded-2xl h-12 text-sm font-semibold shadow-lg shadow-[#900546]/20 transition-all cursor-pointer"
          size="lg"
          disabled={selectedRoom.status !== "available"}
          onClick={() => setOpen(true)}
        >
          {selectedRoom.status === "available"
            ? "Reserve This Suite"
            : "Not Available"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-bold text-[#130005] dark:text-white">
            Reserve{" "}
            {selectedRoom.roomNumber
              ? `Unit ${selectedRoom.roomNumber} · ${selectedRoom.category}`
              : selectedRoom.category}
          </DialogTitle>
          <DialogDescription className="text-xs text-[#5C454B] dark:text-gray-400">
            Complete the form below to confirm your reservation and proceed to
            payment.
          </DialogDescription>
        </DialogHeader>

        {/* Selected Room Summary Banner */}
        <div className="flex items-center gap-4 p-4 rounded-2xl border border-[#D9C3C3] dark:border-white/10 bg-[#FAF5F5] dark:bg-[#25121B]">
          <div className="size-16 rounded-xl overflow-hidden bg-muted shrink-0 border border-[#D9C3C3] dark:border-white/10 shadow-xs">
            {selectedRoom.image ? (
              <img
                src={selectedRoom.image}
                alt={selectedRoom.category}
                className="size-full object-cover"
              />
            ) : (
              <div className="size-full flex items-center justify-center text-[#900546]">
                <Bed className="size-7" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#130005] dark:text-white truncate">
              {selectedRoom.roomNumber
                ? `Unit ${selectedRoom.roomNumber} · `
                : ""}
              {selectedRoom.category}
            </p>
            <p className="font-serif text-base text-[#900546] font-bold mt-0.5">
              ₱{nightlyRate.toLocaleString()}{" "}
              <span className="text-xs font-normal text-[#5C454B] dark:text-gray-400">
                / night
              </span>
            </p>
            <p className="text-[11px] text-[#5C454B] dark:text-gray-400 mt-0.5">
              Up to {selectedRoom.maxHead || 2} guest(s)
            </p>
          </div>
        </div>

        {/* ── Non-refundable policy notice ── */}
        <div className="rounded-2xl border-2 border-[#900546]/40 bg-[#900546]/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-[#900546] dark:text-[#F968AC]">
            <ShieldAlert className="size-4 shrink-0" />
            <p className="text-sm font-bold uppercase tracking-wide">
              Non-Refundable Reservation
            </p>
          </div>
          <p className="text-xs leading-relaxed text-[#5C454B] dark:text-gray-300">
            Online reservations at this property are{" "}
            <strong>non-refundable</strong>. Once your payment goes through, the
            amount paid cannot be refunded — this includes cancellations, date
            changes, early departures and no-shows. Please double-check your
            dates before you continue.
          </p>
        </div>

        <form
          onSubmit={(e) => handleSubmit(onValidSubmit, onInvalidSubmit)(e)}
          className="space-y-5"
          noValidate
        >
          {/* Client Name */}
          <div className="space-y-1.5">
            <Label
              htmlFor="clientName"
              className="text-xs font-semibold text-[#5C454B] dark:text-gray-300"
            >
              Full Guest Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="clientName"
              placeholder="e.g. John Doe"
              aria-invalid={!!errors.clientName}
              {...register("clientName")}
              maxLength={80}
              className="h-11 rounded-xl bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 text-xs focus-visible:ring-[#900546]"
            />
            <FieldError message={errors.clientName?.message} />
          </div>

          {/* Client Address */}
          <div className="space-y-1.5">
            <Label
              htmlFor="clientAddress"
              className="text-xs font-semibold text-[#5C454B] dark:text-gray-300"
            >
              Guest Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="clientAddress"
              placeholder="e.g. 123 Main St, City"
              aria-invalid={!!errors.clientAddress}
              {...register("clientAddress")}
              maxLength={160}
              className="h-11 rounded-xl bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 text-xs focus-visible:ring-[#900546]"
            />
            <FieldError message={errors.clientAddress?.message} />
          </div>

          {/* Client Email & Phone - same row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="clientEmail"
                className="text-xs font-semibold text-[#5C454B] dark:text-gray-300"
              >
                Guest Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="clientEmail"
                type="email"
                placeholder="e.g. john@email.com"
                aria-invalid={!!errors.clientEmail}
                {...register("clientEmail")}
                className="h-11 rounded-xl bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 text-xs focus-visible:ring-[#900546]"
              />
              <FieldError message={errors.clientEmail?.message} />
              <p className="text-[10px] text-muted-foreground">
                Your confirmation voucher is sent here.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="clientPhone"
                className="text-xs font-semibold text-[#5C454B] dark:text-gray-300"
              >
                Guest Phone
              </Label>
              <Input
                id="clientPhone"
                type="tel"
                placeholder="e.g. 0917 123 4567"
                aria-invalid={!!errors.clientPhone}
                {...register("clientPhone")}
                className="h-11 rounded-xl bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 text-xs focus-visible:ring-[#900546]"
              />
              <FieldError message={errors.clientPhone?.message} />
            </div>
          </div>

          {/* Arrival Date & Time - same row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="arrivalDate"
                className="text-xs font-semibold text-[#5C454B] dark:text-gray-300"
              >
                Check-in Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="arrivalDate"
                type="date"
                min={getTodayDate()}
                aria-invalid={!!errors.arrivalDate}
                {...register("arrivalDate", {
                  onChange: (e) => handleArrivalDateChange(e.target.value),
                })}
                className="h-11 rounded-xl bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 text-xs focus-visible:ring-[#900546]"
              />
              <FieldError message={errors.arrivalDate?.message} />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="arrivalTime"
                className="text-xs font-semibold text-[#5C454B] dark:text-gray-300"
              >
                Estimated Arrival Time{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="arrivalTime"
                type="time"
                step="300"
                aria-invalid={!!errors.arrivalTime}
                {...register("arrivalTime")}
                className="h-11 rounded-xl bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 text-xs focus-visible:ring-[#900546]"
              />
              {errors.arrivalTime ? (
                <FieldError message={errors.arrivalTime.message} />
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  5-minute interval stepping
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="guests"
                className="text-xs font-semibold text-[#5C454B] dark:text-gray-300"
              >
                Number of Guests <span className="text-destructive">*</span>
              </Label>
              <Input
                id="guests"
                type="number"
                min={1}
                max={selectedRoom.maxHead || 20}
                step={1}
                aria-invalid={!!errors.guests}
                {...register("guests")}
                className="h-11 rounded-xl bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 text-xs focus-visible:ring-[#900546]"
              />
              {errors.guests ? (
                <FieldError message={errors.guests.message} />
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  Maximum {selectedRoom.maxHead || 2} guest(s) for this room
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-[#5C454B] dark:text-gray-300">
              Add-ons &amp; Special Requests
            </Label>
            <AddOnSelector
              options={addOnOptions}
              value={addOnQuantities}
              onChange={setAddOnQuantities}
              nights={1}
              isLoading={addOnsQuery.isLoading}
              isError={addOnsQuery.isError}
              disabled={isSubmitting}
            />
          </div>

          {/* Stay cost summary */}
          <div className="rounded-2xl border border-[#D9C3C3] dark:border-white/10 bg-[#FAF5F5] dark:bg-[#25121B] p-4 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#5C454B] dark:text-gray-400">
                ₱{nightlyRate.toLocaleString()} × 1 night
              </span>
              <span className="font-bold text-[#130005] dark:text-white">
                ₱{nightlyRate.toLocaleString()}
              </span>
            </div>
            {addOnOptions
              .filter((addOn) => (addOnQuantities[addOn._id] || 0) > 0)
              .map((addOn) => (
                <div key={addOn._id} className="flex items-center justify-between">
                  <span className="text-[#5C454B] dark:text-gray-400">
                    {addOnQuantities[addOn._id]}× {addOn.name}
                    {addOn.pricingUnit === "per_night" ? " × 1 night" : ""}
                  </span>
                  <span className="font-semibold text-[#130005] dark:text-white">
                    {peso(addOnLineTotal(addOn, addOnQuantities[addOn._id] || 0, 1))}
                  </span>
                </div>
              ))}
            <div className="flex items-center justify-between border-t border-[#D9C3C3] dark:border-white/10 pt-1.5">
              <span className="font-semibold text-[#130005] dark:text-white">Estimated first-night total</span>
              <span className="font-bold text-[#130005] dark:text-white">{peso(estimatedTotal)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Final prices are confirmed by the hotel system when you continue. Your check-out date is arranged with the front desk, and any additional nights and the remaining balance are settled when you check out.
            </p>
            {depositDue > 0 && (
              <div className="flex items-center justify-between border-t border-[#D9C3C3] dark:border-white/10 pt-1.5">
                <span className="text-[#5C454B] dark:text-gray-400">
                  Non-refundable amount due now
                </span>
                <span className="font-bold text-[#900546] dark:text-[#F968AC]">
                  {peso(depositDue)}
                </span>
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div className="space-y-2.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-[#5C454B] dark:text-gray-300">
              Payment Method
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentmode("stripe")}
                className={`
                  relative flex items-center gap-3 p-4 rounded-2xl border transition-all duration-300 cursor-pointer text-left
                  ${
                    paymentMode === "stripe"
                      ? "border-[#900546] bg-[#900546]/10 shadow-sm"
                      : "border-[#D9C3C3] dark:border-white/10 bg-[#FAF5F5] dark:bg-[#28161D] hover:border-[#900546]/50"
                  }
                `}
              >
                <div
                  className={`
                  flex items-center justify-center size-10 rounded-xl transition-all duration-200
                  ${
                    paymentMode === "stripe"
                      ? "bg-[#900546] text-white shadow-md shadow-[#900546]/20"
                      : "bg-white dark:bg-[#1A0E13] text-[#5C454B]"
                  }
                `}
                >
                  <CreditCard className="size-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#130005] dark:text-white">
                    Credit / Debit Card
                  </p>
                  <p className="text-[10px] text-[#5C454B] dark:text-gray-400">
                    Via Stripe Gateway
                  </p>
                </div>

                {paymentMode === "stripe" && (
                  <div className="absolute -top-1.5 -right-1.5 size-5 bg-[#900546] rounded-full flex items-center justify-center shadow-sm">
                    <Check className="size-3 text-white" />
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => setPaymentmode("paymongo")}
                className={`
                  relative flex items-center gap-3 p-4 rounded-2xl border transition-all duration-300 cursor-pointer text-left
                  ${
                    paymentMode === "paymongo"
                      ? "border-[#900546] bg-[#900546]/10 shadow-sm"
                      : "border-[#D9C3C3] dark:border-white/10 bg-[#FAF5F5] dark:bg-[#28161D] hover:border-[#900546]/50"
                  }
                `}
              >
                <div
                  className={`
                  flex items-center justify-center size-10 rounded-xl transition-all duration-200
                  ${
                    paymentMode === "paymongo"
                      ? "bg-[#900546] text-white shadow-md shadow-[#900546]/20"
                      : "bg-white dark:bg-[#1A0E13] text-[#5C454B]"
                  }
                `}
                >
                  <Smartphone className="size-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#130005] dark:text-white">
                    GCash / E-Wallet
                  </p>
                  <p className="text-[10px] text-[#5C454B] dark:text-gray-400">
                    Via PayMongo QR
                  </p>
                </div>

                {paymentMode === "paymongo" && (
                  <div className="absolute -top-1.5 -right-1.5 size-5 bg-[#900546] rounded-full flex items-center justify-center shadow-sm">
                    <Check className="size-3 text-white" />
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* ── Policy acknowledgement (required before reserving) ── */}
          <div className="flex items-start gap-3 rounded-2xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#25121B] p-4">
            <Checkbox
              id="policyAccepted"
              checked={policyAccepted}
              onCheckedChange={(checked) => setPolicyAccepted(checked === true)}
              className="mt-0.5"
            />
            <Label
              htmlFor="policyAccepted"
              className="text-xs font-medium leading-relaxed text-[#130005] dark:text-gray-200 cursor-pointer"
            >
              I have read and agree that this online reservation and the amount
              I pay now are{" "}
              <strong className="text-[#900546] dark:text-[#F968AC]">
                non-refundable
              </strong>
              , and that no refund will be issued if I cancel or do not show up.
            </Label>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="submit"
              disabled={submitDisabled}
              className="w-full bg-[#900546] hover:bg-[#720336] text-white rounded-2xl h-12 text-sm font-semibold shadow-lg shadow-[#900546]/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting || createBookingMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Processing
                  Reservation...
                </>
              ) : (
                <>
                  <LogIn className="size-4" />
                  <span>Confirm Non-Refundable Reservation & Pay</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
