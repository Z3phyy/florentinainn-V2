export const PASSWORD_REQUIREMENTS_MESSAGE =
  "Password must contain at least 8 characters, including uppercase, lowercase, number, and special character.";

export function validatePassword(password: string): string | null {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  if (password.length > 128) {
    return "Password must be at most 128 characters long.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least 1 uppercase letter.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least 1 lowercase letter.";
  }
  if (!/\d/.test(password)) {
    return "Password must contain at least 1 number.";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must contain at least 1 special character.";
  }
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email || typeof email !== "string") {
    return "Email is required.";
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return "Invalid email address format.";
  }
  return null;
}

export const ACCESS_CODE_MIN_LENGTH = 6;
export const ACCESS_CODE_MAX_LENGTH = 20;

export function normalizeAccessCode(code: unknown): string {
  return typeof code === "string" ? code.trim().toUpperCase() : "";
}

export function validateAccessCode(code: unknown): string | null {
  const normalized = normalizeAccessCode(code);
  if (!normalized) {
    return "Access code is required.";
  }
  if (
    normalized.length < ACCESS_CODE_MIN_LENGTH ||
    normalized.length > ACCESS_CODE_MAX_LENGTH
  ) {
    return `Access code must be ${ACCESS_CODE_MIN_LENGTH}-${ACCESS_CODE_MAX_LENGTH} characters long.`;
  }
  if (!/^[A-Z0-9]+$/.test(normalized)) {
    return "Access code may only contain letters and numbers.";
  }
  if (/^(.)\1+$/.test(normalized)) {
    return "Access code cannot be a single repeated character.";
  }
  return null;
}

export function isValidObjectId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
}
