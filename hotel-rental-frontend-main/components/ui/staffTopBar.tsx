"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ExternalLink } from "lucide-react";
import { StaffNotificationBell } from "@/components/ui/staffNotificationBell";

const PAGE_TITLES: Record<string, string> = {
  home: "Staff Dashboard",
  guest: "In-House Guests",
  reservation: "Reservations",
  rooms: "Rooms & Suites",
  chat: "Guest Messages",
  profile: "My Profile",
};

export function StaffTopBar() {
  const pathname = usePathname();

  const pathParts = pathname.split("/").filter(Boolean);
  const currentSegment = pathParts[pathParts.length - 1] || "home";
  const formattedPageTitle =
    PAGE_TITLES[currentSegment] ||
    (currentSegment.charAt(0).toUpperCase() + currentSegment.slice(1));

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[#D9C3C3] dark:border-white/10 bg-white/95 dark:bg-[#130005]/95 backdrop-blur-md px-6 shadow-xs">
      {/* ── Left: Page Breadcrumb ── */}
      <div className="flex items-center gap-2 text-xs">
        <span className="font-semibold text-[#618685] dark:text-[#88afae]">
          Florentina Staff
        </span>
        <ChevronRight className="size-3.5 text-[#5C454B] dark:text-gray-400" />
        <span className="font-medium text-[#130005] dark:text-white capitalize">
          {formattedPageTitle}
        </span>
      </div>

      {/* ── Right: Staff Alerts & Public Portal Link ── */}
      <div className="flex items-center gap-3">
        <StaffNotificationBell />

        <Link
          href="/"
          target="_blank"
          className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#618685] bg-[#618685]/10 hover:bg-[#618685] hover:text-white transition-all shadow-xs cursor-pointer"
        >
          <span>Guest Site</span>
          <ExternalLink className="size-3.5" />
        </Link>
      </div>
    </header>
  );
}