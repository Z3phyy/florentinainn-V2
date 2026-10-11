import crypto from "crypto";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const REFERENCE_PATTERN = /^RES-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/;

export function generateReferenceCode(): string {
  const bytes = crypto.randomBytes(10);
  const chars = Array.from(bytes, (b) => ALPHABET[b % 32]).join("");
  return `RES-${chars.slice(0, 5)}-${chars.slice(5)}`;
}

export function normalizeReferenceCode(value: unknown): string {
  if (typeof value !== "string") return "";
  const compact = value
    .trim()
    .toUpperCase()
    .replace(/[\s_]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/^RES-?/, "")
    .replace(/-/g, "");
  if (!/^[0-9A-HJKMNP-TV-Z]{10}$/.test(compact)) return "";
  return `RES-${compact.slice(0, 5)}-${compact.slice(5)}`;
}

export function isLegacyVerificationCode(value: unknown): boolean {
  return typeof value === "string" && /^[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(value.trim());
}
