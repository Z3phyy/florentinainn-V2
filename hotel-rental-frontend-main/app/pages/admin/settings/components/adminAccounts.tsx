"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { successAlert, errorAlert, confirmAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Power, ShieldCheck, Shield } from "lucide-react";

interface adminInterface {
  _id: string;
  name: string;
  email: string;
  type: string;
  isActive: boolean;
  lastLogin?: string | null;
}

export function AdminAccounts() {
  const queryClient = useQueryClient();

  const { data: admins = [], isLoading, isError } = useQuery<adminInterface[]>({
    queryKey: ["admins"],
    queryFn: async () => {
      const res = await axiosInstance.get("/system/admins");
      return res.data || [];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ _id, isActive }: { _id: string; isActive: boolean }) =>
      axiosInstance.put("/system/admin/status", { _id, isActive }),
    onSuccess: () => {
      successAlert("Admin status updated.");
      queryClient.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      errorAlert(err.response?.data?.message || "Failed to update admin status."),
  });

  return (
    <section className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 space-y-4 shadow-xs">
      <div>
        <h2 className="font-serif text-lg font-bold text-[#130005] dark:text-white flex items-center gap-2">
          <ShieldCheck className="size-4.5 text-[#900546]" />
          Administrator Accounts
        </h2>
        <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5">
          Super admin only. Deactivating an admin revokes all their active sessions immediately.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load admin accounts.</p>
      ) : admins.length === 0 ? (
        <p className="text-sm text-muted-foreground">No admin accounts found.</p>
      ) : (
        <div className="space-y-2">
          {admins.map((admin) => (
            <div
              key={admin._id}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
            >
              <div className="min-w-0 flex items-center gap-3">
                {admin.type === "super admin" ? (
                  <Shield className="size-4 text-[#900546]" />
                ) : (
                  <ShieldCheck className="size-4 text-muted-foreground" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {admin.name}
                    <span className="ml-2 text-xs font-normal uppercase tracking-wide text-muted-foreground">
                      {admin.type}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {admin.email}
                    {admin.lastLogin
                      ? ` · Last login ${new Date(admin.lastLogin).toLocaleString()}`
                      : ""}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={
                  admin.type === "super admin" ||
                  toggleMutation.isPending
                }
                title={
                  admin.type === "super admin"
                    ? "The super admin cannot be deactivated"
                    : admin.isActive === false
                      ? "Reactivate admin"
                      : "Deactivate admin"
                }
                onClick={() =>
                  confirmAlert(
                    admin.isActive === false
                      ? `Reactivate admin "${admin.name}"?`
                      : `Deactivate admin "${admin.name}" and revoke their sessions?`,
                    admin.isActive === false ? "Reactivate" : "Deactivate",
                    () =>
                      toggleMutation.mutate({
                        _id: admin._id,
                        isActive: !admin.isActive,
                      }),
                  )
                }
              >
                <Power
                  className={`size-3.5 ${
                    admin.isActive === false
                      ? "text-green-600"
                      : "text-destructive"
                  }`}
                />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}