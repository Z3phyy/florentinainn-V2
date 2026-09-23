"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { systemInterface } from "@/app/types/system.type";
import axiosInstance from "@/app/utils/axios";
import useUserStore from "@/app/store/useUserStore";
import {
  LayoutDashboard,
  Users,
  BedDouble,
  CreditCard,
  Settings,
  FileBarChart,
  TrendingUp,
  LogOut,
  Menu,
  X,
  Sparkles,
  History,
  UserRound,
  CalendarDays,
  SprayCan,
} from "lucide-react";
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
import { AdminNotificationBell } from "@/components/ui/adminNotificationBell";

const navigationItems = [
  {
    title: "Dashboard",
    url: "/pages/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Staff Management",
    url: "/pages/admin/staff",
    icon: Users,
  },
  {
    title: "Rooms & Suites",
    url: "/pages/admin/rooms",
    icon: BedDouble,
  },
  {
    title: "Housekeeping",
    url: "/pages/admin/housekeeping",
    icon: SprayCan,
  },
  {
    title: "Availability",
    url: "/pages/admin/calendar",
    icon: CalendarDays,
  },
  {
    title: "Payment Records",
    url: "/pages/admin/payments",
    icon: CreditCard,
  },
  {
    title: "System Configuration",
    url: "/pages/admin/settings",
    icon: Settings,
  },
  {
    title: "Audit Trail",
    url: "/pages/admin/audit",
    icon: History,
  },
  {
    title: "Financial Reports",
    url: "/pages/admin/reports",
    icon: FileBarChart,
  },
  {
    title: "My Profile",
    url: "/pages/admin/profile",
    icon: UserRound,
  },
  {
    title: "AI Predictions",
    url: "/pages/admin/predictions",
    icon: TrendingUp,
  },
];

interface AppSidebarProps {
  className?: string;
}

