import jwt from "jsonwebtoken";
import { getJwtSecret, getJwtSecretCandidates } from "../config/jwt";
import { ACCESS_CODE_CHALLENGE_TTL_SECONDS } from "../config/loginPolicy";

export type AccountRole = "super admin" | "admin" | "employee";
export type AccessCodeStage = "verify" | "setup";

export const ACCESS_CODE_PURPOSE = "access-code";

export interface SessionTokenPayload {
  id: string;
  role?: AccountRole;
  name?: string;
  sv?: number;
  acv?: boolean;
  purpose?: string;
}

export interface ChallengeTokenPayload {
  id: string;
  role: AccountRole;
  sv: number;
  stage: AccessCodeStage;
  purpose: typeof ACCESS_CODE_PURPOSE;
}

const secret = getJwtSecret();
const secretCandidates = getJwtSecretCandidates();

export function verifyAnyToken<T extends object>(token: string): T | null {
  for (const candidate of secretCandidates) {
    try {
      const decoded = jwt.verify(token, candidate);
      if (decoded && typeof decoded === "object") {
        return decoded as T;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function signSessionToken(payload: {
  id: string;
  role: AccountRole;
  name: string;
  sv: number;
}): string {
  return jwt.sign({ ...payload, acv: true }, secret, { expiresIn: "3d" });
}

export function signChallengeToken(payload: {
  id: string;
  role: AccountRole;
  sv: number;
  stage: AccessCodeStage;
}): string {
  return jwt.sign({ ...payload, purpose: ACCESS_CODE_PURPOSE }, secret, {
    expiresIn: ACCESS_CODE_CHALLENGE_TTL_SECONDS,
  });
}

export function verifyChallengeToken(token: unknown): ChallengeTokenPayload | null {
  if (typeof token !== "string" || !token) return null;
  const decoded = verifyAnyToken<Partial<ChallengeTokenPayload>>(token);
  if (
    !decoded ||
    decoded.purpose !== ACCESS_CODE_PURPOSE ||
    typeof decoded.id !== "string" ||
    (decoded.stage !== "verify" && decoded.stage !== "setup") ||
    (decoded.role !== "employee" &&
      decoded.role !== "admin" &&
      decoded.role !== "super admin")
  ) {
    return null;
  }
  return decoded as ChallengeTokenPayload;
}
