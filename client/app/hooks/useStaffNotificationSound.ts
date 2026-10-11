"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { NotificationResponse } from "@/app/types/notification.type";
import { playMessageChime } from "@/app/utils/sound";

export default function useStaffNotificationSound(enabled: boolean) {
  const seenIdsRef = useRef<Set<string> | null>(null);

  const { data } = useQuery<NotificationResponse>({
    queryKey: ["staff-notifications"],
    queryFn: async () => {
      const res = await axiosInstance.get("/system/notifications/staff");
      return res.data;
    },
    enabled,
  });

  useEffect(() => {
    if (!data) return;
    const items = data.items || [];

    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(items.map((n) => n.id));
      return;
    }

    const seen = seenIdsRef.current;
    const hasNew = items.some((n) => !seen.has(n.id) && !n.read);
    items.forEach((n) => seen.add(n.id));

    if (hasNew) playMessageChime();
  }, [data]);
}
