"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { bookingInterface } from "@/app/types/bookings.type";
import { roomInterface } from "@/app/types/room.type";
import { bookingData as mockBookingData } from "@/app/data/bookingData";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
  Legend,
  ComposedChart,
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
  TrendingUp,
  CalendarRange,
  BarChart3,
  Activity,
  AlertTriangle,
  CalendarCheck,
  LineChart as LineChartIcon,
  Sparkles,
  Flame,
  DoorOpen,
} from "lucide-react";
import { ForecastSuggestionsModal } from "./components/forecastSuggestionsModal";

// ─── Constants ───

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PEAK_COLORS = {
  peak: "#f59e0b",
  high: "#3b82f6",
  normal: "#10b981",
  low: "#6b7280",
};

const LINE_COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444"];

// ─── Helpers ───

function getMonthFromDate(dateStr: string): number {
  return new Date(dateStr).getMonth();
}

function getYearFromDate(dateStr: string): number {
  return new Date(dateStr).getFullYear();
}

function getPeakLabel(count: number, avg: number): string {
  const ratio = count / avg;
  if (ratio >= 1.4) return "Peak";
  if (ratio >= 1.1) return "High";
  if (ratio >= 0.7) return "Normal";
  return "Low";
}

function getPeakColor(label: string): string {
  switch (label) {
    case "Peak": return PEAK_COLORS.peak;
    case "High": return PEAK_COLORS.high;
    case "Normal": return PEAK_COLORS.normal;
    default: return PEAK_COLORS.low;
  }
}

