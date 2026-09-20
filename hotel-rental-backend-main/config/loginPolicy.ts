export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 5;

export const ATTEMPT_WINDOW_MINUTES = 15;

export const IP_MAX_FAILED_ATTEMPTS = 20;
export const IP_LOCKOUT_MINUTES = 15;
export const IP_ATTEMPT_WINDOW_MINUTES = 15;

export const LOCKOUT_MS = LOCKOUT_MINUTES * 60 * 1000;
export const ATTEMPT_WINDOW_MS = ATTEMPT_WINDOW_MINUTES * 60 * 1000;
export const IP_LOCKOUT_MS = IP_LOCKOUT_MINUTES * 60 * 1000;
export const IP_ATTEMPT_WINDOW_MS = IP_ATTEMPT_WINDOW_MINUTES * 60 * 1000;

export interface LoginPolicy {
  maxAttempts: number;
  lockoutMs: number;
  windowMs: number;
}

export const EMAIL_POLICY: LoginPolicy = {
  maxAttempts: MAX_FAILED_ATTEMPTS,
  lockoutMs: LOCKOUT_MS,
  windowMs: ATTEMPT_WINDOW_MS,
};

export const IP_POLICY: LoginPolicy = {
  maxAttempts: IP_MAX_FAILED_ATTEMPTS,
  lockoutMs: IP_LOCKOUT_MS,
  windowMs: IP_ATTEMPT_WINDOW_MS,
};
