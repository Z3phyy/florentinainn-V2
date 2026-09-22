"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { successAlert, errorAlert } from "@/app/utils/alert";
import useUserStore from "@/app/store/useUserStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  KeyRound,
  Shield,
  CheckCircle2,
  UserRound,
  Mail,
  AtSign,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";
import { validatePassword, validateEmail } from "@/app/utils/validation";
import { PasswordRequirements } from "@/components/ui/passwordRequirements";
import { usePasswordVisibility } from "@/app/hooks/usePasswordVisibility";

export default function Page() {
  const { user, setUser } = useUserStore();
  const currentPasswordVisibility = usePasswordVisibility();
  const newPasswordVisibility = usePasswordVisibility();
  const confirmPasswordVisibility = usePasswordVisibility();

  // ── Update Email form state ──
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");

  // ── Change Password form state ──
  const [currentPasswordForPass, setCurrentPasswordForPass] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const updateEmailMutation = useMutation({
    mutationFn: (data: {
      currentEmail: string;
      currentPassword: string;
      newEmail: string;
    }) => axiosInstance.put("/system/admin/change-credentials", data),
    onSuccess: (response) => {
      successAlert("Email updated successfully.");
      if (response.data?.admin?.email && user) {
        setUser({
          ...user,
          email: response.data.admin.email,
        });
      }
      setCurrentPassword("");
      setNewEmail("");
    },
    onError: (err: { response?: { data?: string | { message?: string } } }) => {
      const message =
        typeof err.response?.data === "string"
          ? err.response.data
          : err.response?.data?.message || "Failed to update email.";
      errorAlert(message);
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: {
      currentEmail: string;
      currentPassword: string;
      newPassword: string;
    }) => axiosInstance.put("/system/admin/change-credentials", data),
    onSuccess: () => {
      successAlert("Password updated successfully.");
      setCurrentPasswordForPass("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: { response?: { data?: string | { message?: string } } }) => {
      const message =
        typeof err.response?.data === "string"
          ? err.response.data
          : err.response?.data?.message || "Failed to update password.";
      errorAlert(message);
    },
  });

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      errorAlert("Please enter your current password to verify.");
      return;
    }

    const email = newEmail.trim();
    if (!email) {
      errorAlert("Please enter your new email.");
      return;
    }

    if (email === (user?.email || "")) {
      errorAlert("New email must be different from your current email.");
      return;
    }

    const emailErr = validateEmail(email);
    if (emailErr) {
      errorAlert(emailErr);
      return;
    }

    updateEmailMutation.mutate({
      currentEmail: user?.email || "",
      currentPassword,
      newEmail: email,
    });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPasswordForPass) {
      errorAlert("Please enter your current password.");
      return;
    }

    const passErr = validatePassword(newPassword);
    if (passErr) {
      errorAlert(passErr);
      return;
    }

    if (newPassword !== confirmPassword) {
      errorAlert("New passwords do not match.");
      return;
    }

    changePasswordMutation.mutate({
      currentEmail: user?.email || "",
      currentPassword: currentPasswordForPass,
      newPassword,
    });
  };

  const roleTitle =
    user?.type === "super admin" ? "Super Administrator" : "Administrator";
  const initials = user?.name
    ? user.name
        .split(" ")
        .filter(Boolean)
        .map((w) => w.charAt(0))
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "A";

  return (
    <div className="space-y-8 max-w-3xl">
      {/* ── Header ── */}
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3 py-1 text-xs font-semibold text-[#900546] dark:text-[#F968AC] mb-2">
          Account & Security
        </div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-[#130005] dark:text-white">
          My Profile
        </h1>
        <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-1">
          View your administrator details and manage your login email and
          password securely.
        </p>
      </div>

      {/* ── Identity Card ── */}
      <section className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="size-16 rounded-2xl bg-[#900546]/10 text-[#900546] dark:text-[#F968AC] border border-[#900546]/20 flex items-center justify-center font-bold text-2xl shrink-0 shadow-xs">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-serif text-xl font-bold text-[#130005] dark:text-white">
                {user?.name || roleTitle}
              </h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#618685]/10 text-[#618685] dark:text-[#88afae] border border-[#618685]/30 uppercase">
                <Shield className="size-3" />
                {roleTitle}
              </span>
            </div>
            <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-1">
              {user?.email}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-2xl bg-[#FAF5F5] dark:bg-[#130005] border border-[#D9C3C3] dark:border-white/10">
            <p className="text-[10px] font-semibold uppercase text-[#5C454B] dark:text-gray-400 flex items-center gap-1">
              <UserRound className="size-3" /> Full Name
            </p>
            <p className="font-bold text-[#130005] dark:text-white mt-1">
              {user?.name || "—"}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-[#FAF5F5] dark:bg-[#130005] border border-[#D9C3C3] dark:border-white/10">
            <p className="text-[10px] font-semibold uppercase text-[#5C454B] dark:text-gray-400 flex items-center gap-1">
              <AtSign className="size-3" /> Login Email
            </p>
            <p className="font-bold text-[#130005] dark:text-white mt-1 truncate">
              {user?.email || "—"}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-[#FAF5F5] dark:bg-[#130005] border border-[#D9C3C3] dark:border-white/10">
            <p className="text-[10px] font-semibold uppercase text-[#5C454B] dark:text-gray-400 flex items-center gap-1">
              <CheckCircle2 className="size-3" /> Access Level
            </p>
            <p className="font-bold text-[#130005] dark:text-white mt-1 capitalize">
              {user?.type || "admin"}
            </p>
          </div>
        </div>
      </section>

      {/* ── Update Email (separate flow) ── */}
      <section className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 shadow-xs space-y-5">
        <div>
          <h2 className="font-serif text-lg font-bold text-[#130005] dark:text-white flex items-center gap-2">
            <Mail className="size-4.5 text-[#900546] dark:text-[#F968AC]" />
            Update Email
          </h2>
          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5">
            Change the email address you use to sign in.
          </p>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div className="rounded-xl border border-[#D9C3C3] dark:border-white/10 bg-[#FAF5F5] dark:bg-[#130005] p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="profile-new-email" className="text-xs">
                New Email
              </Label>
              <Input
                id="profile-new-email"
                type="email"
                placeholder="newemail@hotel.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </div>
            <div className="relative">
              <Label htmlFor="profile-verify-pass" className="text-xs">
                Current Password
              </Label>
              <Input
                id="profile-verify-pass"
                type={currentPasswordVisibility.passwordInputType}
                placeholder="Enter your current password to verify"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="pr-10"
              />

              <button
                type="button"
                onClick={currentPasswordVisibility.togglePasswordVisibility}
                aria-label={
                  currentPasswordVisibility.showPassword
                    ? "Hide password"
                    : "Show password"
                }
                className="absolute right-0 -bottom-2 flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              >
                {currentPasswordVisibility.showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateEmailMutation.isPending}
              variant="outline"
              className="gap-2"
            >
              {updateEmailMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Updating...
                </>
              ) : (
                <>
                  <Mail className="size-4" /> Update Email
                </>
              )}
            </Button>
          </div>
        </form>
      </section>

      {/* ── Change Password (separate flow) ── */}
      <section className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 shadow-xs space-y-5">
        <div>
          <h2 className="font-serif text-lg font-bold text-[#130005] dark:text-white flex items-center gap-2">
            <KeyRound className="size-4.5 text-amber-500" />
            Change Password
          </h2>
          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5">
            Set a new password for your administrator account.
          </p>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="rounded-xl border border-[#D9C3C3] dark:border-white/10 bg-[#FAF5F5] dark:bg-[#130005] p-4 space-y-3">
            <div className="relative">
              <Label htmlFor="profile-current-pass" className="text-xs">
                Current Password
              </Label>
              <Input
                id="profile-current-pass"
                type={currentPasswordVisibility.passwordInputType}
                placeholder="Enter your current password"
                value={currentPasswordForPass}
                onChange={(e) => setCurrentPasswordForPass(e.target.value)}
                required
                className="pr-10"
              />

              <button
                type="button"
                onClick={currentPasswordVisibility.togglePasswordVisibility}
                aria-label={
                  currentPasswordVisibility.showPassword
                    ? "Hide password"
                    : "Show password"
                }
                className="absolute right-0 -bottom-2 flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              >
                {currentPasswordVisibility.showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            <div className="relative">
              <Label htmlFor="profile-new-pass" className="text-xs">
                New Password
              </Label>
              <Input
                id="profile-new-pass"
                type={newPasswordVisibility.passwordInputType}
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="pr-10"
              />

              <button
                type="button"
                onClick={newPasswordVisibility.togglePasswordVisibility}
                aria-label={
                  newPasswordVisibility.showPassword
                    ? "Hide password"
                    : "Show password"
                }
                className="absolute right-0 -bottom-2 flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              >
                {newPasswordVisibility.showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>

            {newPassword && (
              <>
                <PasswordRequirements password={newPassword} />
                <div className="relative">
                  <Label htmlFor="profile-new-pass" className="text-xs">
                    Repeat new password
                  </Label>
                  <Input
                    id="profile-confirm-pass"
                    type={confirmPasswordVisibility.passwordInputType}
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="pr-10"
                  />

                  <button
                    type="button"
                    onClick={confirmPasswordVisibility.togglePasswordVisibility}
                    aria-label={
                      confirmPasswordVisibility.showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    className="absolute right-0 -bottom-2 flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {confirmPasswordVisibility.showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={changePasswordMutation.isPending}
              className="gap-2"
            >
              {changePasswordMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Updating...
                </>
              ) : (
                <>
                  <RefreshCw className="size-4" /> Change Password
                </>
              )}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
