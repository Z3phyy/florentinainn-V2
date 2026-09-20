"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { roomInterface } from "@/app/types/room.type";
import { bookingInterface } from "@/app/types/bookings.type";
import { paymentInterface } from "@/app/types/payment.type";
import { getDaysFromDate } from "@/app/utils/customFunction";
import { todayDateStr } from "@/app/utils/bookingValidation";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  CalendarCheck,
  TrendingUp,
  Percent,
  Bed,
  Users,
  CreditCard,
  Sparkles,
  Calendar,
  ArrowUpRight,
  ShieldCheck,
  Clock,
  CircleDollarSign,
  Activity,
  Layers,
  LogIn,
  LogOut,
  Coins,
} from "lucide-react";

// ─── Constants ───

const MONTHS = [
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

const ROOM_STATUS_COLORS: Record<string, string> = {
  available: "#10b981",
  occupied: "#900546",
  maintenance: "#f59e0b",
  reserved: "#8b5cf6",
};

type DateRangePreset =
  | "today"
  | "this_week"
  | "this_month"
  | "last_30_days"
  | "this_quarter"
  | "all_time";

// ─── Helpers ───

function formatCurrency(n: number) {
  return `₱${n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Circular Occupancy Gauge Component ───

function OccupancyGauge({ rate }: { rate: number }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (rate / 100) * circumference;

  const color = rate >= 70 ? "#10b981" : rate >= 40 ? "#618685" : "#900546";

  return (
    <div className="relative flex size-24 items-center justify-center shrink-0">
      <svg className="size-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={radius}
          className="text-[#D9C3C3]/40 dark:text-white/10"
          strokeWidth="8"
          stroke="currentColor"
          fill="transparent"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="font-serif text-lg font-bold text-[#130005] dark:text-white leading-none">
          {rate.toFixed(0)}%
        </span>
        <span className="text-[9px] uppercase tracking-wider text-[#5C454B] dark:text-gray-400 font-semibold mt-0.5">
          Occupied
        </span>
      </div>
    </div>
  );
}

// ─── Stat Card Component ───

function StatCard({
  label,
  value,
  icon,
  subtext,
  badgeText,
  badgeColor = "text-[#900546] bg-[#900546]/10 border-[#900546]/20",
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  subtext?: string;
  badgeText?: string;
  badgeColor?: string;
}) {
  return (
    <div className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-5.5 flex flex-col justify-between shadow-xs hover:shadow-md hover:border-[#900546]/30 transition-all duration-300">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex size-10.5 shrink-0 items-center justify-center rounded-2xl bg-[#900546]/10 text-[#900546] dark:text-[#F968AC] border border-[#900546]/20 shadow-xs">
          {icon}
        </div>
        {badgeText && (
          <span
            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${badgeColor}`}
          >
            {badgeText}
          </span>
        )}
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#5C454B] dark:text-gray-400">
          {label}
        </p>
        <p className="font-serif text-2xl sm:text-3xl font-bold text-[#130005] dark:text-white mt-0.5 tracking-tight">
          {value}
        </p>
        {subtext && (
          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-1 flex items-center gap-1 truncate">
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Chart Card Container ───

function ChartCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] shadow-xs overflow-hidden flex flex-col">
      <div className="px-6 py-4.5 border-b border-[#D9C3C3] dark:border-white/10 flex items-center justify-between flex-wrap gap-2 bg-[#FAF5F5]/60 dark:bg-[#130005]/40">
        <div>
          <h3 className="font-serif text-lg font-bold text-[#130005] dark:text-white">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      <div className="p-6 flex-1">{children}</div>
    </div>
  );
}

// ─── Custom Glassmorphism Tooltip ───

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-[#D9C3C3] dark:border-white/10 bg-white/95 dark:bg-[#130005]/95 backdrop-blur-md px-3.5 py-2.5 text-xs shadow-xl space-y-1">
      <p className="font-bold text-[#130005] dark:text-white">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p
          key={i}
          className="flex items-center gap-2 text-[11px] font-semibold"
          style={{ color: entry.color || "#900546" }}
        >
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: entry.color || "#900546" }}
          />
          <span>{entry.name}:</span>
          <span>
            {typeof entry.value === "number" &&
            entry.name.toLowerCase().includes("revenue")
              ? formatCurrency(entry.value)
              : entry.value.toLocaleString()}
          </span>
        </p>
      ))}
    </div>
  );
}

