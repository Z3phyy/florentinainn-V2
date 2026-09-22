"use client";

import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { bookingInterface } from "@/app/types/bookings.type";
import { getDaysFromDate, formatTime12hr } from "@/app/utils/customFunction";
import { CheckinModal } from "./components/checkinModal";
import { Loader2, Bed, CalendarDays, User, Hash, Sparkles, Mail, Phone, Coins } from "lucide-react";
import { CheckoutModal } from "./components/checkoutmodal";
import { PartialPaymentModal } from "./components/partialPaymentModal";

export default function Page() {
  const { data: bookings, isLoading } = useQuery<bookingInterface[]>({
    queryKey: ["active-bookings"],
    queryFn: async () => {
      const res = await axiosInstance.get("/booking");
      const all: bookingInterface[] = res.data;
      // Filter only active bookings
      return all.filter((b) => b.status === "active");
    },
  });

  return (
    <div className="w-full min-h-screen p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D9C3C3] dark:border-white/10">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3 py-0.5 text-[11px] font-bold text-[#900546] dark:text-[#F968AC] mb-1.5">
            <Sparkles className="size-3.5" />
            Active In-House Guests
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#130005] dark:text-white">
            Guest Management & Folios
          </h1>
          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5">
            {isLoading
              ? "Loading active folios..."
              : `${bookings?.length ?? 0} active guest${(bookings?.length ?? 0) !== 1 ? "s" : ""} currently checked in`}
          </p>
        </div>
        <CheckinModal />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <div className="flex items-center gap-3 text-[#5C454B] dark:text-gray-400 text-sm">
            <Loader2 className="size-6 animate-spin text-[#900546]" />
            <span>Loading active guest bookings...</span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && bookings && bookings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-[#5C454B] dark:text-gray-400 bg-white dark:bg-[#1A0E13] rounded-3xl border border-[#D9C3C3] dark:border-white/10 p-8 shadow-xs">
          <div className="size-16 rounded-full bg-[#900546]/10 text-[#900546] flex items-center justify-center mb-4">
            <Bed className="size-8" />
          </div>
          <h3 className="font-serif text-lg font-bold text-[#130005] dark:text-white">
            No Active In-House Guests
          </h3>
          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-1 max-w-sm text-center">
            All suites are currently vacant and ready. Use the Walk-In Check-In button above to register arriving guests.
          </p>
        </div>
      )}

      {/* Bookings Grid */}
      {!isLoading && bookings && bookings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {bookings.map((booking) => {
            const daysStayed = getDaysFromDate(booking.arrivalDate);
            const room = booking.room;

            const discountedPrice = room.price * (1 - (room.discount || 0) / 100);
            const stayTotal = Math.max(0, discountedPrice * Math.max(1, daysStayed));
            const amountPaid = booking.paymentAmount || 0;
            const balanceDue = Math.max(0, stayTotal - amountPaid);

            return (
              <div
                key={booking._id}
                className="group rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-[#900546]/40 flex flex-col justify-between"
              >
                <div>
                  {/* Room Image */}
                  <div className="relative h-48 w-full bg-[#FAF5F5] dark:bg-[#25121B] overflow-hidden">
                    {room.image ? (
                      <img
                        src={room.image}
                        alt={room.category}
                        className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center">
                        <Bed className="size-10 text-[#5C454B]/30" />
                      </div>
                    )}
                    {/* Days stayed badge */}
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-white/95 dark:bg-[#130005]/95 backdrop-blur-sm border border-[#D9C3C3] dark:border-white/10 px-3 py-1 text-xs font-bold text-[#130005] dark:text-white shadow-sm">
                      <CalendarDays className="size-3.5 text-[#900546]" />
                      <span>
                        {daysStayed === 0
                          ? "Arrived Today"
                          : `${daysStayed} day${daysStayed !== 1 ? "s" : ""}`}
                      </span>
                    </div>
                    {/* Status indicator */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-emerald-500/95 backdrop-blur-sm px-3 py-1 text-xs font-bold text-white shadow-sm">
                      <span className="size-1.5 rounded-full bg-white animate-pulse" />
                      Checked-In
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 space-y-3.5">
                    {/* Room info */}
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-serif text-base font-bold text-[#130005] dark:text-white">
                          {room.roomNumber ? `Room ${room.roomNumber} · ` : ""}{room.category}
                        </p>
                        <p className="text-xs font-semibold text-[#900546] dark:text-[#F968AC] mt-0.5">
                          ₱{room.price.toLocaleString()}/day
                        </p>
                      </div>
                    </div>

                    <div className="h-px bg-[#D9C3C3]/40 dark:bg-white/10" />

                    {/* Guest details */}
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-[#130005] dark:text-white font-semibold">
                        <User className="size-3.5 text-[#618685] shrink-0" />
                        <span className="truncate">{booking.clientName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[#5C454B] dark:text-gray-400">
                        <CalendarDays className="size-3.5 text-[#618685] shrink-0" />
                        <span>
                          Check-In: {new Date(booking.arrivalDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[#5C454B] dark:text-gray-400">
                        <Hash className="size-3.5 text-[#618685] shrink-0" />
                        <span className="capitalize">
                          {formatTime12hr(booking.arrivalTime)} · {booking.type}
                        </span>
                      </div>
                      {booking.clientEmail && (
                        <div className="flex items-center gap-2 text-[#5C454B] dark:text-gray-400">
                          <Mail className="size-3.5 text-[#618685] shrink-0" />
                          <span className="truncate">{booking.clientEmail}</span>
                        </div>
                      )}
                      {booking.clientPhone && (
                        <div className="flex items-center gap-2 text-[#5C454B] dark:text-gray-400">
                          <Phone className="size-3.5 text-[#618685] shrink-0" />
                          <span className="truncate">{booking.clientPhone}</span>
                        </div>
                      )}
                      </div>

                      {balanceDue > 0 && (
                        <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                          <span className="inline-flex items-center gap-1.5">
                            <Coins className="size-3.5 shrink-0" />
                            Balance Due
                          </span>
                          <span className="font-mono">
                            ₱{balanceDue.toLocaleString("en-US")}
                          </span>
                        </div>
                      )}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-5 pt-0">
                  <PartialPaymentModal booking={booking} />
                  <CheckoutModal booking={booking} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
