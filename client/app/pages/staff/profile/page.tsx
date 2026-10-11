"use client";

import { useMutation } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axiosInstance from "@/app/utils/axios";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { changeEmailSchema, changePasswordSchema } from "@/app/utils/schemas";
import { FormField } from "@/components/ui/formField";
import { PasswordInput } from "@/components/ui/passwordInput";
import useUserStore from "@/app/store/useUserStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  KeyRound,
  Mail,
  ShieldCheck,
  UserRound,
  AtSign,
  RefreshCw,
} from "lucide-react";
import { PasswordRequirements } from "@/components/ui/passwordRequirements";

export default function Page() {
  const { user, setUser } = useUserStore();

  const emailForm = useForm<z.input<typeof changeEmailSchema>>({
    resolver: zodResolver(changeEmailSchema),
    mode: "onTouched",
    defaultValues: { newEmail: "", currentPassword: "" },
  });
  const passwordForm = useForm<z.input<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onTouched",
    defaultValues: { currentPassword: "", password: "", confirmPassword: "" },
  });
  const emailErrors = emailForm.formState.errors;
  const passwordErrors = passwordForm.formState.errors;
  const newPassword = useWatch({ control: passwordForm.control, name: "password" }) || "";

  const updateEmailMutation = useMutation({
    mutationFn: (data: {
      oldEmail: string;
      oldPassword: string;
      newEmail: string;
    }) => axiosInstance.put("/account/change-credentials", data),
    onSuccess: (response) => {
      successAlert("Email updated successfully.");
      if (response.data?.account?.email && user) {
        setUser({
          ...user,
          email: response.data.account.email,
        });
      }
      emailForm.reset();
    },
    onError: (err) => {
      errorAlert(getApiErrorMessage(err, "Failed to update email."));
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: {
      oldEmail: string;
      oldPassword: string;
      newPassword: string;
    }) => axiosInstance.put("/account/change-credentials", data),
    onSuccess: () => {
      successAlert("Password updated successfully.");
      passwordForm.reset();
    },
    onError: (err) => {
      errorAlert(getApiErrorMessage(err, "Failed to update password."));
    },
  });

  const handleEmailSubmit = emailForm.handleSubmit((values) => {
    const email = values.newEmail.trim();
    if (email.toLowerCase() === (user?.email || "").toLowerCase()) {
      emailForm.setError("newEmail", {
        message: "New email must be different from your current email.",
      });
      return;
    }
    updateEmailMutation.mutate({
      oldEmail: user?.email || "",
      oldPassword: values.currentPassword,
      newEmail: email,
    });
  });

  const handlePasswordSubmit = passwordForm.handleSubmit((values) => {
    changePasswordMutation.mutate({
      oldEmail: user?.email || "",
      oldPassword: values.currentPassword,
      newPassword: values.password,
    });
  });

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
          View your staff details and manage your login email and password
          securely.
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

        <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
          <div className="rounded-xl border border-[#D9C3C3] dark:border-white/10 bg-[#FAF5F5] dark:bg-[#130005] p-4 space-y-3">
            <FormField id="profile-new-email" label="New Email" required error={emailErrors.newEmail?.message} labelClassName="text-xs">
              <Input
                id="profile-new-email"
                type="email"
                autoComplete="email"
                placeholder="newemail@hotel.com"
                aria-invalid={!!emailErrors.newEmail}
                {...emailForm.register("newEmail")}
              />
            </FormField>
            <FormField id="profile-verify-pass" label="Current Password" required error={emailErrors.currentPassword?.message} labelClassName="text-xs">
              <PasswordInput
                id="profile-verify-pass"
                autoComplete="current-password"
                placeholder="Enter your current password to verify"
                aria-invalid={!!emailErrors.currentPassword}
                {...emailForm.register("currentPassword")}
              />
            </FormField>
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

        <form onSubmit={handlePasswordSubmit} className="space-y-4" noValidate>
          <div className="rounded-xl border border-[#D9C3C3] dark:border-white/10 bg-[#FAF5F5] dark:bg-[#130005] p-4 space-y-3">
            <FormField id="profile-current-pass" label="Current Password" required error={passwordErrors.currentPassword?.message} labelClassName="text-xs">
              <PasswordInput
                id="profile-current-pass"
                autoComplete="current-password"
                placeholder="Enter your current password"
                aria-invalid={!!passwordErrors.currentPassword}
                {...passwordForm.register("currentPassword")}
              />
            </FormField>
            <FormField id="profile-new-pass" label="New Password" required error={passwordErrors.password?.message} labelClassName="text-xs">
              <PasswordInput
                id="profile-new-pass"
                autoComplete="new-password"
                placeholder="Enter new password"
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
            <FormField id="profile-confirm-pass" label="Repeat New Password" required error={passwordErrors.confirmPassword?.message} labelClassName="text-xs">
              <PasswordInput
                id="profile-confirm-pass"
                autoComplete="new-password"
                placeholder="Repeat new password"
                aria-invalid={!!passwordErrors.confirmPassword}
                {...passwordForm.register("confirmPassword")}
              />
            </FormField>
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
