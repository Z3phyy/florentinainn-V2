"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { accountInterface } from "@/app/types/account.type";
import { successAlert, errorAlert, confirmAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, UserCheck, Check, X } from "lucide-react";

export function PendingStaffModal() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["staff"],
    queryFn: async (): Promise<accountInterface[]> => {
      const response = await axiosInstance.get("/account");
      return response.data;
    },
  });

  const pendingStaff = data?.filter((staff) => staff.isApproved === false) ?? [];

  const approveMutation = useMutation({
    mutationFn: (_id: string) => axiosInstance.put("/account/approve", { _id }),
    onSuccess: () => {
      successAlert("Staff account approved.");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: { response?: { data?: string } }) => {
      const message =
        typeof err.response?.data === "string"
          ? err.response.data
          : "Failed to approve staff account.";
      errorAlert(message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (_id: string) =>
      axiosInstance.delete("/account/reject", { data: { _id } }),
    onSuccess: () => {
      successAlert("Staff account rejected.");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: { response?: { data?: string } }) => {
      const message =
        typeof err.response?.data === "string"
          ? err.response.data
          : "Failed to reject staff account.";
      errorAlert(message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" onClick={() => setOpen(true)}>
          <UserCheck className="size-4" />
          Pending Approvals
          {pendingStaff.length > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground">
              {pendingStaff.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Pending Approvals</DialogTitle>
          <DialogDescription>
            Review staff accounts waiting for approval.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">Failed to load pending staff.</p>
        ) : pendingStaff.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-sm text-muted-foreground">No pending approvals.</p>
            <p className="text-xs text-muted-foreground mt-1">
              All staff accounts have been reviewed.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingStaff.map((staff) => (
              <div
                key={staff._id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{staff.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {staff.email}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>{
                       setOpen(false)
                      confirmAlert(
                        `Approve "${staff.name}"?`,
                        "Approve",
                        () => approveMutation.mutate(staff._id)
                      )

                    }
                      
                    
                    }
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Check className="size-3.5 text-green-600" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setOpen(false)
                      confirmAlert(
                        `Reject and delete "${staff.name}"?`,
                        "Reject",
                        () => rejectMutation.mutate(staff._id)
                      )
                    }
                      
                    }
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                  >
                    <X className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
