"use client";

import { useState, useMemo, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sparkles,
  DollarSign,
  Users,
  Megaphone,
  Package,
  Copy,
  Check,
  Lightbulb,
  Loader2,
  RefreshCw,
  Bot,
  AlertCircle,
} from "lucide-react";
import { successAlert, errorAlert } from "@/app/utils/alert";

interface ForecastItem {
  label: string;
  historical?: number;
  forecast?: number;
  isForecast: boolean;
}

interface SellOutRiskItem {
  label: string;
  bookings: number;
  pct: number;
  risk: "Low" | "Medium" | "High";
}

interface Props {
  forecastData: ForecastItem[];
  avgMonthlyBookings: number;
  allBookingsCount: number;
  sellOutRisk?: SellOutRiskItem[];
}

interface AiResponse {
  summary?: string;
  pricing: string[];
  staffing: string[];
  marketing: string[];
  inventory: string[];
}

export function ForecastSuggestionsModal({
  forecastData,
  avgMonthlyBookings,
  allBookingsCount,
  sellOutRisk = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [aiResult, setAiResult] = useState<AiResponse | null>(null);

  // Computed metrics
  const analysis = useMemo(() => {
    const upcoming = forecastData.filter((d) => d.isForecast && d.forecast !== undefined);
    const baseline = Math.max(1, Math.round(avgMonthlyBookings));

    if (upcoming.length === 0) {
      return {
        hasData: false,
        peakMonths: [],
        slowMonths: [],
        totalForecast: 0,
        highestMonth: null,
        lowestMonth: null,
        baseline,
      };
    }

    const peakMonths = upcoming.filter((d) => (d.forecast ?? 0) >= baseline * 1.15);
    const slowMonths = upcoming.filter((d) => (d.forecast ?? 0) < baseline * 0.85);

    const totalForecast = upcoming.reduce((s, d) => s + (d.forecast ?? 0), 0);

    const sorted = [...upcoming].sort((a, b) => (b.forecast ?? 0) - (a.forecast ?? 0));
    const highestMonth = sorted[0];
    const lowestMonth = sorted[sorted.length - 1];

    return {
      hasData: true,
      peakMonths,
      slowMonths,
      totalForecast,
      highestMonth,
      lowestMonth,
      baseline,
    };
  }, [forecastData, avgMonthlyBookings]);

  // AI Generation Mutation
  const generateAiSuggestionsMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        forecastData: forecastData.filter((d) => d.isForecast),
        baseline: analysis.baseline,
        peakMonths: analysis.peakMonths,
        slowMonths: analysis.slowMonths,
        totalForecast: analysis.totalForecast,
        projectedOccupancy: sellOutRisk,
      };
      const res = await axiosInstance.post("/system/ai-forecast", payload);
      return res.data as AiResponse;
    },
    onSuccess: (data) => {
      setAiResult(data);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      const msg = err.response?.data?.message || "Failed to generate AI recommendations.";
      errorAlert(msg);
    },
  });

  // Automatically trigger AI analysis when modal opens (if not already fetched)
  useEffect(() => {
    if (open && !aiResult && !generateAiSuggestionsMutation.isPending) {
      generateAiSuggestionsMutation.mutate();
    }
  }, [open]);

  const worstSellOut = sellOutRisk.length > 0
    ? sellOutRisk.reduce((a, b) => (b.pct > a.pct ? b : a))
    : null;

  // Copy full suggestion report to clipboard
  const handleCopyPlan = () => {
    if (!aiResult) return;

    const report = `
🤖 GEMINI AI HOTEL OCCUPANCY STRATEGY & ACTION PLAN
==================================================
Executive Summary:
${aiResult.summary || "Actionable forecast recommendations for the upcoming 6-month period."}

Key Metrics:
• Monthly Baseline: ${analysis.baseline} bookings/mo
• 6-Month Projected Volume: ${analysis.totalForecast} bookings
• Peak Surges: ${analysis.peakMonths.map((m) => m.label).join(", ") || "None"}
• Low Occupancy: ${analysis.slowMonths.map((m) => m.label).join(", ") || "None"}
• Full-House Risk: ${worstSellOut ? `${worstSellOut.label} (${worstSellOut.risk}, ${worstSellOut.pct.toFixed(0)}% occ)` : "Insufficient data"}

1. 💰 DYNAMIC PRICING STRATEGY
${aiResult.pricing.map((p, i) => `   ${i + 1}. ${p}`).join("\n")}

2. 👥 STAFFING & OPERATIONS PLAN
${aiResult.staffing.map((s, i) => `   ${i + 1}. ${s}`).join("\n")}

3. 📢 MARKETING & OUTREACH CAMPAIGN
${aiResult.marketing.map((m, i) => `   ${i + 1}. ${m}`).join("\n")}

4. 📦 INVENTORY & RESOURCE PLANNING
${aiResult.inventory.map((inv, i) => `   ${i + 1}. ${inv}`).join("\n")}
==================================================
Generated on: ${new Date().toLocaleDateString()} via Google Gemini AI
    `.trim();

    navigator.clipboard.writeText(report);
    setCopied(true);
    successAlert("AI strategic action plan copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          onClick={() => setOpen(true)}
          className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-md shadow-violet-500/20"
        >
          <Sparkles className="size-4 animate-pulse" />
          Analyze & Suggest Actions
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[740px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-500/20 shadow-xs">
                <Bot className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base flex items-center gap-2">
                  AI Forecast Strategic Recommendations
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                    Powered by Gemini AI
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Automated revenue management, staffing, marketing, and inventory strategy based on 6-month projected demand.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* ── Key Forecast Metrics Banner ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 text-center">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground">Projected Volume</span>
            <p className="text-xl font-bold text-violet-600 mt-0.5">{analysis.totalForecast}</p>
            <span className="text-[10px] text-muted-foreground">Next 6 Months</span>
          </div>

          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground">Highest Surge</span>
            <p className="text-xl font-bold text-emerald-600 mt-0.5">
              {analysis.highestMonth ? `${analysis.highestMonth.forecast} bks` : "N/A"}
            </p>
            <span className="text-[10px] text-muted-foreground truncate block">
              {analysis.highestMonth ? analysis.highestMonth.label : "N/A"}
            </span>
          </div>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-center">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground">Lowest Demand</span>
            <p className="text-xl font-bold text-amber-600 mt-0.5">
              {analysis.lowestMonth ? `${analysis.lowestMonth.forecast} bks` : "N/A"}
            </p>
            <span className="text-[10px] text-muted-foreground truncate block">
              {analysis.lowestMonth ? analysis.lowestMonth.label : "N/A"}
            </span>
          </div>

          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-center">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground">Monthly Baseline</span>
            <p className="text-xl font-bold text-blue-600 mt-0.5">{analysis.baseline || 0}</p>
            <span className="text-[10px] text-muted-foreground">Avg Bookings/mo</span>
          </div>
        </div>

        {/* ── Full-House Risk Note ── */}
        {worstSellOut && (
          <div
            className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-xs font-semibold ${
              worstSellOut.risk === "High"
                ? "border-red-500/30 bg-red-500/10 text-red-600"
                : worstSellOut.risk === "Medium"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-600"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
            }`}
          >
            <span>Full-House Prediction</span>
            <span>
              {worstSellOut.label} · {worstSellOut.risk} risk · {worstSellOut.pct.toFixed(0)}% projected occupancy
            </span>
          </div>
        )}

        {/* ── AI Loading State ── */}
        {generateAiSuggestionsMutation.isPending && (
          <div className="py-12 flex flex-col items-center justify-center rounded-xl border border-dashed border-violet-500/30 bg-violet-500/5 text-center space-y-3">
            <div className="relative">
              <div className="size-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg animate-pulse">
                <Sparkles className="size-6" />
              </div>
              <Loader2 className="size-16 text-violet-500 animate-spin absolute -top-2 -left-2" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Analyzing forecast data with Gemini AI...</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Evaluating historical demand fluctuations to formulate custom pricing, staffing, marketing, and inventory action plans.
              </p>
            </div>
          </div>
        )}

        {/* ── AI Error State ── */}
        {generateAiSuggestionsMutation.isError && !generateAiSuggestionsMutation.isPending && (
          <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 flex items-start gap-3">
            <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-destructive">Failed to generate AI recommendations</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Could not connect to the AI model. Please verify your internet connection or backend configuration.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 text-xs"
                onClick={() => generateAiSuggestionsMutation.mutate()}
              >
                <RefreshCw className="size-3 mr-1.5" /> Try Again
              </Button>
            </div>
          </div>
        )}

        {/* ── AI Results ── */}
        {aiResult && !generateAiSuggestionsMutation.isPending && (
          <div className="space-y-4 py-1">
            {/* AI Executive Summary */}
            {aiResult.summary && (
              <div className="p-3.5 rounded-xl border border-violet-500/30 bg-violet-500/10 text-xs text-foreground flex items-start gap-2.5">
                <Sparkles className="size-4 text-violet-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed"><strong className="text-violet-700 dark:text-violet-300">Executive Summary:</strong> {aiResult.summary}</p>
              </div>
            )}

            {/* 1. Dynamic Pricing Strategy */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <DollarSign className="size-4" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground">1. Dynamic Pricing Strategy</h4>
                </div>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  Revenue Optimization
                </span>
              </div>

              <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside ml-1">
                {aiResult.pricing.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 2. Staffing & Operations Plan */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-md bg-blue-500/10 text-blue-600 flex items-center justify-center">
                    <Users className="size-4" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground">2. Staffing & Operations Plan</h4>
                </div>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
                  Operational Efficiency
                </span>
              </div>

              <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside ml-1">
                {aiResult.staffing.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 3. Marketing & Campaign Outreach */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-md bg-violet-500/10 text-violet-600 flex items-center justify-center">
                    <Megaphone className="size-4" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground">3. Marketing & Outreach Campaign</h4>
                </div>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 border border-violet-500/20">
                  Demand Generation
                </span>
              </div>

              <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside ml-1">
                {aiResult.marketing.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 4. Inventory & Resource Planning */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-md bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <Package className="size-4" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground">4. Inventory & Resource Planning</h4>
                </div>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                  Resource Buffer
                </span>
              </div>

              <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside ml-1">
                {aiResult.inventory.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <DialogFooter className="border-t pt-3 flex items-center justify-between sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!aiResult || generateAiSuggestionsMutation.isPending}
              onClick={handleCopyPlan}
              className="gap-1.5 text-xs"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-emerald-600" /> Copied Action Plan
                </>
              ) : (
                <>
                  <Copy className="size-3.5" /> Copy Action Plan
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={generateAiSuggestionsMutation.isPending}
              onClick={() => generateAiSuggestionsMutation.mutate()}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`size-3.5 ${generateAiSuggestionsMutation.isPending ? "animate-spin" : ""}`} />
              Re-analyze with AI
            </Button>
          </div>

          <Button type="button" onClick={() => setOpen(false)} size="sm">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
