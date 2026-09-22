import LoginAttemptModel from "../model/loginAttempt.model";
import { LoginPolicy } from "../config/loginPolicy";

export interface LockStatus {
  locked: boolean;
  lockedUntil: Date | null;
  retryAfterSeconds: number;
  failedAttempts: number;
  remainingAttempts: number;
}

const unlocked = (policy: LoginPolicy, failedAttempts = 0): LockStatus => ({
  locked: false,
  lockedUntil: null,
  retryAfterSeconds: 0,
  failedAttempts,
  remainingAttempts: Math.max(0, policy.maxAttempts - failedAttempts),
});

const secondsUntil = (date: Date, now: number) =>
  Math.max(1, Math.ceil((date.getTime() - now) / 1000));

export class LoginAttemptService {
  static emailKey(email: string) {
    return `email:${(email || "").trim().toLowerCase()}`;
  }

  static ipKey(ip: string) {
    return `ip:${ip || "unknown"}`;
  }

  static async getStatus(
    key: string,
    policy: LoginPolicy,
  ): Promise<LockStatus> {
    const record = await LoginAttemptModel.findOne({ key });
    if (!record) return unlocked(policy);

    const now = Date.now();

    if (record.lockedUntil && record.lockedUntil.getTime() > now) {
      return {
        locked: true,
        lockedUntil: record.lockedUntil,
        retryAfterSeconds: secondsUntil(record.lockedUntil, now),
        failedAttempts: record.failedAttempts || 0,
        remainingAttempts: 0,
      };
    }

    const windowExpired =
      !record.firstFailedAt ||
      now - record.firstFailedAt.getTime() > policy.windowMs;

    return unlocked(policy, windowExpired ? 0 : record.failedAttempts || 0);
  }

  static async registerFailure(
    key: string,
    scope: string,
    policy: LoginPolicy,
  ): Promise<LockStatus> {
    const now = new Date();
    const nowMs = now.getTime();

    const record =
      (await LoginAttemptModel.findOne({ key })) ||
      new LoginAttemptModel({ key, scope, failedAttempts: 0, expiresAt: now });

    if (record.lockedUntil && record.lockedUntil.getTime() > nowMs) {
      return {
        locked: true,
        lockedUntil: record.lockedUntil,
        retryAfterSeconds: secondsUntil(record.lockedUntil, nowMs),
        failedAttempts: record.failedAttempts || 0,
        remainingAttempts: 0,
      };
    }

    const windowExpired =
      !record.firstFailedAt ||
      nowMs - record.firstFailedAt.getTime() > policy.windowMs;

    if (record.lockedUntil || windowExpired) {
      record.failedAttempts = 0;
      record.firstFailedAt = null;
      record.lockedUntil = null;
    }

    record.scope = scope;
    record.failedAttempts = (record.failedAttempts || 0) + 1;
    record.firstFailedAt = record.firstFailedAt || now;
    record.lastFailedAt = now;

    let status: LockStatus;

    if (record.failedAttempts >= policy.maxAttempts) {
      const lockedUntil = new Date(nowMs + policy.lockoutMs);
      record.lockedUntil = lockedUntil;

      record.failedAttempts = 0;
      record.firstFailedAt = null;
      status = {
        locked: true,
        lockedUntil,
        retryAfterSeconds: secondsUntil(lockedUntil, nowMs),
        failedAttempts: policy.maxAttempts,
        remainingAttempts: 0,
      };
    } else {
      status = unlocked(policy, record.failedAttempts);
    }

    const keepUntil = Math.max(
      record.lockedUntil ? record.lockedUntil.getTime() : 0,
      nowMs + policy.windowMs,
    );
    record.expiresAt = new Date(keepUntil + 24 * 60 * 60 * 1000);

    await record.save();
    return status;
  }

  static async reset(keys: string[]) {
    if (!keys.length) return;
    await LoginAttemptModel.deleteMany({ key: { $in: keys } });
  }
}
