"use client";

import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { bookingInterface } from "@/app/types/bookings.type";
import { roomInterface } from "@/app/types/room.type";
import {
  Loader2,
  Bed,
  CalendarCheck,
  BookmarkCheck,
  Building2,
  Wrench,
  Users,
  AlertTriangle,
  Sparkles,
  CreditCard,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

// ── Florentina Brand Status Colors ──
const STATUS_COLORS = {
  available: "#10b981",
  occupied: "#900546",
  maintenance: "#f59e0b",
  reserved: "#8b5cf6",
} as const;

const CATEGORY_COLORS = ["#900546", "#618685", "#F968AC", "#f59e0b", "#10b981"];

export default function Page() {
  // ── Fetch bookings ──
  const {
    data: bookings,
    isLoading: bookingsLoading,
    isError: bookingsError,
  } = useQuery<bookingInterface[]>({
    queryKey: ["bookings"],
    queryFn: async () => {
      const res = await axiosInstance.get("/booking");
      return res.data;
    },
  });

  // ── Fetch rooms ──
  const {
    data: rooms,
    isLoading: roomsLoading,
    isError: roomsError,
  } = useQuery<roomInterface[]>({
    queryKey: ["rooms"],
    queryFn: async () => {
      const res = await axiosInstance.get("/room");
      return res.data;
    },
  });

  const isLoading = bookingsLoading || roomsLoading;
  const isError = bookingsError || roomsError;

  // ── Compute stats ──
  const totalRooms = rooms?.length ?? 0;
  const availableRooms = rooms?.filter((r) => r.status === "available").length ?? 0;
  const occupiedRooms = rooms?.filter((r) => r.status === "occupied").length ?? 0;
  const maintenanceRooms = rooms?.filter((r) => r.status === "maintenance").length ?? 0;
  const reservedRooms = rooms?.filter((r) => r.status === "reserved").length ?? 0;

  const activeBookings = bookings?.filter((b) => b.status === "active").length ?? 0;
  const reservations = bookings?.filter((b) => b.type === "reservation").length ?? 0;
  const walkIns = bookings?.filter((b) => b.type === "walk in").length ?? 0;
  const unpaidBookings = bookings?.filter((b) => b.status === "unpaid").length ?? 0;

  // ── Front desk operational analytics ──
  const dateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  const todayKey = dateKey(new Date());
  const todayArrivals = bookings?.filter((b) => b.arrivalDate === todayKey).length ?? 0;

  const arrivalForecast = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const key = dateKey(d);
    return {
      name: d.toLocaleDateString("en-US", { weekday: "short" }),
      arrivals: bookings?.filter((b) => b.arrivalDate === key).length ?? 0,
      color: i === 0 ? "#900546" : "#618685",
    };
  });

  const totalForecast = arrivalForecast.reduce((sum, day) => sum + day.arrivals, 0);

  const categoryList = Array.from(new Set((rooms ?? []).map((r) => r.category)));
  const occupancyByCategory = categoryList
    .map((cat, index) => {
      const catRooms = rooms?.filter((r) => r.category === cat) ?? [];
      return {
        name: cat,
        occupied: catRooms.filter((r) => r.status === "occupied").length,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      };
    })
    .filter((d) => d.occupied > 0);

  // ── Chart data ──
  const roomStatusData = [
    { name: "Available", value: availableRooms, color: STATUS_COLORS.available },
    { name: "Occupied", value: occupiedRooms, color: STATUS_COLORS.occupied },
    { name: "Reserved", value: reservedRooms, color: STATUS_COLORS.reserved },
    { name: "Maintenance", value: maintenanceRooms, color: STATUS_COLORS.maintenance },
  ].filter((d) => d.value > 0);

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="w-full min-h-[80vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[#5C454B] dark:text-gray-400 text-sm">
          <Loader2 className="size-6 animate-spin text-[#900546]" />
          <span>Loading Front Desk operations...</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="w-full min-h-[80vh] flex flex-col items-center justify-center gap-3 text-center p-6">
        <AlertTriangle className="size-10 text-rose-600" />
        <h2 className="font-serif text-xl font-bold text-[#130005] dark:text-white">
          Failed to load dashboard data
        </h2>
        <p className="text-xs text-[#5C454B] dark:text-gray-400">
          Please check your network connection and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen p-6 sm:p-8 space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D9C3C3] dark:border-white/10">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3 py-0.5 text-[11px] font-bold text-[#900546] dark:text-[#F968AC] mb-1.5">
            <Sparkles className="size-3.5" />
            Florentina Inn Front Desk Operations
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#130005] dark:text-white">
            Staff Dashboard
          </h1>
          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5">
            Live overview of suite availability, guest arrivals, and front desk workflows.
          </p>
        </div>
      </div>

      {/* ── Stat Cards Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatCard
          icon={<Building2 className="size-4" />}
          label="Total Suites"
          value={totalRooms}
          color="bg-[#900546]/10 text-[#900546] dark:text-[#F968AC]"
        />
        <StatCard
          icon={<Bed className="size-4" />}
          label="Available"
          value={availableRooms}
          color="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
        />
        <StatCard
          icon={<Users className="size-4" />}
          label="Occupied"
          value={occupiedRooms}
          color="bg-[#900546]/10 text-[#900546] dark:text-[#F968AC]"
        />
        <StatCard
          icon={<Wrench className="size-4" />}
          label="Maintenance"
          value={maintenanceRooms}
          color="bg-amber-500/10 text-amber-700 dark:text-amber-400"
        />
        <StatCard
          icon={<CalendarCheck className="size-4" />}
          label="Active Stays"
          value={activeBookings}
          color="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
        />
        <StatCard
          icon={<BookmarkCheck className="size-4" />}
          label="Reservations"
          value={reservations}
          color="bg-[#618685]/15 text-[#618685]"
        />
        <StatCard
          icon={<Users className="size-4" />}
          label="Walk-in"
          value={walkIns}
          color="bg-[#618685]/15 text-[#618685]"
        />
        <StatCard
          icon={<CreditCard className="size-4" />}
          label="Pending Pay"
          value={unpaidBookings}
          color="bg-[#F968AC]/15 text-[#900546] dark:text-[#F968AC]"
        />
      </div>

      {/* ── Operational Visual Overview Charts ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Room Status Distribution */}
        <div className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-sm font-bold text-[#130005] dark:text-white">
              Room Status
            </h3>
            <span className="text-[10px] font-bold text-[#618685]">Live Capacity</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="size-24 shrink-0">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 96, height: 96 }}>
                <PieChart>
                  <Pie
                    data={roomStatusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={24}
                    outerRadius={44}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {roomStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              {roomStatusData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-[#5C454B] dark:text-gray-400 text-[11px] truncate">{d.name}</span>
                  </div>
                  <span className="font-bold text-[#130005] dark:text-white tabular-nums text-xs">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Occupancy by Room Category */}
        <div className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-sm font-bold text-[#130005] dark:text-white">
              Occupancy by Suites
            </h3>
            <span className="text-[10px] font-bold text-[#900546] dark:text-[#F968AC]">
              {occupiedRooms}/{totalRooms} In-House
            </span>
          </div>
          {occupancyByCategory.length === 0 ? (
            <div className="h-[95px] flex items-center justify-center text-xs text-[#5C454B] dark:text-gray-400">
              No occupied suites yet.
            </div>
          ) : (
            <div className="h-[95px]">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 95 }}>
                <BarChart
                  data={occupancyByCategory}
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                  barCategoryGap="25%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#D9C3C3" opacity={0.3} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9, fill: "#5C454B" }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 9, fill: "#5C454B" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Bar dataKey="occupied" radius={[6, 6, 0, 0]} maxBarSize={28}>
                    {occupancyByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 3. Arrivals Forecast */}
        <div className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-sm font-bold text-[#130005] dark:text-white">
              Arrivals Forecast
            </h3>
            <span className="text-[10px] font-bold text-[#618685]">Next 7 Days</span>
          </div>
          <div className="h-[95px]">
<ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 95 }}>
                <BarChart
                  data={arrivalForecast}
                margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                barCategoryGap="30%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#D9C3C3" opacity={0.3} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9, fill: "#5C454B" }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 9, fill: "#5C454B" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Bar dataKey="arrivals" radius={[6, 6, 0, 0]} maxBarSize={20}>
                  {arrivalForecast.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Today's Front Desk */}
        <div className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-5 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-sm font-bold text-[#130005] dark:text-white">
              Today's Front Desk
            </h3>
            <CalendarCheck className="size-4 text-[#900546] dark:text-[#F968AC]" />
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#5C454B] dark:text-gray-400">Today's Arrivals</span>
              <span className="font-bold text-[#900546] dark:text-[#F968AC]">{todayArrivals}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#5C454B] dark:text-gray-400">In-House Guests</span>
              <span className="font-bold text-[#130005] dark:text-white">{occupiedRooms}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#5C454B] dark:text-gray-400">Pending Payment</span>
              <span className="font-bold text-[#900546] dark:text-[#F968AC]">{unpaidBookings}</span>
            </div>
            <div className="h-px bg-[#D9C3C3]/40 dark:bg-white/10" />
            <div className="flex items-center justify-between">
              <span className="text-[#5C454B] dark:text-gray-400">7-Day Arrival Forecast</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{totalForecast}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Compact Stat Card Component ──
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-3 transition-all duration-150 hover:shadow-md hover:border-[#900546]/30">
      <div className="flex items-center gap-2.5">
        <div className={`rounded-xl p-2 shrink-0 ${color}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-base font-bold text-[#130005] dark:text-white tabular-nums leading-none">
            {value}
          </p>
          <p className="text-[10px] font-medium text-[#5C454B] dark:text-gray-400 mt-1 truncate">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}
