"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import axiosInstance from "@/app/utils/axios";
import { roomInterface } from "@/app/types/room.type";
import { systemInterface } from "@/app/types/system.type";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Building2,
  Check,
  Bed,
  Users,
  Wifi,
  Coffee,
  Star,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Clock,
  MapPin,
  Calendar,
  Wind,
  Droplets,
  Tv,
  Car,
  Zap,
  Utensils,
} from "lucide-react";
import { RoomExteriorImage } from "./components/roomExteriorImage";
import { RoomInteriorGallery } from "./components/roomInteriorGallery";
import { CheckinModal } from "./components/checkinModal";
import { GuestChatWidget } from "@/components/ui/guestChatWidget";
import { FacebookIcon } from "@/components/ui/facebookIcon";

// ── Amenity icon mapping ──
const amenityIcon = (amenity: string) => {
  const lower = amenity.toLowerCase();
  if (lower.includes("air") || lower.includes("ac") || lower.includes("cool")) return <Wind className="size-4 text-[#618685]" />;
  if (lower.includes("shower") || lower.includes("hot") || lower.includes("cold") || lower.includes("bath") || lower.includes("water")) return <Droplets className="size-4 text-[#618685]" />;
  if (lower.includes("tv") || lower.includes("dvd") || lower.includes("cable") || lower.includes("television") || lower.includes("entertainment")) return <Tv className="size-4 text-[#900546]" />;
  if (lower.includes("wifi") || lower.includes("internet") || lower.includes("net")) return <Wifi className="size-4 text-[#618685]" />;
  if (lower.includes("breakfast") || lower.includes("food") || lower.includes("dine") || lower.includes("coffee") || lower.includes("tea")) return <Utensils className="size-4 text-[#900546]" />;
  if (lower.includes("park") || lower.includes("car") || lower.includes("vehicle")) return <Car className="size-4 text-[#618685]" />;
  if (lower.includes("generator") || lower.includes("power") || lower.includes("backup") || lower.includes("electric")) return <Zap className="size-4 text-[#900546]" />;
  if (lower.includes("bed") || lower.includes("sleep")) return <Bed className="size-4 text-[#900546]" />;
  return <Check className="size-4 text-[#618685]" />;
};

