"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { successAlert, errorAlert, confirmAlert } from "@/app/utils/alert";
import { getApiErrorMessage } from "@/app/utils/apiError";
import useUserStore from "@/app/store/useUserStore";
import { adminAccountInterface } from "@/app/types/account.type";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AccessCodeDialog } from "@/components/ui/accessCodeDialog";
import { ReasonDialog } from "@/components/ui/reasonDialog";
import { AddAdminModal } from "./addAdminModal";
import { Ban, Power, RotateCcw, ShieldCheck, Shield, Trash2 } from "lucide-react";

type AdminAction = "suspend" | "unsuspend" | "deactivate" | "reactivate";

function adminStatus(admin: adminAccountInterface) {
  if (admin.isActive === false) {
    return { key: "revoked", label: "Revoked", cls: "bg-gray-500/10 text-gray-600 border-gray-500/30" };
  }
  if (admin.isSuspended) {
    return { key: "suspended", label: "Suspended", cls: "bg-amber-600/10 text-amber-700 border-amber-600/30" };
  }
  return { key: "active", label: "Active", cls: "bg-green-600/10 text-green-700 border-green-600/30" };
}

export function AdminAccounts() {
  const queryClient = useQueryClient();
  const currentUser = useUserStore((s) => s.user);

  const { data: admins = [], isLoading, isError } = useQuery<adminAccountInterface[]>({
    queryKey: ["admins"],
    queryFn: async () => {
      const res = await axiosInstance.get("/system/admins");
      return res.data || [];
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ _id, action, reason }: { _id: string; action: AdminAction; reason?: string }) =>
      axiosInstance.put("/system/admin/status", { _id, action, reason }),
    onSuccess: (_res, variables) => {
      const messages: Record<AdminAction, string> = {
        suspend: "Administrator suspended. Their sessions were signed out.",
        unsuspend: "Administrator unsuspended.",
        deactivate: "Administrator access revoked. Their sessions were signed out.",
        reactivate: "Administrator reactivated.",
      };
      successAlert(messages[variables.action]);
      queryClient.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: (err) => errorAlert(getApiErrorMessage(err, "Failed to update admin status.")),
  });

  const removeMutation = useMutation({
    mutationFn: (_id: string) => axiosInstance.delete("/system/admin", { data: { _id } }),
    onSuccess: () => {
      successAlert("Administrator account removed. You can now create a replacement.");
      queryClient.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: (err) => errorAlert(getApiErrorMessage(err, "Failed to remove administrator.")),
  });

  const hasAdminAccount = admins.some((a) => a.type === "admin");

  return (
    <section className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 space-y-4 shadow-xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-serif text-lg font-bold text-[#130005] dark:text-white flex items-center gap-2">
            <ShieldCheck className="size-4.5 text-[#900546]" />
            Administrator Accounts
          </h2>
          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5">
            Super admin only. Suspending or revoking an administrator signs them out immediately.
            To replace an administrator who left, revoke their access, remove the account, then add a new one.
          </p>
        </div>
        <AddAdminModal disabled={isLoading || hasAdminAccount} />
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
          {admins.map((admin) => {
            const status = adminStatus(admin);
            const isSuper = admin.type === "super admin";
            const isSelf = admin._id === currentUser?._id;
            const busy = statusMutation.isPending || removeMutation.isPending;
            return (
              <div
                key={admin._id}
                className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex items-center gap-3">
                  {isSuper ? (
                    <Shield className="size-4 shrink-0 text-[#900546]" />
                  ) : (
                    <ShieldCheck className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span className="truncate">{admin.name}</span>
                      <span className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
                        {admin.type}
                      </span>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.cls}`}>
                        {status.label}
                      </span>
                      {!admin.hasAccessCode && (
                        <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                          No access code
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {admin.email}
                      {admin.lastLogin
                        ? ` · Last login ${new Date(admin.lastLogin).toLocaleString()}`
                        : ""}
                      {admin.isSuspended && admin.suspensionReason ? ` · ${admin.suspensionReason}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 self-end sm:self-auto">
                  {!isSuper && status.key !== "revoked" && (
                    <AccessCodeDialog
                      targetId={admin._id}
                      targetName={admin.name}
                      endpoint="/system/admin/access-code"
                      hasAccessCode={admin.hasAccessCode}
                      invalidateKey="admins"
                    />
                  )}
                  {!isSuper && status.key === "active" && (
                    <ReasonDialog
                      trigger={
                        <Button variant="ghost" size="icon-sm" title="Suspend administrator" aria-label="Suspend administrator" disabled={busy}>
                          <Ban className="size-3.5 text-amber-600" />
                        </Button>
                      }
                      title={`Suspend ${admin.name}?`}
                      description="The administrator is signed out immediately and cannot sign in until unsuspended."
                      confirmLabel="Suspend"
                      isPending={statusMutation.isPending}
                      onConfirm={(reason) => statusMutation.mutateAsync({ _id: admin._id, action: "suspend", reason })}
                    />
                  )}
                  {!isSuper && status.key === "suspended" && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Unsuspend administrator"
                      aria-label="Unsuspend administrator"
                      disabled={busy}
                      onClick={() =>
                        confirmAlert(`Unsuspend "${admin.name}"?`, "Unsuspend", () =>
                          statusMutation.mutate({ _id: admin._id, action: "unsuspend" }),
                        )
                      }
                    >
                      <RotateCcw className="size-3.5 text-green-600" />
                    </Button>
                  )}
                  {!isSuper && status.key !== "revoked" && (
                    <ReasonDialog
                      trigger={
                        <Button variant="ghost" size="icon-sm" title="Revoke access" aria-label="Revoke access" disabled={busy}>
                          <Power className="size-3.5 text-destructive" />
                        </Button>
                      }
                      title={`Revoke access for ${admin.name}?`}
                      description="Use this when an administrator leaves the organization. They are signed out immediately and cannot sign in until reactivated."
                      confirmLabel="Revoke Access"
                      isPending={statusMutation.isPending}
                      onConfirm={(reason) => statusMutation.mutateAsync({ _id: admin._id, action: "deactivate", reason })}
                    />
                  )}
                  {!isSuper && status.key === "revoked" && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Reactivate administrator"
                        aria-label="Reactivate administrator"
                        disabled={busy}
                        onClick={() =>
                          confirmAlert(`Reactivate "${admin.name}"?`, "Reactivate", () =>
                            statusMutation.mutate({ _id: admin._id, action: "reactivate" }),
                          )
                        }
                      >
                        <RotateCcw className="size-3.5 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Remove account permanently"
                        aria-label="Remove account permanently"
                        disabled={busy}
                        onClick={() =>
                          confirmAlert(
                            `Permanently remove "${admin.name}"? This cannot be undone, but frees the slot for a replacement administrator.`,
                            "Remove",
                            () => removeMutation.mutate(admin._id),
                          )
                        }
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </>
                  )}
                  {isSuper && (
                    <span className="text-[11px] text-muted-foreground">
                      {isSelf ? "You · manage your code above" : "Protected"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
