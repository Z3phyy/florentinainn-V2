"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { accountInterface, accountListResult } from "@/app/types/account.type";
import { successAlert, errorAlert, confirmAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AddStaffModal } from "./components/addStaffModal";
import { EditStaffModal } from "./components/editStaffModal";
import { PendingStaffModal } from "./components/pendingStaffModal";
import { UserPlus, Search, ChevronLeft, ChevronRight, Power, RotateCcw, LogOut, Ban } from "lucide-react";
import useUserStore from "@/app/store/useUserStore";

const STATUS_OPTIONS = [
  { value: "all", label: "All Staff" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending Approval" },
  { value: "suspended", label: "Suspended" },
  { value: "inactive", label: "Inactive" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-green-600/10 text-green-700 border-green-600/30" },
  suspended: { label: "Suspended", cls: "bg-amber-600/10 text-amber-700 border-amber-600/30" },
  inactive: { label: "Inactive", cls: "bg-gray-500/10 text-gray-600 border-gray-500/30" },
  pending: { label: "Pending", cls: "bg-blue-600/10 text-blue-700 border-blue-600/30" },
  rejected: { label: "Rejected", cls: "bg-red-500/10 text-red-600 border-red-500/30" },
};

function staffStatus(staff: accountInterface): string {
  if (staff.isApproved === false && staff.rejectedAt) return "rejected";
  if (staff.isApproved === false) return "pending";
  if (staff.isSuspended) return "suspended";
  if (staff.isActive === false) return "inactive";
  return "active";
}

export default function Page() {
  const queryClient = useQueryClient();
  const currentUser = useUserStore((s) => s.user);
  const isSuperAdmin = currentUser?.type === "super admin";

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading, isError } = useQuery<accountListResult | accountInterface[]>({
    queryKey: ["staff", { search: debouncedSearch, status, page }],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        status,
        page,
        limit: pageSize,
        sortField: "name",
        sortDir: "asc",
      };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      const response = await axiosInstance.get("/account", { params });
      return response.data;
    },
  });

  // Local search debounce
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
    window.clearTimeout((handleSearch as any)._t);
    (handleSearch as any)._t = window.setTimeout(() => {
      setDebouncedSearch(value);
    }, 350);
  };

  const rows = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    return data.items || [];
  }, [data]);

  const totalPages = useMemo(() => {
    if (!data || Array.isArray(data)) return 1;
    return data.totalPages || 1;
  }, [data]);

  const listTotal = useMemo(() => {
    if (!data || Array.isArray(data)) return rows.length;
    return data.total || 0;
  }, [data, rows]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      axiosInstance.delete("/account", { data: { _id: id } }),
    onSuccess: () => {
      successAlert("Staff member deactivated.");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      errorAlert(err.response?.data?.message || "Failed to deactivate staff member."),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) =>
      axiosInstance.put("/account/reactivate", { _id: id }),
    onSuccess: () => {
      successAlert("Staff member reactivated.");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      errorAlert(err.response?.data?.message || "Failed to reactivate staff member."),
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) =>
      axiosInstance.put("/account/suspend", { _id: id, reason: "Suspended by admin" }),
    onSuccess: () => {
      successAlert("Staff member suspended. Sessions revoked.");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      errorAlert(err.response?.data?.message || "Failed to suspend staff member."),
  });

  const unsuspendMutation = useMutation({
    mutationFn: (id: string) =>
      axiosInstance.put("/account/unsuspend", { _id: id }),
    onSuccess: () => {
      successAlert("Staff member unsuspended.");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      errorAlert(err.response?.data?.message || "Failed to unsuspend staff member."),
  });

  const forceLogoutMutation = useMutation({
    mutationFn: (id: string) =>
      axiosInstance.put("/account/force-logout", { _id: id }),
    onSuccess: () => {
      successAlert("All sessions revoked for this staff member.");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      errorAlert(err.response?.data?.message || "Failed to revoke sessions."),
  });

  const mutations = {
    delete: deleteMutation,
    reactivate: reactivateMutation,
    suspend: suspendMutation,
    unsuspend: unsuspendMutation,
    forceLogout: forceLogoutMutation,
  };

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3 py-1 text-xs font-semibold text-[#900546] dark:text-[#F968AC] mb-2">
            Team & Access Control
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#130005] dark:text-white">
            Staff Management
          </h1>
          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5">
            Manage accounts, permissions, and staff lifecycle (active, suspended, inactive).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PendingStaffModal />
          <AddStaffModal />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, position..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load staff data.</p>
      ) : rows.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email / Position</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((staff) => {
              const statusKey = staffStatus(staff);
              const badge = STATUS_BADGE[statusKey];
              return (
                <TableRow key={staff._id}>
                  <TableCell className="font-medium">{staff.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {staff.email}
                    {staff.position ? (
                      <span className="block text-xs">{staff.position}</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {staff.permisions.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        staff.permisions.map((perm) => (
                          <span
                            key={perm}
                            className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium"
                          >
                            {perm}
                          </span>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {staff.lastLogin
                      ? new Date(staff.lastLogin).toLocaleString()
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      <EditStaffModal staff={staff} />
                      {isSuperAdmin && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title={statusKey === "active" ? "Suspend" : "Unsuspend"}
                          onClick={() =>
                            statusKey === "active"
                              ? confirmAlert(
                                  `Suspend "${staff.name}" and revoke their sessions?`,
                                  "Suspend",
                                  () => mutations.suspend.mutate(staff._id),
                                )
                              : mutations.unsuspend.mutate(staff._id)
                          }
                        >
                          {statusKey === "active" ? (
                            <Ban className="size-3.5 text-amber-600" />
                          ) : (
                            <RotateCcw className="size-3.5 text-green-600" />
                          )}
                        </Button>
                      )}
                      {isSuperAdmin && statusKey === "inactive" && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Reactivate"
                          onClick={() =>
                            confirmAlert(
                              `Reactivate "${staff.name}"?`,
                              "Reactivate",
                              () => mutations.reactivate.mutate(staff._id),
                            )
                          }
                        >
                          <RotateCcw className="size-3.5 text-green-600" />
                        </Button>
                      )}
                      {isSuperAdmin && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Force logout (revoke sessions)"
                          onClick={() =>
                            confirmAlert(
                              `Revoke all sessions for "${staff.name}"?`,
                              "Revoke",
                              () => mutations.forceLogout.mutate(staff._id),
                            )
                          }
                        >
                          <LogOut className="size-3.5 text-blue-600" />
                        </Button>
                      )}
                      {statusKey === "active" ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Deactivate"
                          onClick={() =>
                            confirmAlert(
                              `Deactivate staff member "${staff.name}"?`,
                              "Deactivate",
                              () => mutations.delete.mutate(staff._id),
                            )
                          }
                        >
                          <Power className="size-3.5 text-destructive" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">No staff found.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Adjust filters or add staff to get started.
          </p>
        </div>
      )}

      {/* Pagination */}
      {rows.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {rows.length} of {listTotal} staff
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} / {Math.max(1, totalPages)}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}