export function AdminSidebar({ className }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  const queryClient = useQueryClient();

  const { user } = useUserStore();

  const { data: systemInfo } = useQuery<systemInterface>({
    queryKey: ["systeminfo"],
    queryFn: async (): Promise<systemInterface> => {
      const response = await axiosInstance.get("/system");
      return response.data;
    },
  });

  const hotelName = systemInfo?.systemName || "Florentina Inn";
  const logoUrl = systemInfo?.logo || "/Florentina Inn Logo.png";

  const logoutHandler = () => {
    queryClient.clear();
    localStorage.clear();
    sessionStorage.clear();
    router.push("/guest/login");
  };

  return (
    <>
      {/* ── Mobile Header ── */}
      <div className="lg:hidden bg-white dark:bg-[#130005] text-[#130005] dark:text-white p-4 flex items-center justify-between fixed top-0 left-0 right-0 z-50 border-b border-[#D9C3C3] dark:border-white/10 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl overflow-hidden bg-white p-1 border border-[#D9C3C3] flex items-center justify-center shadow-xs">
            <img
              src={logoUrl}
              alt={hotelName}
              className="size-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/Florentina Inn Logo.png";
              }}
            />
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-base font-bold tracking-tight text-[#130005] dark:text-white">
              {hotelName}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-[#900546] dark:text-[#F968AC] font-semibold">
              {user?.type === "super admin" ? "Super Admin" : "Admin Portal"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <AdminNotificationBell />
          <button
            onClick={toggleMobileMenu}
            className="p-2 rounded-xl block md:hidden border border-[#D9C3C3] dark:border-white/10 bg-[#FAF5F5] dark:bg-[#1A0E13] text-[#130005] dark:text-white hover:bg-[#900546]/10 transition-colors"
          >
            {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* ── Mobile Sidebar Drawer ── */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-xs"
          onClick={closeMobileMenu}
        >
          <div
            className="fixed top-0 left-0 w-72 h-full bg-white dark:bg-[#130005] border-r border-[#D9C3C3] dark:border-white/10 shadow-2xl flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pt-20 px-4">
              <div className="mb-6">
                <p className="text-[10px] uppercase tracking-[0.25em] text-[#900546] dark:text-[#F968AC] font-bold px-3 mb-2">
                  Admin Navigation
                </p>
                <nav className="space-y-1.5">
                  {navigationItems.map((item) => {
                    const isActive = pathname === item.url || pathname.startsWith(`${item.url}/`);
                    return (
                      <Link
                        key={item.title}
                        href={item.url}
                        onClick={closeMobileMenu}
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                          isActive
                            ? "bg-[#900546] text-white shadow-md shadow-[#900546]/25"
                            : "text-[#5C454B] dark:text-gray-300 hover:bg-[#FAF5F5] dark:hover:bg-[#1A0E13] hover:text-[#900546]"
                        }`}
                      >
                        <item.icon size={16} />
                        <span>{item.title}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>

            {/* Mobile Footer */}
            <div className="p-4 border-t border-[#D9C3C3] dark:border-white/10">
              <button
                onClick={logoutHandler}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/30 hover:bg-rose-600 hover:text-white transition-all cursor-pointer"
              >
                <LogOut size={16} />
                <span>Logout Session</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Desktop Sidebar ── */}
      <Sidebar className={`hidden lg:flex bg-white dark:bg-[#130005] border-r border-[#D9C3C3] dark:border-white/10 ${className}`}>
        {/* Header Branding */}
        <SidebarHeader className="bg-white dark:bg-[#130005] border-b border-[#D9C3C3] dark:border-white/10 p-4">
          <Link href="/pages/admin/dashboard" className="flex items-center gap-3 group">
            <div className="size-10 rounded-xl overflow-hidden bg-white p-1 border border-[#D9C3C3] group-hover:border-[#900546]/50 transition-all flex items-center justify-center shadow-xs">
              <img
                src={logoUrl}
                alt={hotelName}
                className="size-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/Florentina Inn Logo.png";
                }}
              />
            </div>
            <div className="grid flex-1 text-left leading-tight">
              <span className="font-serif text-lg font-bold tracking-tight text-[#130005] dark:text-white truncate">
                {hotelName}
              </span>
              <span className="text-[9px] uppercase tracking-[0.2em] text-[#900546] dark:text-[#F968AC] font-bold">
                {user?.type === "super admin" ? "Super Admin" : "Admin Panel"}
              </span>
            </div>
          </Link>
        </SidebarHeader>

        {/* Navigation Items */}
        <SidebarContent className="bg-white dark:bg-[#130005] px-3 py-4">
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.25em] text-[#900546] dark:text-[#F968AC] font-bold px-3 mb-2 flex items-center gap-2">
              <Sparkles className="size-3 text-[#F968AC]" />
              Management
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {navigationItems.map((item) => {
                  const isActive = pathname === item.url || pathname.startsWith(`${item.url}/`);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        className={`rounded-xl px-3 py-2.5 transition-all text-xs font-semibold ${
                          isActive
                            ? "bg-[#900546] text-white shadow-md shadow-[#900546]/20 hover:bg-[#900546] hover:text-white"
                            : "text-[#5C454B] dark:text-gray-300 hover:bg-[#FAF5F5] dark:hover:bg-[#1A0E13] hover:text-[#900546]"
                        }`}
                      >
                        <Link href={item.url} className="flex items-center gap-3">
                          <item.icon className={`size-4 ${isActive ? "text-white" : "text-[#5C454B] dark:text-gray-400"}`} />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Logout Footer */}
        <SidebarFooter className="bg-[#FAF5F5] dark:bg-[#1A0E13] border-t border-[#D9C3C3] dark:border-white/10 p-3.5 space-y-3">
          <button
            onClick={logoutHandler}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 bg-white dark:bg-[#130005] border border-rose-200 dark:border-rose-900/30 hover:bg-rose-600 hover:text-white transition-all cursor-pointer shadow-xs"
          >
            <LogOut className="size-3.5" />
            <span>Sign Out</span>
          </button>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>
    </>
  );
}