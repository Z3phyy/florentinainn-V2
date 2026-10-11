export const PASSWORD_REQUIREMENTS_MESSAGE =
  "Password must contain at least 8 characters, including uppercase, lowercase, number, and special character.";

export const PASSWORD_RULES = [
  { label: "Minimum 8 characters in length", test: (v: string) => v.length >= 8 },
  { label: "At least 1 uppercase letter (A-Z)", test: (v: string) => /[A-Z]/.test(v) },
  { label: "At least 1 lowercase letter (a-z)", test: (v: string) => /[a-z]/.test(v) },
  { label: "At least 1 numerical digit (0-9)", test: (v: string) => /\d/.test(v) },
  { label: "At least 1 special character (!@#$...)", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

export function validatePassword(password: string): string | null {
  if (!password || password.length < 8) {
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
  if (!email) {
    return "Email is required.";
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return "Please enter a valid email address.";
  }
  return null;
}
