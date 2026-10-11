"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { hotelDateKey } from "@/app/utils/hotelTime";
import { peso } from "@/app/utils/addOnPricing";
import { forecastFilters, forecastResult } from "@/app/types/forecast.type";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Activity,
  AlertTriangle,
  BedDouble,
  CalendarRange,
  Info,
  Percent,
  TrendingDown,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";
import { ForecastSuggestionsModal } from "./components/forecastSuggestionsModal";

const CONFIDENCE_STYLES: Record<string, { label: string; cls: string }> = {
  insufficient: { label: "Insufficient data", cls: "border-rose-500/30 bg-rose-500/10 text-rose-700" },
  low: { label: "Low confidence", cls: "border-amber-500/30 bg-amber-500/10 text-amber-700" },
  medium: { label: "Medium confidence", cls: "border-blue-500/30 bg-blue-500/10 text-blue-700" },
  high: { label: "High confidence", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" },
};

const shiftMonth = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

function StatCard({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50 text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-xl font-bold mt-0.5 tabular-nums">{value}</p>
        {hint ? <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p> : null}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 pt-5 pb-3 border-b border-border">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

const signed = (value: number | null, suffix = "%") =>
  value === null ? "new activity" : `${value > 0 ? "+" : ""}${value}${suffix}`;

export default function Page() {
  const currentMonth = hotelDateKey(new Date()).slice(0, 7);
  const [filters, setFilters] = useState<forecastFilters>({
    from: shiftMonth(currentMonth, -11),
    to: currentMonth,
    horizon: 6,
    roomCategory: "all",
  });
  const rangeError =
    !filters.from || !filters.to
      ? "Choose both months."
      : filters.from > filters.to
        ? "The start month must be on or before the end month."
        : "";

  const { data, isLoading, isError, error, isFetching, refetch } = useQuery<forecastResult>({
    queryKey: ["forecast", filters],
    enabled: !rangeError,
    placeholderData: keepPreviousData,
    queryFn: async () => (await axiosInstance.get("/reports/forecast", { params: filters })).data,
  });

  const historyChart = useMemo(
    () =>
      (data?.monthly || [])
        .filter((m) => !m.isFuture)
        .map((m) => ({
          label: m.isPartial ? `${m.label}*` : m.label,
          Bookings: m.bookings,
          Canceled: m.canceled,
          "Occupancy %": m.occupancyRate,
          "Booked revenue": m.bookedRevenue,
          "Collected payments": m.collectedRevenue ?? undefined,
        })),
    [data],
  );

  const forecastChart = useMemo(() => {
    if (!data) return [];
    const history = data.monthly
      .filter((m) => !m.isFuture && !m.isPartial)
      .slice(-6)
      .map((m) => ({ label: m.label, Actual: m.bookings }));
    const future = data.forecast.months.map((m) => ({
      label: m.label,
      Forecast: m.bookings,
      Range: [m.low, m.high] as [number, number],
    }));
    return [...history, ...future];
  }, [data]);

  const confidence = data ? CONFIDENCE_STYLES[data.dataQuality.confidence] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3 py-1 text-xs font-semibold text-[#900546] dark:text-[#F968AC] mb-2">
            Demand Forecast
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#130005] dark:text-white">
            Occupancy & Demand Forecast
          </h1>
          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5 max-w-2xl">
            All figures are calculated from this hotel&apos;s reservations, rooms and payment records. The forecast is a statistical projection; AI is only used to interpret these numbers.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:min-w-[640px]">
          <div className="space-y-1">
            <Label htmlFor="fc-from" className="text-[11px] text-muted-foreground">From</Label>
            <Input id="fc-from" type="month" value={filters.from} max={filters.to} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fc-to" className="text-[11px] text-muted-foreground">To</Label>
            <Input id="fc-to" type="month" value={filters.to} min={filters.from} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Forecast</Label>
            <Select value={String(filters.horizon)} onValueChange={(v) => setFilters((f) => ({ ...f, horizon: Number(v) }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Next 3 months</SelectItem>
                <SelectItem value="6">Next 6 months</SelectItem>
                <SelectItem value="12">Next 12 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Room type</Label>
            <Select value={filters.roomCategory} onValueChange={(v) => setFilters((f) => ({ ...f, roomCategory: v }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All room types</SelectItem>
                {(data?.filters.categories || []).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {rangeError && <p className="text-sm text-destructive">{rangeError}</p>}

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[84px] rounded-xl" />)}
          </div>
          <Skeleton className="h-[320px] rounded-xl" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 py-12 text-center">
          <AlertTriangle className="size-7 text-destructive" />
          <p className="text-sm text-destructive">{getApiErrorMessage(error, "Failed to load forecast data.")}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
        </div>
      ) : data ? (
        <div className={`space-y-6 ${isFetching ? "opacity-70" : ""}`}>
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                {confidence && <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${confidence.cls}`}>{confidence.label}</span>}
                <span className="text-xs text-muted-foreground">
                  {data.dataQuality.totalBookings} booking(s) · {data.dataQuality.completeMonths} complete month(s) · {data.activeRooms} active room(s)
                </span>
              </div>
              {data.dataQuality.notes.map((note) => (
                <p key={note} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  {note}
                </p>
              ))}
            </div>
            <ForecastSuggestionsModal filters={filters} confidence={data.dataQuality.confidence} />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Bookings" value={data.totals.bookings.toLocaleString()} hint={data.trend ? `${signed(data.trend.bookingsChangePct)} last 3 mo.` : undefined} icon={<CalendarRange className="size-5" />} />
            <StatCard label="Occupancy" value={`${data.totals.occupancyRate}%`} hint={data.trend ? `${signed(data.trend.occupancyChangePts, " pts")} last 3 mo.` : `${data.totals.roomNights.toLocaleString()} room-nights`} icon={<Percent className="size-5" />} />
            <StatCard label="Booked revenue" value={peso(data.totals.bookedRevenue)} hint={data.trend ? `${signed(data.trend.revenueChangePct)} last 3 mo.` : undefined} icon={<Wallet className="size-5" />} />
            <StatCard label="Collected payments" value={data.totals.collectedRevenue === null ? "—" : peso(data.totals.collectedRevenue)} hint={data.totals.refunds ? `${peso(data.totals.refunds)} refunded` : undefined} icon={<Wallet className="size-5" />} />
            <StatCard label="Cancellation rate" value={`${data.totals.cancellationRate}%`} hint={`${data.totals.noShowRate}% no-shows`} icon={<XCircle className="size-5" />} />
            <StatCard label="Avg. daily rate" value={peso(data.totals.adr)} hint="Booked revenue per room-night" icon={<Activity className="size-5" />} />
            <StatCard label="Avg. stay" value={`${data.totals.avgLengthOfStay} nights`} icon={<BedDouble className="size-5" />} />
            <StatCard label="Avg. lead time" value={`${data.totals.avgLeadTimeDays} days`} hint="Booking to arrival" icon={data.trend && (data.trend.bookingsChangePct ?? 0) < 0 ? <TrendingDown className="size-5" /> : <TrendingUp className="size-5" />} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title="Bookings & occupancy by month" subtitle="By arrival month · * current month in progress">
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={historyChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" unit="%" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="left" dataKey="Bookings" fill="#900546" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="left" dataKey="Canceled" fill="#F968AC" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" dataKey="Occupancy %" stroke="#618685" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Revenue by month" subtitle={data.filters.roomCategory === "all" ? "Booked (billed) vs collected payments" : "Booked (billed) revenue for this room type"}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={historyChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => peso(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Booked revenue" fill="#900546" radius={[4, 4, 0, 0]} />
                  {data.filters.roomCategory === "all" && <Bar dataKey="Collected payments" fill="#618685" radius={[4, 4, 0, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <ChartCard
            title={`Forecast: next ${data.horizon} months`}
            subtitle={data.forecast.months.length ? `${data.forecast.method}. Shaded band = likely range.` : "Not enough history to forecast."}
          >
            {data.forecast.months.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                A forecast needs at least 10 bookings across 3 months in the selected range.
              </p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={forecastChart}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area dataKey="Range" stroke="none" fill="#F968AC" fillOpacity={0.2} name="Likely range" />
                    <Line dataKey="Actual" stroke="#900546" strokeWidth={2} />
                    <Line dataKey="Forecast" stroke="#618685" strokeWidth={2} strokeDasharray="6 4" />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-1 pr-3 font-medium">Month</th>
                        <th className="py-1 pr-3 font-medium">Bookings</th>
                        <th className="py-1 pr-3 font-medium">Range</th>
                        <th className="py-1 font-medium">Projected occupancy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.forecast.months.map((m) => (
                        <tr key={m.month} className="border-t border-border">
                          <td className="py-1.5 pr-3">{m.label}</td>
                          <td className="py-1.5 pr-3 tabular-nums">{m.bookings}</td>
                          <td className="py-1.5 pr-3 tabular-nums">{m.low}–{m.high}</td>
                          <td className="py-1.5 tabular-nums">{m.occupancyRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </ChartCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title="Room type performance" subtitle="Selected period">
              {data.roomPerformance.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No room data.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-1 pr-3 font-medium">Room type</th>
                        <th className="py-1 pr-3 font-medium">Rooms</th>
                        <th className="py-1 pr-3 font-medium">Bookings</th>
                        <th className="py-1 pr-3 font-medium">Occupancy</th>
                        <th className="py-1 pr-3 font-medium">Revenue</th>
                        <th className="py-1 font-medium">Cancel %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.roomPerformance.map((r) => (
                        <tr key={r.category} className="border-t border-border">
                          <td className="py-1.5 pr-3 font-medium">{r.category}</td>
                          <td className="py-1.5 pr-3 tabular-nums">{r.rooms}</td>
                          <td className="py-1.5 pr-3 tabular-nums">{r.bookings} ({r.bookingShare}%)</td>
                          <td className="py-1.5 pr-3 tabular-nums">{r.occupancyRate}%</td>
                          <td className="py-1.5 pr-3 tabular-nums">{peso(r.bookedRevenue)}</td>
                          <td className="py-1.5 tabular-nums">{r.cancellationRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ChartCard>
            <ChartCard title="Seasonality" subtitle="Average bookings per calendar month (index 1.0 = average month)">
              {data.seasonality.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Not enough complete months.</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.seasonality}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="indexVsAverage" name="Index vs average" fill="#618685" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </div>
      ) : null}
    </div>
  );
}
