"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { successAlert, errorAlert, confirmAlert } from "@/app/utils/alert";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { addOnInterface } from "@/app/types/addOn.type";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddOnFormDialog } from "./addOnFormDialog";
import { PackagePlus, Pencil, Plus, Trash2 } from "lucide-react";

const peso = (v: number) => `₱${Number(v || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function AddOnManager() {
  const queryClient = useQueryClient();
  const { data = [], isLoading, isError, refetch } = useQuery<addOnInterface[]>({
    queryKey: ["addons-manage"],
    queryFn: async () => (await axiosInstance.get("/addons/manage")).data,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axiosInstance.delete(`/addons/${id}`),
    onSuccess: (res) => {
      successAlert(res.data?.message || "Add-on removed.");
      queryClient.invalidateQueries({ queryKey: ["addons-manage"] });
      queryClient.invalidateQueries({ queryKey: ["addons"] });
    },
    onError: (err) => errorAlert(getApiErrorMessage(err, "Failed to remove add-on.")),
  });

  return (
    <section className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 space-y-4 shadow-xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-serif text-lg font-bold text-[#130005] dark:text-white flex items-center gap-2">
            <PackagePlus className="size-4.5 text-[#900546]" />
            Booking Add-ons & Extras
          </h2>
          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5 max-w-2xl">
            Items guests can request with a reservation (extra bed, towels, breakfast…). The server prices them and adds them to the reservation bill.
          </p>
        </div>
        <AddOnFormDialog
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              New Add-on
            </Button>
          }
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isError ? (
        <div className="flex items-center gap-3">
          <p className="text-sm text-destructive">Failed to load add-ons.</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No add-ons yet. Create one so guests can request extras.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Add-on</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Max / booking</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((addOn) => (
                <TableRow key={addOn._id}>
                  <TableCell>
                    <p className="text-sm font-medium">{addOn.name}</p>
                    {addOn.description ? <p className="text-[11px] text-muted-foreground">{addOn.description}</p> : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {peso(addOn.price)} <span className="text-muted-foreground">{addOn.pricingUnit === "per_night" ? "/ night" : "/ stay"}</span>
                  </TableCell>
                  <TableCell className="text-xs">{addOn.maxPerBooking}</TableCell>
                  <TableCell className="text-xs">{addOn.stock === null ? "Unlimited" : addOn.stock}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${addOn.isActive ? "border-green-600/30 bg-green-600/10 text-green-700" : "border-gray-500/30 bg-gray-500/10 text-gray-600"}`}>
                      {addOn.isActive ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <AddOnFormDialog
                        addOn={addOn}
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${addOn.name}`} title="Edit">
                            <Pencil className="size-3.5" />
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${addOn.name}`}
                        title={addOn.bookingCount ? "Deactivate (used by bookings)" : "Delete"}
                        disabled={deleteMutation.isPending}
                        onClick={() =>
                          confirmAlert(
                            addOn.bookingCount
                              ? `"${addOn.name}" is on ${addOn.bookingCount} booking(s). It will be deactivated instead of deleted.`
                              : `Delete "${addOn.name}"?`,
                            addOn.bookingCount ? "Deactivate" : "Delete",
                            () => deleteMutation.mutate(addOn._id),
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
        </div>
      )}
    </section>
  );
}
