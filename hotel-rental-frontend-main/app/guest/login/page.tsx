"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axiosInstance from "@/app/utils/axios";
import useUserStore from "@/app/store/useUserStore";
import { errorAlert, successAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, Timer, Eye, EyeOff } from "lucide-react";
import { usePasswordVisibility } from "@/app/hooks/usePasswordVisibility";

// ── Lockout Configuration ──
// Change this value to adjust the base lockout duration (in seconds).
// After every 3 consecutive failed attempts, the lockout time = BASE_LOCKOUT_DELAY * multiplier
// where multiplier = 1 (first 3 fails), 2 (next 3), 3 (next 3), and so on.
const BASE_LOCKOUT_DELAY = 10; // seconds

export default function Page() {
  const router = useRouter();
  const { setUser } = useUserStore();
  const { showPassword, togglePasswordVisibility, passwordInputType } =
    usePasswordVisibility();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consecutiveFails, setConsecutiveFails] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [showAdminLink, setShowAdminLink] = useState(false);
  const failsRef = useRef(0);

  // ── Query whether Admin / Super Admin accounts can still be registered ──
  const { data: adminStatus } = useQuery<{
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && e.altKey) {
        if (adminStatus?.canRegister === false) {
          setShowAdminLink(false);
          errorAlert(
            "Both Admin and Super Admin accounts are already registered.",
          );
        } else {
          setShowAdminLink((prev) => !prev);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [adminStatus]);

  // ── Restore lockout state from localStorage on mount ──
  useEffect(() => {
    const storedFails = localStorage.getItem("login_consecutive_fails");
    if (storedFails) {
      const n = Number(storedFails);
      failsRef.current = n;
      setConsecutiveFails(n);
    }

    const lockoutUntil = localStorage.getItem("login_lockout_until");
    if (lockoutUntil) {
      const remaining = Math.max(
        0,
        Math.ceil((Number(lockoutUntil) - Date.now()) / 1000),
      );
      if (remaining > 0) {
        setLockoutRemaining(remaining);
      } else {
        localStorage.removeItem("login_lockout_until");
      }
    }
  }, []);

  // ── Countdown ticker ──
  useEffect(() => {
    if (lockoutRemaining <= 0) return;

    const id = setInterval(() => {
      setLockoutRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(id);
          localStorage.removeItem("login_lockout_until");
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [lockoutRemaining]);

  // ── Persist lockout ──
  const applyLockout = (totalFails: number) => {
    // Lockout activates at every 3-fail boundary: 3, 6, 9, ...
    if (totalFails >= 3 && totalFails % 3 === 0) {
      const multiplier = Math.floor(totalFails / 3);
      const lockoutSeconds = BASE_LOCKOUT_DELAY * multiplier;
      const lockoutUntil = Date.now() + lockoutSeconds * 1000;
      localStorage.setItem("login_lockout_until", String(lockoutUntil));
      setLockoutRemaining(lockoutSeconds);
    }
  };

  const resetFails = () => {
    failsRef.current = 0;
    setConsecutiveFails(0);
    localStorage.removeItem("login_consecutive_fails");
    localStorage.removeItem("login_lockout_until");
    setLockoutRemaining(0);
  };

  const incrementFails = () => {
    const newFails = failsRef.current + 1;
    failsRef.current = newFails;
    setConsecutiveFails(newFails);
    localStorage.setItem("login_consecutive_fails", String(newFails));
    applyLockout(newFails);
  };

  // ── Login mutation ──
  const loginMutation = useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      axiosInstance.post("/account/login", data),
    onSuccess: (response) => {
      resetFails();

      const { token, account, role } = response.data;
      if (token) {
        localStorage.setItem("token", token);
      }

      switch (role) {
        case "employee":
          setUser({
            ...account,
            name: account?.name || account?.email || "Staff",
            type: "employee",
          });
          router.push("/pages/staff/home");
          break;

        case "admin":
          setUser({
            _id: account?._id || "admin",
            name: account?.name || "Admin",
            type: "admin",
            permisions: [],
            email: account?.email || email,
            password: "",
            otp: null,
            isApproved: true,
          });
          router.push("/pages/admin/dashboard");
          break;

        case "super admin":
          setUser({
            _id: account?._id || "superadmin",
            name: account?.name || "Super Admin",
            type: "super admin",
            permisions: [],
            email: account?.email || email,
            password: "",
            otp: null,
            isApproved: true,
          });
          router.push("/pages/admin/dashboard");
          break;
      }
    },
    onError: (err: { response?: { data?: string } }) => {
      console.log(err);
      const message =
        typeof err.response?.data === "string"
          ? err.response.data
          : "Failed to create admin account. Please try again.";
      errorAlert(message);
      incrementFails();
    },
  });

  // ── Submit handler ──
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (lockoutRemaining > 0) return;

    if (!email || !password) {
      errorAlert("Please fill in all fields.");
      return;
    }

    loginMutation.mutate({ email, password });
  };

  // ── Format countdown ──
  const minutes = Math.floor(lockoutRemaining / 60);
  const seconds = lockoutRemaining % 60;
  const countdownText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Login form */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Sign In</h1>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to access your account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Email</Label>
              <Input
                id="username"
                type="email"
                placeholder="your-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={lockoutRemaining > 0}
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
                  disabled={lockoutRemaining > 0}
                  className="pr-10"
                />

                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  disabled={lockoutRemaining > 0}
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

            {/* ── Lockout Banner ── */}
            {lockoutRemaining > 0 && (
              <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30 px-3.5 py-2.5 text-sm">
                <Lock className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-amber-800 dark:text-amber-300 text-xs leading-tight">
                    Too many failed attempts
                  </p>
                  <p className="text-amber-600 dark:text-amber-400 text-xs mt-0.5">
                    Try again in{" "}
                    <span className="font-semibold tabular-nums inline-flex items-center gap-1">
                      <Timer className="size-3" />
                      {countdownText}
                    </span>
                  </p>
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending || lockoutRemaining > 0}
            >
              {lockoutRemaining > 0 ? (
                <>
                  <Timer className="size-4 animate-pulse" />
                  Locked — {countdownText}
                </>
              ) : loginMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="space-y-2 text-center text-sm text-muted-foreground">
            <p>
              <Link
                href="/"
                className="underline underline-offset-4 hover:text-foreground transition-colors"
              >
                Back to home
              </Link>
            </p>
            <p>
              No staff account yet?{" "}
              <Link
                href="/guest/registerStaff"
                className="underline underline-offset-4 hover:text-foreground transition-colors"
              >
                Create staff account
              </Link>
            </p>
            {showAdminLink && adminStatus?.canRegister !== false && (
              <p>
                <Link
                  href="/guest/register"
                  className="underline underline-offset-4 hover:text-foreground transition-colors"
                >
                  Create admin account
                </Link>
              </p>
            )}
            <p>
              <Link
                href="/guest/forgotPassword"
                className="underline underline-offset-4 hover:text-foreground transition-colors"
              >
                Forgot password?
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
