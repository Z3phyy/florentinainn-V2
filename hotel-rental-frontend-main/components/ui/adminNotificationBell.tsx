"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { NotificationResponse } from "@/app/types/notification.type";
import { formatAlertTimeAgo } from "@/app/utils/formatTime";
import useNotificationStream from "@/app/hooks/useNotificationStream";
import {
  Bell,
  Calendar,
  Wrench,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  UserCheck,
  Trash2,
  Loader2,
  X,
} from "lucide-react";

type AlertFilter = "ALL" | "ACCOUNT" | "RESERVATION" | "MAINTENANCE" | "CHAT";

function getItemIcon(type: string) {
  switch (type) {
    case "account":
      return <UserCheck className="size-4" />;
    case "reservation":
      return <Calendar className="size-4" />;
    case "maintenance":
      return <Wrench className="size-4" />;
    case "chat":
      return <MessageSquare className="size-4" />;
    default:
      return <Bell className="size-4" />;
  }
}

function getItemBadgeStyle(type: string) {
  switch (type) {
    case "account":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
    case "reservation":
      return "bg-[#900546]/10 text-[#900546] dark:text-[#F968AC]";
    case "maintenance":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "chat":
      return "bg-[#618685]/15 text-[#618685] dark:text-[#88afae]";
    default:
      return "bg-purple-500/10 text-purple-600";
  }
}

