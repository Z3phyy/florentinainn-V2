"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axiosInstance from "@/app/utils/axios";
import { accountInterface, permissionOption } from "@/app/types/account.type";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { staffEditSchema } from "@/app/utils/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/formField";
import { PasswordInput } from "@/components/ui/passwordInput";
import { PasswordRequirements } from "@/components/ui/passwordRequirements";
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
import { PermissionChecklist } from "./permissionChecklist";

interface Props {
  staff: accountInterface;
}

type StaffEditValues = z.input<typeof staffEditSchema>;

const valuesFromStaff = (staff: accountInterface): StaffEditValues => ({
  name: staff.name || "",
  position: staff.position || "",
  email: staff.email || "",
  password: "",
  permisions: staff.permisions || [],
});

export function EditStaffModal({ staff }: Props) {
  const queryClient = useQueryClient();
  const currentUser = useUserStore((s) => s.user);
  const isSuperAdmin = currentUser?.type === "super admin";

  const [open, setOpen] = useState(false);

  const form = useForm<StaffEditValues>({
    resolver: zodResolver(staffEditSchema),
    mode: "onTouched",
    defaultValues: valuesFromStaff(staff),
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = form;

  const {
    data: permissionData,
    isLoading: permissionsLoading,
    isError: permissionsError,
  } = useQuery({
    queryKey: ["permission-matrix"],
    enabled: open && isSuperAdmin,
    queryFn: async (): Promise<{ permissions: permissionOption[] }> => {
      const res = await axiosInstance.get("/account/permissions");
      return res.data;
    },
  });

  const permissionOptions = permissionData?.permissions ?? [];

  const editStaffMutation = useMutation({
    mutationFn: (data: z.output<typeof staffEditSchema>) =>
      axiosInstance.put("/account", {
        _id: staff._id,
        name: data.name,
        email: data.email,
        position: data.position,
        ...(data.password ? { password: data.password } : {}),
        ...(isSuperAdmin ? { permisions: data.permisions } : {}),
      }),
    onSuccess: () => {
      successAlert("Staff member updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setOpen(false);
    },
    onError: (err) => errorAlert(getApiErrorMessage(err, "Failed to update staff member.")),
  });

  const onSubmit = handleSubmit((values) => {
    editStaffMutation.mutate(staffEditSchema.parse(values));
  });

  const password = useWatch({ control, name: "password" }) || "";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset(valuesFromStaff(staff));
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" title="Edit staff" aria-label="Edit staff">
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Staff</DialogTitle>
          <DialogDescription>
            Update staff account details{isSuperAdmin ? " and permissions" : ""}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id={`edit-name-${staff._id}`} label="Name" required error={errors.name?.message}>
              <Input
                id={`edit-name-${staff._id}`}
                placeholder="John Doe"
                aria-invalid={!!errors.name}
                {...register("name")}
              />
            </FormField>

            <FormField id={`edit-position-${staff._id}`} label="Position / Designation" error={errors.position?.message}>
              <Input
                id={`edit-position-${staff._id}`}
                placeholder="Front Desk Receptionist"
                aria-invalid={!!errors.position}
                {...register("position")}
              />
            </FormField>
          </div>

          <FormField id={`edit-email-${staff._id}`} label="Email" required error={errors.email?.message}>
            <Input
              id={`edit-email-${staff._id}`}
              type="email"
              placeholder="staff@hotel.com"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
          </FormField>

          <FormField
            id={`edit-password-${staff._id}`}
            label="New Password"
            error={errors.password?.message}
            hint="Leave blank to keep the current password. Setting a new one signs the staff member out everywhere."
          >
            <PasswordInput
              id={`edit-password-${staff._id}`}
              autoComplete="new-password"
              placeholder="••••••••"
              aria-invalid={!!errors.password}
              {...register("password", {
                onChange: () => {
                  if (form.getFieldState("password").isTouched) form.trigger("password");
                },
              })}
            />
          </FormField>
          {password && <PasswordRequirements password={password} />}

          {isSuperAdmin ? (
            <div className="space-y-2">
              <Label>Permissions</Label>
              <Controller
                control={control}
                name="permisions"
                render={({ field }) => (
                  <PermissionChecklist
                    options={permissionOptions}
                    value={field.value}
                    onChange={field.onChange}
                    isLoading={permissionsLoading}
                    isError={permissionsError}
                    disabled={editStaffMutation.isPending}
                  />
                )}
              />
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={editStaffMutation.isPending || !isDirty}>
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
