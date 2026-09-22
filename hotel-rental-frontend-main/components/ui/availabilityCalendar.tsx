"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { formatTime12hr } from "@/app/utils/customFunction";
import { bookingInterface } from "@/app/types/bookings.type";
import { roomInterface } from "@/app/types/room.type";
import {
  pad,
  formatKey,
  todayKey,
  primaryBooking,
  buildRoomDayIndex,
} from "@/app/utils/calendarBookings";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  BedDouble,
  Wrench,
  UserCheck,
  Clock,
  Info,
  CircleDot,
} from "lucide-react";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_COLORS = {
  reservation: "#900546",
  active: "#618685",
  completed: "#9e938f",
} as const;

const ROOM_STATUS_DOT: Record<string, string> = {
  available: "#10b981",
  occupied: "#618685",
  maintenance: "#f59e0b",
  reserved: "#900546",
};

export function AvailabilityCalendar() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  const { data: rooms = [], isLoading: roomsLoading } = useQuery<
    roomInterface[]
  >({
    queryKey: ["rooms"],
    queryFn: async () => {
      const res = await axiosInstance.get("/room");
      return res.data;
    },
  });

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery<
    bookingInterface[]
  >({
    queryKey: ["bookings"],
    queryFn: async () => {
      const res = await axiosInstance.get("/booking");
      return res.data;
    },
  });

  const isLoading = roomsLoading || bookingsLoading;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = useMemo(() => {
    const arr: number[] = [];
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    return arr;
  }, [year, month, daysInMonth]);

  const isCurrentMonth =
    year === new Date().getFullYear() && month === new Date().getMonth();

  const roomDayIndex = useMemo(() => buildRoomDayIndex(bookings), [bookings]);

  const totalRooms = rooms.length;
  const maintenanceCount = rooms.filter(
    (r) => r.status === "maintenance",
  ).length;
  const occupiedCount = rooms.filter((r) => r.status === "occupied").length;
  const availableCount = rooms.filter((r) => r.status === "available").length;

  const todayArrivals = useMemo(() => {
    const tk = todayKey();
    return bookings.filter(
      (b) =>
        b.arrivalDate === tk &&
        (b.status === "reservation" || b.status === "active"),
    );
  }, [bookings]);

  const monthArrivals = useMemo(() => {
    const prefix = `${year}-${pad(month + 1)}-`;
    return bookings.filter(
      (b) =>
        b.arrivalDate?.startsWith(prefix) &&
        (b.status === "reservation" || b.status === "active"),
    ).length;
  }, [bookings, year, month]);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const goToToday = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  };

  const renderCell = (room: roomInterface, day: number) => {
    const key = formatKey(year, month, day);
    const isToday = key === todayKey();
    const isPast = key < todayKey();

    if (room.status === "maintenance") {
      return (
        <div
          className={
            "flex items-center justify-center h-7 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20 transition-colors hover:bg-amber-500/25" +
            (isToday ? " ring-2 ring-[#900546]/40" : "") +
            (isPast ? " opacity-40" : "")
          }
          title={`${room.category} - Under maintenance`}
        >
          <Wrench className="size-3" />
        </div>
      );
    }

    const entry = roomDayIndex.get(room._id);
    const nightBookings = entry?.nights.get(key) || [];
    const arrivals = entry?.arrivals.get(key) || [];
    const departures = entry?.departures.get(key) || [];

    const staying = nightBookings.filter((b) =>
      ["reservation", "active", "completed"].includes(b.status),
    );
    const arrivingToday = arrivals.filter(
      (b) => b.status === "active" || b.status === "reservation",
    );

    const timeSuffix = (b: bookingInterface) =>
      b.arrivalTime ? ` ${formatTime12hr(b.arrivalTime)}` : "";

    const describe = (b: bookingInterface) =>
      `${b.clientName} (${b.status})${b.arrivalDate ? ` ${b.arrivalDate}` : ""}${
        b.departureDate ? ` → ${b.departureDate}` : ""
      }`;

    if (departures.length > 0 && arrivingToday.length > 0) {
      const inbound = primaryBooking(arrivingToday)!;
      const inboundIsCheckedIn = inbound.status === "active";
      const inboundColor = inboundIsCheckedIn ? "#618685" : "#900546";
      const inboundLabel = inboundIsCheckedIn ? "IN" : "RSV";

      return (
        <div
          className={
            "flex h-7 items-stretch gap-px rounded-md overflow-hidden cursor-default" +
            (isToday ? " ring-2 ring-[#900546]/50" : "")
          }
          title={
            `Same-day turnover on ${key}\n` +
            `Check-out: ${departures.map(describe).join(", ")}\n` +
            `Check-in: ${arrivingToday.map(describe).join(", ")}${timeSuffix(inbound)}`
          }
        >
          <div
            className="flex flex-1 items-center justify-center text-white text-[9px] font-bold"
            style={{ backgroundColor: "#9e938f" }}
          >
            OUT
          </div>
          <div
            className="flex flex-1 items-center justify-center text-white text-[9px] font-bold"
            style={{ backgroundColor: inboundColor }}
          >
            {inboundLabel}
          </div>
        </div>
      );
    }

    if (departures.length > 0 && staying.length === 0) {
      return (
        <div
          className={
            "flex h-7 items-stretch gap-px rounded-md overflow-hidden cursor-default" +
            (isToday ? " ring-2 ring-[#900546]/50" : "") +
            (isPast ? " opacity-60" : "")
          }
          title={`Check-out on ${key}\n${departures.map(describe).join(", ")}\nRoom is free from this day.`}
        >
          <div
            className="flex flex-1 items-center justify-center text-white text-[9px] font-bold"
            style={{ backgroundColor: "#9e938f" }}
          >
            OUT
          </div>
          <div className="flex-1 bg-transparent ring-1 ring-inset ring-[#D9C3C3] dark:ring-white/15" />
        </div>
      );
    }

    if (staying.length === 0) {
      // Fall back to the room's live status when no booking spans today (e.g.
      // stale status or a walk-in without a booking record).
      if (isToday && room.status === "occupied") {
        return (
          <div
            className="flex items-center justify-center gap-0.5 h-7 rounded-md text-white text-[10px] font-bold bg-[#61868580]"
            title="Occupied — no active booking record"
          >
            <span>IN</span>
            <span className="hidden xl:inline"> Occupied</span>
          </div>
        );
      }
      if (isToday && room.status === "reserved") {
        return (
          <div
            className="flex items-center justify-center gap-0.5 h-7 rounded-md text-white text-[10px] font-bold bg-[#90054680]"
            title="Reserved — no upcoming booking record"
          >
            <span>RSV</span>
            <span className="hidden xl:inline"> Reserved</span>
          </div>
        );
      }
      return (
        <div
          className={
            "h-7 rounded-md transition-colors" +
            (isToday
              ? " bg-[#900546]/10 ring-2 ring-[#900546]/40"
              : isPast
                ? ""
                : " hover:bg-muted")
          }
        />
      );
    }

    const statusBooking = primaryBooking(staying)!;
    const isCheckedIn = statusBooking.status === "active";
    const isDeparted = statusBooking.status === "completed";
    const status = statusBooking.status as keyof typeof STATUS_COLORS;
    const color = isCheckedIn
      ? "#618685"
      : isDeparted
        ? "#9e938f"
        : STATUS_COLORS[status] || "#900546";
    const isArrivalDay = statusBooking.arrivalDate === key;
    const label = isDeparted
      ? "STAY"
      : isCheckedIn
        ? "IN"
        : isArrivalDay
          ? "RSV"
          : "STAY";
    const guestFirst = statusBooking.clientName?.split(" ")[0] || "Guest";
    const title = `${staying.map(describe).join(", ")}\nArrival: ${statusBooking.arrivalDate} ${formatTime12hr(statusBooking.arrivalTime)}${
      statusBooking.departureDate
        ? `\nCheck-out: ${statusBooking.departureDate}`
        : ""
    }`;

    return (
      <div
        className={
          "flex items-center justify-center gap-0.5 h-7 rounded-md text-white text-[10px] font-bold cursor-default transition-transform hover:scale-105" +
          (isToday ? " ring-2 ring-[#900546]/50" : "")
        }
        style={{ backgroundColor: color }}
        title={title}
      >
        <span>{`${label}${isArrivalDay && statusBooking.arrivalTime && !isDeparted ? ` ${formatTime12hr(statusBooking.arrivalTime)}` : ""}`}</span>
        <span className="hidden xl:inline">{` ${guestFirst.slice(0, 3)}`}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="inline-flex items-center gap-2 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3 py-1 text-xs font-semibold text-[#900546] dark:text-[#F968AC]">
            <CalendarIcon className="size-3" />
            Occupancy Overview
          </h1>

          <h1 className="text-2xl mt-2 font-semibold">Calendar</h1>

          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-2">
            Daily room status. Markers show reservations (RSV), checked-in
            guests (IN), held nights (STAY) and check-outs (OUT). A split cell
            means a same-day turnover — one guest checks out and the next checks
            in on that date.
          </p>
        </div>

        <div className="sm:ml-auto flex items-center justify-center sm:justify-end gap-2">
          <button
            onClick={prevMonth}
            className="flex size-9 items-center justify-center rounded-xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] text-[#5C454B] dark:text-gray-400 hover:text-[#900546] hover:border-[#900546]/50 transition-colors cursor-pointer"
            title="Previous month"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={goToToday}
            disabled={isCurrentMonth}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-xl bg-[#900546] hover:bg-[#720336] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <CalendarIcon className="size-3.5" />
            Today
          </button>
          <button
            onClick={nextMonth}
            className="flex size-9 items-center justify-center rounded-xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] text-[#5C454B] dark:text-gray-400 hover:text-[#900546] hover:border-[#900546]/50 transition-colors cursor-pointer"
            title="Next month"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Month Title */}
      <div className="flex items-end justify-between gap-4">
        <h2 className="font-serif text-2xl font-bold text-[#130005] dark:text-white">
          {MONTH_NAMES[month]} {year}
        </h2>
        <span className="text-xs text-[#5C454B] dark:text-gray-400">
          <strong className="text-[#900546] dark:text-[#F968AC]">
            {monthArrivals}
          </strong>{" "}
          expected arrival{monthArrivals !== 1 ? "s" : ""} this month
        </span>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Rooms
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#900546]/10 text-[#900546] dark:text-[#F968AC]">
              <BedDouble className="size-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">
            {totalRooms}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Available
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <BedDouble className="size-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">
            {availableCount}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Checked-in / Due
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#618685]/10 text-[#618685] dark:text-[#90b8b7]">
              <UserCheck className="size-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">
            {occupiedCount}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Maintenance
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Wrench className="size-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">
            {maintenanceCount}
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#5C454B] dark:text-gray-400">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-3 rounded-sm"
            style={{ backgroundColor: "#900546" }}
          />{" "}
          Paid Reservation
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-3 rounded-sm"
            style={{ backgroundColor: "#F968AC" }}
          />{" "}
          Unpaid Reservation
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-3 rounded-sm"
            style={{ backgroundColor: "#618685" }}
          />{" "}
          Checked-in
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-3 rounded-sm"
            style={{ backgroundColor: "#9e938f" }}
          />{" "}
          Check-out (OUT)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex size-3 overflow-hidden rounded-sm">
            <span className="w-1/2" style={{ backgroundColor: "#9e938f" }} />
            <span className="w-1/2" style={{ backgroundColor: "#900546" }} />
          </span>
          Same-day turnover
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-amber-400/60" /> Maintenance
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-transparent ring-1 ring-[#D9C3C3] dark:ring-white/20" />{" "}
          Available
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CircleDot className="size-3 text-[#900546]" /> Today
        </span>
      </div>

      {todayArrivals.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-[#900546]/20 bg-[#900546]/5 px-4 py-3 text-xs text-[#900546] dark:text-[#F968AC]">
          <Clock className="size-4 shrink-0" />
          <span>
            <strong>{todayArrivals.length}</strong> arrival
            {todayArrivals.length > 1 ? "s" : ""} scheduled today:{" "}
            {todayArrivals.map((b) => b.clientName).join(", ")}
          </span>
        </div>
      )}

      {/* Calendar Table */}
      <div className="rounded-2xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs min-w-[1240px]">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-bold w-44">
                  Room / Suite
                </th>
                {days.map((d) => {
                  const date = new Date(year, month, d);
                  const isToday = formatKey(year, month, d) === todayKey();
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  return (
                    <th
                      key={d}
                      className={
                        "px-0.5 py-1.5 text-center align-bottom" +
                        (isToday
                          ? " bg-[#900546]/10"
                          : isWeekend
                            ? " bg-[#900546]/5"
                            : "") +
                        (isWeekend && !isToday
                          ? " text-[#900546]/80 dark:text-[#F968AC]/80"
                          : " text-muted-foreground")
                      }
                    >
                      <span className="block text-[9px] font-medium opacity-70">
                        {WEEKDAYS[date.getDay()]}
                      </span>
                      <span
                        className={
                          "block text-[11px] font-bold" +
                          (isToday ? " text-[#900546] dark:text-[#F968AC]" : "")
                        }
                      >
                        {d}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={daysInMonth + 1} className="p-6">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full mt-2" />
                    <Skeleton className="h-8 w-full mt-2" />
                  </td>
                </tr>
              ) : rooms.length === 0 ? (
                <tr>
                  <td colSpan={daysInMonth + 1} className="p-10 text-center">
                    <Info className="size-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No rooms have been added yet.
                    </p>
                  </td>
                </tr>
              ) : (
                rooms.map((room, ri) => (
                  <tr
                    key={room._id}
                    className={ri % 2 === 1 ? "bg-muted/30" : ""}
                  >
                    <td className="sticky left-0 z-10 bg-card px-3 py-1.5 border-b border-border/60">
                      <div className="flex items-center gap-1.5">
                        <CircleDot
                          className="size-2.5 shrink-0"
                          style={{
                            color: ROOM_STATUS_DOT[room.status] || "#9ca3af",
                          }}
                        />
                        <p className="font-bold text-foreground truncate">
                          {room.roomNumber
                            ? `Unit ${room.roomNumber}`
                            : "Suite"}
                          <span className="text-muted-foreground font-medium">
                            {" "}
                            · {room.category}
                          </span>
                        </p>
                      </div>
                      <p className="text-[10px] text-muted-foreground pl-4">
                        ₱{room.price.toLocaleString()}/day
                        {room.discount > 0 ? ` · ${room.discount}% off` : ""}
                      </p>
                    </td>
                    {days.map((d) => (
                      <td
                        key={d}
                        className="px-0.5 py-1 border-b border-border/60"
                      >
                        {renderCell(room, d)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
