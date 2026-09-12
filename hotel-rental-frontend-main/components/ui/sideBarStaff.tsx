"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  CalendarCheck,
  CalendarDays,
  BedDouble,
  MessageCircle,
  LogOut,
  Menu,
  X,
  Sparkles,
  ExternalLink,
  UserRound,
} from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import { playMessageChime } from "@/app/utils/sound";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { systemInterface } from "@/app/types/system.type";
import { chatInterface } from "@/app/types/chat.type";
import axiosInstance from "@/app/utils/axios";
import useUserStore from "@/app/store/useUserStore";
import { needsReply } from "@/app/utils/customFunction";
import { StaffNotificationBell } from "@/components/ui/staffNotificationBell";

const navigationItems = [
  {
    title: "Staff Dashboard",
    url: "/pages/staff/home",
    icon: Home,
  },
  {
    title: "In-House Guests",
    url: "/pages/staff/guest",
    icon: Users,
    permision: "frontdesk management",
  },
  {
    title: "Reservations",
    url: "/pages/staff/reservation",
    icon: CalendarCheck,
    permision: "reservation management",
  },
  {
    title: "Rooms & Suites",
    url: "/pages/staff/rooms",
    icon: BedDouble,
    permision: "room management",
  },
  {
    title: "Availability",
    url: "/pages/staff/calendar",
    icon: CalendarDays,
    permision: "availability management",
  },
  {
    title: "Guest Messages",
    url: "/pages/staff/chat",
    icon: MessageCircle,
    permision: "chat management",
  },
  {
    title: "My Profile",
    url: "/pages/staff/profile",
    icon: UserRound,
  },
];

interface AppSidebarProps {
  className?: string;
}