const RISK_COLORS: Record<string, { text: string; bg: string; bar: string }> = {
  High: { text: "text-red-600", bg: "bg-red-500/10 border-red-500/20", bar: "bg-red-500" },
  Medium: { text: "text-amber-600", bg: "bg-amber-500/10 border-amber-500/20", bar: "bg-amber-500" },
  Low: { text: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-500/20", bar: "bg-emerald-500" },
};

// ─── Stat Card ───

function StatCard({
  label,
  value,
  icon,
  trend,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-4 transition-all hover:shadow-md hover:shadow-primary/5">
      <div
        className={`flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50 ${
          color ? `text-${color}` : "text-muted-foreground"
        }`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <p className={`text-2xl font-bold mt-0.5 ${color ? `text-${color}` : ""}`}>
          {value}
        </p>
        {trend && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{trend}</p>
        )}
      </div>
    </div>
  );
}

// ─── Chart Card ───

function ChartCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border bg-card overflow-hidden ${className ?? ""}`}>
      <div className="px-5 pt-5 pb-3 border-b border-border">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Custom Tooltip ───

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs flex items-center gap-2" style={{ color: entry.color }}>
          <span className="size-2 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
          {entry.name}: {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
        </p>
      ))}
    </div>
  );
}

// ─── Main Page ───

export default function Page() {
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [viewMode, setViewMode] = useState<string>("overview");

  // ── Fetch live bookings ──
  const { data: liveBookings, isLoading: liveLoading } = useQuery<bookingInterface[]>({
    queryKey: ["predictions-bookings"],
    queryFn: async () => {
      const res = await axiosInstance.get("/booking");
      return res.data;
    },
  });

  // ── Fetch room inventory (for sell-out / full-house capacity checks) ──
  const { data: rooms, isLoading: roomsLoading } = useQuery<roomInterface[]>({
    queryKey: ["predictions-rooms"],
    queryFn: async () => {
      const res = await axiosInstance.get("/room");
      return res.data;
    },
  });

  const totalRooms = rooms?.length ?? 0;

  // ── Merge mock + live data ──
  const allBookings = useMemo(() => {
    const combined = [...mockBookingData];
    if (liveBookings?.length) {
      combined.push(...liveBookings);
    }
    return combined;
  }, [liveBookings]);

  // ── Average length of stay (used for projected occupancy) ──
  const avgStayDays = useMemo(() => {
    const stays = allBookings.map((b) => {
      if (!b.departureDate) return 1;
      const arr = new Date(b.arrivalDate);
      const dep = new Date(b.departureDate);
      const days = Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(1, days);
    });
    return stays.length > 0 ? stays.reduce((s, d) => s + d, 0) / stays.length : 1;
  }, [allBookings]);

  // ── Filter by year ──
  const filteredBookings = useMemo(() => {
    if (selectedYear === "all") return allBookings;
    return allBookings.filter((b) => String(getYearFromDate(b.arrivalDate)) === selectedYear);
  }, [allBookings, selectedYear]);

  // ── Monthly booking counts ──
  const monthlyData = useMemo(() => {
    // Build data for all months across all available years
    const years = new Set<number>();
    allBookings.forEach((b) => years.add(getYearFromDate(b.arrivalDate)));

    const data: { month: string; monthIndex: number; [key: string]: any }[] = [];

    for (let m = 0; m < 12; m++) {
      const entry: any = {
        month: MONTHS_SHORT[m],
        monthIndex: m,
        total: 0,
      };

      years.forEach((year) => {
        const count = allBookings.filter(
          (b) => getYearFromDate(b.arrivalDate) === year && getMonthFromDate(b.arrivalDate) === m
        ).length;
        entry[String(year)] = count;
        entry.total += count;
      });

      data.push(entry);
    }

    return data;
  }, [allBookings]);

  // ── Average monthly bookings ──
  const avgMonthlyBookings = useMemo(() => {
    const total = monthlyData.reduce((sum, m) => sum + m.total, 0);
    return total / 12;
  }, [monthlyData]);

  // ── Peak season identification ──
  const peakSeasonData = useMemo(() => {
    return monthlyData.map((m) => {
      const label = getPeakLabel(m.total, avgMonthlyBookings);
      return {
        month: m.month,
        count: m.total,
        avg: Math.round(avgMonthlyBookings),
        label,
        color: getPeakColor(label),
      };
    });
  }, [monthlyData, avgMonthlyBookings]);

  // ── Forecast data (projected next 6 months) ──
  const forecastData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Calculate seasonal factors from past data
    const seasonalFactors: number[] = [];
    for (let m = 0; m < 12; m++) {
      const monthTotal = monthlyData[m]?.total ?? 0;
      seasonalFactors[m] = avgMonthlyBookings > 0 ? monthTotal / avgMonthlyBookings : 1;
    }

    const data: { label: string; historical?: number; forecast?: number; isForecast: boolean; monthIdx?: number; year?: number }[] = [];

    // Historical data for current year so far
    for (let m = 0; m <= currentMonth; m++) {
      const count = allBookings.filter(
        (b) => getYearFromDate(b.arrivalDate) === currentYear && getMonthFromDate(b.arrivalDate) === m
      ).length;
      data.push({
        label: MONTHS_SHORT[m],
        historical: count,
        isForecast: false,
        monthIdx: m,
        year: currentYear,
      });
    }

    // Forecast next 6 months
    for (let i = 1; i <= 6; i++) {
      const forecastMonth = (currentMonth + i) % 12;
      const forecastYear = currentMonth + i >= 12 ? currentYear + 1 : currentYear;

      // Base forecast on seasonal factor * average + slight growth trend
      const growthFactor = 1 + (i * 0.02); // 2% growth per month trend
      const historicalAvg = monthlyData[forecastMonth]?.total ?? avgMonthlyBookings;
      const yearsCount = new Set(allBookings.map((b) => getYearFromDate(b.arrivalDate))).size || 1;
      const forecast = Math.round((historicalAvg / yearsCount) * growthFactor);

      data.push({
        label: `${MONTHS_SHORT[forecastMonth]} ${forecastMonth <= currentMonth ? forecastYear : ""}`,
        forecast,
        isForecast: true,
        monthIdx: forecastMonth,
        year: forecastYear,
      });
    }

    return data;
  }, [monthlyData, allBookings, avgMonthlyBookings]);

  // ── Full-house / sell-out risk (projected occupancy vs total rooms) ──
  const sellOutRisk = useMemo(() => {
    if (!totalRooms) return [];

    return forecastData
      .filter((d) => !!d.isForecast && d.monthIdx !== undefined && d.year !== undefined)
      .map((d) => {
        const daysInMonth = new Date(d.year!, d.monthIdx! + 1, 0).getDate();
        const capacity = totalRooms * daysInMonth;
        const projectedNights = (d.forecast ?? 0) * avgStayDays;
        const pct = capacity > 0 ? Math.min(100, (projectedNights / capacity) * 100) : 0;
        const risk: "Low" | "Medium" | "High" = pct >= 85 ? "High" : pct >= 60 ? "Medium" : "Low";

        return { label: d.label, bookings: d.forecast ?? 0, pct, risk };
      });
  }, [forecastData, totalRooms, avgStayDays]);

  const worstSellOutMonth = sellOutRisk.length > 0
    ? sellOutRisk.reduce((a, b) => (b.pct > a.pct ? b : a))
    : null;

  // ── Year-over-year data ──
  const yearsInData = useMemo(() => {
    const years = new Set<number>();
    allBookings.forEach((b) => years.add(getYearFromDate(b.arrivalDate)));
    return Array.from(years).sort();
  }, [allBookings]);

  // ── Peak seasons list ──
  const peakMonths = useMemo(() => {
    return peakSeasonData
      .filter((m) => m.label === "Peak")
      .sort((a, b) => b.count - a.count);
  }, [peakSeasonData]);

  // ── Stats ──
  const stats = useMemo(() => {
    const total = allBookings.length;
    const avgPerMonth = Math.round(avgMonthlyBookings);
    const peakMonthsCount = peakMonths.length;
    const peakRatio = avgMonthlyBookings > 0
      ? ((peakMonths.reduce((s, m) => s + m.count, 0) / (avgMonthlyBookings * 12)) * 100).toFixed(1)
      : "0";

    return { total, avgPerMonth, peakMonthsCount, peakRatio };
  }, [allBookings, avgMonthlyBookings, peakMonths]);

  // ── Filtered chart data (based on selected year) ──
  const chartMonthlyData = useMemo(() => {
    if (selectedYear === "all") {
      return monthlyData.map((m) => ({
        month: m.month,
        bookings: m.total,
      }));
    }
    const year = Number(selectedYear);
    return monthlyData.map((m) => ({
      month: m.month,
      bookings: m[String(year)] ?? 0,
    }));
  }, [monthlyData, selectedYear]);

  // ── Year-over-year chart data ──
  const yoyChartData = useMemo(() => {
    return monthlyData.map((m) => {
      const entry: any = { month: m.month };
      yearsInData.forEach((y) => {
        entry[String(y)] = m[String(y)] ?? 0;
      });
      return entry;
    });
  }, [monthlyData, yearsInData]);

  const isLoading = liveLoading || roomsLoading;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3 py-1 text-xs font-semibold text-[#900546] dark:text-[#F968AC] mb-2">
            AI Demand Forecast
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#130005] dark:text-white">
            Peak Season & Occupancy Predictions
          </h1>
          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5">
            Machine intelligence modeling for seasonal demand surges, rate optimization, and resource scaling.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#5C454B] dark:text-gray-400 font-semibold">Period:</span>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[140px] h-10 rounded-xl bg-white dark:bg-[#1A0E13] border-[#D9C3C3] dark:border-white/10 text-xs font-semibold text-[#130005] dark:text-white">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13]">
              <SelectItem value="all">All Years</SelectItem>
              {yearsInData.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-xs text-muted-foreground font-medium ml-2">View:</span>
          <Select value={viewMode} onValueChange={setViewMode}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select view" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Overview</SelectItem>
              <SelectItem value="forecast">Forecast</SelectItem>
              <SelectItem value="comparison">Year Comparison</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Loading State ── */}
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[100px] rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-[320px] rounded-xl" />
            <Skeleton className="h-[320px] rounded-xl" />
          </div>
        </div>
      ) : (
        <>
          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <StatCard
              label="Total Historical Bookings"
              value={stats.total.toLocaleString()}
              icon={<CalendarCheck className="size-5" />}
              trend={`Across ${yearsInData.length} year${yearsInData.length > 1 ? "s" : ""} of data`}
              color="blue-600"
            />
            <StatCard
              label="Avg Monthly Bookings"
              value={stats.avgPerMonth}
              icon={<BarChart3 className="size-5" />}
              trend={`Baseline for peak comparison`}
              color="emerald-600"
            />
            <StatCard
              label="Peak Months Identified"
              value={stats.peakMonthsCount}
              icon={<AlertTriangle className="size-5" />}
              trend={`${stats.peakRatio}% of bookings during peak seasons`}
              color="amber-600"
            />
            <StatCard
              label="Forecast Trend"
              value={forecastData.filter((d) => d.isForecast).reduce((s, d) => s + (d.forecast ?? 0), 0)}
              icon={<TrendingUp className="size-5" />}
              trend={`Next 6 months projected bookings`}
              color="violet-600"
            />
            <StatCard
              label="Full-House Risk"
              value={worstSellOutMonth ? worstSellOutMonth.label : "—"}
              icon={<Flame className="size-5" />}
              trend={
                worstSellOutMonth
                  ? `${worstSellOutMonth.risk} risk · ${worstSellOutMonth.pct.toFixed(0)}% projected occupancy`
                  : "Insufficient inventory data"
              }
              color={worstSellOutMonth?.risk === "High" ? "red-600" : worstSellOutMonth?.risk === "Medium" ? "amber-600" : "emerald-600"}
            />
          </div>

          {/* ── View: Overview (default) ── */}
          {viewMode === "overview" && (
            <>
              {/* Monthly Booking Trends */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard
                  title="Monthly Booking Trends"
                  subtitle={selectedYear === "all" ? "Combined booking distribution across all years" : `Booking distribution for ${selectedYear}`}
                >
                  <div style={{ width: "100%", height: 300 }}>
                    {chartMonthlyData.some((d) => d.bookings > 0) ? (
                      <ResponsiveContainer width="100%" height={300} initialDimension={{ width: 600, height: 300 }}>
                        <AreaChart data={chartMonthlyData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="bookingGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                          <Tooltip content={<ChartTooltip />} />
                          <Area
                            type="monotone"
                            dataKey="bookings"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            fill="url(#bookingGradient)"
                            dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
                            activeDot={{ r: 5, fill: "#3b82f6", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-muted-foreground" style={{ height: 300 }}>
                        <BarChart3 className="size-8 mb-2 opacity-40" />
                        <p className="text-sm font-medium">No booking data</p>
                        <p className="text-xs mt-0.5">No historical data for this period.</p>
                      </div>
                    )}
                  </div>
                </ChartCard>

                {/* Peak Season Bar Chart */}
                <ChartCard
                  title="Peak Season Identification"
                  subtitle="Months colored by booking intensity vs average"
                >
                  <div style={{ width: "100%", height: 300 }}>
                    {peakSeasonData.some((d) => d.count > 0) ? (
                      <ResponsiveContainer width="100%" height={300} initialDimension={{ width: 600, height: 300 }}>
                        <BarChart data={peakSeasonData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                          <Tooltip
                            content={({ active, payload, label }: any) => {
                              if (!active || !payload?.length) return null;
                              const data = payload[0].payload;
                              return (
                                <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
                                  <p className="font-medium text-foreground">{label}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Bookings: <span className="font-semibold text-foreground">{data.count}</span>
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Status: <span className="font-semibold" style={{ color: data.color }}>{data.label}</span>
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    vs Avg: {data.avg} ({data.count > 0 ? `${Math.round((data.count / data.avg) * 100)}%` : "N/A"})
                                  </p>
                                </div>
                              );
                            }}
                          />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={36}>
                            {peakSeasonData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Bar>
                          {/* Reference line for average */}
                          <CartesianGrid
                            horizontalPoints={[avgMonthlyBookings]}
                            stroke="#f59e0b"
                            strokeDasharray="6 3"
                            strokeWidth={1.5}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-muted-foreground" style={{ height: 300 }}>
                        <Activity className="size-8 mb-2 opacity-40" />
                        <p className="text-sm font-medium">No data available</p>
                        <p className="text-xs mt-0.5">Peak season analysis requires historical data.</p>
                      </div>
                    )}
                  </div>
                </ChartCard>
              </div>

              {/* Peak Season Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ChartCard
                  title="Peak Season Summary"
                  subtitle="Months identified as peak periods"
                  className="lg:col-span-2"
                >
                  {peakMonths.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Month</th>
                            <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Bookings</th>
                            <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">vs Average</th>
                            <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Intensity</th>
                            <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {peakMonths.map((m) => (
                            <tr key={m.month} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                              <td className="py-2.5 px-2 font-medium">{m.month}</td>
                              <td className="py-2.5 px-2 text-right font-mono">{m.count}</td>
                              <td className="py-2.5 px-2 text-right font-mono">
                                {m.avg > 0 ? `${Math.round((m.count / m.avg) * 100)}%` : "N/A"}
                              </td>
                              <td className="py-2.5 px-2 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="h-1.5 rounded-full bg-muted w-16 overflow-hidden">
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${Math.min(100, Math.round((m.count / (peakMonths[0]?.count ?? 1)) * 100))}%`,
                                        backgroundColor: m.color,
                                      }}
                                    />
                                  </div>
                                  <span className="text-xs font-mono">{m.count}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-2 text-right">
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                                  style={{
                                    backgroundColor: `${m.color}20`,
                                    color: m.color,
                                    border: `1px solid ${m.color}40`,
                                  }}
                                >
                                  {m.label}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <Activity className="size-8 mb-2 opacity-40" />
                      <p className="text-sm font-medium">No peak seasons detected</p>
                      <p className="text-xs mt-0.5">Add more booking data to identify patterns.</p>
                    </div>
                  )}
                </ChartCard>

                {/* Legend / Info Card */}
                <ChartCard
                  title="Intensity Guide"
                  subtitle="How peak seasons are classified"
                >
                  <div className="space-y-4 py-2">
                    <div className="flex items-start gap-3">
                      <div className="size-3 rounded-sm mt-0.5 shrink-0" style={{ backgroundColor: PEAK_COLORS.peak }} />
                      <div>
                        <p className="text-sm font-medium">Peak Season</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {">"} 40% above average. Highest booking concentration.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="size-3 rounded-sm mt-0.5 shrink-0" style={{ backgroundColor: PEAK_COLORS.high }} />
                      <div>
                        <p className="text-sm font-medium">High Season</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          10-40% above average. Elevated booking activity.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="size-3 rounded-sm mt-0.5 shrink-0" style={{ backgroundColor: PEAK_COLORS.normal }} />
                      <div>
                        <p className="text-sm font-medium">Normal Season</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          30% below to 10% above average. Typical activity.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="size-3 rounded-sm mt-0.5 shrink-0" style={{ backgroundColor: PEAK_COLORS.low }} />
                      <div>
                        <p className="text-sm font-medium">Low Season</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          More than 30% below average. Slowest periods.
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-border pt-4 mt-4">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Average baseline:</span>{" "}
                        {stats.avgPerMonth} bookings/month across {yearsInData.length} year{yearsInData.length > 1 ? "s" : ""}.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-semibold text-foreground">Peak concentration:</span>{" "}
                        {stats.peakRatio}% of all bookings occur during peak months.
                      </p>
                    </div>
                  </div>
                </ChartCard>
              </div>
            </>
          )}

          {/* ── View: Forecast ── */}
          {viewMode === "forecast" && (
            <>
              {/* Strategic Suggestions Action Banner */}
              <div className="flex items-center justify-between flex-wrap gap-4 p-4 rounded-xl border border-violet-500/20 bg-gradient-to-r from-violet-500/10 via-indigo-500/5 to-card shadow-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-violet-600 dark:text-violet-400" />
                    <h3 className="text-sm font-bold text-foreground">
                      AI Forecast Decision Support & Strategy
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Analyze the projected occupancy surge & dip periods to receive strategic pricing, staffing, and marketing recommendations.
                  </p>
                </div>
                <ForecastSuggestionsModal
                  forecastData={forecastData}
                  avgMonthlyBookings={avgMonthlyBookings}
                  allBookingsCount={allBookings.length}
                  sellOutRisk={sellOutRisk}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard
                  title="Occupancy Forecast"
                  subtitle="Historical trends with 6-month projection"
                  className="lg:col-span-2"
                >
                  <div style={{ width: "100%", height: 350 }}>
                    {forecastData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={350} initialDimension={{ width: 700, height: 350 }}>
                        <ComposedChart data={forecastData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                          <Tooltip content={<ChartTooltip />} />
                          <Legend
                            verticalAlign="top"
                            height={30}
                            formatter={(value) => (
                              <span className="text-xs text-muted-foreground">{value}</span>
                            )}
                          />
                          <Bar
                            dataKey="historical"
                            name="Historical"
                            fill="#3b82f6"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={32}
                          />
                          <Bar
                            dataKey="forecast"
                            name="Forecast"
                            fill="#8b5cf6"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={32}
                            opacity={0.8}
                          />
                          <Line
                            type="monotone"
                            dataKey="forecast"
                            stroke="#8b5cf6"
                            strokeWidth={2}
                            strokeDasharray="6 3"
                            dot={{ r: 4, fill: "#8b5cf6", strokeWidth: 0 }}
                            connectNulls
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-muted-foreground" style={{ height: 350 }}>
                        <TrendingUp className="size-8 mb-2 opacity-40" />
                        <p className="text-sm font-medium">No forecast data</p>
                        <p className="text-xs mt-0.5">Insufficient data to generate forecast.</p>
                      </div>
                    )}
                  </div>
                </ChartCard>
              </div>

              {/* Forecast Summary + Sell-Out Risk */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {forecastData.filter((d) => d.isForecast).slice(0, 4).map((d, i) => {
                  const risk = sellOutRisk[i];
                  const riskColor = risk ? RISK_COLORS[risk.risk] : null;
                  return (
                    <div key={i} className="rounded-xl border border-border bg-card p-4 text-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">{d.label}</p>
                      <p className="text-2xl font-bold mt-1 text-violet-500">{d.forecast}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">projected bookings</p>
                      {risk && (
                        <div className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${riskColor?.bg} ${riskColor?.text}`}>
                          <span className={`size-1.5 rounded-full ${riskColor?.bar}`} />
                          {risk.risk} · {risk.pct.toFixed(0)}% occ
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Full-House / Sell-Out Projection */}
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <DoorOpen className="size-4 text-violet-600" />
                      Full-House / Sell-Out Projection
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Projected occupied room-nights vs {totalRooms} rooms · avg stay {avgStayDays > 0 ? avgStayDays.toFixed(1) : "—"} nights
                    </p>
                  </div>
                  {worstSellOutMonth && (
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${RISK_COLORS[worstSellOutMonth.risk].bg} ${RISK_COLORS[worstSellOutMonth.risk].text}`}>
                      <AlertTriangle className="size-3" />
                      Peak: {worstSellOutMonth.label}
                    </span>
                  )}
                </div>

                {sellOutRisk.length > 0 ? (
                  <div className="space-y-3.5">
                    {sellOutRisk.map((m) => {
                      const riskColor = RISK_COLORS[m.risk];
                      return (
                        <div key={m.label}>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="font-semibold text-foreground">{m.label}</span>
                            <span className={`font-bold ${riskColor.text}`}>
                              {m.risk} risk · {m.pct.toFixed(0)}% occupancy
                            </span>
                          </div>
                          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${riskColor.bar}`}
                              style={{ width: `${Math.min(100, m.pct)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {m.bookings} projected bookings · {totalRooms} rooms → ~{(m.bookings * avgStayDays).toFixed(0)} occupied room-nights of {totalRooms * 30} monthly capacity
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Room inventory data is required to project sell-out risk.
                  </p>
                )}
              </div>

              {/* Forecast Note */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Forecast Disclaimer</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Projections are based on historical booking patterns with a 2% monthly growth assumption.
                      Actual occupancy may vary due to external factors such as holidays, events, economic conditions,
                      and seasonal changes. This forecast should be used as a planning reference only.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── View: Year Comparison ── */}
          {viewMode === "comparison" && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard
                  title="Year-over-Year Comparison"
                  subtitle="Monthly booking counts side by side"
                  className="lg:col-span-2"
                >
                  <div style={{ width: "100%", height: 350 }}>
                    {yearsInData.length > 1 ? (
                      <ResponsiveContainer width="100%" height={350} initialDimension={{ width: 700, height: 350 }}>
                        <BarChart data={yoyChartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                          <Tooltip content={<ChartTooltip />} />
                          <Legend
                            verticalAlign="top"
                            height={30}
                            formatter={(value) => (
                              <span className="text-xs text-muted-foreground">{value}</span>
                            )}
                          />
                          {yearsInData.map((year, i) => (
                            <Bar
                              key={year}
                              dataKey={String(year)}
                              name={String(year)}
                              fill={LINE_COLORS[i % LINE_COLORS.length]}
                              radius={[4, 4, 0, 0]}
                              maxBarSize={24}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-muted-foreground" style={{ height: 350 }}>
                        <CalendarRange className="size-8 mb-2 opacity-40" />
                        <p className="text-sm font-medium">Need multiple years</p>
                        <p className="text-xs mt-0.5">Year-over-year comparison requires data from at least 2 years.</p>
                      </div>
                    )}
                  </div>
                </ChartCard>
              </div>

              {/* Year-over-year stats */}
              {yearsInData.length > 1 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {yearsInData.map((year) => {
                    const yearlyTotal = monthlyData.reduce(
                      (sum, m) => sum + ((m[String(year)] as number) ?? 0),
                      0
                    );
                    const yearlyAvg = Math.round(yearlyTotal / 12);

                    // Calculate growth vs prior year
                    const yearIndex = yearsInData.indexOf(year);
                    let growth: string | null = null;
                    if (yearIndex > 0) {
                      const priorYear = yearsInData[yearIndex - 1];
                      const priorTotal = monthlyData.reduce(
                        (sum, m) => sum + ((m[String(priorYear)] as number) ?? 0),
                        0
                      );
                      if (priorTotal > 0) {
                        const g = ((yearlyTotal - priorTotal) / priorTotal) * 100;
                        growth = `${g >= 0 ? "+" : ""}${g.toFixed(1)}% vs ${priorYear}`;
                      }
                    }

                    return (
                      <div key={year} className="rounded-xl border border-border bg-card p-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">{year}</p>
                        <p className="text-2xl font-bold mt-1">{yearlyTotal}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {yearlyAvg} avg/month
                        </p>
                        {growth && (
                          <p className={`text-[11px] mt-1 ${growth.startsWith("+") ? "text-emerald-500" : "text-red-500"}`}>
                            {growth}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Bottom: All Seasons Table ── */}
          <ChartCard
            title="Complete Monthly Analysis"
            subtitle="All months with peak classification"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Month</th>
                    {yearsInData.map((year) => (
                      <th key={year} className="text-right py-2 px-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">{year}</th>
                    ))}
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Total</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((m) => {
                    const peakInfo = peakSeasonData.find((p) => p.month === m.month);
                    return (
                      <tr key={m.month} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-2 font-medium">{m.month}</td>
                        {yearsInData.map((year) => (
                          <td key={year} className="py-2 px-2 text-right font-mono text-xs">
                            {m[String(year)] ?? 0}
                          </td>
                        ))}
                        <td className="py-2 px-2 text-right font-mono font-semibold">{m.total}</td>
                        <td className="py-2 px-2 text-right">
                          {peakInfo && (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                              style={{
                                backgroundColor: `${peakInfo.color}20`,
                                color: peakInfo.color,
                                border: `1px solid ${peakInfo.color}40`,
                              }}
                            >
                              {peakInfo.label}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </>
      )}
    </div>
  );
}
