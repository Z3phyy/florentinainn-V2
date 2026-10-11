"use client";

import { useState, useEffect, useCallback } from "react";
import { Image, ChevronLeft, ChevronRight, X, Sparkles } from "lucide-react";

interface RoomInteriorGalleryProps {
  images: string[];
  category: string;
}

export function RoomInteriorGallery({
  images,
  category,
}: RoomInteriorGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const goPrev = useCallback(() => {
    if (lightboxIndex === null) return;
    setLightboxIndex(
      lightboxIndex === 0 ? images.length - 1 : lightboxIndex - 1,
    );
  }, [lightboxIndex, images.length]);

  const goNext = useCallback(() => {
    if (lightboxIndex === null) return;
    setLightboxIndex(
      lightboxIndex === images.length - 1 ? 0 : lightboxIndex + 1,
    );
  }, [lightboxIndex, images.length]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;

    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          closeLightbox();
          break;
        case "ArrowLeft":
          goPrev();
          break;
        case "ArrowRight":
          goNext();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIndex, closeLightbox, goPrev, goNext]);

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#D9C3C3] dark:border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl border border-[#900546]/30 bg-[#900546]/10 flex items-center justify-center">
            <Sparkles className="size-4 text-[#900546] dark:text-[#F968AC]" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-bold text-[#130005] dark:text-white">
              Interior & Space Gallery
            </h2>
            <p className="text-xs text-[#5C454B] dark:text-gray-400">
              {images.length} high-resolution photographs of this suite
            </p>
          </div>
        </div>
      </div>

      {/* Gallery grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {images.map((img, index) => (
          <button
            key={index}
            onClick={() => openLightbox(index)}
            aria-label={`View ${category} interior photo ${index + 1}`}
            className="group relative aspect-[4/3] rounded-2xl overflow-hidden bg-[#FAF5F5] dark:bg-[#1E0E14] border border-[#D9C3C3] dark:border-white/10 hover:border-[#900546]/50 hover:shadow-lg transition-all duration-500 cursor-pointer"
          >
            <img
              src={img}
              alt={`${category} - Interior ${index + 1}`}
              className="size-full object-cover group-hover:scale-108 transition-transform duration-700"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
              <span className="text-white text-xs font-semibold opacity-0 group-hover:opacity-100 transition-all duration-300 bg-[#900546] px-3.5 py-1 rounded-full shadow-md transform translate-y-2 group-hover:translate-y-0">
                View Full
              </span>
            </div>
            {/* Corner index badge */}
            <div className="absolute top-2.5 right-2.5 size-6 rounded-full bg-[#130005]/80 backdrop-blur-sm flex items-center justify-center text-[10px] font-bold text-white border border-white/20 shadow-sm">
              {index + 1}
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          onClick={closeLightbox}
        >
          {/* Close */}
          <button
            onClick={closeLightbox}
            className="absolute top-5 right-5 z-10 size-11 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-[#D16806] transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>

          {/* Prev */}
          {images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 z-10 size-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-[#D16806] transition-colors cursor-pointer"
            >
              <ChevronLeft className="size-6" />
            </button>
          )}

          {/* Next */}
          {images.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 z-10 size-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-[#D16806] transition-colors cursor-pointer"
            >
              <ChevronRight className="size-6" />
            </button>
          )}

          {/* Image */}
          <img
            src={images[lightboxIndex]}
            alt={`${category} - Interior ${lightboxIndex + 1}`}
            className="max-w-[92vw] max-h-[86vh] object-contain rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 border border-white/10"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Counter */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/10 backdrop-blur-md px-5 py-1.5 text-xs font-semibold text-white border border-white/10">
            {lightboxIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </div>
  );
}