export function StaffSidebar({ className }: AppSidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  const queryClient = useQueryClient();
  const pathname = usePathname();

  const { user } = useUserStore();

  const visibleNavigationItems = navigationItems.filter(
    (item) => !item.permision || user?.permisions?.includes(item.permision)
  );

  const { data: systemInfo } = useQuery<systemInterface>({
    queryKey: ["systeminfo"],
    queryFn: async (): Promise<systemInterface> => {
      const response = await axiosInstance.get("/system");
      return response.data;
    },
  });

  // Fetch chats for live badge count
  const { data: chats = [] } = useQuery<chatInterface[]>({
    queryKey: ["sidebar-chats"],
    queryFn: async (): Promise<chatInterface[]> => {
      const response = await axiosInstance.get("/system/chat");
      return response.data;
    },
    refetchInterval: 4000,
  });

  const unreadCount = useMemo(() => {
    return chats.filter((c) => needsReply(c.convo, c.status)).length;
  }, [chats]);

  const prevUnreadRef = useRef<number>(0);
  const isFirstLoadRef = useRef<boolean>(true);

  useEffect(() => {
    if (isFirstLoadRef.current) {
      prevUnreadRef.current = unreadCount;
      isFirstLoadRef.current = false;
      return;
    }

    if (unreadCount > prevUnreadRef.current) {
      playMessageChime();
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  const logoutHandler = async () => {
    queryClient.clear();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/";
  };

  const hotelName = systemInfo?.systemName || "Florentina Inn";
  const logoUrl = systemInfo?.logo || "/Florentina Inn Logo.png";

  return (
    <>
      {/* ── Mobile Top Navbar ── */}
      <div className="lg:hidden bg-white dark:bg-[#130005] text-[#130005] dark:text-white p-3.5 flex items-center justify-between fixed top-0 left-0 right-0 z-50 border-b border-[#D9C3C3] dark:border-white/10 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg overflow-hidden bg-white p-0.5 border border-[#D9C3C3] flex items-center justify-center shrink-0">
            <img
              src={logoUrl}
              alt="Logo"
              className="size-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/Florentina Inn Logo.png";
              }}
            />
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-sm font-bold text-[#900546] dark:text-white leading-tight">
              {hotelName}
            </span>
            <span className="text-[10px] text-[#5C454B] dark:text-gray-400 font-medium">
              Front Desk Portal
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <StaffNotificationBell />
          <button
            onClick={toggleMobileMenu}
            className="p-2 rounded-xl border border-[#D9C3C3] bg-[#FAF5F5] dark:bg-[#1A0E13] text-[#130005] dark:text-white hover:text-[#900546] transition-colors cursor-pointer"
          >
            {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* ── Mobile Drawer ── */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-xs"
          onClick={closeMobileMenu}
        >
          <div
            className="fixed top-0 left-0 w-72 h-full bg-white dark:bg-[#130005] border-r border-[#D9C3C3] dark:border-white/10 shadow-2xl p-5 pt-20 flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-4">
              <p className="text-[10px] uppercase tracking-wider font-bold text-[#5C454B] dark:text-gray-400 px-2">
                Operations Menu
              </p>
              <nav className="space-y-1.5">
                {visibleNavigationItems.map((item) => {
                  const isActive = pathname === item.url;
                  return (
                    <Link
                      key={item.title}
                      href={item.url}
                      onClick={closeMobileMenu}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                        isActive
                          ? "bg-[#900546] text-white shadow-md shadow-[#900546]/20"
                          : "text-[#5C454B] dark:text-gray-300 hover:bg-[#FAF5F5] dark:hover:bg-[#1A0E13] hover:text-[#130005]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </div>
                      {item.url.includes("chat") && unreadCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[#F968AC] text-white text-[10px] font-bold">
                          {unreadCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-[#D9C3C3] dark:border-white/10">
              <button
                onClick={logoutHandler}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              >
                <LogOut className="size-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Desktop Sidebar ── */}
      <Sidebar className={`hidden lg:flex bg-white dark:bg-[#130005] border-r border-[#D9C3C3] dark:border-white/10 ${className}`}>
        {/* Header */}
        <SidebarHeader className="bg-white dark:bg-[#130005] border-b border-[#D9C3C3] dark:border-white/10 p-5">
          <Link href="/" className="flex items-center gap-3 group min-w-0">
            <div className="size-10 rounded-2xl overflow-hidden bg-white p-1 border border-[#D9C3C3] dark:border-white/10 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <img
                src={logoUrl}
                alt="Logo"
                className="size-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/Florentina Inn Logo.png";
                }}
              />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-serif text-base font-bold text-[#130005] dark:text-white leading-tight truncate">
                {hotelName}
              </span>
              <span className="text-[10px] text-[#900546] dark:text-[#F968AC] font-bold uppercase tracking-wider">
                Staff Operations
              </span>
            </div>
          </Link>
        </SidebarHeader>

        {/* Navigation */}
        <SidebarContent className="bg-white dark:bg-[#130005] px-3 py-4">
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider font-bold text-[#5C454B] dark:text-gray-400 px-3 mb-2">
              Staff Management
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1.5">
                {visibleNavigationItems.map((item) => {
                  const isActive = pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        className={`w-full rounded-2xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                          isActive
                            ? "bg-[#900546] text-white shadow-md shadow-[#900546]/20 hover:bg-[#720336] hover:text-white"
                            : "text-[#5C454B] dark:text-gray-300 hover:bg-[#FAF5F5] dark:hover:bg-[#1A0E13] hover:text-[#130005]"
                        }`}
                      >
                        <Link href={item.url} className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            <item.icon className="size-4 shrink-0" />
                            <span>{item.title}</span>
                          </div>
                          {item.url.includes("chat") && unreadCount > 0 && (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isActive
                                  ? "bg-white text-[#900546]"
                                  : "bg-[#900546] text-white"
                              }`}
                            >
                              {unreadCount}
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Footer with Staff Profile Badge & Sign Out */}
        <SidebarFooter className="bg-white dark:bg-[#130005] border-t border-[#D9C3C3] dark:border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#FAF5F5] dark:bg-[#1A0E13] border border-[#D9C3C3] dark:border-white/10">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 rounded-full bg-[#618685] text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
                {user?.name ? user.name.charAt(0).toUpperCase() : "S"}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#130005] dark:text-white truncate">
                  {user?.name || "Staff Member"}
                </p>
                <p className="text-[10px] text-[#5C454B] dark:text-gray-400 capitalize">
                  {user?.type || "Receptionist"}
                </p>
              </div>
            </div>
            <button
              onClick={logoutHandler}
              className="p-1.5 rounded-lg text-[#5C454B] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>
    </>
  );
}