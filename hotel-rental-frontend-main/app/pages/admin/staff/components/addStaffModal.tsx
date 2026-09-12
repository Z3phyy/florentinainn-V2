"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
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
import { Loader2, UserPlus } from "lucide-react";

const PERMISSION_OPTIONS = [
  { label: "Frontdesk Management", value: "frontdesk management" },
  { label: "Reservation Management", value: "reservation management" },
  { label: "Room Management", value: "room management" },
  { label: "Chat Management", value: "chat management" },
  { label: "Availability Management", value: "availability management" },
];

export function AddStaffModal() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [permisions, setPermisions] = useState<string[]>([]);

  const addStaffMutation = useMutation({
    mutationFn: (data: { name: string; email: string; password: string; permisions: string[], isApproved : boolean }) =>
      axiosInstance.post("/account", data),
    onSuccess: () => {
      successAlert("Staff member added successfully.");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setPermisions([]);
    },
      onError: (err: { response?: { data?: string } }) => {
        const message =
          typeof err.response?.data === "string"
            ? err.response.data
            : "Failed to register. Please try again.";
        errorAlert(message);
      },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      errorAlert("Please fill in all required fields.");
      return;
    }
    addStaffMutation.mutate({ name, email, password, permisions , isApproved : true});
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
        <Button onClick={() => setOpen(true)}>
          <UserPlus className="size-4" />
          Add Staff
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Add Staff</DialogTitle>
          <DialogDescription>
            Create a new staff account with custom permissions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username">Email</Label>
            <Input
              id="username"
              type="email"
              placeholder="staff@hotel.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            <Button type="submit" disabled={addStaffMutation.isPending}>
              {addStaffMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Add Staff"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
