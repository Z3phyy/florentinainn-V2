"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { accountInterface, permissionOption } from "@/app/types/account.type";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
import useUserStore from "@/app/store/useUserStore";

interface Props {
  staff: accountInterface;
}

export function EditStaffModal({ staff }: Props) {
  const queryClient = useQueryClient();
  const currentUser = useUserStore((s) => s.user);
  const isSuperAdmin = currentUser?.type === "super admin";

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [email, setEmail] = useState("");
  const [permisions, setPermisions] = useState<string[]>([]);

  const { data: permissionData, isSuccess } = useQuery({
    queryKey: ["permission-matrix"],
    enabled: open && isSuperAdmin,
    queryFn: async (): Promise<{ permissions: permissionOption[] }> => {
      const res = await axiosInstance.get("/account/permissions");
      return res.data;
    },
  });

  const permissionOptions = permissionData?.permissions ?? [];

  // Pre-populate fields when modal opens
  useEffect(() => {
    if (open) {
      setName(staff.name);
      setEmail(staff.email);
      setPosition(staff.position || "");
      setPermisions(staff.permisions);
    }
  }, [open, staff]);

  const editStaffMutation = useMutation({
    mutationFn: (data: { _id: string; name: string; email: string; password: string; permisions: string[]; position: string }) =>
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
      permisions: isSuperAdmin ? permisions : staff.permisions,
      position,
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

          {/* Position */}
          <div className="space-y-2">
            <Label htmlFor="edit-position">Position / Designation</Label>
            <Input
              id="edit-position"
              placeholder="Front Desk Receptionist"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
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

          {/* Permissions (super admin only) */}
          {isSuperAdmin ? (
            <div className="space-y-3">
              <Label>Permissions</Label>
              {permissionOptions.length === 0 && isSuccess ? null : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {permissionOptions.length === 0 ? (
                    <Skeleton className="h-8 w-full" />
                  ) : (
                    permissionOptions.map((perm) => (
                      <div
                        key={perm.value}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                      >
                        <div>
                          <span className="text-sm">{perm.value}</span>
                          <p className="text-[11px] text-muted-foreground">
                            {perm.operations.join(", ")}
                          </p>
                        </div>
                        <Switch
                          checked={permisions.includes(perm.value)}
                          onCheckedChange={() => togglePermission(perm.value)}
                        />
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Permissions</Label>
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
              <p className="text-[11px] text-muted-foreground">
                Only super admins can change permissions.
              </p>
            </div>
          )}

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