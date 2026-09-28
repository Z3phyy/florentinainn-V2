"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axiosInstance from "@/app/utils/axios";
import { errorAlert, successAlert } from "@/app/utils/alert";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { emailSchema, passwordWithConfirmSchema } from "@/app/utils/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/formField";
import { PasswordInput } from "@/components/ui/passwordInput";
import { Loader2, Mail, ShieldCheck, KeyRound } from "lucide-react";
import { PasswordRequirements } from "@/components/ui/passwordRequirements";

const emailStepSchema = z.object({ email: emailSchema });
const otpStepSchema = z.object({
  otp: z.string().trim().regex(/^\d{4}$/, "Enter the 4-digit code from your email."),
});

export default function Page() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  const emailForm = useForm<z.input<typeof emailStepSchema>>({
    resolver: zodResolver(emailStepSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });
  const otpForm = useForm<z.input<typeof otpStepSchema>>({
    resolver: zodResolver(otpStepSchema),
    mode: "onTouched",
    defaultValues: { otp: "" },
  });
  const passwordForm = useForm<z.input<typeof passwordWithConfirmSchema>>({
    resolver: zodResolver(passwordWithConfirmSchema),
    mode: "onTouched",
    defaultValues: { password: "", confirmPassword: "" },
  });

  const sendOtpMutation = useMutation({
    mutationFn: (data: { email: string }) =>
      axiosInstance.post("/system/forgot-password/send-otp", data),
    onSuccess: (_res, variables) => {
      successAlert("OTP sent to your email");
      setEmail(variables.email);
      setStep(2);
    },
    onError: (err) =>
      errorAlert(getApiErrorMessage(err, "Failed to send OTP. Please try again.")),
  });

  const verifyOtpMutation = useMutation({
    mutationFn: (data: { email: string; inputOtp: string }) =>
      axiosInstance.post("/system/forgot-password/verify-otp", data),
    onSuccess: (_res, variables) => {
      successAlert("OTP verified");
      setOtp(variables.inputOtp);
      setStep(3);
    },
    onError: (err) =>
      errorAlert(getApiErrorMessage(err, "Invalid OTP. Please try again.")),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (data: { email: string; newPassword: string; inputOtp: string }) =>
      axiosInstance.post("/system/forgot-password/reset-password", data),
    onSuccess: () => {
      successAlert("Password updated successfully");
      router.push("/guest/login");
    },
    onError: (err) =>
      errorAlert(getApiErrorMessage(err, "Failed to reset password. Please try again.")),
  });

  const handleSendOtp = emailForm.handleSubmit((values) => {
    sendOtpMutation.mutate({ email: values.email.trim() });
  });

  const handleVerifyOtp = otpForm.handleSubmit((values) => {
    verifyOtpMutation.mutate({ email, inputOtp: values.otp.trim() });
  });

  const handleResetPassword = passwordForm.handleSubmit((values) => {
    resetPasswordMutation.mutate({ email, newPassword: values.password, inputOtp: otp });
  });

  const newPassword = useWatch({ control: passwordForm.control, name: "password" }) || "";
  const emailErrors = emailForm.formState.errors;
  const otpErrors = otpForm.formState.errors;
  const passwordErrors = passwordForm.formState.errors;

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Forgot Password</h1>
            <p className="text-sm text-muted-foreground">
              {step === 1 && "Enter your email to receive a verification code."}
              {step === 2 && "Enter the 4-digit code sent to your email."}
              {step === 3 && "Set a new password for your account."}
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2">
            <div
              className={`flex items-center gap-1 text-xs ${
                step >= 1 ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <Mail className="size-3.5" />
              Email
            </div>
            <div className="h-px w-6 bg-border" />
            <div
              className={`flex items-center gap-1 text-xs ${
                step >= 2 ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <ShieldCheck className="size-3.5" />
              OTP
            </div>
            <div className="h-px w-6 bg-border" />
            <div
              className={`flex items-center gap-1 text-xs ${
                step >= 3 ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <KeyRound className="size-3.5" />
              New Password
            </div>
          </div>

          {step === 1 && (
            <form onSubmit={handleSendOtp} className="space-y-4" noValidate>
              <FormField id="email" label="Email" required error={emailErrors.email?.message}>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@example.com"
                  aria-invalid={!!emailErrors.email}
                  {...emailForm.register("email")}
                />
              </FormField>

              <Button
                type="submit"
                className="w-full"
                disabled={sendOtpMutation.isPending}
              >
                {sendOtpMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Sending code...
                  </>
                ) : (
                  "Send Code"
                )}
              </Button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-4" noValidate>
              <FormField id="otp" label="Verification Code" required error={otpErrors.otp?.message}>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={4}
                  placeholder="0000"
                  aria-invalid={!!otpErrors.otp}
                  {...otpForm.register("otp", {
                    onChange: (e) => {
                      const digits = String(e.target.value).replace(/\D/g, "");
                      if (digits !== e.target.value) {
                        otpForm.setValue("otp", digits, { shouldValidate: otpForm.getFieldState("otp").isTouched });
                      }
                    },
                  })}
                />
              </FormField>

              <Button
                type="submit"
                className="w-full"
                disabled={verifyOtpMutation.isPending}
              >
                {verifyOtpMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Code"
                )}
              </Button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
              <FormField id="newPassword" label="New Password" required error={passwordErrors.password?.message}>
                <PasswordInput
                  id="newPassword"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  aria-invalid={!!passwordErrors.password}
                  {...passwordForm.register("password", {
                    onChange: () => {
                      if (passwordForm.getFieldState("password").isTouched) passwordForm.trigger("password");
                      if (passwordForm.getFieldState("confirmPassword").isTouched) passwordForm.trigger("confirmPassword");
                    },
                  })}
                />
              </FormField>

              {newPassword && <PasswordRequirements password={newPassword} />}

              <FormField id="confirmPassword" label="Confirm New Password" required error={passwordErrors.confirmPassword?.message}>
                <PasswordInput
                  id="confirmPassword"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  aria-invalid={!!passwordErrors.confirmPassword}
                  {...passwordForm.register("confirmPassword")}
                />
              </FormField>

              <Button
                type="submit"
                className="w-full"
                disabled={resetPasswordMutation.isPending}
              >
                {resetPasswordMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Updating password...
                  </>
                ) : (
                  "Reset Password"
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
