"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BookUser, Filter, X, Search, ChevronDown } from "lucide-react";
import { EditGuestModal } from "./components/editGuestModal";

export interface GuestDirectoryEntry {
  key: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  totalStays: number;
  totalSpent: number;
  outstandingBalance: number;
  lastStayAt: string | null;
  stays: Array<{
    bookingId: string;
    roomId: string;
    roomNumber: string;
    category: string;
    type: string;
    status: string;
    arrivalDate: string;
    departureDate: string;
    nights: number;
    stayTotal: number;
    amountPaid: number;
    balance: number;
  }>;
}

const statusTone = (status: string) => {
  switch (status) {
    case "active":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800";
    case "reservation":
      return "bg-violet-500/10 text-violet-600 border-violet-200 dark:border-violet-800";
    case "completed":
      return "bg-sky-500/10 text-sky-600 border-sky-200 dark:border-sky-800";
    case "canceled":
      return "bg-red-500/10 text-red-600 border-red-200 dark:border-red-800";
    case "unpaid":
      return "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800";
    case "no-show":
      return "bg-gray-500/10 text-gray-600 border-gray-200 dark:border-gray-700";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

export default function Page() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "returning">("all");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["guest-directory"],
    queryFn: async (): Promise<GuestDirectoryEntry[]> => {
      const res = await axiosInstance.get("/booking/directory");
      return res.data;
    },
  });

  const filtered = useMemo(() => {
    const list = data || [];
    const q = searchQuery.trim().toLowerCase();
    const base = list.filter((guest) => {
      if (!q) return true;
      return (
        guest.name?.toLowerCase().includes(q) ||
        guest.email?.toLowerCase().includes(q) ||
        guest.phone?.toLowerCase().includes(q) ||
        guest.address?.toLowerCase().includes(q)
      );
    });

    switch (activeFilter) {
      case "active":
        return base.filter((g) =>
          g.stays.some((s) => s.status === "active"),
        );
      case "returning":
        return base.filter((g) => g.totalStays > 1);
      default:
        return base;
    }
  }, [data, searchQuery, activeFilter]);

  const totals = useMemo(() => {
    return (data || []).reduce(
      (acc, g) => ({
        guests: acc.guests + 1,
        stays: acc.stays + g.totalStays,
        spent: acc.spent + g.totalSpent,
        outstanding: acc.outstanding + g.outstandingBalance,
      }),
      { guests: 0, stays: 0, spent: 0, outstanding: 0 },
    );
  }, [data]);

  return (
    <div className="w-full min-h-screen p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D9C3C3] dark:border-white/10">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3 py-0.5 text-[11px] font-bold text-[#900546] dark:text-[#F968AC] mb-1.5">
            <BookUser className="size-3.5" />
            Guest Records
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#130005] dark:text-white">
            Guest Directory
          </h1>
          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5">
            Search every guest, view stay history, and update contact records.
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-4 shadow-xs">
          <p className="text-2xl font-bold text-[#130005] dark:text-white">
            {totals.guests}
          </p>
          <p className="text-[11px] text-[#5C454B] dark:text-gray-400">
            Unique Guests
          </p>
        </div>
        <div className="rounded-2xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-4 shadow-xs">
          <p className="text-2xl font-bold text-[#130005] dark:text-white">
            {totals.stays}
          </p>
          <p className="text-[11px] text-[#5C454B] dark:text-gray-400">
            Total Stays
          </p>
        </div>
        <div className="rounded-2xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-4 shadow-xs">
          <p className="text-2xl font-bold text-[#618685]">
            ₱{totals.spent.toLocaleString()}
          </p>
          <p className="text-[11px] text-[#5C454B] dark:text-gray-400">
            Lifetime Revenue
          </p>
        </div>
        <div className="rounded-2xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-4 shadow-xs">
          <p
            className={`text-2xl font-bold ${
              totals.outstanding > 0 ? "text-amber-600" : "text-[#130005] dark:text-white"
            }`}
          >
            ₱{totals.outstanding.toLocaleString()}
          </p>
          <p className="text-[11px] text-[#5C454B] dark:text-gray-400">
            Outstanding Balances
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-[#5C454B]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, phone..."
            className="pl-9 pr-8 h-10 rounded-xl bg-white dark:bg-[#1A0E13] border-[#D9C3C3] text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Filter className="size-3.5 text-[#5C454B]" />
          {(
            [
              { value: "all", label: "All Guests" },
              { value: "active", label: "Currently In-House" },
              { value: "returning", label: "Returning" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              onClick={() => setActiveFilter(option.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                activeFilter === option.value
                  ? "bg-[#900546] text-white border-[#900546]"
                  : "bg-white dark:bg-[#1A0E13] border-[#D9C3C3] dark:border-white/10 text-[#5C454B] dark:text-gray-300 hover:border-[#900546]/50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">Failed to load guest directory.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookUser className="size-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {data?.length === 0 ? "No guest records yet." : "No guests match your search."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((guest) => {
            const expanded = expandedKey === guest.key;
            return (
              <div
                key={guest.key}
                className="rounded-2xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] shadow-xs overflow-hidden"
              >
                <button
                  onClick={() => setExpandedKey(expanded ? null : guest.key)}
                  className="w-full text-left px-5 py-4 flex items-center justify-between gap-3 hover:bg-[#FAF5F5] dark:hover:bg-[#25121B] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-10 rounded-xl bg-[#618685]/15 text-[#618685] flex items-center justify-center font-bold text-sm shrink-0">
                      {guest.name ? guest.name.charAt(0).toUpperCase() : "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#130005] dark:text-white truncate">
                        {guest.name || "Unnamed Guest"}
                      </p>
                      <p className="text-[11px] text-[#5C454B] dark:text-gray-400 truncate">
                        {guest.email || guest.phone || guest.address || "No contact on file"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="hidden sm:flex items-center gap-4 text-xs">
                      <div className="text-center">
                        <p className="font-bold text-[#130005] dark:text-white">{guest.totalStays}</p>
                        <p className="text-[10px] text-muted-foreground">Stays</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-[#618685]">
                          ₱{guest.totalSpent.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Spent</p>
                      </div>
                      {guest.outstandingBalance > 0 && (
                        <div className="text-center">
                          <p className="font-bold text-amber-600">
                            ₱{guest.outstandingBalance.toLocaleString()}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Balance</p>
                        </div>
                      )}
                    </div>
                    <EditGuestModal guest={guest} />
                    <span
                      className={`text-xs transition-transform ${
                        expanded ? "rotate-180" : ""
                      }`}
                    >
                      <ChevronDown className="size-4 opacity-60" />
                    </span>
                  </div>
                </button>

                {expanded && (
                  <div className="px-5 pb-4 border-t border-[#D9C3C3]/40 dark:border-white/10 pt-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-3 text-xs">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Email</p>
                        <p className="font-medium truncate">{guest.email || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Phone</p>
                        <p className="font-medium truncate">{guest.phone || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Address</p>
                        <p className="font-medium truncate">{guest.address || "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Last Stay</p>
                        <p className="font-medium">
                          {guest.lastStayAt
                            ? new Date(guest.lastStayAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                        Stay History ({guest.stays.length})
                      </p>
                      {guest.stays.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No stays recorded.</p>
                      ) : (
                        [...guest.stays]
                          .sort(
                            (a, b) =>
                              new Date(b.arrivalDate).getTime() -
                              new Date(a.arrivalDate).getTime(),
                          )
                          .map((stay) => (
                            <div
                              key={stay.bookingId}
                              className="rounded-xl border border-[#D9C3C3]/50 dark:border-white/10 bg-[#FAF5F5] dark:bg-[#25121B] px-3 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1"
                            >
                              <span className="text-xs font-semibold">
                                {stay.roomNumber ? `Room ${stay.roomNumber}` : "Suite"} · {stay.category}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {new Date(stay.arrivalDate).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                                {" → "}
                                {stay.departureDate
                                  ? new Date(stay.departureDate).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })
                                  : "Open"}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {stay.nights} night{stay.nights !== 1 ? "s" : ""}
                              </span>
                              <span className="text-[11px] font-medium">
                                ₱{stay.stayTotal.toLocaleString()}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium capitalize ${statusTone(stay.status)}`}
                              >
                                {stay.status}
                              </span>
                              {stay.balance > 0 && (
                                <span className="text-[11px] font-bold text-amber-600">
                                  ₱{stay.balance.toLocaleString()} balance
                                </span>
                              )}
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}