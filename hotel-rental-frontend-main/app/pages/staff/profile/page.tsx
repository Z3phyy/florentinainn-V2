"use client";

import { useState, useEffect } from "react";
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
  Mail,
  ShieldCheck,
  UserRound,
  AtSign,
  RefreshCw,
} from "lucide-react";
import { validatePassword, validateEmail } from "@/app/utils/validation";
import { PasswordRequirements } from "@/components/ui/passwordRequirements";

export default function Page() {
  const { user, setUser } = useUserStore();

  // ── Update Email form state ──
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");

  // ── Change Password form state ──
  const [currentPasswordForPass, setCurrentPasswordForPass] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const updateEmailMutation = useMutation({
    mutationFn: (data: { oldEmail: string; oldPassword: string; newEmail: string }) =>
      axiosInstance.put("/account/change-credentials", data),
    onSuccess: (response) => {
      successAlert("Email updated successfully.");
      if (response.data?.account?.email && user) {
        setUser({
          ...user,
          email: response.data.account.email,
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
    mutationFn: (data: { oldEmail: string; oldPassword: string; newPassword: string }) =>
      axiosInstance.put("/account/change-credentials", data),
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
      oldEmail: user?.email || "",
      oldPassword: currentPassword,
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
      oldEmail: user?.email || "",
      oldPassword: currentPasswordForPass,
      newPassword,
    });
  };

  const roleTitle = user?.type || "Front Desk Staff";
  const initials = user?.name
    ? user.name
        .split(" ")
        .filter(Boolean)
        .map((w) => w.charAt(0))
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "S";

  const permissionCount = user?.permisions?.length ?? 0;

  return (
    <div className="w-full min-h-screen p-6 sm:p-8 space-y-8 max-w-3xl">
      {/* ── Header ── */}
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#618685]/30 bg-[#618685]/10 px-3 py-1 text-xs font-semibold text-[#618685] dark:text-[#88afae] mb-2">
          Account & Security
        </div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-[#130005] dark:text-white">
          My Profile
        </h1>
        <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-1">
          View your staff details and manage your login email and password securely.
        </p>
      </div>

      {/* ── Identity Card ── */}
      <section className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="size-16 rounded-2xl bg-[#618685]/15 text-[#618685] dark:text-[#88afae] border border-[#618685]/25 flex items-center justify-center font-bold text-2xl shrink-0 shadow-xs">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-serif text-xl font-bold text-[#130005] dark:text-white">
                {user?.name || roleTitle}
              </h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#900546]/10 text-[#900546] dark:text-[#F968AC] border border-[#900546]/30 uppercase">
                <ShieldCheck className="size-3" />
                {roleTitle}
              </span>
            </div>
            <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-1">{user?.email}</p>
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
              <ShieldCheck className="size-3" /> Access Level
            </p>
            <p className="font-bold text-[#130005] dark:text-white mt-1 capitalize">
              {user?.type || "staff"}
            </p>
          </div>
        </div>

        {permissionCount > 0 && (
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold uppercase text-[#5C454B] dark:text-gray-400">
              Permissions:
            </span>
            {user?.permisions?.map((perm) => (
              <span
                key={perm}
                className="px-2 py-0.5 rounded-full bg-[#618685]/10 text-[#618685] dark:text-[#88afae] border border-[#618685]/25 text-[10px] font-semibold capitalize"
              >
                {perm}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ── Update Email (separate flow) ── */}
      <section className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 shadow-xs space-y-5">
        <div>
          <h2 className="font-serif text-lg font-bold text-[#130005] dark:text-white flex items-center gap-2">
            <Mail className="size-4.5 text-[#618685]" />
            Update Email
          </h2>
          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5">
            Change the email address you use to sign in.
          </p>
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div className="rounded-xl border border-[#D9C3C3] dark:border-white/10 bg-[#FAF5F5] dark:bg-[#130005] p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="staff-profile-new-email" className="text-xs">
                New Email
              </Label>
              <Input
                id="staff-profile-new-email"
                type="email"
                placeholder="newemail@hotel.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-profile-verify-pass" className="text-xs">
                Current Password
              </Label>
              <Input
                id="staff-profile-verify-pass"
                type="password"
                placeholder="Enter your current password to verify"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
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
            Set a new password for your staff account.
          </p>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="rounded-xl border border-[#D9C3C3] dark:border-white/10 bg-[#FAF5F5] dark:bg-[#130005] p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="staff-profile-current-pass" className="text-xs">
                Current Password
              </Label>
              <Input
                id="staff-profile-current-pass"
                type="password"
                placeholder="Enter your current password"
                value={currentPasswordForPass}
                onChange={(e) => setCurrentPasswordForPass(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-profile-new-pass" className="text-xs">
                New Password
              </Label>
              <Input
                id="staff-profile-new-pass"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            {newPassword && (
              <>
                <PasswordRequirements password={newPassword} />
                <div className="space-y-1.5 pt-1">
                  <Label htmlFor="staff-profile-confirm-pass" className="text-xs">
                    Re-enter New Password
                  </Label>
                  <Input
                    id="staff-profile-confirm-pass"
                    type="password"
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
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