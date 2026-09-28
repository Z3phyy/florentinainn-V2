"use client";

import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axiosInstance from "@/app/utils/axios";
import { errorAlert, successAlert } from "@/app/utils/alert";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { adminRegistrationSchema } from "@/app/utils/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/formField";
import { PasswordInput } from "@/components/ui/passwordInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ShieldAlert } from "lucide-react";
import { checkEmailAvailability } from "@/app/utils/customFunction";
import { PasswordRequirements } from "@/components/ui/passwordRequirements";

type Values = z.input<typeof adminRegistrationSchema>;

export default function Page() {
  const router = useRouter();

  const { data: adminStatus, isLoading: statusLoading } = useQuery<{
    canRegister: boolean;
    hasAdmin: boolean;
    hasSuperAdmin: boolean;
  }>({
    queryKey: ["admin-registration-status"],
    queryFn: async () => {
      const res = await axiosInstance.get("/system/admin/status");
      return res.data;
    },
  });

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    trigger,
    getFieldState,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(adminRegistrationSchema),
    mode: "onTouched",
    defaultValues: { type: "super admin", email: "", password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (adminStatus) {
      setValue("type", adminStatus.hasSuperAdmin ? "admin" : "super admin");
    }
  }, [adminStatus, setValue]);

  const registerMutation = useMutation({
    mutationFn: (data: { email: string; password: string; type: string }) =>
      axiosInstance.post("/system/admin", data),
    onSuccess: () => {
      successAlert("Admin account created. Sign in to set up your access code.");
      router.push("/guest/login");
    },
    onError: (err) => {
      errorAlert(getApiErrorMessage(err, "Failed to create admin account. Please try again."));
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (adminStatus?.canRegister === false) {
      errorAlert("Public admin registration is closed.");
      return;
    }
    try {
      const availability = await checkEmailAvailability(values.email);
      if (!availability.available) {
        setError("email", {
          message: "This email is already registered. Please use a different email address.",
        });
        return;
      }
    } catch (err) {
      errorAlert(getApiErrorMessage(err, "Could not verify the email address. Please try again."));
      return;
    }
    registerMutation.mutate({
      email: values.email.trim(),
      password: values.password,
      type: values.type,
    });
  });

  const password = useWatch({ control, name: "password" }) || "";
  const busy = isSubmitting || registerMutation.isPending;

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Create Admin Account
            </h1>
            <p className="text-sm text-muted-foreground">
              Initial setup only. Once the super admin exists, administrator
              accounts are created from System Configuration.
            </p>
          </div>

          {statusLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : adminStatus?.canRegister === false ? (
            <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/10 text-center space-y-2">
              <ShieldAlert className="size-6 text-amber-500 mx-auto" />
              <p className="text-sm font-semibold text-foreground">
                Registration Closed
              </p>
              <p className="text-xs text-muted-foreground">
                The super admin account is already registered. Ask the super
                admin to create administrator accounts from System Configuration.
              </p>
              <Button
                onClick={() => router.push("/guest/login")}
                variant="outline"
                size="sm"
                className="mt-2"
              >
                Return to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <FormField id="type" label="Account Type" required error={errors.type?.message}>
                <Controller
                  control={control}
                  name="type"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="type" className="w-full">
                        <SelectValue placeholder="Select account type" />
                      </SelectTrigger>
                      <SelectContent>
                        {!adminStatus?.hasSuperAdmin && (
                          <SelectItem value="super admin">Super Admin</SelectItem>
                        )}
                        {!adminStatus?.hasAdmin && (
                          <SelectItem value="admin">Admin</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>

              <FormField id="email" label="Email" required error={errors.email?.message}>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@example.com"
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
              </FormField>

              <FormField id="password" label="Password" required error={errors.password?.message}>
                <PasswordInput
                  id="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  aria-invalid={!!errors.password}
                  {...register("password", {
                    onChange: () => {
                      if (getFieldState("password").isTouched) trigger("password");
                      if (getFieldState("confirmPassword").isTouched) trigger("confirmPassword");
                    },
                  })}
                />
              </FormField>

              {password && <PasswordRequirements password={password} />}

              <FormField id="confirmPassword" label="Confirm Password" required error={errors.confirmPassword?.message}>
                <PasswordInput
                  id="confirmPassword"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  aria-invalid={!!errors.confirmPassword}
                  {...register("confirmPassword")}
                />
              </FormField>

              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground">
            <Link
              href="/guest/login"
              className="underline underline-offset-4 hover:text-foreground transition-colors"
            >
              Back to login
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
