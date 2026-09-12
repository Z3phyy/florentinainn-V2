"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axiosInstance from "@/app/utils/axios";
import { errorAlert, successAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, ShieldCheck, KeyRound } from "lucide-react";
import { validatePassword, validateEmail } from "@/app/utils/validation";
import { PasswordRequirements } from "@/components/ui/passwordRequirements";

type ErrorResponse = { response?: { data?: string } };

const errorMessage = (err: ErrorResponse, fallback: string) =>
  typeof err.response?.data === "string" ? err.response.data : fallback;

export default function Page() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const sendOtpMutation = useMutation({
    mutationFn: (data: { email: string }) =>
      axiosInstance.post("/system/forgot-password/send-otp", data),
    onSuccess: () => {
      successAlert("OTP sent to your email");
      setStep(2);
    },
    onError: (err: ErrorResponse) =>
      errorAlert(errorMessage(err, "Failed to send OTP. Please try again.")),
  });

  const verifyOtpMutation = useMutation({
    mutationFn: (data: { email: string; inputOtp: string }) =>
      axiosInstance.post("/system/forgot-password/verify-otp", data),
    onSuccess: () => {
      successAlert("OTP verified");
      setStep(3);
    },
    onError: (err: ErrorResponse) =>
      errorAlert(errorMessage(err, "Invalid OTP. Please try again.")),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (data: { email: string; newPassword: string; inputOtp: string }) =>
      axiosInstance.post("/system/forgot-password/reset-password", data),
    onSuccess: () => {
      successAlert("Password updated successfully");
      router.push("/guest/login");
    },
    onError: (err: ErrorResponse) =>
      errorAlert(errorMessage(err, "Failed to reset password. Please try again.")),
  });

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      errorAlert("Please enter your email.");
      return;
    }

    const emailErr = validateEmail(email);
    if (emailErr) {
      errorAlert(emailErr);
      return;
    }

    sendOtpMutation.mutate({ email });
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();

    if (!otp) {
      errorAlert("Please enter the OTP.");
      return;
    }

    verifyOtpMutation.mutate({ email, inputOtp: otp });
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      errorAlert("Please fill in all fields.");
      return;
    }

    const passErr = validatePassword(newPassword);
    if (passErr) {
      errorAlert(passErr);
      return;
    }

    if (newPassword !== confirmPassword) {
      errorAlert("Passwords do not match.");
      return;
    }

    resetPasswordMutation.mutate({ email, newPassword, inputOtp: otp });
  };

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
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

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
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="0000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>

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
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              {newPassword && <PasswordRequirements password={newPassword} />}

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

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
