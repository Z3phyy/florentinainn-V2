"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axiosInstance from "@/app/utils/axios";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { adminCreateSchema } from "@/app/utils/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/formField";
import { PasswordInput } from "@/components/ui/passwordInput";
import { PasswordRequirements } from "@/components/ui/passwordRequirements";
import { AccessCodeFields } from "@/components/ui/accessCodeFields";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, UserPlus } from "lucide-react";

type Values = z.input<typeof adminCreateSchema>;
const EMPTY: Values = { name: "", email: "", password: "", accessCode: "", confirmAccessCode: "" };

export function AddAdminModal({ disabled }: { disabled?: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(adminCreateSchema),
    mode: "onTouched",
    defaultValues: EMPTY,
  });
  const errors = form.formState.errors;
  const password = useWatch({ control: form.control, name: "password" }) || "";

  const mutation = useMutation({
    mutationFn: (values: z.output<typeof adminCreateSchema>) =>
      axiosInstance.post("/system/admins", values),
    onSuccess: () => {
      successAlert("Administrator account created.");
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      setOpen(false);
      form.reset(EMPTY);
    },
    onError: (err) => errorAlert(getApiErrorMessage(err, "Failed to create administrator.")),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) form.reset(EMPTY);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled} onClick={() => setOpen(true)}>
          <UserPlus className="size-4" />
          Add Administrator
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Add Administrator</DialogTitle>
          <DialogDescription>
            Create the administrator account. Share the password and access code with them securely.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(adminCreateSchema.parse(values)))}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="admin-name" label="Name" required error={errors.name?.message}>
              <Input id="admin-name" aria-invalid={!!errors.name} {...form.register("name")} />
            </FormField>
            <FormField id="admin-email" label="Email" required error={errors.email?.message}>
              <Input id="admin-email" type="email" autoComplete="off" aria-invalid={!!errors.email} {...form.register("email")} />
            </FormField>
          </div>
          <FormField id="admin-password" label="Password" required error={errors.password?.message}>
            <PasswordInput
              id="admin-password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...form.register("password", {
                onChange: () => {
                  if (form.getFieldState("password").isTouched) form.trigger("password");
                },
              })}
            />
          </FormField>
          <PasswordRequirements password={password} />
          <AccessCodeFields form={form} idPrefix="new-admin" disabled={mutation.isPending} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Administrator"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
