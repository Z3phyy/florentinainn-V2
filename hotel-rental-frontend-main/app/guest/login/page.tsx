"use client";

import { useState, useEffect, useMemo, useSyncExternalStore } from "react";
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
const MAX_ATTEMPTS = 5;
const LOCKOUT_STORAGE_KEY = "login_lockout";
const LEGACY_LOCKOUT_KEYS = ["login_consecutive_fails", "login_lockout_until"];

interface StoredLockout {
  email: string;
  until: number;
}

function parseLockout(raw: string | null): StoredLockout | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredLockout>;
    if (typeof parsed?.until !== "number" || !Number.isFinite(parsed.until))
      return null;
    return {
      email: String(parsed.email || "").toLowerCase(),
      until: parsed.until,
    };
  } catch {
    return null;
  }
}

const lockoutListeners = new Set<() => void>();

function emitLockoutChange() {
  lockoutListeners.forEach((listener) => listener());
}

function subscribeLockout(listener: () => void) {
  lockoutListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    lockoutListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getLockoutSnapshot(): string {
  try {
    return localStorage.getItem(LOCKOUT_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function getLockoutServerSnapshot(): string {
  return "";
}

function writeStoredLockout(value: StoredLockout) {
  try {
    localStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify(value));
  } catch {}
  emitLockoutChange();
}

function clearStoredLockout() {
  try {
    localStorage.removeItem(LOCKOUT_STORAGE_KEY);
    LEGACY_LOCKOUT_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {}
  emitLockoutChange();
}

function subscribeClock(listener: () => void) {
  const id = setInterval(listener, 1000);
  return () => clearInterval(id);
}

function getClockSnapshot(): number {
  return Math.floor(Date.now() / 1000) * 1000;
}

function getClockServerSnapshot(): number {
  return 0;
}

interface LoginErrorBody {
  message?: string;
  locked?: boolean;
  lockedUntil?: string | null;
  retryAfterSeconds?: number;
  remainingAttempts?: number;
}

function parseLoginError(error: unknown): {
  message: string;
  body: LoginErrorBody;
  status?: number;
} {
  const response = (error as { response?: { data?: unknown; status?: number } })
    ?.response;
  const data = response?.data;

  if (typeof data === "string") {
    return { message: data, body: {}, status: response?.status };
  }
  if (data && typeof data === "object") {
    const body = data as LoginErrorBody;
    return {
      message: body.message || "Unable to sign in. Please try again.",
      body,
      status: response?.status,
    };
  }
  return {
    message: "Unable to sign in. Please try again.",
    body: {},
    status: response?.status,
  };
}

export default function Page() {
  const router = useRouter();
  const { setUser } = useUserStore();
  const { showPassword, togglePasswordVisibility, passwordInputType } =
    usePasswordVisibility();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [showAdminLink, setShowAdminLink] = useState(false);

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

  const rawLockout = useSyncExternalStore(
    subscribeLockout,
    getLockoutSnapshot,
    getLockoutServerSnapshot,
  );
  const nowMs = useSyncExternalStore(
    subscribeClock,
    getClockSnapshot,
    getClockServerSnapshot,
  );

  const lockout = useMemo(() => parseLockout(rawLockout), [rawLockout]);

  const lockoutRemaining =
    lockout && nowMs
      ? Math.max(0, Math.ceil((lockout.until - nowMs) / 1000))
      : 0;

  const typedEmail = email.trim().toLowerCase();

  const isLocked =
    lockoutRemaining > 0 &&
    (!typedEmail || !lockout?.email || typedEmail === lockout.email);

  const applyServerLockout = (body: LoginErrorBody, attemptedEmail: string) => {
    const until = body.lockedUntil
      ? new Date(body.lockedUntil).getTime()
      : body.retryAfterSeconds
        ? Date.now() + body.retryAfterSeconds * 1000
        : 0;

    if (!until || Number.isNaN(until) || until <= Date.now()) return false;

    writeStoredLockout({ email: attemptedEmail.trim().toLowerCase(), until });
    setAttemptsLeft(0);
    return true;
  };

  const resetLockout = () => {
    clearStoredLockout();
    setAttemptsLeft(null);
  };

  // ── Login mutation ──
  const loginMutation = useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      axiosInstance.post("/account/login", data),
    onSuccess: (response) => {
      // A successful sign-in clears the local mirror; the server clears the
      // authoritative counter at the same time.
      resetLockout();

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
    onError: (err: unknown, variables) => {
      const { message, body } = parseLoginError(err);

      // The server reports the lockout deadline; the client only displays it.
      const nowLocked = applyServerLockout(body, variables.email);

      if (!nowLocked && typeof body.remainingAttempts === "number") {
        setAttemptsLeft(body.remainingAttempts);
      }

      errorAlert(message);
    },
  });

  // ── Submit handler ──
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isLocked || loginMutation.isPending) return;

    if (!email.trim() || !password) {
      errorAlert("Please fill in all fields.");
      return;
    }

    loginMutation.mutate({ email: email.trim(), password });
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
                disabled={isLocked}
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
                  disabled={isLocked}
                  className="pr-10"
                />

                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  disabled={isLocked}
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

            {/* ── Remaining attempts hint (from the server) ── */}
            {!isLocked && attemptsLeft !== null && attemptsLeft > 0 && (
              <p className="text-xs text-muted-foreground">
                {attemptsLeft} of {MAX_ATTEMPTS} sign-in attempt
                {attemptsLeft === 1 ? "" : "s"} remaining before this account is
                locked for 5 minutes.
              </p>
            )}

            {/* ── Lockout Banner ── */}
            {isLocked && (
              <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30 px-3.5 py-2.5 text-sm">
                <Lock className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-amber-800 dark:text-amber-300 text-xs leading-tight">
                    Too many failed attempts ({MAX_ATTEMPTS} maximum)
                  </p>
                  <p className="text-amber-600 dark:text-amber-400 text-xs mt-0.5">
                    Sign-in is locked by the server. Try again in{" "}
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
              disabled={loginMutation.isPending || isLocked}
            >
              {isLocked ? (
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
