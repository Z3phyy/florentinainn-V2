"use client";

import { useSearchParams } from "next/navigation";
import axiosInstance from "@/app/utils/axios";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState, Suspense } from "react";
import {
  CheckCircle2,
  Printer,
  Home,
  MapPin,
  Calendar,
  Clock,
  Sparkles,
  ShieldCheck,
  Phone,
  Bed,
  Receipt,
  Download,
  ExternalLink,
  X,
} from "lucide-react";
import { bookingInterface } from "@/app/types/bookings.type";
import { systemInterface } from "@/app/types/system.type";
import Link from "next/link";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();

  const bookingId = searchParams.get("bookingId");
  const amount = searchParams.get("amount");
  const gateway = searchParams.get("gateway") || "paymongo";
  const sessionId = searchParams.get("session_id");

  const { data: systemInfo } = useQuery<systemInterface>({
    queryKey: ["systeminfo"],
    queryFn: async (): Promise<systemInterface> => {
      const response = await axiosInstance.get("/system");
      return response.data;
    },
  });

  const { data: bookingInfo, isLoading } = useQuery({
    queryKey: ["bookingInfo", bookingId],
    queryFn: async (): Promise<bookingInterface> => {
      if (!bookingId) throw new Error("No booking ID");
      const response = await axiosInstance.get(`/booking/${bookingId}`);
      return response.data;
    },
    enabled: !!bookingId,
  });

  const paymentMutation = useMutation({
    mutationFn: (data: {
      bookingId: string;
      amount: number;
      paymentBy: string;
      method?: string;
      refNumber?: string;
      gateway?: string;
      sessionId?: string;
    }) => axiosInstance.post("/booking/reservationPayment", data),
    onSuccess: () => {
      console.log("Payment recorded successfully");
    },
  });

  const [hasCalled, setHasCalled] = useState(false);
  const [paymentError, setPaymentError] = useState(false);

  useEffect(() => {
    if (
      bookingId &&
      amount &&
      !hasCalled &&
      sessionId &&
      bookingInfo?.clientName
    ) {
      paymentMutation.mutate(
        {
          bookingId,
          amount: Number(amount),
          paymentBy: bookingInfo?.clientName,
          method: "Online Payment",
          refNumber: `RSV-${bookingId.slice(-6).toUpperCase()}`,
          gateway,
          sessionId,
        },
        {
          onSuccess: () => {
            setHasCalled(true);
          },
          onError: () => {
            setPaymentError(true);
          },
        },
      );
    }
  }, [bookingInfo, bookingId, amount, gateway, sessionId, hasCalled]);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const total = Number(amount || bookingInfo?.room?.price || 0);

  const hotelName = systemInfo?.systemName || "Florentina Inn";
  const logoUrl = systemInfo?.logo || "/Florentina Inn Logo.png";
  const hotelAddress = "Jose D. Aspiras Hwy, Tubao, 2506 La Union, Philippines";
  const hotelPhone = "0917-123-4567";

  return (
    <div className="min-h-screen bg-[#FAF5F5] dark:bg-[#130005] text-[#130005] dark:text-white px-4 py-8 sm:py-12 relative">
      {/* Background decorative gradient */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[360px] rounded-full opacity-[0.06] blur-[100px] bg-[#900546]" />

      <div className="max-w-4xl mx-auto space-y-6 relative z-10">
        {/* ── Top Bar with Logo & Navigation ── */}
        <div className="flex items-center justify-between pb-4 border-b border-[#D9C3C3] dark:border-white/10 print:hidden">
          <Link href="/" className="flex items-center gap-3">
            <div className="size-10 rounded-2xl overflow-hidden bg-white p-1 border border-[#D9C3C3] flex items-center justify-center shrink-0 shadow-xs">
              <img
                src={logoUrl}
                alt={hotelName}
                className="size-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "/Florentina Inn Logo.png";
                }}
              />
            </div>
            <span className="font-serif text-lg font-bold text-[#130005] dark:text-white">
              {hotelName}
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-[#D9C3C3] bg-white dark:bg-[#1A0E13] text-xs font-bold text-[#900546] hover:bg-[#900546] hover:text-white hover:border-[#900546] transition-all shadow-xs cursor-pointer"
            >
              <Printer className="size-3.5" />
              <span>Print Voucher</span>
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#900546] hover:bg-[#720336] text-white text-xs font-bold transition-all shadow-xs"
            >
              <Home className="size-3.5" />
              <span>Back Home</span>
            </Link>
          </div>
        </div>

        {/* ── Main Layout: Status & Voucher Card ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Confirmation & Stay Details (5 cols) */}
          <div className="lg:col-span-5 space-y-4 print:hidden">
            <div className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 shadow-xs text-center space-y-4">
              {/* Success Badge */}
              <div className="size-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto ring-8 ring-emerald-500/5">
                {paymentError ? (
                  <X className="size-9 text-red-500" />
                ) : (
                  <CheckCircle2 className="size-9" />
                )}
              </div>

              <div>
                {paymentError ? (
                  <>
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-0.5 text-[11px] font-bold text-red-700 dark:text-red-400 mb-2">
                      Payment Verification Failed
                    </div>
                    <h1 className="font-serif text-2xl font-bold text-[#130005] dark:text-white">
                      Payment Could Not Be Verified
                    </h1>
                    <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-1 leading-relaxed">
                      We were unable to confirm your payment with the gateway.
                      Please contact the front desk with your reference.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mb-2">
                      <ShieldCheck className="size-3.5" />
                      Payment Confirmed & Verified
                    </div>
                    <h1 className="font-serif text-2xl font-bold text-[#130005] dark:text-white">
                      Reservation Confirmed!
                    </h1>
                    <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-1 leading-relaxed">
                      Thank you,{" "}
                      <strong className="text-[#130005] dark:text-white">
                        {bookingInfo?.clientName || "valued guest"}
                      </strong>
                      . Your suite is reserved at Florentina Inn.
                    </p>
                  </>
                )}
              </div>

              {/* Room Card Preview */}
              {bookingInfo?.room && (
                <div className="p-3.5 rounded-2xl bg-[#FAF5F5] dark:bg-[#130005] border border-[#D9C3C3] dark:border-white/10 flex items-center gap-3.5 text-left">
                  {bookingInfo.room.image ? (
                    <img
                      src={bookingInfo.room.image}
                      alt={bookingInfo.room.category}
                      className="size-16 rounded-xl object-cover shrink-0 border border-[#D9C3C3]"
                    />
                  ) : (
                    <div className="size-16 rounded-xl bg-white dark:bg-[#1A0E13] flex items-center justify-center shrink-0 border border-[#D9C3C3]">
                      <Bed className="size-6 text-[#900546]" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-sm font-bold text-[#130005] dark:text-white truncate">
                      {bookingInfo.room.roomNumber
                        ? `Room ${bookingInfo.room.roomNumber} · `
                        : ""}
                      {bookingInfo.room.category}
                    </p>
                    <p className="text-xs font-semibold text-[#900546] dark:text-[#F968AC] mt-0.5">
                      ₱{bookingInfo.room.price.toLocaleString()}/night
                    </p>
                    <p className="text-[10px] text-[#5C454B] dark:text-gray-400 mt-1 flex items-center gap-1">
                      <Clock className="size-3 text-[#618685]" />
                      Arrival:{" "}
                      {bookingInfo.arrivalDate
                        ? new Date(bookingInfo.arrivalDate).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" },
                          )
                        : "Flexible"}
                    </p>
                  </div>
                </div>
              )}

              {/* Flexible Check-in Note */}
              <div className="p-3.5 rounded-2xl bg-[#618685]/10 border border-[#618685]/30 text-left text-xs space-y-1">
                <p className="font-bold text-[#618685] flex items-center gap-1.5">
                  <Sparkles className="size-3.5" />
                  Flexible 24/7 Anytime Check-in
                </p>
                <p className="text-[11px] text-[#5C454B] dark:text-gray-300 leading-relaxed">
                  Our front desk reception is staffed 24 hours daily. Please
                  show this voucher or state your reservation name upon arrival.
                </p>
              </div>

              {/* Navigation Link */}
              <a
                href="https://maps.app.goo.gl/37dEzqkG98UiqkbM9"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border border-[#D9C3C3] bg-white dark:bg-[#1A0E13] text-xs font-bold text-[#900546] hover:bg-[#FAF5F5] transition-colors"
              >
                <MapPin className="size-3.5 text-[#900546]" />
                <span>Open GPS Directions in Google Maps</span>
                <ExternalLink className="size-3 opacity-60" />
              </a>
            </div>
          </div>

          {/* Right Column: High-Res Official Booking Voucher (7 cols) */}
          <div className="lg:col-span-7 print:col-span-12">
            <div
              id="printable-voucher"
              className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 sm:p-8 shadow-md space-y-6 relative overflow-hidden print:border-none print:shadow-none print:p-0"
            >
              {/* Watermark Logo in Voucher background */}
              <div className="pointer-events-none absolute right-4 bottom-4 size-48 opacity-[0.03] select-none">
                <img
                  src={logoUrl}
                  alt=""
                  className="size-full object-contain"
                />
              </div>

              {/* Voucher Header */}
              <div className="flex items-start justify-between gap-4 pb-5 border-b border-[#D9C3C3] dark:border-white/10">
                <div className="flex items-center gap-3.5">
                  <div className="size-12 rounded-2xl overflow-hidden bg-white p-1 border border-[#D9C3C3] flex items-center justify-center shrink-0">
                    <img
                      src={logoUrl}
                      alt={hotelName}
                      className="size-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "/Florentina Inn Logo.png";
                      }}
                    />
                  </div>
                  <div>
                    <h2 className="font-serif text-lg font-bold text-[#130005] dark:text-white">
                      {hotelName}
                    </h2>
                    <p className="text-[10px] text-[#5C454B] dark:text-gray-400">
                      {hotelAddress}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[9px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full bg-[#900546]/10 text-[#900546] dark:text-[#F968AC] border border-[#900546]/20">
                    OFFICIAL VOUCHER
                  </span>
                  <p className="text-[11px] font-mono font-bold text-[#130005] dark:text-white mt-1.5">
                    REF:{" "}
                    {bookingId
                      ? `RSV-${bookingId.slice(-8).toUpperCase()}`
                      : "RSV-ONLINE"}
                  </p>
                </div>
              </div>

              {/* Guest & Reservation Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#5C454B] dark:text-gray-400 block mb-0.5">
                    Guest Name
                  </span>
                  <span className="font-bold text-[#130005] dark:text-white">
                    {bookingInfo?.clientName || "Online Guest"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#5C454B] dark:text-gray-400 block mb-0.5">
                    Arrival Date
                  </span>
                  <span className="font-bold text-[#130005] dark:text-white">
                    {bookingInfo?.arrivalDate
                      ? new Date(bookingInfo.arrivalDate).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )
                      : dateStr}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#5C454B] dark:text-gray-400 block mb-0.5">
                    Check-in Window
                  </span>
                  <span className="font-bold text-[#618685]">
                    Flexible 24/7 Anytime
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#5C454B] dark:text-gray-400 block mb-0.5">
                    Reserved Room
                  </span>
                  <span className="font-bold text-[#130005] dark:text-white">
                    {bookingInfo?.room?.category || "Standard Suite"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#5C454B] dark:text-gray-400 block mb-0.5">
                    Payment Channel
                  </span>
                  <span className="font-bold text-[#130005] dark:text-white">
                    Online E-Wallet / Card
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#5C454B] dark:text-gray-400 block mb-0.5">
                    Issued On
                  </span>
                  <span className="font-bold text-[#130005] dark:text-white">
                    {dateStr}
                  </span>
                </div>
              </div>

              {/* Financial Breakdown Table */}
              <div className="rounded-2xl border border-[#D9C3C3] dark:border-white/10 bg-[#FAF5F5] dark:bg-[#130005] p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[#5C454B] dark:text-gray-400">
                  <span>Room Reservation Rate</span>
                  <span className="font-medium text-[#130005] dark:text-white">
                    ₱
                    {total.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="h-px bg-[#D9C3C3] dark:bg-white/10 my-1" />
                <div className="flex items-center justify-between text-sm font-bold text-[#130005] dark:text-white">
                  <span className="font-serif text-[#900546] dark:text-[#F968AC]">
                    Total Amount Paid
                  </span>
                  <span className="text-[#900546] dark:text-[#F968AC]">
                    ₱
                    {total.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-[#900546]/30 bg-[#900546]/5 p-3.5 text-[11px] leading-relaxed text-[#5C454B] dark:text-gray-300">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#900546] dark:text-[#F968AC] mb-0.5">
                  Non-Refundable Reservation
                </span>
                This online reservation is non-refundable. The amount paid is
                not returned for cancellations, date changes, early departures
                or no-shows.
              </div>

              {/* Complimentary Amenities Included */}
              <div className="space-y-1.5 text-[11px] text-[#5C454B] dark:text-gray-400">
                <span className="font-bold text-[#130005] dark:text-white block uppercase tracking-wider text-[10px]">
                  Included Amenities & Services
                </span>
                <p>
                  • Airconditioned rooms • Hot & cold shower • Cable TV / DVD •
                  Free WiFi internet • We serve Breakfast • Private Parking •
                  Backup generator
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={null}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
