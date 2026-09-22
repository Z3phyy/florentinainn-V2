"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
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
import {
  validateBookingForm,
  nightsBetween,
  todayDateStr,
  addDays,
  apiErrorMessage,
  FieldErrors,
  MAX_STAY_NIGHTS,
} from "@/app/utils/bookingValidation";

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

// Field-level error text shown under an input.
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
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [arrivalDate, setArivalDate] = useState(getTodayDate());
  const [arrivalTime, setArivalTime] = useState(getNextIncrementedTime(5));
  const [departureDate, setDepartureDate] = useState(
    addDays(getTodayDate(), 1),
  );
  const [guests, setGuests] = useState("1");
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLock = useRef(false);

  // Sync state whenever modal is opened
  useEffect(() => {
    if (open) {
      const today = getTodayDate();
      setArivalDate(today);
      setArivalTime(getNextIncrementedTime(5));
      setDepartureDate(addDays(today, 1));
      setErrors({});
      setSubmitted(false);
      setPolicyAccepted(false);
      setIsSubmitting(false);
      submitLock.current = false;
    }
  }, [open]);

  const formValues = useMemo(
    () => ({
      clientName,
      clientAddress,
      clientEmail,
      clientPhone,
      arrivalDate,
      arrivalTime,
      departureDate,
      guests,
    }),
    [
      clientName,
      clientAddress,
      clientEmail,
      clientPhone,
      arrivalDate,
      arrivalTime,
      departureDate,
      guests,
    ],
  );

  const liveErrors = useMemo(
    () =>
      validateBookingForm(formValues, {
        requireEmail: true,
        maxHead: selectedRoom.maxHead,
      }),
    [formValues, selectedRoom.maxHead],
  );

  const visibleErrors = submitted ? liveErrors : errors;

  const nights = nightsBetween(arrivalDate, departureDate);
  const nightlyRate = Math.round(
    selectedRoom.price * (1 - (selectedRoom.discount || 0) / 100),
  );
  const estimatedTotal = nights > 0 ? nightlyRate * nights : 0;
  const depositDue = Number(systemInfo?.paymentMin || 0);

  const handleDateChange = (newDate: string) => {
    setArivalDate(newDate);
    // If selected date is today, ensure time is not earlier than current time
    if (newDate === getTodayDate()) {
      const now = new Date();
      const [h, m] = arrivalTime.split(":").map(Number);
      if (
        h < now.getHours() ||
        (h === now.getHours() && m < now.getMinutes())
      ) {
        setArivalTime(getNextIncrementedTime(5));
      }
    }
    if (!departureDate || nightsBetween(newDate, departureDate) < 1) {
      setDepartureDate(addDays(newDate, 1));
    }
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
      departureDate: string;
      arrivalTime: string;
      guests: number;
      policyAccepted: boolean;
      room: string;
    }) => axiosInstance.post("/booking/reservation", data),
    onSuccess: (response) => {
      const bookingId = response.data?.bookingId;
      if (!bookingId) {
        errorAlert("Reservation could not be created. Please try again.");
        setIsSubmitting(false);
        submitLock.current = false;
        return;
      }

      const amount = systemInfo?.paymentMin?.toString() || "1000";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitLock.current || isSubmitting || createBookingMutation.isPending)
      return;

    setSubmitted(true);
    setErrors(liveErrors);

    if (Object.keys(liveErrors).length > 0) {
      errorAlert("Please correct the highlighted fields before continuing.");
      return;
    }

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
      clientName: clientName.trim(),
      clientAddress: clientAddress.trim(),
      clientEmail: clientEmail.trim(),
      clientPhone: clientPhone.trim(),
      type: "reservation",
      status: "unpaid",
      arrivalDate,
      departureDate,
      arrivalTime,
      guests: Number(guests),
      policyAccepted: true,
      room: selectedRoom._id,
    });
  };

  const submitDisabled =
    isSubmitting || createBookingMutation.isPending || !policyAccepted;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
              Up to {selectedRoom.maxHead || 2} guest(s) · max {MAX_STAY_NIGHTS}{" "}
              nights per stay
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

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              aria-invalid={!!visibleErrors.clientName}
              maxLength={80}
              className="h-11 rounded-xl bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 text-xs focus-visible:ring-[#900546]"
            />
            <FieldError message={visibleErrors.clientName} />
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
              value={clientAddress}
              onChange={(e) => setClientAddress(e.target.value)}
              aria-invalid={!!visibleErrors.clientAddress}
              maxLength={160}
              className="h-11 rounded-xl bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 text-xs focus-visible:ring-[#900546]"
            />
            <FieldError message={visibleErrors.clientAddress} />
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
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                aria-invalid={!!visibleErrors.clientEmail}
                className="h-11 rounded-xl bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 text-xs focus-visible:ring-[#900546]"
              />
              <FieldError message={visibleErrors.clientEmail} />
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
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                aria-invalid={!!visibleErrors.clientPhone}
                className="h-11 rounded-xl bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 text-xs focus-visible:ring-[#900546]"
              />
              <FieldError message={visibleErrors.clientPhone} />
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
                value={arrivalDate}
                onChange={(e) => handleDateChange(e.target.value)}
                aria-invalid={!!visibleErrors.arrivalDate}
                className="h-11 rounded-xl bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 text-xs focus-visible:ring-[#900546]"
              />
              <FieldError message={visibleErrors.arrivalDate} />
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
                value={arrivalTime}
                onChange={(e) => setArivalTime(e.target.value)}
                aria-invalid={!!visibleErrors.arrivalTime}
                className="h-11 rounded-xl bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 text-xs focus-visible:ring-[#900546]"
              />
              {visibleErrors.arrivalTime ? (
                <FieldError message={visibleErrors.arrivalTime} />
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  5-minute interval stepping
                </p>
              )}
            </div>
          </div>

          {/* Departure date & guests */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="departureDate"
                className="text-xs font-semibold text-[#5C454B] dark:text-gray-300"
              >
                Check-out Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="departureDate"
                type="date"
                min={addDays(arrivalDate || getTodayDate(), 1)}
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                aria-invalid={!!visibleErrors.departureDate}
                className="h-11 rounded-xl bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 text-xs focus-visible:ring-[#900546]"
              />
              {visibleErrors.departureDate ? (
                <FieldError message={visibleErrors.departureDate} />
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  {nights > 0
                    ? `${nights} night${nights === 1 ? "" : "s"}`
                    : "Must be after check-in"}
                </p>
              )}
            </div>
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
                value={guests}
                onChange={(e) => setGuests(e.target.value)}
                aria-invalid={!!visibleErrors.guests}
                className="h-11 rounded-xl bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 text-xs focus-visible:ring-[#900546]"
              />
              {visibleErrors.guests ? (
                <FieldError message={visibleErrors.guests} />
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  Maximum {selectedRoom.maxHead || 2} guest(s) for this room
                </p>
              )}
            </div>
          </div>

          {/* Stay cost summary */}
          {nights > 0 && (
            <div className="rounded-2xl border border-[#D9C3C3] dark:border-white/10 bg-[#FAF5F5] dark:bg-[#25121B] p-4 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#5C454B] dark:text-gray-400">
                  ₱{nightlyRate.toLocaleString()} × {nights} night
                  {nights === 1 ? "" : "s"}
                </span>
                <span className="font-bold text-[#130005] dark:text-white">
                  ₱{estimatedTotal.toLocaleString()}
                </span>
              </div>
              {depositDue > 0 && (
                <div className="flex items-center justify-between border-t border-[#D9C3C3] dark:border-white/10 pt-1.5">
                  <span className="text-[#5C454B] dark:text-gray-400">
                    Non-refundable amount due now
                  </span>
                  <span className="font-bold text-[#900546] dark:text-[#F968AC]">
                    ₱{depositDue.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}

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
