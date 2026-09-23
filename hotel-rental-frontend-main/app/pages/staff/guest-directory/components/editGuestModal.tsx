"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { errorAlert, successAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Pencil } from "lucide-react";
import type { GuestDirectoryEntry } from "../page";

export function EditGuestModal({ guest }: { guest: GuestDirectoryEntry }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setName(guest.name || "");
      setEmail(guest.email || "");
      setPhone(guest.phone || "");
      setAddress(guest.address || "");
    }
  }, [open, guest]);

  const updateMutation = useMutation({
    mutationFn: () =>
      axiosInstance.put("/booking/directory", {
        key: guest.key,
        clientName: name.trim(),
        clientEmail: email.trim(),
        clientPhone: phone.trim(),
        clientAddress: address.trim(),
      }),
    onSuccess: () => {
      successAlert("Guest record updated across their bookings.");
      queryClient.invalidateQueries({ queryKey: ["guest-directory"] });
      queryClient.invalidateQueries({ queryKey: ["active-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setOpen(false);
    },
    onError: (err: { response?: { data?: string } }) => {
      const message =
        typeof err.response?.data === "string"
          ? err.response.data
          : "Failed to update guest record.";
      errorAlert(message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Edit guest record"
          onClick={() => setOpen(true)}
        >
          <Pencil className="size-3.5 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Edit Guest Record</DialogTitle>
          <DialogDescription>
            Updates the contact details on all bookings for this guest (
            {guest.totalStays} record{guest.totalStays !== 1 ? "s" : ""}).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="guest-name">Guest Name</Label>
            <Input
              id="guest-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="guest-email">Email</Label>
            <Input
              id="guest-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="guest-phone">Phone</Label>
            <Input
              id="guest-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="guest-address">Address</Label>
            <Input
              id="guest-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || !name.trim()}
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving...
              </>
            ) : (
              "Save Record"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}