// ─── Main Dashboard Page ───

export default function Page() {
  const [dateRange, setDateRange] = useState<DateRangePreset>("this_month");

  // ── Fetch rooms ──
  const { data: rooms, isLoading: roomsLoading } = useQuery<roomInterface[]>({
    queryKey: ["dashboard-rooms"],
    queryFn: async () => {
      const res = await axiosInstance.get("/room");
      return res.data;
    },
  });

  // ── Fetch bookings ──
  const { data: bookings, isLoading: bookingsLoading } = useQuery<
    bookingInterface[]
  >({
    queryKey: ["dashboard-bookings"],
    queryFn: async () => {
      const res = await axiosInstance.get("/booking");
      return res.data;
    },
  });

  // ── Fetch payments ──
  const { data: payments, isLoading: paymentsLoading } = useQuery<
    paymentInterface[]
  >({
    queryKey: ["dashboard-payments"],
    queryFn: async () => {
      const res = await axiosInstance.get("/system/payments");
      return res.data;
    },
  });

  const isLoading = roomsLoading || bookingsLoading || paymentsLoading;

  // ── Dynamic Date Range Filter ──
  const { filteredBookings, filteredPayments, periodDaysCount, periodLabel } =
    useMemo(() => {
      if (!bookings || !payments) {
        return {
          filteredBookings: [],
          filteredPayments: [],
          periodDaysCount: 30,
          periodLabel: "This Month",
        };
      }

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      let startDate: Date;
      let label = "This Month";
      let days = 30;

      switch (dateRange) {
        case "today":
          startDate = today;
          label = "Today";
          days = 1;
          break;
        case "this_week":
          startDate = new Date(today);
          startDate.setDate(today.getDate() - today.getDay());
          label = "This Week";
          days = 7;
          break;
        case "this_month":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          label = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
          days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          break;
        case "last_30_days":
          startDate = new Date(today);
          startDate.setDate(today.getDate() - 30);
          label = "Past 30 Days";
          days = 30;
          break;
        case "this_quarter":
          const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
          startDate = new Date(now.getFullYear(), quarterMonth, 1);
          label = `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
          days = 90;
          break;
        case "all_time":
        default:
          startDate = new Date(2020, 0, 1);
          label = "All Time History";
          days = 365;
          break;
      }

      const fb = bookings.filter((b) => {
        const d = new Date(b.arrivalDate);
        return d >= startDate;
      });

      const fp = payments.filter((p) => {
        const d = new Date(p.date);
        return d >= startDate;
      });

      return {
        filteredBookings: fb,
        filteredPayments: fp,
        periodDaysCount: days,
        periodLabel: label,
      };
    }, [bookings, payments, dateRange]);

  // ── Derived hospitality stats ──
  const totalRooms = rooms?.length ?? 0;
  const availableRooms =
    rooms?.filter((r) => r.status === "available").length ?? 0;
  const occupiedRooms =
    rooms?.filter((r) => r.status === "occupied").length ?? 0;
  const maintenanceRooms =
    rooms?.filter((r) => r.status === "maintenance").length ?? 0;
  const reservedRooms =
    rooms?.filter((r) => r.status === "reserved").length ?? 0;
  const occupancyRateNumber =
    totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;
  const occupancyRate = occupancyRateNumber.toFixed(1);

  // Total Revenue in selected period
  const totalRevenue = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalBookingsCount = filteredBookings.length;

  // ── Industry Standard Metrics: ADR & RevPAR ──
  // ADR (Average Daily Rate) = Total Revenue / Total Bookings in period (or occupied room-days)
  const adr =
    totalBookingsCount > 0 ? Math.round(totalRevenue / totalBookingsCount) : 0;

  // RevPAR (Revenue Per Available Room) = Total Revenue / (Total Rooms * Days in Period)
  const revpar =
    totalRooms > 0
      ? Math.round(totalRevenue / (totalRooms * (periodDaysCount || 1)))
      : 0;

  // ── Revenue Area Chart Data ──
  const revenueChartData = useMemo(() => {
    if (!filteredPayments || filteredPayments.length === 0) return [];

    const dateMap: Record<string, number> = {};

    filteredPayments.forEach((p) => {
      const d = formatDate(p.date);
      dateMap[d] = (dateMap[d] || 0) + p.amount;
    });

    return Object.entries(dateMap).map(([date, amount]) => ({
      date,
      Revenue: amount,
    }));
  }, [filteredPayments]);

  // ── Room status distribution ──
  const roomStatusData = useMemo(() => {
    if (!rooms) return [];
    return [
      { name: "Available", value: availableRooms },
      { name: "Occupied", value: occupiedRooms },
      { name: "Reserved", value: reservedRooms },
      { name: "Maintenance", value: maintenanceRooms },
    ].filter((d) => d.value > 0);
  }, [rooms, availableRooms, occupiedRooms, reservedRooms, maintenanceRooms]);

  // ── Bookings by status distribution ──
  const activeBookings = filteredBookings.filter(
    (b) => b.status === "active" || b.status === "occupied",
  ).length;
  const completedBookings = filteredBookings.filter(
    (b) => b.status === "completed",
  ).length;
  const reservationBookings = filteredBookings.filter(
    (b) => b.status === "reservation" || b.status === "unpaid",
  ).length;
  const canceledBookings = filteredBookings.filter(
    (b) => b.status === "canceled",
  ).length;

  const bookingStatusData = [
    { name: "Active Lodging", value: activeBookings },
    { name: "Pending Reservation", value: reservationBookings },
    { name: "Completed", value: completedBookings },
    { name: "Canceled", value: canceledBookings },
  ].filter((d) => d.value > 0);

  // ── Today's operational snapshot (front-desk movements) ──
  const todayKey = todayDateStr();
  const checkinsToday =
    bookings?.filter((b) => b.arrivalDate === todayKey).length ?? 0;
  const checkoutsToday =
    bookings?.filter((b) => b.departureDate === todayKey).length ?? 0;

  // ── Total outstanding balance across all in-house folios ──
  const totalOutstandingBalance = useMemo(() => {
    if (!bookings || !payments) return 0;

    return bookings
      .filter((b) => b.status === "active" || b.status === "occupied")
      .reduce((sum, b) => {
        const room = b.room;
        if (!room?.price) return sum;

        const discountedPrice = room.price * (1 - (room.discount || 0) / 100);
        const stayTotal = Math.max(
          0,
          discountedPrice * Math.max(1, getDaysFromDate(b.arrivalDate)),
        );
        const paidInPayments = payments
          .filter((p) => p.paymentBy === b.clientName)
          .reduce((s, p) => s + p.amount, 0);
        const amountPaid = Math.max(paidInPayments, b.paymentAmount || 0);

        return sum + Math.max(0, stayTotal - amountPaid);
      }, 0);
  }, [bookings, payments]);

  // ── Recent transactions (last 5) ──
  const recentTransactions = useMemo(() => {
    if (!payments) return [];
    return [...payments]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [payments]);

  // ── Recent bookings (last 5) ──
  const recentBookings = useMemo(() => {
    if (!bookings) return [];
    return [...bookings]
      .sort(
        (a, b) =>
          new Date(b.arrivalDate).getTime() - new Date(a.arrivalDate).getTime(),
      )
      .slice(0, 5);
  }, [bookings]);

  return (
    <div className="space-y-8">
      {/* ── Page Header & Period Customizer ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3 py-1 text-xs font-semibold text-[#900546] dark:text-[#F968AC] mb-2">
            Executive Summary
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#130005] dark:text-white">
            Hotel Analytics & Performance
          </h1>
          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-1">
            Real-time occupancy rates, RevPAR metrics, revenue trends, and
            operational capacity.
          </p>
        </div>

        {/* Dynamic Period Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#5C454B] dark:text-gray-400 font-semibold">
            Filter Period:
          </span>
          <Select
            value={dateRange}
            onValueChange={(val: DateRangePreset) => setDateRange(val)}
          >
            <SelectTrigger className="w-[180px] h-10 rounded-xl bg-white dark:bg-[#1A0E13] border-[#D9C3C3] dark:border-white/10 text-xs font-semibold text-[#130005] dark:text-white focus:ring-[#900546]">
              <SelectValue placeholder="Select Range" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13]">
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_30_days">Past 30 Days</SelectItem>
              <SelectItem value="this_quarter">This Quarter</SelectItem>
              <SelectItem value="all_time">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Loading Skeleton ── */}
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-3xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Skeleton className="lg:col-span-8 h-80 rounded-3xl" />
            <Skeleton className="lg:col-span-4 h-80 rounded-3xl" />
          </div>
        </div>
      ) : (
        <>
          {/* ── Top Hospitality Metric Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* 1. Total Revenue */}
            <StatCard
              label="Period Revenue"
              value={formatCurrency(totalRevenue)}
              icon={<CircleDollarSign className="size-5" />}
              subtext={`${filteredPayments.length} transactions in ${periodLabel}`}
              badgeText="Financial"
              badgeColor="text-[#900546] bg-[#900546]/10 border-[#900546]/20"
            />

            {/* 2. ADR (Average Daily Rate) */}
            <StatCard
              label="Average Daily Rate (ADR)"
              value={formatCurrency(adr)}
              icon={<TrendingUp className="size-5" />}
              subtext="Average rate earned per suite booking"
              badgeText="KPI Metric"
              badgeColor="text-[#618685] bg-[#618685]/10 border-[#618685]/20"
            />

            {/* 3. RevPAR */}
            <StatCard
              label="RevPAR"
              value={formatCurrency(revpar)}
              icon={<Activity className="size-5" />}
              subtext="Revenue per available suite inventory"
              badgeText="Hospitality"
              badgeColor="text-emerald-700 bg-emerald-500/10 border-emerald-300"
            />

            {/* 4. Total Bookings */}
            <StatCard
              label="Total Bookings"
              value={totalBookingsCount}
              icon={<CalendarCheck className="size-5" />}
              subtext={`${activeBookings} currently active · ${reservationBookings} pending`}
              badgeText="Occupancy"
              badgeColor="text-amber-700 bg-amber-500/10 border-amber-300"
            />
          </div>

          {/* ── Front Desk & Folio Metric Row ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* 1. Rooms Available Now */}
            <StatCard
              label="Rooms Available Now"
              value={`${availableRooms} / ${totalRooms}`}
              icon={<Bed className="size-5" />}
              subtext={`${occupiedRooms} occupied · ${reservedRooms} reserved`}
              badgeText="Inventory"
              badgeColor="text-emerald-700 bg-emerald-500/10 border-emerald-300"
            />

            {/* 2. Check-ins Today */}
            <StatCard
              label="Check-ins Today"
              value={checkinsToday}
              icon={<LogIn className="size-5" />}
              subtext="Expected arrivals for today"
              badgeText="Front Desk"
              badgeColor="text-sky-700 bg-sky-500/10 border-sky-300"
            />

            {/* 3. Check-outs Today */}
            <StatCard
              label="Check-outs Today"
              value={checkoutsToday}
              icon={<LogOut className="size-5" />}
              subtext="Expected departures for today"
              badgeText="Front Desk"
              badgeColor="text-orange-700 bg-orange-500/10 border-orange-300"
            />

            {/* 4. Total Outstanding Balance */}
            <StatCard
              label="Outstanding Balance"
              value={formatCurrency(totalOutstandingBalance)}
              icon={<Coins className="size-5" />}
              subtext="Across in-house guest folios"
              badgeText="Folio"
              badgeColor="text-violet-700 bg-violet-500/10 border-violet-300"
            />
          </div>

          {/* ── Main Analytics Row: Revenue Area Chart & Real-Time Occupancy Gauge ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Revenue Area Flow Chart */}
            <div className="lg:col-span-8">
              <ChartCard
                title="Revenue Trend & Collections"
                subtitle={`Daily cash & online intake for ${periodLabel}`}
                action={
                  <span className="text-xs font-bold text-[#900546] bg-[#900546]/10 px-3 py-1 rounded-full border border-[#900546]/20">
                    Total: {formatCurrency(totalRevenue)}
                  </span>
                }
              >
                <div style={{ width: "100%", height: 300 }}>
                  {revenueChartData.length > 0 ? (
                    <ResponsiveContainer
                      width="100%"
                      height={300}
                      initialDimension={{ width: 600, height: 300 }}
                    >
                      <AreaChart
                        data={revenueChartData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="florentinaRevenueGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#900546"
                              stopOpacity={0.4}
                            />
                            <stop
                              offset="95%"
                              stopColor="#F968AC"
                              stopOpacity={0.0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#D9C3C3"
                          opacity={0.5}
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: "#5C454B" }}
                          tickLine={false}
                          axisLine={{ stroke: "#D9C3C3" }}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#5C454B" }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="Revenue"
                          stroke="#900546"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#florentinaRevenueGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-[#5C454B] dark:text-gray-400">
                      <CircleDollarSign className="size-10 mb-2 opacity-30 text-[#900546]" />
                      <p className="text-sm font-semibold text-[#130005] dark:text-white">
                        No Revenue in Selected Period
                      </p>
                      <p className="text-xs mt-0.5">
                        Switch the filter range above to view historical
                        transactions.
                      </p>
                    </div>
                  )}
                </div>
              </ChartCard>
            </div>

            {/* Right: Real-time Occupancy & Inventory Gauge */}
            <div className="lg:col-span-4">
              <ChartCard
                title="Real-Time Occupancy"
                subtitle="Live status of all physical hotel rooms"
              >
                <div className="flex flex-col items-center justify-center pt-2 space-y-6">
                  <OccupancyGauge rate={occupancyRateNumber} />

                  {/* Room Breakdown Stats */}
                  <div className="w-full space-y-2.5 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF5F5] dark:bg-[#130005] border border-[#D9C3C3] dark:border-white/10">
                      <span className="flex items-center gap-2 font-medium text-[#5C454B] dark:text-gray-300">
                        <span className="size-2.5 rounded-full bg-emerald-500" />
                        Available for Guests
                      </span>
                      <span className="font-bold text-[#130005] dark:text-white">
                        {availableRooms} Suites
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF5F5] dark:bg-[#130005] border border-[#D9C3C3] dark:border-white/10">
                      <span className="flex items-center gap-2 font-medium text-[#5C454B] dark:text-gray-300">
                        <span className="size-2.5 rounded-full bg-[#900546]" />
                        Currently Occupied
                      </span>
                      <span className="font-bold text-[#130005] dark:text-white">
                        {occupiedRooms} Suites
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF5F5] dark:bg-[#130005] border border-[#D9C3C3] dark:border-white/10">
                      <span className="flex items-center gap-2 font-medium text-[#5C454B] dark:text-gray-300">
                        <span className="size-2.5 rounded-full bg-amber-500" />
                        Under Maintenance
                      </span>
                      <span className="font-bold text-[#130005] dark:text-white">
                        {maintenanceRooms} Suites
                      </span>
                    </div>
                  </div>
                </div>
              </ChartCard>
            </div>
          </div>

          {/* ── Second Analytics Row: Room Status Pie & Booking Types ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Room Distribution Donut */}
            <div className="lg:col-span-6">
              <ChartCard
                title="Room Inventory Distribution"
                subtitle="Categorization across total hotel suites"
              >
                <div style={{ width: "100%", height: 260 }}>
                  {roomStatusData.length > 0 ? (
                    <ResponsiveContainer
                      width="100%"
                      height={260}
                      initialDimension={{ width: 600, height: 260 }}
                    >
                      <PieChart>
                        <Pie
                          data={roomStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {roomStatusData.map((entry) => (
                            <Cell
                              key={entry.name}
                              fill={
                                ROOM_STATUS_COLORS[entry.name.toLowerCase()] ||
                                "#900546"
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                        <Legend
                          verticalAlign="bottom"
                          height={30}
                          formatter={(value) => (
                            <span className="text-xs font-medium text-[#5C454B] dark:text-gray-300">
                              {value}
                            </span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-xs text-[#5C454B]">
                      No room inventory records found.
                    </div>
                  )}
                </div>
              </ChartCard>
            </div>

            {/* Booking Status Bars */}
            <div className="lg:col-span-6">
              <ChartCard
                title="Booking Status Breakdown"
                subtitle={`Booking activity distribution for ${periodLabel}`}
              >
                <div style={{ width: "100%", height: 260 }}>
                  {bookingStatusData.length > 0 ? (
                    <ResponsiveContainer
                      width="100%"
                      height={260}
                      initialDimension={{ width: 600, height: 260 }}
                    >
                      <BarChart
                        data={bookingStatusData}
                        layout="vertical"
                        margin={{ top: 10, right: 20, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#D9C3C3"
                          opacity={0.4}
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 11, fill: "#5C454B" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 11, fill: "#5C454B" }}
                          tickLine={false}
                          axisLine={false}
                          width={110}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar
                          dataKey="value"
                          name="Total Bookings"
                          fill="#900546"
                          radius={[0, 8, 8, 0]}
                          barSize={22}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-xs text-[#5C454B]">
                      No bookings recorded in this range.
                    </div>
                  )}
                </div>
              </ChartCard>
            </div>
          </div>

          {/* ── Bottom Section: Recent Transactions & Check-ins ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Recent Payments */}
            <div className="lg:col-span-7">
              <ChartCard
                title="Recent Guest Payments"
                subtitle="Latest verified transaction receipts"
              >
                <div className="space-y-3">
                  {recentTransactions.length === 0 ? (
                    <p className="text-xs text-[#5C454B] py-6 text-center">
                      No recent payment transactions.
                    </p>
                  ) : (
                    recentTransactions.map((p) => (
                      <div
                        key={p._id}
                        className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF5F5] dark:bg-[#130005] border border-[#D9C3C3] dark:border-white/10 hover:border-[#900546]/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-xl bg-[#900546]/10 text-[#900546] dark:text-[#F968AC] flex items-center justify-center font-bold text-xs">
                            {p.method?.charAt(0).toUpperCase() || "P"}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[#130005] dark:text-white">
                              {p.paymentBy}
                            </p>
                            <p className="text-[10px] text-[#5C454B] dark:text-gray-400">
                              Ref: {p.refNumber} · {p.method || "Cash"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-serif text-sm font-bold text-[#900546] dark:text-[#F968AC]">
                            {formatCurrency(p.amount)}
                          </p>
                          <p className="text-[10px] text-[#5C454B] dark:text-gray-400">
                            {formatDate(p.date)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ChartCard>
            </div>

            {/* Recent Bookings */}
            <div className="lg:col-span-5">
              <ChartCard
                title="Recent Reservations"
                subtitle="Latest incoming & checked-in guests"
              >
                <div className="space-y-3">
                  {recentBookings.length === 0 ? (
                    <p className="text-xs text-[#5C454B] py-6 text-center">
                      No recent guest reservations.
                    </p>
                  ) : (
                    recentBookings.map((b) => (
                      <div
                        key={b._id}
                        className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FAF5F5] dark:bg-[#130005] border border-[#D9C3C3] dark:border-white/10"
                      >
                        <div>
                          <p className="text-xs font-bold text-[#130005] dark:text-white">
                            {b.clientName}
                          </p>
                          <p className="text-[10px] text-[#5C454B] dark:text-gray-400">
                            {b.room ? `${b.room.category}` : "Suite"} ·{" "}
                            {b.arrivalDate}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                            b.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-300"
                              : b.status === "occupied" || b.status === "active"
                                ? "bg-[#900546]/10 text-[#900546] border-[#900546]/30"
                                : "bg-amber-500/10 text-amber-700 border-amber-300"
                          }`}
                        >
                          {b.status.toUpperCase()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </ChartCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
