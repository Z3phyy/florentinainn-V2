"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { forecastAiResult, forecastConfidence, forecastFilters } from "@/app/types/forecast.type";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertCircle, Info, Loader2, RefreshCw, Sparkles } from "lucide-react";

const filterKey = (f: forecastFilters) => `${f.from}|${f.to}|${f.horizon}|${f.roomCategory}`;

export function ForecastSuggestionsModal({
  filters,
  confidence,
}: {
  filters: forecastFilters;
  confidence: forecastConfidence;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ key: string; data: forecastAiResult } | null>(null);
  const [showMetrics, setShowMetrics] = useState(false);
  const currentKey = filterKey(filters);

  const generate = useMutation({
    mutationFn: async (f: forecastFilters) =>
      (await axiosInstance.post<forecastAiResult>("/system/ai-forecast", f)).data,
    onSuccess: (data, f) => setResult({ key: filterKey(f), data }),
  });

  useEffect(() => {
    if (open && result?.key !== currentKey && !generate.isPending) {
      generate.mutate(filters);
    }
  }, [open, currentKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = result?.key === currentKey ? result.data : null;
  const stale = !!result && result.key !== currentKey;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button onClick={() => setOpen(true)} disabled={confidence === "insufficient"} className="shrink-0">
          <Sparkles className="size-4" />
          AI Recommendations
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Recommendations</DialogTitle>
          <DialogDescription>
            Based on {filters.from} to {filters.to}
            {filters.roomCategory !== "all" ? ` · ${filters.roomCategory}` : ""} · {filters.horizon}-month forecast.
            The AI only receives aggregated figures, never guest details.
          </DialogDescription>
        </DialogHeader>

        {generate.isPending ? (
          <p className="flex items-center gap-2 py-10 justify-center text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Analyzing hotel data...
          </p>
        ) : generate.isError && !data ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            <p>{getApiErrorMessage(generate.error, "AI recommendations are unavailable right now.")} The metrics on the page are unaffected.</p>
          </div>
        ) : data ? (
          <div className="space-y-4">
            {stale && <p className="text-xs text-amber-600">Filters changed. Regenerate to update.</p>}
            <p className="text-sm">{data.summary}</p>
            {data.confidenceNote && (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="size-3.5 mt-0.5 shrink-0" />
                {data.confidenceNote}
              </p>
            )}
            {data.notes.map((note) => (
              <p key={note} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="size-3.5 mt-0.5 shrink-0" />
                {note}
              </p>
            ))}
            {data.status === "insufficient_data" ? (
              <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                There is not enough booking history in this range to make reliable recommendations. Widen the date range or wait for more reservations.
              </p>
            ) : (
              <div className="space-y-3">
                {data.recommendations.map((r, i) => (
                  <div key={`${r.title}-${i}`} className="rounded-lg border border-border p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm">{r.title}</p>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] capitalize text-muted-foreground">{r.category}</span>
                    </div>
                    <dl className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-[120px_1fr]">
                      <dt className="text-muted-foreground">Observed trend</dt>
                      <dd>{r.observedTrend}</dd>
                      <dt className="text-muted-foreground">Supporting metric</dt>
                      <dd className="font-medium">{r.supportingMetric}</dd>
                      <dt className="text-muted-foreground">Implication</dt>
                      <dd>{r.implication}</dd>
                      <dt className="text-muted-foreground">Action</dt>
                      <dd className="font-medium">{r.action}</dd>
                    </dl>
                  </div>
                ))}
              </div>
            )}
            <div>
              <Button variant="ghost" size="sm" onClick={() => setShowMetrics((v) => !v)}>
                {showMetrics ? "Hide" : "Show"} metrics sent to AI
              </Button>
              {showMetrics && (
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-[11px]">
                  {JSON.stringify(data.metricsUsed, null, 2)}
                </pre>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Generated {new Date(data.generatedAt).toLocaleString()} · {data.source === "ai" ? "AI interpretation of calculated metrics" : "Rule-based check (AI not called)"}
            </p>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          <Button onClick={() => generate.mutate(filters)} disabled={generate.isPending}>
            <RefreshCw className="size-4" />
            Regenerate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
