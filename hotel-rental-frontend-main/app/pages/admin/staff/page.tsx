"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { accountInterface } from "@/app/types/account.type";
import { successAlert, errorAlert, confirmAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
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
import { UserPlus, Pencil, Trash2 } from "lucide-react";

export default function Page() {
  const queryClient = useQueryClient();

  const [selectedStaff, setSelectedStaff] = useState<accountInterface | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["staff"],
    queryFn: async (): Promise<accountInterface[]> => {
      const response = await axiosInstance.get("/account");
      return response.data;
    },
  });

  const approvedStaff = data?.filter((staff) => staff.isApproved === true) ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      axiosInstance.delete("/account", { data: { _id: id } }),
    onSuccess: () => {
      successAlert("Staff member deleted.");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      const message =
        err.response?.data?.message || "Failed to delete staff member.";
      errorAlert(message);
    },
  });

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
            Manage front-desk receptionists, service team accounts, and role permissions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PendingStaffModal />
          <AddStaffModal />
        </div>
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
      ) : approvedStaff.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {approvedStaff.map((staff) => (
              <TableRow key={staff._id}>
                <TableCell className="font-medium">{staff.name}</TableCell>
                <TableCell className="text-muted-foreground">{staff.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {staff.permisions.map((perm) => (
                      <span
                        key={perm}
                        className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                      <EditStaffModal
                       staff={staff}
                      />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        confirmAlert(
                          `Delete staff member "${staff.name}"?`,
                          "Delete",
                          () => deleteMutation.mutate(staff._id)
                        )
                      }
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">No staff found.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add your first staff member to get started.
          </p>
        </div>
      )}

      {/* Add Staff Modal */}


      {/* Edit Staff Modal */}
    
    </div>
  );
}
