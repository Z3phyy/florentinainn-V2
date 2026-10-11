"use client";

import { useEffect, useRef } from "react";

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL_LIVE || "";
}

export default function useNotificationStream(
  channel: "admin" | "staff",
  onEvent: () => void
) {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("token");
    if (!token) return;

    const path =
      channel === "staff"
        ? "/system/notifications/staff/stream"
        : "/system/notifications/stream";
    const url = `${getApiBaseUrl()}${path}?token=${encodeURIComponent(token)}`;

    const eventSource = new EventSource(url);
    eventSource.onmessage = () => callbackRef.current();
    eventSource.onerror = () => {
      // EventSource auto-reconnects; periodic refetch remains as fallback
    };

    return () => eventSource.close();
  }, [channel]);
}