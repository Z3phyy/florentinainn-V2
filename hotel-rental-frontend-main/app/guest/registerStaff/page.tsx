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
import { Loader2, Eye, EyeOff } from "lucide-react";
import { validatePassword, validateEmail } from "@/app/utils/validation";
import { checkEmailAvailability } from "@/app/utils/customFunction";
import { PasswordRequirements } from "@/components/ui/passwordRequirements";
import { usePasswordVisibility } from "@/app/hooks/usePasswordVisibility";

export default function Page() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { showPassword, togglePasswordVisibility, passwordInputType } =
    usePasswordVisibility();

  const registerMutation = useMutation({
    mutationFn: (data: {
      name: string;
      email: string;
      password: string;
      permisions: string[];
      isApproved: boolean;
    }) => axiosInstance.post("/account", data),
    onSuccess: () => {
      successAlert("Registration submitted. Awaiting admin approval.");
      router.push("/guest/login");
    },
    onError: (err: { response?: { data?: string } }) => {
      const message =
        typeof err.response?.data === "string"
          ? err.response.data
          : "Failed to register. Please try again.";
      errorAlert(message);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !email || !password || !confirmPassword) {
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

    const availability = await checkEmailAvailability(email);
    if (!availability.available) {
      errorAlert(
        "Email already exists. Registration is blocked — please use a different email address.",
      );
      return;
    }

    registerMutation.mutate({
      name,
      email,
      password,
      permisions: [],
      isApproved: false,
    });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Staff Registration
            </h1>
            <p className="text-sm text-muted-foreground">
              Register a staff account. An admin must approve your account
              before you can sign in.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Email</Label>
              <Input
                id="username"
                type="email"
                placeholder="staff@hotel.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>

              <div className="relative">
                <Input
                  id="password"
                  type={passwordInputType}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />

                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {password && <PasswordRequirements password={password} />}

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>

              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={passwordInputType}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="pr-10"
                />

                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? (
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
