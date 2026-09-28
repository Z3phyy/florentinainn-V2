"use client";

import { useState, useMemo, useSyncExternalStore } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axiosInstance, { AUTH_NOTICE_KEY } from "@/app/utils/axios";
import useUserStore from "@/app/store/useUserStore";
import { errorAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/formField";
import { PasswordInput } from "@/components/ui/passwordInput";
import {
  Loader2,
  Lock,
  Timer,
  KeyRound,
  ShieldCheck,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  X,
} from "lucide-react";
import {
  loginSchema,
  accessCodeEntrySchema,
  accessCodePairSchema,
} from "@/app/utils/schemas";
import { generateAccessCode } from "@/app/utils/accessCode";
import { getApiErrorCode } from "@/app/utils/apiError";

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

const noticeListeners = new Set<() => void>();

function subscribeNotice(listener: () => void) {
  noticeListeners.add(listener);
  return () => {
    noticeListeners.delete(listener);
  };
}

function getNoticeSnapshot(): string {
  try {
    return sessionStorage.getItem(AUTH_NOTICE_KEY) ?? "";
  } catch {
    return "";
  }
}

function getNoticeServerSnapshot(): string {
  return "";
}

function clearAuthNotice() {
  try {
    sessionStorage.removeItem(AUTH_NOTICE_KEY);
  } catch {}
  noticeListeners.forEach((listener) => listener());
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
  code?: string;
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

type LoginRole = "employee" | "admin" | "super admin";

interface LoginAccount {
  _id?: string;
  name?: string;
  email?: string;
  [key: string]: unknown;
}

interface Challenge {
  token: string;
  role: LoginRole;
  stage: "verify" | "setup";
  expiresAt: number;
  email: string;
}

type LoginValues = z.infer<typeof loginSchema>;
type AccessCodeValues = z.infer<typeof accessCodeEntrySchema>;
type SetupValues = z.input<typeof accessCodePairSchema>;

export default function Page() {
  const router = useRouter();
  const { setUser } = useUserStore();
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [codeAttemptsLeft, setCodeAttemptsLeft] = useState<number | null>(null);
  const [codeLockedUntil, setCodeLockedUntil] = useState<number | null>(null);

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

  const authNotice = useSyncExternalStore(
    subscribeNotice,
    getNoticeSnapshot,
    getNoticeServerSnapshot,
  );

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  const codeForm = useForm<AccessCodeValues>({
    resolver: zodResolver(accessCodeEntrySchema),
    mode: "onTouched",
    defaultValues: { accessCode: "" },
  });

  const setupForm = useForm<SetupValues>({
    resolver: zodResolver(accessCodePairSchema),
    mode: "onChange",
    defaultValues: { accessCode: "", confirmAccessCode: "" },
  });

  const email = useWatch({ control: loginForm.control, name: "email" });

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

  const typedEmail = (email || "").trim().toLowerCase();

  const isLocked =
    lockoutRemaining > 0 &&
    (!typedEmail || !lockout?.email || typedEmail === lockout.email);

  const challengeRemaining =
    challenge && nowMs
      ? Math.max(0, Math.ceil((challenge.expiresAt - nowMs) / 1000))
      : 0;
  const challengeExpired = !!challenge && nowMs > 0 && challengeRemaining === 0;

  const codeLockRemaining =
    codeLockedUntil && nowMs
      ? Math.max(0, Math.ceil((codeLockedUntil - nowMs) / 1000))
      : 0;
  const isCodeLocked = codeLockRemaining > 0;

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

  const restartLogin = () => {
    setChallenge(null);
    setCodeAttemptsLeft(null);
    setCodeLockedUntil(null);
    codeForm.reset({ accessCode: "" });
    setupForm.reset({ accessCode: "", confirmAccessCode: "" });
    loginForm.setValue("password", "");
  };

  const completeLogin = (data: {
    token?: string;
    account?: LoginAccount;
    role?: LoginRole;
  }) => {
    const { token, account, role } = data;
    if (!token || !role) {
      errorAlert("Unexpected response from the server. Please try again.");
      restartLogin();
      return;
    }
    localStorage.setItem("token", token);
    clearAuthNotice();
    const fallbackEmail = challenge?.email || typedEmail;

    if (role === "employee") {
      setUser({
        ...(account as object),
        name: account?.name || account?.email || "Staff",
        type: "employee",
      } as Parameters<typeof setUser>[0]);
      router.push("/pages/staff/home");
      return;
    }

    setUser({
      _id: account?._id || role,
      name: account?.name || (role === "super admin" ? "Super Admin" : "Admin"),
      type: role,
      permisions: [],
      email: account?.email || fallbackEmail,
      password: "",
      otp: null,
      isApproved: true,
    });
    router.push("/pages/admin/dashboard");
  };

  const loginMutation = useMutation({
    mutationFn: (data: LoginValues) => axiosInstance.post("/account/login", data),
    onSuccess: (response, variables) => {
      resetLockout();
      const data = response.data || {};
      if (data.requiresAccessCode && data.challengeToken) {
        setChallenge({
          token: data.challengeToken,
          role: data.role,
          stage: data.stage === "setup" ? "setup" : "verify",
          expiresAt: Date.now() + (Number(data.expiresInSeconds) || 600) * 1000,
          email: variables.email,
        });
        setCodeAttemptsLeft(null);
        setCodeLockedUntil(null);
        return;
      }
      errorAlert("Unexpected response from the server. Please try again.");
    },
    onError: (err: unknown, variables) => {
      const { message, body } = parseLoginError(err);
      const nowLocked = applyServerLockout(body, variables.email);
      if (!nowLocked && typeof body.remainingAttempts === "number") {
        setAttemptsLeft(body.remainingAttempts);
      }
      errorAlert(message);
    },
  });

  const handleChallengeError = (err: unknown) => {
    const { message, body } = parseLoginError(err);
    const code = getApiErrorCode(err);
    if (code === "CHALLENGE_INVALID" || code === "ACCOUNT_DISABLED") {
      errorAlert(message);
      restartLogin();
      return;
    }
    if (body.locked) {
      const until = body.lockedUntil
        ? new Date(body.lockedUntil).getTime()
        : Date.now() + (body.retryAfterSeconds || 60) * 1000;
      setCodeLockedUntil(until);
      setCodeAttemptsLeft(0);
    } else if (typeof body.remainingAttempts === "number") {
      setCodeAttemptsLeft(body.remainingAttempts);
    }
    errorAlert(message);
  };

  const verifyMutation = useMutation({
    mutationFn: (data: AccessCodeValues) =>
      axiosInstance.post("/account/login/access-code", {
        challengeToken: challenge?.token,
        accessCode: data.accessCode,
      }),
    onSuccess: (response) => completeLogin(response.data || {}),
    onError: (err: unknown) => {
      codeForm.setValue("accessCode", "");
      handleChallengeError(err);
    },
  });

  const setupMutation = useMutation({
    mutationFn: (data: SetupValues) =>
      axiosInstance.post("/account/login/access-code/setup", {
        challengeToken: challenge?.token,
        accessCode: data.accessCode,
        confirmAccessCode: data.confirmAccessCode,
      }),
    onSuccess: (response) => completeLogin(response.data || {}),
    onError: handleChallengeError,
  });

  const onLoginSubmit = loginForm.handleSubmit((values) => {
    if (isLocked || loginMutation.isPending) return;
    loginMutation.mutate({ email: values.email.trim(), password: values.password });
  });

  const onCodeSubmit = codeForm.handleSubmit((values) => {
    if (verifyMutation.isPending || isCodeLocked) return;
    if (challengeExpired) {
      errorAlert("Your sign-in session has expired. Please sign in again.");
      restartLogin();
      return;
    }
    verifyMutation.mutate(values);
  });

  const onSetupSubmit = setupForm.handleSubmit((values) => {
    if (setupMutation.isPending) return;
    if (challengeExpired) {
      errorAlert("Your sign-in session has expired. Please sign in again.");
      restartLogin();
      return;
    }
    setupMutation.mutate(values);
  });

  const fillGeneratedCode = () => {
    const code = generateAccessCode();
    setupForm.setValue("accessCode", code, { shouldValidate: true, shouldTouch: true });
    setupForm.setValue("confirmAccessCode", code, { shouldValidate: true, shouldTouch: true });
  };

  const formatCountdown = (total: number) => {
    const m = Math.floor(total / 60);
    const sec = total % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };
  const countdownText = formatCountdown(lockoutRemaining);

  const loginErrors = loginForm.formState.errors;
  const codeErrors = codeForm.formState.errors;
  const setupErrors = setupForm.formState.errors;

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-6">
          {authNotice && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p className="flex-1">{authNotice}</p>
              <button
                type="button"
                onClick={clearAuthNotice}
                aria-label="Dismiss notice"
                className="shrink-0 opacity-70 hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
          {!challenge ? (
            <>
              <div className="text-center space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">Sign In</h1>
                <p className="text-sm text-muted-foreground">
                  Enter your credentials to access your account.
                </p>
              </div>

              <form onSubmit={onLoginSubmit} className="space-y-4" noValidate>
                <FormField id="username" label="Email" required error={loginErrors.email?.message}>
                  <Input
                    id="username"
                    type="email"
                    autoComplete="username"
                    placeholder="your-email"
                    disabled={isLocked}
                    aria-invalid={!!loginErrors.email}
                    aria-describedby="username-error"
                    {...loginForm.register("email")}
                  />
                </FormField>

                <FormField id="password" label="Password" required error={loginErrors.password?.message}>
                  <PasswordInput
                    id="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    disabled={isLocked}
                    aria-invalid={!!loginErrors.password}
                    aria-describedby="password-error"
                    {...loginForm.register("password")}
                  />
                </FormField>

                {!isLocked && attemptsLeft !== null && attemptsLeft > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {attemptsLeft} of {MAX_ATTEMPTS} sign-in attempt
                    {attemptsLeft === 1 ? "" : "s"} remaining before this account is
                    locked for 5 minutes.
                  </p>
                )}

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
            </>
          ) : challenge.stage === "verify" ? (
            <>
              <div className="text-center space-y-2">
                <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-[#900546]/10 text-[#900546]">
                  <KeyRound className="size-5" />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">Enter Access Code</h1>
                <p className="text-sm text-muted-foreground">
                  Your password was accepted. Enter the access code assigned to{" "}
                  <span className="font-medium text-foreground">{challenge.email}</span>{" "}
                  to continue.
                </p>
              </div>

              <form onSubmit={onCodeSubmit} className="space-y-4" noValidate>
                <FormField
                  id="accessCode"
                  label="Access Code"
                  required
                  error={codeErrors.accessCode?.message}
                  hint="Access codes are not case-sensitive."
                >
                  <Input
                    id="accessCode"
                    autoComplete="one-time-code"
                    autoFocus
                    placeholder="7KQ9XM2P"
                    className="font-mono uppercase tracking-[0.3em] text-center"
                    maxLength={20}
                    disabled={isCodeLocked || verifyMutation.isPending}
                    aria-invalid={!!codeErrors.accessCode}
                    aria-describedby="accessCode-error"
                    {...codeForm.register("accessCode")}
                  />
                </FormField>

                {!isCodeLocked && codeAttemptsLeft !== null && codeAttemptsLeft > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {codeAttemptsLeft} attempt{codeAttemptsLeft === 1 ? "" : "s"} remaining
                    before access code entry is temporarily locked.
                  </p>
                )}

                {isCodeLocked && (
                  <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30 px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-300">
                    <Lock className="size-4 shrink-0" />
                    Too many invalid codes. Try again in {formatCountdown(codeLockRemaining)}.
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={verifyMutation.isPending || isCodeLocked || challengeExpired}
                >
                  {verifyMutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-4" />
                      Verify & Continue
                    </>
                  )}
                </Button>

                <p className="text-center text-[11px] text-muted-foreground">
                  {challengeExpired
                    ? "This sign-in session has expired."
                    : `Session expires in ${formatCountdown(challengeRemaining)}.`}
                </p>

                <Button type="button" variant="ghost" className="w-full" onClick={restartLogin}>
                  <ArrowLeft className="size-4" />
                  Use a different account
                </Button>
              </form>
            </>
          ) : (
            <>
              <div className="text-center space-y-2">
                <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-[#900546]/10 text-[#900546]">
                  <ShieldCheck className="size-5" />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">Set Up Your Access Code</h1>
                <p className="text-sm text-muted-foreground">
                  Administrator accounts require an access code after the password.
                  Create one now — you will need it every time you sign in.
                </p>
              </div>

              <form onSubmit={onSetupSubmit} className="space-y-4" noValidate>
                <FormField
                  id="setupAccessCode"
                  label="New Access Code"
                  required
                  error={setupErrors.accessCode?.message}
                  hint="6–20 letters or numbers. Not case-sensitive."
                >
                  <PasswordInput
                    id="setupAccessCode"
                    autoComplete="new-password"
                    className="font-mono uppercase tracking-widest"
                    maxLength={20}
                    aria-invalid={!!setupErrors.accessCode}
                    aria-describedby="setupAccessCode-error"
                    {...setupForm.register("accessCode", {
                      onChange: () => {
                        if (setupForm.getFieldState("confirmAccessCode").isTouched) {
                          setupForm.trigger("confirmAccessCode");
                        }
                      },
                    })}
                  />
                </FormField>

                <FormField
                  id="setupConfirmAccessCode"
                  label="Confirm Access Code"
                  required
                  error={setupErrors.confirmAccessCode?.message}
                >
                  <PasswordInput
                    id="setupConfirmAccessCode"
                    autoComplete="new-password"
                    className="font-mono uppercase tracking-widest"
                    maxLength={20}
                    aria-invalid={!!setupErrors.confirmAccessCode}
                    aria-describedby="setupConfirmAccessCode-error"
                    {...setupForm.register("confirmAccessCode")}
                  />
                </FormField>

                <Button type="button" variant="outline" className="w-full" onClick={fillGeneratedCode}>
                  <Sparkles className="size-4" />
                  Generate a secure code
                </Button>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={setupMutation.isPending || challengeExpired}
                >
                  {setupMutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Access Code & Continue"
                  )}
                </Button>

                <p className="text-center text-[11px] text-muted-foreground">
                  {challengeExpired
                    ? "This sign-in session has expired."
                    : `Session expires in ${formatCountdown(challengeRemaining)}.`}
                </p>

                <Button type="button" variant="ghost" className="w-full" onClick={restartLogin}>
                  <ArrowLeft className="size-4" />
                  Back to sign in
                </Button>
              </form>
            </>
          )}

          <div className="space-y-2 text-center text-sm text-muted-foreground">
            <p>
              <Link
                href="/"
                className="underline underline-offset-4 hover:text-foreground transition-colors"
              >
                Back to home
              </Link>
            </p>
            {!challenge && (
              <>
                <p>
                  No staff account yet?{" "}
                  <Link
                    href="/guest/registerStaff"
                    className="underline underline-offset-4 hover:text-foreground transition-colors"
                  >
                    Create staff account
                  </Link>
                </p>
                {adminStatus?.canRegister === true && (
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
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