export function AdminNotificationBell() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<AlertFilter>("ALL");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: notifications } = useQuery<NotificationResponse>({
    queryKey: ["admin-notifications"],
    queryFn: async () => {
      const res = await axiosInstance.get("/system/notifications");
      return res.data;
    },
refetchInterval: 60000,
    });

  const { mutate: clearNotifications, isPending: isClearing } = useMutation({
    mutationFn: () => axiosInstance.delete("/system/notifications"),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    },
  });

  const { mutate: deleteNotification } = useMutation({
    mutationFn: (id: string) => axiosInstance.delete(`/system/notifications/${id}`),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    },
  });

  useNotificationStream("admin", () => {
    queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const unreadCount = notifications?.totalUnread || 0;

  const filteredItems = useMemo(() => {
    if (!notifications?.items) return [];
    if (activeFilter === "ALL") return notifications.items;
    if (activeFilter === "ACCOUNT") return notifications.items.filter((i) => i.type === "account");
    if (activeFilter === "RESERVATION") return notifications.items.filter((i) => i.type === "reservation");
    if (activeFilter === "MAINTENANCE") return notifications.items.filter((i) => i.type === "maintenance");
    if (activeFilter === "CHAT") return notifications.items.filter((i) => i.type === "chat");
    return notifications.items;
  }, [notifications, activeFilter]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex size-9 items-center justify-center rounded-xl bg-[#FAF5F5] dark:bg-[#1A0E13] border border-[#D9C3C3] dark:border-white/10 text-[#130005] dark:text-gray-200 hover:bg-[#900546]/10 hover:text-[#900546] transition-colors cursor-pointer"
        aria-label="View notifications"
        title="Admin Alerts"
      >
        <Bell className="size-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-[#900546] text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-[#130005]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-[340px] sm:w-[420px] rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="bg-[#130005] p-4 text-white flex items-center justify-between border-b border-[#900546]/30">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-[#900546]/30 text-[#F968AC] flex items-center justify-center">
                <Sparkles className="size-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold">Admin Alert Center</h4>
                <p className="text-[10px] text-[#E4D1D1]/70">
                  {unreadCount > 0
                    ? `${unreadCount} pending action${unreadCount === 1 ? "" : "s"} requiring attention`
                    : "You're all caught up"}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-[#900546]/40 text-[#F968AC] border border-[#900546]/50 inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-[#FAF5F5]/70 dark:bg-[#130005]/70 border-b border-[#D9C3C3]/40 dark:border-white/10 overflow-x-auto text-[11px]">
            {(notifications?.pendingAccountsCount ?? 0) > 0 && (
              <button
                onClick={() => setActiveFilter("ACCOUNT")}
                className={`px-2.5 py-1 rounded-full font-semibold transition-all cursor-pointer ${
                  activeFilter === "ACCOUNT"
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-[#1A0E13] text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900"
                }`}
              >
                Staff ({notifications?.pendingAccountsCount})
              </button>
            )}
            {(notifications?.recentBookingsCount ?? 0) > 0 && (
              <button
                onClick={() => setActiveFilter("RESERVATION")}
                className={`px-2.5 py-1 rounded-full font-semibold transition-all cursor-pointer ${
                  activeFilter === "RESERVATION"
                    ? "bg-[#900546] text-white"
                    : "bg-white dark:bg-[#1A0E13] text-[#900546] dark:text-[#F968AC] border border-[#900546]/30"
                }`}
              >
                Bookings ({notifications?.recentBookingsCount})
              </button>
            )}
            {(notifications?.maintenanceCount ?? 0) > 0 && (
              <button
                onClick={() => setActiveFilter("MAINTENANCE")}
                className={`px-2.5 py-1 rounded-full font-semibold transition-all cursor-pointer ${
                  activeFilter === "MAINTENANCE"
                    ? "bg-amber-600 text-white"
                    : "bg-white dark:bg-[#1A0E13] text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900"
                }`}
              >
                Rooms ({notifications?.maintenanceCount})
              </button>
            )}
            {(notifications?.activeChatsCount ?? 0) > 0 && (
              <button
                onClick={() => setActiveFilter("CHAT")}
                className={`px-2.5 py-1 rounded-full font-semibold transition-all cursor-pointer ${
                  activeFilter === "CHAT"
                    ? "bg-[#618685] text-white"
                    : "bg-white dark:bg-[#1A0E13] text-[#618685] dark:text-[#88afae] border border-[#618685]/30"
                }`}
              >
                Chat ({notifications?.activeChatsCount})
              </button>
            )}
          </div>

          {/* Notification items list */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-[#D9C3C3]/40 dark:divide-white/10 p-2">
            {filteredItems.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#5C454B] dark:text-gray-400">
                <CheckCircle2 className="size-9 text-emerald-500 mx-auto mb-2" />
                <p className="font-bold text-[#130005] dark:text-white">All Caught Up!</p>
                <p className="text-[11px] mt-0.5">No pending alerts in this category.</p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <div key={item.id} className="relative">
                  <Link
                    href={item.link}
                    onClick={() => setOpen(false)}
                    className={`flex items-start gap-3 p-3 rounded-2xl hover:bg-[#FAF5F5] dark:hover:bg-[#25121B] transition-colors group ${
                      item.read ? "opacity-70" : ""
                    }`}
                  >
                    {!item.read && (
                      <span className="absolute -ml-0.5 size-2 rounded-full bg-[#900546] mt-2 ring-2 ring-white dark:ring-[#1A0E13]" />
                    )}
                    <div
                      className={`size-8.5 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${getItemBadgeStyle(
                        item.type
                      )}`}
                    >
                      {getItemIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h5 className="text-xs font-semibold text-[#130005] dark:text-white truncate group-hover:text-[#900546] dark:group-hover:text-[#F968AC] transition-colors">
                          {item.title}
                        </h5>
                        <span className="text-[10px] text-[#5C454B] dark:text-gray-400 shrink-0">
                          {formatAlertTimeAgo(item.timestamp)}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#5C454B] dark:text-gray-400 line-clamp-2 mt-0.5">
                        {item.message}
                      </p>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      deleteNotification(item.id);
                    }}
                    className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-white dark:bg-[#1A0E13] border border-[#D9C3C3]/70 dark:border-white/15 text-[#5C454B] dark:text-gray-300 shadow-sm hover:text-rose-600 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer z-10"
                    aria-label="Dismiss notification"
                    title="Dismiss alert"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-[#FAF5F5] dark:bg-[#130005] border-t border-[#D9C3C3] dark:border-white/10 flex items-center justify-end text-xs">
            <button
              onClick={() => clearNotifications()}
              disabled={(notifications?.items?.length || 0) === 0 || isClearing}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-600 bg-white dark:bg-[#130005] border border-rose-200 dark:border-rose-900/40 px-3 py-1.5 rounded-lg hover:bg-rose-600 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isClearing ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              Clear Alerts
            </button>
          </div>
        </div>
      )}
    </div>
  );
}