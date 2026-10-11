"use client";

import { useEffect, useRef, useState } from "react";
import {
  MapPin,
  Navigation,
  Compass,
  ExternalLink,
  Copy,
  Check,
  Car,
  Clock,
  Shield,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface HotelLocationMapProps {
  hotelName?: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export function HotelLocationMap({
  hotelName = "Florentina Inn",
  address = "Jose D. Aspiras Hwy, Tubao, 2506 La Union, Philippines",
  lat = 16.3434641,
  lng = 120.4149687,
}: HotelLocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [copied, setCopied] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // ── Navigation URLs ──
  const googleMapsUrl = "https://maps.app.goo.gl/37dEzqkG98UiqkbM9";
  const wazeUrl = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  const appleMapsUrl = `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;

  // ── Copy address helper ──
  const handleCopyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Initialize Leaflet Map safely on client side ──
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (!mapContainerRef.current || mapInstanceRef.current) return;

      try {
        const L = (await import("leaflet")).default;

        if (!isMounted || !mapContainerRef.current) return;

        // Initialize Map
        const map = L.map(mapContainerRef.current, {
          center: [lat, lng],
          zoom: 15,
          scrollWheelZoom: false,
          attributionControl: false,
        });

        mapInstanceRef.current = map;

        // Clean OpenStreetMap Tile Layer
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        // Custom Florentina Burgundy Radar Pulsing Marker
        const customIcon = L.divIcon({
          className: "custom-florentina-marker",
          html: `
            <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
              <span class="animate-ping absolute inline-flex size-9 rounded-full bg-[#900546] opacity-40"></span>
              <div class="relative flex size-9 items-center justify-center rounded-full bg-[#900546] text-white shadow-xl ring-4 ring-white border-2 border-[#FAF5F5]">
                <svg xmlns="http://www.w3.org/2000/svg" class="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -20],
        });

        // Popup Content
        const popupContent = `
          <div style="font-family: inherit; padding: 4px; max-width: 230px;">
            <p style="font-size: 13px; font-weight: bold; color: #900546; margin: 0 0 4px 0;">${hotelName}</p>
            <p style="font-size: 11px; color: #5C454B; margin: 0 0 8px 0; line-height: 1.3;">${address}</p>
            <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #E4D1D1; padding-top: 6px;">
              <span style="font-size: 10px; font-weight: bold; color: #618685;">24/7 Front Desk</span>
              <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; font-weight: bold; color: #900546; text-decoration: underline;">Open Maps &rarr;</a>
            </div>
          </div>
        `;

        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
        marker.bindPopup(popupContent).openPopup();

        setMapLoaded(true);
      } catch (err) {
        console.error("Leaflet init error:", err);
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lng, hotelName, address, googleMapsUrl]);

  // Recenter helper
  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], 16, { duration: 1.2 });
    }
  };

  return (
    <div className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] overflow-hidden shadow-lg">
      {/* ── Top Bar: Location Title & 1-Click Launchers ── */}
      <div className="p-6 border-b border-[#D9C3C3] dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FAF5F5]/60 dark:bg-[#130005]/40">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3 py-0.5 text-[11px] font-bold text-[#900546] dark:text-[#F968AC] mb-1">
            <Compass className="size-3.5" />
            Interactive GPS & Live Directions
          </div>
          <h3 className="font-serif text-2xl font-bold text-[#130005] dark:text-white">
            How To Find Us
          </h3>
          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5 flex items-center gap-1">
            <MapPin className="size-3.5 text-[#618685] shrink-0" />
            <span>{address}</span>
          </p>
        </div>

        {/* 1-Click Navigation Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Official Google Maps Button */}
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#900546] hover:bg-[#720336] text-white text-xs font-bold shadow-md shadow-[#900546]/20 transition-all cursor-pointer"
          >
            <Navigation className="size-4" />
            <span>Google Maps</span>
            <ExternalLink className="size-3.5 opacity-80" />
          </a>

          {/* Waze Button */}
          <a
            href={wazeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#618685] hover:bg-[#4d6b6a] text-white text-xs font-bold shadow-md shadow-[#618685]/20 transition-all cursor-pointer"
          >
            <Car className="size-4" />
            <span>Open in Waze</span>
            <ExternalLink className="size-3.5 opacity-80" />
          </a>

          {/* Apple Maps */}
          <a
            href={appleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#FAF5F5] dark:bg-[#25121B] border border-[#D9C3C3] dark:border-white/10 text-[#130005] dark:text-white hover:bg-[#900546]/10 text-xs font-semibold transition-all cursor-pointer"
          >
            <span>Apple Maps</span>
          </a>

          {/* Copy Address */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyAddress}
            className="rounded-xl border-[#D9C3C3] dark:border-white/10 text-xs font-semibold h-10 px-3 cursor-pointer"
            title="Copy Full Address"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-600 mr-1" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5 mr-1" />
                <span>Copy</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── Interactive Leaflet Map View Container ── */}
      <div className="relative w-full h-[360px] sm:h-[420px] bg-[#FAF5F5] dark:bg-[#130005]">
        <div ref={mapContainerRef} className="size-full z-10" />

        {/* Map overlay controls */}
        <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-2">
          <button
            onClick={handleRecenter}
            className="p-2.5 rounded-xl bg-white/95 dark:bg-[#130005]/95 backdrop-blur-md border border-[#D9C3C3] dark:border-white/10 text-[#900546] dark:text-[#F968AC] shadow-lg hover:bg-[#900546] hover:text-white transition-all cursor-pointer"
            title="Recenter Hotel Pin"
          >
            <Compass className="size-5" />
          </button>
        </div>
      </div>

      {/* ── Highway Travel Times & Parking Highlights ── */}
      <div className="p-6 bg-[#FAF5F5] dark:bg-[#130005] border-t border-[#D9C3C3] dark:border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Highway Access */}
        <div className="flex items-start gap-3 p-3 rounded-2xl bg-white dark:bg-[#1A0E13] border border-[#D9C3C3] dark:border-white/10">
          <div className="size-9 rounded-xl bg-[#900546]/10 text-[#900546] flex items-center justify-center shrink-0">
            <Car className="size-4.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#130005] dark:text-white">Direct Highway Access</h4>
            <p className="text-[11px] text-[#5C454B] dark:text-gray-400 mt-0.5">
              Situated directly along Jose D. Aspiras Highway.
            </p>
          </div>
        </div>

        {/* 2. From Agoo Junction */}
        <div className="flex items-start gap-3 p-3 rounded-2xl bg-white dark:bg-[#1A0E13] border border-[#D9C3C3] dark:border-white/10">
          <div className="size-9 rounded-xl bg-[#618685]/15 text-[#618685] flex items-center justify-center shrink-0">
            <Clock className="size-4.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#130005] dark:text-white">~15 Mins from Agoo</h4>
            <p className="text-[11px] text-[#5C454B] dark:text-gray-400 mt-0.5">
              Quick scenic drive from MacArthur Highway junction.
            </p>
          </div>
        </div>

        {/* 3. From Baguio City */}
        <div className="flex items-start gap-3 p-3 rounded-2xl bg-white dark:bg-[#1A0E13] border border-[#D9C3C3] dark:border-white/10">
          <div className="size-9 rounded-xl bg-[#618685]/15 text-[#618685] flex items-center justify-center shrink-0">
            <Compass className="size-4.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#130005] dark:text-white">~45 Mins to Baguio</h4>
            <p className="text-[11px] text-[#5C454B] dark:text-gray-400 mt-0.5">
              Direct connection via Agoo-Baguio Road.
            </p>
          </div>
        </div>

        {/* 4. Private Parking */}
        <div className="flex items-start gap-3 p-3 rounded-2xl bg-white dark:bg-[#1A0E13] border border-[#D9C3C3] dark:border-white/10">
          <div className="size-9 rounded-xl bg-[#900546]/10 text-[#900546] flex items-center justify-center shrink-0">
            <Shield className="size-4.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#130005] dark:text-white">Free Secure Parking</h4>
            <p className="text-[11px] text-[#5C454B] dark:text-gray-400 mt-0.5">
              Dedicated private parking with 24/7 key concierge.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
