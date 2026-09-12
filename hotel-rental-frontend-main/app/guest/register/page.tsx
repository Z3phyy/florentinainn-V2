"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axiosInstance from "@/app/utils/axios";
import { errorAlert, successAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ShieldAlert } from "lucide-react";
import { validatePassword, validateEmail } from "@/app/utils/validation";
import { PasswordRequirements } from "@/components/ui/passwordRequirements";

export default function Page() {
  const router = useRouter();
  const [type, setType] = useState("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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

  useEffect(() => {
    if (adminStatus) {
      if (adminStatus.hasAdmin && !adminStatus.hasSuperAdmin) {
        setType("super admin");
      } else if (!adminStatus.hasAdmin && adminStatus.hasSuperAdmin) {
        setType("admin");
      }
    }
  }, [adminStatus]);

  const registerMutation = useMutation({
    mutationFn: (data: { email: string; password: string; type: string }) =>
      axiosInstance.post("/system/admin", data),
    onSuccess: () => {
      successAlert("Admin account created successfully");
      router.push("/guest/login");
    },
    onError: (err: { response?: { data?: string } }) => {
      const message =
        typeof err.response?.data === "string"
          ? err.response.data
          : "Failed to create admin account. Please try again.";
      errorAlert(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (adminStatus?.canRegister === false) {
      errorAlert("Both Admin and Super Admin accounts are already registered.");
      return;
    }

    if (!type || !email || !password || !confirmPassword) {
      errorAlert("Please fill in all fields.");
      return;
    }

    const emailErr = validateEmail(email);
    if (emailErr) {
      errorAlert(emailErr);
      return;
    }

    const passErr = validatePassword(password);
    if (passErr) {
      errorAlert(passErr);
      return;
    }

    if (password !== confirmPassword) {
      errorAlert("Passwords do not match.");
      return;
    }

    registerMutation.mutate({ email, password, type });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Create Admin Account</h1>
            <p className="text-sm text-muted-foreground">
              Register an administrator account. Only one admin and one super
              admin account are allowed.
            </p>
          </div>

          {statusLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : adminStatus?.canRegister === false ? (
            <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/10 text-center space-y-2">
              <ShieldAlert className="size-6 text-amber-500 mx-auto" />
              <p className="text-sm font-semibold text-foreground">Registration Closed</p>
              <p className="text-xs text-muted-foreground">
                Both the Admin and Super Admin accounts are already registered.
              </p>
              <Button onClick={() => router.push("/guest/login")} variant="outline" size="sm" className="mt-2">
                Return to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type">Account Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    {!adminStatus?.hasAdmin && <SelectItem value="admin">Admin</SelectItem>}
                    {!adminStatus?.hasSuperAdmin && <SelectItem value="super admin">Super Admin</SelectItem>}
                  </SelectContent>
                </Select>
              </div>

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

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {password && <PasswordRequirements password={password} />}

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? (
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