export default function RoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: systemInfo } = useQuery<systemInterface>({
    queryKey: ["systeminfo"],
    queryFn: async (): Promise<systemInterface> => {
      const response = await axiosInstance.get("/system");
      return response.data;
    },
  });

  const { data: room, isLoading, isError } = useQuery({
    queryKey: ["room", id],
    queryFn: async (): Promise<roomInterface> => {
      const response = await axiosInstance.get(`/room/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  const hotelName = systemInfo?.systemName || "Florentina Inn";
  const logoUrl = systemInfo?.logo || "/Florentina Inn Logo.png";

  const statusVariant = (status: string) => {
    switch (status) {
      case "available":
        return "bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:border-emerald-700";
      case "occupied":
        return "bg-amber-500/10 text-amber-700 border-amber-300 dark:border-amber-700";
      case "reserved":
        return "bg-violet-500/10 text-violet-700 border-violet-300 dark:border-violet-700";
      case "maintenance":
        return "bg-rose-500/10 text-rose-700 border-rose-300 dark:border-rose-700";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-[#FAF5F5] dark:bg-[#130005]">
        <header className="px-6 py-4 border-b border-[#D9C3C3] dark:border-white/10 bg-white/90 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Skeleton className="h-10 w-40 rounded-xl" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
        </header>
        <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10 space-y-8">
          <Skeleton className="h-8 w-44 rounded-full" />
          <Skeleton className="aspect-[21/9] w-full rounded-3xl" />
          <div className="grid lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
              <Skeleton className="h-40 w-full rounded-3xl" />
              <Skeleton className="h-48 w-full rounded-3xl" />
            </div>
            <div className="lg:col-span-4">
              <Skeleton className="h-72 w-full rounded-3xl" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (isError || !room) {
    return (
      <div className="flex min-h-screen flex-col bg-[#FAF5F5] dark:bg-[#130005]">
        <header className="px-6 py-4 border-b border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#130005]">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-serif text-2xl font-bold tracking-tight text-[#130005] dark:text-white">
                {hotelName}
              </span>
            </Link>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center px-6 py-20">
          <div className="text-center space-y-5 max-w-md bg-white dark:bg-[#1A0E13] p-8 rounded-3xl border border-[#D9C3C3] dark:border-white/10 shadow-lg">
            <div className="size-20 rounded-2xl bg-[#900546]/10 flex items-center justify-center mx-auto text-[#900546]">
              <Bed className="size-10" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-[#130005] dark:text-white">Room Not Found</h2>
            <p className="text-sm text-[#5C454B] dark:text-gray-300">
              The suite you are looking for is currently unavailable or has been relocated.
            </p>
            <Button
              onClick={() => router.push("/")}
              className="bg-[#900546] hover:bg-[#720336] text-white rounded-full px-6 h-11 text-xs font-semibold shadow-md cursor-pointer"
            >
              <ArrowLeft className="size-4 mr-2" />
              Return to Suites Catalog
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const finalPrice = Math.round(room.price * (1 - (room.discount || 0) / 100));

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF5F5] dark:bg-[#130005] text-[#130005] dark:text-gray-100 font-sans antialiased selection:bg-[#900546]/20 selection:text-[#900546]">
      {/* Unified Luxury Floating Concierge Widget */}
      <GuestChatWidget />

      {/* ── Top Navigation Header ── */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#130005]/95 backdrop-blur-md border-b border-[#D9C3C3] dark:border-white/10 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="size-11 rounded-xl overflow-hidden bg-white p-1 border border-[#D9C3C3] group-hover:border-[#900546]/50 transition-all flex items-center justify-center shadow-xs">
              <img
                src={logoUrl}
                alt={hotelName}
                className="size-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/Florentina Inn Logo.png";
                }}
              />
            </div>
            <div>
              <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-[#130005] dark:text-white leading-none block">
                {hotelName}
              </span>
              <span className="text-[9px] uppercase tracking-[0.2em] text-[#900546] dark:text-[#F968AC] font-semibold block mt-0.5">
                Luxury Accommodations
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/")}
              className="border-[#D9C3C3] dark:border-white/10 hover:border-[#900546] hover:bg-[#FAF5F5] rounded-full px-4 h-9 text-xs font-semibold text-[#130005] dark:text-white cursor-pointer"
            >
              <ArrowLeft className="size-3.5 mr-1.5" />
              All Rooms
            </Button>
            <span
              className={`hidden sm:inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${statusVariant(
                room.status
              )}`}
            >
              {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
            </span>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 bg-[#E4D1D1]/20 dark:bg-[#130005] py-8 sm:py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 space-y-8">
          
          {/* Breadcrumb & Navigation */}
          <div className="flex items-center gap-2 text-xs text-[#5C454B] dark:text-gray-400">
            <Link href="/" className="hover:text-[#900546] transition-colors font-medium">
              Home
            </Link>
            <span>/</span>
            <Link href="/#rooms-section" className="hover:text-[#900546] transition-colors font-medium">
              Rooms & Suites
            </Link>
            <span>/</span>
            <span className="text-[#130005] dark:text-white font-semibold">
              {room.roomNumber ? `Unit ${room.roomNumber} · ` : ""}{room.category}
            </span>
          </div>

          {/* ── Room Exterior Showcase ── */}
          {room.image && (
            <div>
              <RoomExteriorImage
                image={room.image}
                category={room.category}
                status={room.status}
                discount={room.discount}
              />
            </div>
          )}

          <div className="grid lg:grid-cols-12 gap-10 items-start">
            
            {/* ── LEFT COLUMN: Suite Narrative & Amenities ── */}
            <div className="lg:col-span-8 space-y-8">
              
              {/* Header Box */}
              <div className="bg-white dark:bg-[#1A0E13] rounded-3xl p-6 sm:p-8 border border-[#D9C3C3] dark:border-white/10 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {room.roomNumber && (
                      <span className="bg-[#130005] text-white text-xs font-bold px-3.5 py-1 rounded-full border border-white/10 shadow-xs">
                        Unit {room.roomNumber}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3 py-1 text-xs font-semibold text-[#900546] dark:text-[#F968AC]">
                      <Sparkles className="size-3 text-[#F968AC]" />
                      Luxury Collection
                    </span>
                  </div>
                  
                  {room.discount > 0 && (
                    <span className="bg-[#900546] text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm border border-[#F968AC]/40">
                      Special Rate -{room.discount}%
                    </span>
                  )}
                </div>

                <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight text-[#130005] dark:text-white leading-tight">
                  {room.category}
                </h1>

                {/* Key feature pills */}
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-[#5C454B] dark:text-gray-300">
                  <span className="inline-flex items-center gap-1.5 bg-[#FAF5F5] dark:bg-[#28161D] px-3 py-1.5 rounded-xl border border-[#D9C3C3] dark:border-white/10 font-medium">
                    <Bed className="size-3.5 text-[#900546]" />
                    {(room.bedding && room.bedding.length > 0 ? room.bedding.join(" / ") : "King / Queen Bedding")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-[#FAF5F5] dark:bg-[#28161D] px-3 py-1.5 rounded-xl border border-[#D9C3C3] dark:border-white/10 font-medium">
                    <Users className="size-3.5 text-[#618685]" />
                    Up to {room.maxHead || 2} Guests
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-[#FAF5F5] dark:bg-[#28161D] px-3 py-1.5 rounded-xl border border-[#D9C3C3] dark:border-white/10 font-medium">
                    <Clock className="size-3.5 text-[#618685]" />
                    Flexible Check-In
                  </span>
                </div>
              </div>

              {/* Description Section */}
              {room.description && (
                <div className="bg-white dark:bg-[#1A0E13] rounded-3xl p-6 sm:p-8 border border-[#D9C3C3] dark:border-white/10 shadow-xs space-y-3">
                  <h2 className="font-serif text-2xl font-bold text-[#130005] dark:text-white flex items-center gap-2">
                    <span className="size-7 rounded-lg bg-[#900546]/10 flex items-center justify-center text-[#900546] dark:text-[#F968AC]">
                      <Star className="size-4" />
                    </span>
                    About This Suite
                  </h2>
                  <p className="text-sm sm:text-base text-[#5C454B] dark:text-gray-300 leading-relaxed">
                    {room.description}
                  </p>
                </div>
              )}

              {/* Curated Amenities */}
              {room.amenities && room.amenities.length > 0 && (
                <div className="bg-white dark:bg-[#1A0E13] rounded-3xl p-6 sm:p-8 border border-[#D9C3C3] dark:border-white/10 shadow-xs space-y-4">
                  <h2 className="font-serif text-2xl font-bold text-[#130005] dark:text-white flex items-center gap-2">
                    <span className="size-7 rounded-lg bg-[#900546]/10 flex items-center justify-center text-[#900546] dark:text-[#F968AC]">
                      <Check className="size-4" />
                    </span>
                    Curated Amenities
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {room.amenities.map((amenity) => (
                      <div
                        key={amenity}
                        className="flex items-center gap-3 text-xs sm:text-sm font-medium text-[#130005] dark:text-gray-200 bg-[#FAF5F5] dark:bg-[#28161D] rounded-2xl p-3 border border-[#D9C3C3] dark:border-white/10 hover:border-[#900546]/40 transition-colors"
                      >
                        <span className="size-8 rounded-xl bg-white dark:bg-[#1A0E13] flex items-center justify-center shrink-0 shadow-xs border border-[#D9C3C3] dark:border-white/10">
                          {amenityIcon(amenity)}
                        </span>
                        <span className="truncate">{amenity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Room Interior Gallery ── */}
              {room.images && room.images.length > 0 && (
                <div className="bg-white dark:bg-[#1A0E13] rounded-3xl p-6 sm:p-8 border border-[#D9C3C3] dark:border-white/10 shadow-xs">
                  <RoomInteriorGallery
                    images={room.images}
                    category={room.category}
                  />
                </div>
              )}

            </div>

            {/* ── RIGHT COLUMN: Sticky Reservation & Price Folio ── */}
            <div className="lg:col-span-4">
              <div className="sticky top-24 space-y-5">
                
                {/* Price & Booking Card */}
                <div className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-7 shadow-xl space-y-6">
                  
                  {/* Price Banner */}
                  <div>
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-[#5C454B] dark:text-gray-400 block mb-1">
                      Nightly Rate
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="font-serif text-4xl font-bold text-[#900546]">
                        ₱{finalPrice.toLocaleString()}
                      </span>
                      <span className="text-xs text-[#5C454B] dark:text-gray-400 font-medium">/ night</span>
                    </div>

                    {room.discount > 0 && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-[#5C454B] dark:text-gray-400 line-through">
                          ₱{room.price.toLocaleString()}
                        </span>
                        <span className="text-[11px] font-bold text-[#900546] bg-[#900546]/10 px-2 py-0.5 rounded-full">
                          Save {room.discount}% Today
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-[#D9C3C3] dark:border-white/10" />

                  {/* Suite Summary Specs */}
                  <div className="space-y-3.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#5C454B] dark:text-gray-400 flex items-center gap-2">
                        <Bed className="size-3.5 text-[#900546]" />
                        Category
                      </span>
                      <span className="font-semibold text-[#130005] dark:text-white capitalize">
                        {room.category}
                      </span>
                    </div>

                    {room.roomNumber && (
                      <div className="flex items-center justify-between">
                        <span className="text-[#5C454B] dark:text-gray-400 flex items-center gap-2">
                          <Building2 className="size-3.5 text-[#900546]" />
                          Assigned Unit
                        </span>
                        <span className="font-semibold text-[#130005] dark:text-white">
                          Unit #{room.roomNumber}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-[#5C454B] dark:text-gray-400 flex items-center gap-2">
                        <Check className="size-3.5 text-[#618685]" />
                        Room Status
                      </span>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusVariant(room.status)}`}>
                        {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[#5C454B] dark:text-gray-400 flex items-center gap-2">
                        <Users className="size-3.5 text-[#618685]" />
                        Max Capacity
                      </span>
                      <span className="font-semibold text-[#130005] dark:text-white">
                        {room.maxHead || 2} Persons
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-[#D9C3C3] dark:border-white/10" />

                  {/* Non-refundable policy — shown before the guest opens the
                      reservation form, and acknowledged inside it. */}
                  <div className="rounded-2xl border border-[#900546]/30 bg-[#900546]/5 p-3.5 space-y-1">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-[#900546] dark:text-[#F968AC]">
                      <ShieldAlert className="size-3.5 shrink-0" />
                      Non-Refundable Online Reservation
                    </p>
                    <p className="text-[11px] leading-relaxed text-[#5C454B] dark:text-gray-300">
                      Payments for online reservations are not refundable — cancellations, date
                      changes and no-shows are not eligible for a refund.
                    </p>
                  </div>

                  {/* Interactive Booking Trigger */}
                  <div className="space-y-3">
                    <CheckinModal selectedRoom={room} />

                    <p className="text-[11px] text-center text-[#5C454B] dark:text-gray-400 flex items-center justify-center gap-1.5">
                      <ShieldCheck className="size-3.5 text-emerald-600" />
                      Instant confirmation & 24/7 key handover
                    </p>
                  </div>
                </div>

                {/* Direct Front Desk Assistance Card */}
                <div className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white/80 dark:bg-[#1A0E13]/80 backdrop-blur-md p-5 space-y-2.5 text-xs text-[#5C454B] dark:text-gray-300">
                  <div className="flex items-center gap-2 font-bold text-[#130005] dark:text-white text-sm">
                    <Clock className="size-4 text-[#618685]" />
                    Need Special Inquiries?
                  </div>
                  <p className="leading-relaxed">
                    Our 24/7 reception and AI concierge are active to answer inquiries regarding late check-in or additional amenities.
                  </p>
                </div>

              </div>
            </div>

          </div>
        </div>
      </main>

      {/* ── Luxury Footer ── */}
      <footer className="bg-[#130005] text-white py-12 px-4 sm:px-8 border-t border-[#900546]/30">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-8 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl overflow-hidden bg-white p-1 flex items-center justify-center shadow-xs">
                <img
                  src={logoUrl}
                  alt={hotelName}
                  className="size-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/Florentina Inn Logo.png";
                  }}
                />
              </div>
              <div>
                <span className="font-serif text-xl font-bold tracking-tight text-white block">
                  {hotelName}
                </span>
                <span className="text-[9px] uppercase tracking-[0.2em] text-[#F968AC] font-semibold block">
                  Comfort & Affordable Accommodations
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/")}
              className="border-[#900546]/40 bg-[#900546]/20 hover:bg-[#900546] text-white rounded-full px-5 h-9 text-xs cursor-pointer"
            >
              <ArrowLeft className="size-3.5 mr-1.5" />
              Return to Home
            </Button>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#E4D1D1]/50">
            <p>&copy; {new Date().getFullYear()} {hotelName}. All rights reserved.</p>
            <p className="text-[#F968AC]">Crafted for Serenity & Luxury Hospitality</p>
          </div>

          {systemInfo?.facebook && (
            <div className="pt-6 flex justify-center">
              <a
                href={systemInfo.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-[#900546] hover:border-[#900546] transition-colors cursor-pointer"
                title="Follow us on Facebook"
              >
                <FacebookIcon size={14} />
                Follow us on Facebook
              </a>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
