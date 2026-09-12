"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, ChevronRight } from "lucide-react";
import { AdminNotificationBell } from "@/components/ui/adminNotificationBell";

export function AdminTopBar() {
  const pathname = usePathname();

  // ── Format breadcrumb from pathname ──
  const pathParts = pathname.split("/").filter(Boolean);
  const currentPageTitle = pathParts[pathParts.length - 1] || "Dashboard";
  const formattedPageTitle =
    currentPageTitle.charAt(0).toUpperCase() + currentPageTitle.slice(1);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#D9C3C3] dark:border-white/10 bg-white/95 dark:bg-[#130005]/95 backdrop-blur-md px-6 shadow-xs">
      {/* ── Left: Page Breadcrumb ── */}
      <div className="flex items-center gap-2 text-xs">
        <span className="font-semibold text-[#900546] dark:text-[#F968AC]">
          Florentina Admin
        </span>
        <ChevronRight className="size-3.5 text-[#5C454B] dark:text-gray-400" />
        <span className="font-medium text-[#130005] dark:text-white capitalize">
          {formattedPageTitle}
        </span>
      </div>

      {/* ── Right: Live Alert Bell, Public Portal Link ── */}
      <div className="flex items-center gap-3">
        <AdminNotificationBell />

        {/* ── Public Site Link ── */}
        <Link
          href="/"
          target="_blank"
          className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#900546] bg-[#900546]/10 hover:bg-[#900546] hover:text-white transition-all shadow-xs cursor-pointer"
        >
          <span>Guest Site</span>
          <ExternalLink className="size-3.5" />
        </Link>
      </div>
    </header>
  );
}