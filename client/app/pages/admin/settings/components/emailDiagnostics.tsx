"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { formatHotelDateTime } from "@/app/utils/hotelTime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Loader2, Mail, XCircle } from "lucide-react";

interface Diagnostics {
  provider: {
    configured: boolean;
    reachable: boolean;
    senderVerified: boolean;
    sender: string;
    sandbox: boolean;
    plan: string;
    credits: number | null;
    error: string;
  };
  email: string | null;
  events: { event: string; date: string; subject: string; reason: string }[] | null;
  eventsError: string;
}

const EVENT_HELP: Record<string, string> = {
  requests: "Accepted by Brevo",
  delivered: "Delivered to the recipient's mail server",
  opened: "Opened",
  clicks: "Link clicked",
  hardBounces: "Rejected: address does not exist (Brevo then blocks it)",
  softBounces: "Temporarily rejected (mailbox full, bad domain, etc.)",
  blocked: "Not sent: recipient is on Brevo's block list (earlier hard bounce or unsubscribe)",
  unsubscribed: "Recipient unsubscribed; future emails will be blocked",
  spam: "Marked as spam",
  invalid: "Invalid address",
  deferred: "Delayed by the receiving server",
  error: "Provider error",
};

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${ok ? "text-emerald-700" : "text-destructive"}`}>
      {ok ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
      {label}
    </span>
  );
}

export function EmailDiagnostics() {
  const [input, setInput] = useState("");
  const [email, setEmail] = useState("");
  const { data, isLoading, isError, error, isFetching, refetch } = useQuery<Diagnostics>({
    queryKey: ["email-diagnostics", email],
    retry: false,
    queryFn: async () => (await axiosInstance.get("/system/email/diagnostics", { params: email ? { email } : {} })).data,
  });

  return (
    <section className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 space-y-4 shadow-xs">
      <div>
        <h2 className="font-serif text-lg font-bold text-[#130005] dark:text-white flex items-center gap-2">
          <Mail className="size-4.5 text-[#900546]" />
          Email Delivery
        </h2>
        <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5 max-w-2xl">
          Checks the email provider connection and shows what happened to recent emails for a specific address (for example, why a staff member did not receive an approval or verification code).
        </p>
      </div>
      {isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : isError ? (
        <p className="text-sm text-destructive">{getApiErrorMessage(error, "Could not check the email provider.")}</p>
      ) : data ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Check ok={data.provider.configured} label="API key configured" />
          <Check ok={data.provider.reachable} label="Provider reachable" />
          <Check ok={data.provider.senderVerified} label={`Sender verified (${data.provider.sender})`} />
          {data.provider.credits !== null && <span className="text-xs text-muted-foreground">{data.provider.credits} credits left ({data.provider.plan})</span>}
          {data.provider.sandbox && <span className="text-xs font-semibold text-amber-700">Sandbox mode: emails are validated but not delivered</span>}
          {data.provider.error && <span className="text-xs text-destructive">{data.provider.error}</span>}
        </div>
      ) : null}
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          setEmail(input.trim());
        }}
      >
        <Input type="email" placeholder="recipient@example.com" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Recipient email" />
        <Button type="submit" variant="outline" disabled={isFetching || !input.trim()}>
          {isFetching ? <Loader2 className="size-4 animate-spin" /> : null}
          Check recipient
        </Button>
        {email && (
          <Button type="button" variant="ghost" onClick={() => refetch()} disabled={isFetching}>Refresh</Button>
        )}
      </form>
      {data?.email && (
        <div className="space-y-2">
          {data.eventsError ? (
            <p className="text-sm text-destructive">{data.eventsError}</p>
          ) : !data.events || data.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No emails to {data.email} in the last 90 days.</p>
          ) : (
            <ul className="divide-y divide-[#D9C3C3]/60 rounded-2xl border border-[#D9C3C3] dark:border-white/10">
              {data.events.map((e, i) => (
                <li key={i} className="flex flex-col gap-0.5 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium">{e.subject || "(no subject)"}</span>
                  <span className={["hardBounces", "blocked", "spam", "invalid", "error", "unsubscribed"].includes(e.event) ? "text-destructive" : "text-muted-foreground"}>
                    {EVENT_HELP[e.event] || e.event}
                    {e.reason ? ` — ${e.reason.slice(0, 120)}` : ""} · {formatHotelDateTime(e.date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
