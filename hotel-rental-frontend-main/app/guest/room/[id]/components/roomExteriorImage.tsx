"use client";

import { useState } from "react";
import { Building2, ZoomIn, Sparkles } from "lucide-react";

interface RoomExteriorImageProps {
  image: string;
  category: string;
  status: string;
  discount: number;
}

export function RoomExteriorImage({
  image,
  category,
  status,
  discount,
}: RoomExteriorImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const statusVariant = (s: string) => {
    switch (s) {
      case "available":
        return "bg-emerald-600/90 text-white border-emerald-400";
      case "occupied":
        return "bg-amber-600/90 text-white border-amber-400";
      case "reserved":
        return "bg-violet-600/90 text-white border-violet-400";
      case "maintenance":
        return "bg-rose-600/90 text-white border-rose-400";
      default:
        return "bg-[#1A1A1A]/80 text-white border-white/20";
    }
  };

  return (
    <>
      <div className="relative rounded-3xl overflow-hidden border border-[#D9C3C3] dark:border-white/10 bg-[#FAF5F5] dark:bg-[#1E0E14] shadow-sm group">
        {/* Aspect ratio container */}
        <div className="aspect-[21/9] sm:aspect-[21/8] relative overflow-hidden">
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#FAF5F5] dark:bg-[#1A0E13]">
              <Building2 className="size-10 text-[#900546]/30 animate-pulse" />
            </div>
          )}
          <img
            src={image}
            alt={`${category} - Exterior`}
            className={`size-full object-cover transition-all duration-700 ${
              loaded ? "opacity-100 scale-100" : "opacity-0 scale-105"
            } group-hover:scale-105`}
            onLoad={() => setLoaded(true)}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

          {/* Status badge */}
          <div className="absolute top-5 left-5 flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-3.5 py-1 text-xs font-bold shadow-lg backdrop-blur-md ${statusVariant(
                status
              )}`}
            >
              <span
                className={`size-1.5 rounded-full mr-1.5 ${
                  status === "available"
                    ? "bg-white animate-pulse"
                    : "bg-white/60"
                }`}
              />
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
            {discount > 0 && (
              <span className="inline-flex items-center rounded-full bg-[#900546] text-white border border-[#F968AC]/40 px-3 py-1 text-xs font-bold shadow-lg backdrop-blur-md">
                -{discount}% Special Offer
              </span>
            )}
          </div>

          {/* Labels & Action */}
          <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between pointer-events-auto">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#130005]/80 backdrop-blur-md px-3.5 py-1.5 text-xs font-medium text-white border border-white/10 shadow-sm">
              <Sparkles className="size-3.5 text-[#F968AC]" />
              Master Suite View
            </div>
            <button
              onClick={() => setExpanded(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/90 dark:bg-[#1A0E13]/90 hover:bg-[#900546] hover:text-white backdrop-blur-md px-4 py-1.5 text-xs font-semibold text-[#130005] dark:text-white border border-[#D9C3C3] dark:border-white/20 shadow-md transition-all cursor-pointer"
            >
              <ZoomIn className="size-3.5" />
              Full Screen
            </button>
          </div>
        </div>
      </div>

      {/* Expanded overlay */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          onClick={() => setExpanded(false)}
          onKeyDown={(e) => e.key === "Escape" && setExpanded(false)}
        >
          <button
            onClick={() => setExpanded(false)}
            className="absolute top-5 right-5 size-11 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-[#D16806] transition-colors cursor-pointer"
          >
            <span className="text-lg font-bold">✕</span>
          </button>
          <img
            src={image}
            alt={`${category} - Exterior`}
            className="max-w-[92vw] max-h-[88vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 border border-white/10"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
