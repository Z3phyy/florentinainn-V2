"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { roomInterface } from "@/app/types/room.type";
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
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddRoomModal } from "./components/addRoomModal";
import { EditRoomModal } from "./components/editRoomModal";
import { UploadImagesModal } from "./components/uploadImagesModal";
import { MaintenanceModal } from "./components/maintenanceModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Trash2,
  Percent,
  Loader2,
  Search,
  X,
} from "lucide-react";

export default function Page() {
  const queryClient = useQueryClient();
  const [discountDialogRoom, setDiscountDialogRoom] = useState<roomInterface | null>(null);
  const [discountValue, setDiscountValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["rooms"],
    queryFn: async (): Promise<roomInterface[]> => {
      const response = await axiosInstance.get("/room");
      return response.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      axiosInstance.delete("/room", { data: { _id: id } }),
    onSuccess: () => {
      successAlert("Room deleted.");
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      const message =
        err.response?.data?.message || "Failed to delete room.";
      errorAlert(message);
    },
  });

  const toggleMaintenanceMutation = useMutation({
    mutationFn: (id: string) =>
      axiosInstance.patch("/room/maintenance", { _id: id }),
    onSuccess: () => {
      successAlert("Room maintenance status updated.");
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      const message =
        err.response?.data?.message || "Failed to toggle maintenance.";
      errorAlert(message);
    },
  });

  const updateDiscountMutation = useMutation({
    mutationFn: ({ id, discount }: { id: string; discount: number }) =>
      axiosInstance.patch("/room/discount", { _id: id, discount }),
    onSuccess: () => {
      successAlert("Discount updated.");
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      setDiscountDialogRoom(null);
      setDiscountValue("");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      const message =
        err.response?.data?.message || "Failed to update discount.";
      errorAlert(message);
    },
  });

  const statusVariant = (status: string) => {
    switch (status) {
      case "available":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800";
      case "occupied":
        return "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800";
      case "reserved":
        return "bg-violet-500/10 text-violet-600 border-violet-200 dark:border-violet-800";
      case "maintenance":
        return "bg-red-500/10 text-red-600 border-red-200 dark:border-red-800";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const filteredRooms = (data || []).filter((room) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const matchesCat = room.category?.toLowerCase().includes(q);
    const matchesNum = room.roomNumber?.toLowerCase().includes(q);
    return matchesCat || matchesNum;
  });

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3 py-1 text-xs font-semibold text-[#900546] dark:text-[#F968AC] mb-2">
            Inventory Folio
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#130005] dark:text-white">
            Suites & Room Inventory
          </h1>
          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5">
            Manage unit numbers, pricing folios, promotional discounts, and photo galleries.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-[#5C454B]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search unit # or category..."
              className="pl-9 pr-8 h-10 rounded-xl bg-white dark:bg-[#1A0E13] border-[#D9C3C3] text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <AddRoomModal />
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
        <p className="text-sm text-destructive">Failed to load rooms data.</p>
      ) : filteredRooms && filteredRooms.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Room / Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Amenities</TableHead>
              <TableHead className="w-[140px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRooms.map((room) => (
              <TableRow key={room._id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2.5">
                    {room.image && (
                      <div className="size-9 rounded-lg overflow-hidden border border-border shrink-0 bg-muted">
                        <img src={room.image} alt={room.category} className="size-full object-cover" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        {room.roomNumber ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
                            Room {room.roomNumber}
                          </span>
                        ) : null}
                        <span className="font-semibold text-sm text-foreground">{room.category}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Max {room.maxHead || 2} guests</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell><span className="font-medium">₱{room.price.toLocaleString()}</span></TableCell>
                <TableCell>
                  {room.discount > 0 ? (
                    <span className="text-destructive font-medium">-{room.discount}%</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${statusVariant(room.status)}`}>
                    {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-[250px]">
                    {room.amenities?.slice(0, 3).map((amenity) => (
                      <span key={amenity} className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-medium">{amenity}</span>
                    ))}
                    {room.amenities?.length > 3 && (
                      <span className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">+{room.amenities.length - 3}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {/* Maintenance toggle */}
                    <div className="flex items-center gap-1.5 px-2">
                      <Switch
                        size="sm"
                        checked={room.status === "maintenance"}
                        disabled={room.status === "occupied" || room.status === "reserved"}
                        onCheckedChange={() => toggleMaintenanceMutation.mutate(room._id)}
                      />
                    </div>
                    {/* Maintenance details modal */}
                    <MaintenanceModal room={room} />
                    {/* Discount button */}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setDiscountDialogRoom(room);
                        setDiscountValue(String(room.discount));
                      }}
                      title="Set discount"
                    >
                      <Percent className="size-3.5 text-muted-foreground" />
                    </Button>
                    <UploadImagesModal room={room} />
                    <EditRoomModal room={room} />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        confirmAlert(`Delete room "${room.category}"?`, "Delete", () => deleteMutation.mutate(room._id))
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
          <p className="text-sm text-muted-foreground">No rooms found.</p>
          <p className="text-xs text-muted-foreground mt-1">Add your first room to get started.</p>
        </div>
      )}

      {/* Discount Update Dialog */}
      <Dialog
        open={!!discountDialogRoom}
        onOpenChange={(open) => {
          if (!open) {
            setDiscountDialogRoom(null);
            setDiscountValue("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="size-4" />
              Update Discount
            </DialogTitle>
            <DialogDescription>
              Set discount percentage for {discountDialogRoom?.category}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="discount">
                Discount (%)
              </Label>
              <div className="relative">
                <Input
                  id="discount"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                  %
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Set to 0 to remove discount.
              </p>
            </div>
            {discountDialogRoom && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Price</span>
                  <span className="font-medium">₱{discountDialogRoom.price.toLocaleString()}</span>
                </div>
                {Number(discountValue) > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span className="text-muted-foreground">Discounted Price</span>
                    <span className="font-medium">
                      ₱{(discountDialogRoom.price * (1 - Number(discountValue) / 100)).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDiscountDialogRoom(null);
                setDiscountValue("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!discountDialogRoom) return;
                const disc = Math.max(0, Math.min(100, Number(discountValue) || 0));
                updateDiscountMutation.mutate({
                  id: discountDialogRoom._id,
                  discount: disc,
                });
              }}
              disabled={updateDiscountMutation.isPending || !discountDialogRoom}
            >
              {updateDiscountMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Saving...
                </>
              ) : (
                "Save Discount"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
