"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axiosInstance from "@/app/utils/axios";
import { permissionOption } from "@/app/types/account.type";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { staffCreateSchema } from "@/app/utils/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/formField";
import { PasswordInput } from "@/components/ui/passwordInput";
import { PasswordRequirements } from "@/components/ui/passwordRequirements";
import { AccessCodeFields } from "@/components/ui/accessCodeFields";
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
import { PermissionChecklist } from "./permissionChecklist";

type StaffCreateValues = z.input<typeof staffCreateSchema>;

const EMPTY_VALUES: StaffCreateValues = {
  name: "",
  position: "",
  email: "",
  password: "",
  permisions: [],
  accessCode: "",
  confirmAccessCode: "",
};

export function AddStaffModal() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const form = useForm<StaffCreateValues>({
    resolver: zodResolver(staffCreateSchema),
    mode: "onTouched",
    defaultValues: EMPTY_VALUES,
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = form;

  const {
    data: permissionData,
    isLoading: permissionsLoading,
    isError: permissionsError,
  } = useQuery({
    queryKey: ["permission-matrix"],
    enabled: open,
    queryFn: async (): Promise<{ permissions: permissionOption[] }> => {
      const res = await axiosInstance.get("/account/permissions");
      return res.data;
    },
  });

  const permissionOptions = permissionData?.permissions ?? [];

  const addStaffMutation = useMutation({
    mutationFn: (data: z.output<typeof staffCreateSchema>) =>
      axiosInstance.post("/account/staff", data),
    onSuccess: () => {
      successAlert("Staff member added successfully.");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setOpen(false);
      reset(EMPTY_VALUES);
    },
    onError: (err) => errorAlert(getApiErrorMessage(err, "Failed to add staff member.")),
  });

  const onSubmit = handleSubmit((values) => {
    addStaffMutation.mutate(staffCreateSchema.parse(values));
  });

  const password = useWatch({ control, name: "password" }) || "";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset(EMPTY_VALUES);
      }}
    >
      <DialogTrigger asChild>
        <Button onClick={() => setOpen(true)}>
          <UserPlus className="size-4" />
          Add Staff
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Add Staff</DialogTitle>
          <DialogDescription>
            Create a staff account, assign an access code, and choose what they can do.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="name" label="Name" required error={errors.name?.message}>
              <Input
                id="name"
                placeholder="John Doe"
                aria-invalid={!!errors.name}
                aria-describedby="name-error"
                {...register("name")}
              />
            </FormField>

            <FormField id="position" label="Position / Designation" error={errors.position?.message}>
              <Input
                id="position"
                placeholder="Front Desk Receptionist"
                aria-invalid={!!errors.position}
                aria-describedby="position-error"
                {...register("position")}
              />
            </FormField>
          </div>

          <FormField id="username" label="Email" required error={errors.email?.message}>
            <Input
              id="username"
              type="email"
              autoComplete="off"
              placeholder="staff@hotel.com"
              aria-invalid={!!errors.email}
              aria-describedby="username-error"
              {...register("email")}
            />
          </FormField>

          <FormField id="password" label="Password" required error={errors.password?.message}>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder="••••••••"
              aria-invalid={!!errors.password}
              aria-describedby="password-error"
              {...register("password", {
                onChange: () => {
                  if (form.getFieldState("password").isTouched) form.trigger("password");
                },
              })}
            />
          </FormField>
          <PasswordRequirements password={password} />

          <AccessCodeFields form={form} idPrefix="add-staff" disabled={addStaffMutation.isPending} />

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
                  disabled={addStaffMutation.isPending}
                />
              )}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
