"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";

export default function UnauthorizedPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary flex-col">
        {/* Grain Overlay */}
        <div
          className="pointer-events-none fixed inset-0 z-50 opacity-[0.035]"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }}
        />
        {/* Ambient Gold Glow */}
        <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[360px] rounded-full opacity-[0.07] blur-[120px] bg-gold" />

        <Loader2 className="w-10 h-10 text-gold animate-spin mb-5" />
        <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Loading</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary text-text flex items-center justify-center flex-col transition-all duration-500">
      {/* Grain Overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.035]"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }}
      />
      {/* Ambient Gold Glow */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[360px] rounded-full opacity-[0.07] blur-[120px] bg-gold" />

      {/* Content */}
      <div className="relative flex flex-col items-center px-8 py-16 border border-border bg-surface">
        {/* Gold corner brackets */}
        <div className="absolute top-0 left-0 w-16 h-16 border-t border-l border-gold opacity-40" />
        <div className="absolute top-0 right-0 w-16 h-16 border-t border-r border-gold opacity-40" />
        <div className="absolute bottom-0 left-0 w-16 h-16 border-b border-l border-gold opacity-40" />
        <div className="absolute bottom-0 right-0 w-16 h-16 border-b border-r border-gold opacity-40" />

        {/* Eyebrow */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-px w-8 bg-gold opacity-60" />
          <span className="text-[10px] uppercase tracking-[0.28em] text-gold">Access Denied</span>
          <div className="h-px w-8 bg-gold opacity-60" />
        </div>

        <h1
          className="text-5xl font-light tracking-[-0.02em] text-text mb-4"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          401
        </h1>

        <p className="text-text-muted text-sm leading-relaxed mb-8 text-center">
          You don't have access to this page.
        </p>

        <Link
          href="/"
          className="px-6 py-2.5 border border-gold-dim text-gold text-[11px] uppercase tracking-[0.2em] hover:border-gold hover:text-gold-light transition-all duration-300"
        >
          Go Back
        </Link>
      </div>
    </div>
  );
}