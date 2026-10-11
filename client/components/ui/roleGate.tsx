"use client";

import useUserStore from "@/app/store/useUserStore";
import Link from "next/link";
import { LogIn, ShieldAlert } from "lucide-react";

interface RoleGateProps {
  allowedTypes: string[];
  children: React.ReactNode;
  icon?: "login" | "shield";
  title: string;
  description: string;
  buttonText: string;
}

export function RoleGate({
  allowedTypes,
  children,
  icon = "shield",
  title,
  description,
  buttonText,
}: RoleGateProps) {
  const { user } = useUserStore();

  const allowed = allowedTypes.length === 0
    ? !!user
    : allowedTypes.includes(user?.type || "");

  if (allowed) return <>{children}</>;

  const Icon = icon === "login" ? LogIn : ShieldAlert;

  return (
    <div className="min-h-screen bg-[#FAF5F5] dark:bg-[#130005] flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-sm p-8 rounded-3xl bg-white dark:bg-[#1A0E13] border border-[#D9C3C3] dark:border-white/10 shadow-xl">
        <div className="size-12 rounded-2xl bg-[#900546]/10 text-[#900546] flex items-center justify-center mx-auto">
          <Icon className="size-6" />
        </div>
        <h2 className="font-serif text-xl font-bold text-[#130005] dark:text-white">
          {title}
        </h2>
        <p className="text-xs text-[#5C454B] dark:text-gray-400">
          {description}
        </p>
        <Link
          href="/guest/login"
          className="inline-block w-full py-2.5 px-4 rounded-xl bg-[#900546] hover:bg-[#720336] text-white text-xs font-semibold shadow-md transition-all"
        >
          {buttonText}
        </Link>
      </div>
    </div>
  );
}