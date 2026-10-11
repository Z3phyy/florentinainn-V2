"use client";

import useUserStore from "@/app/store/useUserStore";
import { ShieldAlert } from "lucide-react";

export function hasPermission(
  user: { type?: string; permisions?: string[] } | null | undefined,
  permission: string,
) {
  if (!user) return false;
  if (user.type === "admin" || user.type === "super admin") return true;
  return Array.isArray(user.permisions) && user.permisions.includes(permission);
}

export function PermissionGate({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { user } = useUserStore();

  if (hasPermission(user, permission)) return <>{children}</>;

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-sm space-y-3 rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-8 text-center shadow-xs">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#900546]/10 text-[#900546]">
          <ShieldAlert className="size-6" />
        </div>
        <h2 className="font-serif text-xl font-bold text-[#130005] dark:text-white">Access Restricted</h2>
        <p className="text-xs text-[#5C454B] dark:text-gray-400">
          Your account does not have the &ldquo;{permission}&rdquo; permission. Ask an administrator to grant it.
        </p>
      </div>
    </div>
  );
}
