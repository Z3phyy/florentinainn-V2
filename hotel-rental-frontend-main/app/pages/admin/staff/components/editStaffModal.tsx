"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { accountInterface } from "@/app/types/account.type";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Pencil } from "lucide-react";

const PERMISSION_OPTIONS = [
  { label: "Frontdesk Management", value: "frontdesk management" },
  { label: "Reservation Management", value: "reservation management" },
  { label: "Room Management", value: "room management" },
  { label: "Chat Management", value: "chat management" },
  { label: "Availability Management", value: "availability management" },
];

interface Props {
  staff: accountInterface;
}

export function EditStaffModal({ staff }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [permisions, setPermisions] = useState<string[]>([]);

  // Pre-populate fields when modal opens
  useEffect(() => {
    if (open) {
      setName(staff.name);
      setEmail(staff.email);
      
      setPermisions(staff.permisions);
    }
  }, [open, staff]);

  const editStaffMutation = useMutation({
    mutationFn: (data: { _id: string; name: string; email: string; password: string; permisions: string[] }) =>
      axiosInstance.put("/account", data),
    onSuccess: () => {
      successAlert("Staff member updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setOpen(false);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      const message =
        err.response?.data?.message || "Failed to update staff member.";
      errorAlert(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      errorAlert("Please fill in all required fields.");
      return;
    }
    editStaffMutation.mutate({
      _id: staff._id,
      name,
      email,
      password : staff.password,
      permisions,
    });
  };

  const togglePermission = (value: string) => {
    setPermisions((prev) =>
      prev.includes(value)
        ? prev.filter((p) => p !== value)
        : [...prev, value]
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)}>
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Edit Staff</DialogTitle>
          <DialogDescription>
            Update staff account details and permissions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="edit-username">Email</Label>
            <Input
              id="edit-username"
              type="email"
              placeholder="staff@hotel.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

       

          {/* Permissions */}
          <div className="space-y-3">
            <Label>Permissions</Label>
            <div className="space-y-2">
              {PERMISSION_OPTIONS.map((perm) => (
                <div
                  key={perm.value}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <span className="text-sm">{perm.label}</span>
                  <Switch
                    checked={permisions.includes(perm.value)}
                    onCheckedChange={() => togglePermission(perm.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={editStaffMutation.isPending}>
              {editStaffMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
