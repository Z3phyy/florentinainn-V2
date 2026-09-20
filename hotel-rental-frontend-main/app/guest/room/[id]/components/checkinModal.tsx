"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { roomInterface } from "@/app/types/room.type";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Loader2, LogIn, CreditCard, Smartphone, Check, ChevronLeft, ChevronRight, Bed } from "lucide-react";
import { stripeBooking } from "@/app/utils/stripe";
import { paymongoBooking } from "@/app/utils/paymongo";
import { systemInterface } from "@/app/types/system.type";

function getTodayDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getNextIncrementedTime(intervalMinutes = 5) {
  const now = new Date();
  const ms = 1000 * 60 * intervalMinutes;
  const rounded = new Date(Math.ceil(now.getTime() / ms) * ms);
  const hh = String(rounded.getHours()).padStart(2, "0");
  const mm = String(rounded.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function CheckinModal({ selectedRoom }: { selectedRoom: roomInterface }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: systemInfo, isLoading, isError } = useQuery({
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

  // Sync state whenever modal is opened
  useEffect(() => {
    if (open) {
      setArivalDate(getTodayDate());
      setArivalTime(getNextIncrementedTime(5));
    }
  }, [open]);

  // Check if selected time is in the past for today
  const isTimeInPast = useMemo(() => {
    if (arrivalDate !== getTodayDate() || !arrivalTime) return false;
    const [h, m] = arrivalTime.split(":").map(Number);
    const now = new Date();
    return h < now.getHours() || (h === now.getHours() && m < now.getMinutes());
  }, [arrivalDate, arrivalTime]);

  const handleDateChange = (newDate: string) => {
    setArivalDate(newDate);
    // If selected date is today, ensure time is not earlier than current time
    if (newDate === getTodayDate()) {
      const now = new Date();
      const [h, m] = arrivalTime.split(":").map(Number);
      if (h < now.getHours() || (h === now.getHours() && m < now.getMinutes())) {
        setArivalTime(getNextIncrementedTime(5));
      }
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
      arrivalTime: string;
      room: string;
    }) => axiosInstance.post("/booking/reservation", data),
    onSuccess: (response) => {
      console.log('Payment', paymentMode)
      console.log("Response:",response)
      console.log('Booking ID', response.data.bookingId)
      if (paymentMode == "stripe") {
        stripeBooking(systemInfo?.paymentMin.toString() || "1000", response.data.bookingId);
      } else {
        paymongoBooking(systemInfo?.paymentMin.toString() || "1000", response.data.bookingId);
        console.log('System Info', systemInfo?.paymentMin.toString())
      }
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      console.log(err.response?.data)
      const message =
        err.response?.data?.message || "Failed to check in guest.";
      errorAlert(message);
    },
  });

  const resetForm = () => {
    setClientName("");
    setClientAddress("");
    setClientEmail("");
    setClientPhone("");
    setArivalDate(getTodayDate());
    setArivalTime(getNextIncrementedTime(5));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientName || !clientAddress || !arrivalDate || !arrivalTime || !selectedRoom) {
      errorAlert("Please fill in all required fields.");
      return;
    }

    // Validate that arrival date & time is not in the past
    const [year, month, day] = arrivalDate.split("-").map(Number);
    const [hours, minutes] = arrivalTime.split(":").map(Number);
    const arrivalDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
    const now = new Date();

    if (arrivalDateTime.getTime() < now.getTime() - 2 * 60 * 1000) {
      errorAlert("Arrival date and time cannot be in the past.");
      return;
    }

    createBookingMutation.mutate({
      clientName,
      clientAddress,
      clientEmail,
      clientPhone,
      type: "reservation",
      status: "unpaid",
      arrivalDate,
      arrivalTime,
      room: selectedRoom._id,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="w-full bg-[#900546] hover:bg-[#720336] text-white rounded-2xl h-12 text-sm font-semibold shadow-lg shadow-[#900546]/20 transition-all cursor-pointer"
          size="lg"
          disabled={selectedRoom.status !== "available"}
          onClick={() => setOpen(true)}
        >
          {selectedRoom.status === "available" ? "Reserve This Suite" : "Not Available"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-bold text-[#130005] dark:text-white">
            Reserve {selectedRoom.roomNumber ? `Unit ${selectedRoom.roomNumber} · ${selectedRoom.category}` : selectedRoom.category}
          </DialogTitle>
          <DialogDescription className="text-xs text-[#5C454B] dark:text-gray-400">
            Complete the form below to confirm your reservation and proceed to payment.
          </DialogDescription>
        </DialogHeader>

        {/* Selected Room Summary Banner */}
        <div className="flex items-center gap-4 p-4 rounded-2xl border border-[#D9C3C3] dark:border-white/10 bg-[#FAF5F5] dark:bg-[#25121B]">
          <div className="size-16 rounded-xl overflow-hidden bg-muted shrink-0 border border-[#D9C3C3] dark:border-white/10 shadow-xs">
            {selectedRoom.image ? (
              <img src={selectedRoom.image} alt={selectedRoom.category} className="size-full object-cover" />
            ) : (
              <div className="size-full flex items-center justify-center text-[#900546]">
                <Bed className="size-7" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#130005] dark:text-white truncate">
              {selectedRoom.roomNumber ? `Unit ${selectedRoom.roomNumber} · ` : ""}{selectedRoom.category}
            </p>
            <p className="font-serif text-base text-[#900546] font-bold mt-0.5">
              ₱{Math.round(selectedRoom.price * (1 - (selectedRoom.discount || 0) / 100)).toLocaleString()} <span className="text-xs font-normal text-[#5C454B] dark:text-gray-400">/ night</span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Client Name */}
          <div className="space-y-1.5">
            <Label htmlFor="clientName" className="text-xs font-semibold text-[#5C454B] dark:text-gray-300">
              Full Guest Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="clientName"
              placeholder="e.g. John Doe"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="h-11 rounded-xl bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 text-xs focus-visible:ring-[#900546]"
              required
            />
          </div>

          {/* Client Address */}
          <div className="space-y-1.5">
            <Label htmlFor="clientAddress" className="text-xs font-semibold text-[#5C454B] dark:text-gray-300">
              Guest Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="clientAddress"
              placeholder="e.g. 123 Main St, City"
              value={clientAddress}
              onChange={(e) => setClientAddress(e.target.value)}
              className="h-11 rounded-xl bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 text-xs focus-visible:ring-[#900546]"
              required
            />
          </div>

          {/* Client Email & Phone - same row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="clientEmail" className="text-xs font-semibold text-[#5C454B] dark:text-gray-300">
                Guest Email
              </Label>
              <Input
                id="clientEmail"
                type="email"
                placeholder="e.g. john@email.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="h-11 rounded-xl bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 text-xs focus-visible:ring-[#900546]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clientPhone" className="text-xs font-semibold text-[#5C454B] dark:text-gray-300">
                Guest Phone
              </Label>
              <Input
                id="clientPhone"
                type="tel"
                placeholder="e.g. 0917 123 4567"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="h-11 rounded-xl bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 text-xs focus-visible:ring-[#900546]"
              />
            </div>
          </div>

          {/* Arrival Date & Time - same row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="arrivalDate" className="text-xs font-semibold text-[#5C454B] dark:text-gray-300">
                Arrival Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="arrivalDate"
                type="date"
                min={getTodayDate()}
                value={arrivalDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="h-11 rounded-xl bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 text-xs focus-visible:ring-[#900546]"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="arrivalTime" className="text-xs font-semibold text-[#5C454B] dark:text-gray-300">
                Estimated Arrival Time <span className="text-destructive">*</span>
              </Label>
              <Input
                id="arrivalTime"
                type="time"
                step="300"
                min={arrivalDate === getTodayDate() ? getNextIncrementedTime(5) : undefined}
                value={arrivalTime}
                onChange={(e) => setArivalTime(e.target.value)}
                required
                className={`h-11 rounded-xl bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 text-xs focus-visible:ring-[#900546] ${
                  isTimeInPast ? "border-destructive focus-visible:ring-destructive" : ""
                }`}
              />
              {isTimeInPast ? (
                <p className="text-[11px] text-destructive font-medium">Time cannot be in the past today</p>
              ) : (
                <p className="text-[10px] text-muted-foreground">5-minute interval stepping</p>
              )}
            </div>
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
                  ${paymentMode === "stripe"
                    ? "border-[#900546] bg-[#900546]/10 shadow-sm"
                    : "border-[#D9C3C3] dark:border-white/10 bg-[#FAF5F5] dark:bg-[#28161D] hover:border-[#900546]/50"
                  }
                `}
              >
                <div className={`
                  flex items-center justify-center size-10 rounded-xl transition-all duration-200
                  ${paymentMode === "stripe"
                    ? "bg-[#900546] text-white shadow-md shadow-[#900546]/20"
                    : "bg-white dark:bg-[#1A0E13] text-[#5C454B]"
                  }
                `}>
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
                  ${paymentMode === "paymongo"
                    ? "border-[#900546] bg-[#900546]/10 shadow-sm"
                    : "border-[#D9C3C3] dark:border-white/10 bg-[#FAF5F5] dark:bg-[#28161D] hover:border-[#900546]/50"
                  }
                `}
              >
                <div className={`
                  flex items-center justify-center size-10 rounded-xl transition-all duration-200
                  ${paymentMode === "paymongo"
                    ? "bg-[#900546] text-white shadow-md shadow-[#900546]/20"
                    : "bg-white dark:bg-[#1A0E13] text-[#5C454B]"
                  }
                `}>
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

          <DialogFooter className="pt-2">
            <Button
              type="submit"
              disabled={createBookingMutation.isPending}
              className="w-full bg-[#900546] hover:bg-[#720336] text-white rounded-2xl h-12 text-sm font-semibold shadow-lg shadow-[#900546]/20 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {createBookingMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Processing Reservation...
                </>
              ) : (
                <>
                  <LogIn className="size-4" />
                  <span>Confirm Reservation & Proceed to Payment</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
