"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axiosInstance from "@/app/utils/axios";
import { errorAlert, successAlert } from "@/app/utils/alert";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { staffRegistrationSchema } from "@/app/utils/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/formField";
import { PasswordInput } from "@/components/ui/passwordInput";
import { Loader2 } from "lucide-react";
import { checkEmailAvailability } from "@/app/utils/customFunction";
import { PasswordRequirements } from "@/components/ui/passwordRequirements";

type Values = z.input<typeof staffRegistrationSchema>;

export default function Page() {
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    setError,
    trigger,
    getFieldState,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(staffRegistrationSchema),
    mode: "onTouched",
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const registerMutation = useMutation({
    mutationFn: (data: { name: string; email: string; password: string }) =>
      axiosInstance.post("/account", data),
    onSuccess: () => {
      successAlert("Registration submitted. Awaiting admin approval.");
      router.push("/guest/login");
    },
    onError: (err) => {
      errorAlert(getApiErrorMessage(err, "Failed to register. Please try again."));
    },
  });

  const onSubmit = handleSubmit(async (values) => {
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
      name: values.name.trim(),
      email: values.email.trim(),
      password: values.password,
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
              Staff Registration
            </h1>
            <p className="text-sm text-muted-foreground">
              Register a staff account. An admin must approve your account and
              assign your access code before you can sign in.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormField id="name" label="Name" required error={errors.name?.message}>
              <Input
                id="name"
                placeholder="John Doe"
                autoComplete="name"
                aria-invalid={!!errors.name}
                {...register("name")}
              />
            </FormField>

            <FormField id="username" label="Email" required error={errors.email?.message}>
              <Input
                id="username"
                type="email"
                autoComplete="email"
                placeholder="staff@hotel.com"
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
                  Registering...
                </>
              ) : (
                "Register"
              )}
            </Button>
          </form>

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
