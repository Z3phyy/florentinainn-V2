import { z } from "zod";
import { validatePassword } from "./validation";
import {
  validateAddress,
  validateEmailFormat,
  validateGuestName,
  validatePhoneFormat,
} from "./bookingValidation";

export const ACCESS_CODE_MIN_LENGTH = 6;
export const ACCESS_CODE_MAX_LENGTH = 20;

export const requiredText = (label: string, max = 100) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`);

export const optionalText = (label: string, max = 100) =>
  z.string().trim().max(max, `${label} must be at most ${max} characters.`);

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Please enter a valid email address.");

export const optionalEmailSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || z.email().safeParse(v).success, {
    message: "Please enter a valid email address.",
  });

export const strongPasswordSchema = z.string().superRefine((value, ctx) => {
  const error = validatePassword(value);
  if (error) {
    ctx.addIssue({ code: "custom", message: error });
  }
});

export const optionalStrongPasswordSchema = z.string().superRefine((value, ctx) => {
  if (value === "") return;
  const error = validatePassword(value);
  if (error) {
    ctx.addIssue({ code: "custom", message: error });
  }
});

export const accessCodeSchema = z
  .string()
  .trim()
  .min(1, "Access code is required.")
  .transform((v) => v.toUpperCase())
  .pipe(
    z
      .string()
      .min(ACCESS_CODE_MIN_LENGTH, `Access code must be at least ${ACCESS_CODE_MIN_LENGTH} characters.`)
      .max(ACCESS_CODE_MAX_LENGTH, `Access code must be at most ${ACCESS_CODE_MAX_LENGTH} characters.`)
      .regex(/^[A-Z0-9]+$/, "Access code may only contain letters and numbers.")
      .refine((v) => !/^(.)\1+$/.test(v), "Access code cannot be a single repeated character."),
  );

export const accessCodePairSchema = z
  .object({
    accessCode: accessCodeSchema,
    confirmAccessCode: z.string().trim().min(1, "Please confirm the access code."),
  })
  .refine((d) => d.accessCode === d.confirmAccessCode.toUpperCase(), {
    path: ["confirmAccessCode"],
    message: "Access codes do not match.",
  });

export const permissionsSchema = z.array(z.string());

export const staffCreateSchema = z
  .object({
    name: requiredText("Name"),
    position: optionalText("Position"),
    email: emailSchema,
    password: strongPasswordSchema,
    permisions: permissionsSchema,
    accessCode: accessCodeSchema,
    confirmAccessCode: z.string().trim().min(1, "Please confirm the access code."),
  })
  .refine((d) => d.accessCode === d.confirmAccessCode.toUpperCase(), {
    path: ["confirmAccessCode"],
    message: "Access codes do not match.",
  });

export const staffEditSchema = z.object({
  name: requiredText("Name"),
  position: optionalText("Position"),
  email: emailSchema,
  password: optionalStrongPasswordSchema,
  permisions: permissionsSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

export const accessCodeEntrySchema = z.object({
  accessCode: z
    .string()
    .trim()
    .min(1, "Access code is required.")
    .max(ACCESS_CODE_MAX_LENGTH, `Access code must be at most ${ACCESS_CODE_MAX_LENGTH} characters.`),
});

export const ownAccessCodeSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    accessCode: accessCodeSchema,
    confirmAccessCode: z.string().trim().min(1, "Please confirm the access code."),
  })
  .refine((d) => d.accessCode === d.confirmAccessCode.toUpperCase(), {
    path: ["confirmAccessCode"],
    message: "Access codes do not match.",
  });

export const passwordWithConfirmSchema = z
  .object({
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const reasonSchema = z.object({
  reason: optionalText("Reason", 300),
});

export const adminCreateSchema = z
  .object({
    name: requiredText("Name"),
    email: emailSchema,
    password: strongPasswordSchema,
    accessCode: accessCodeSchema,
    confirmAccessCode: z.string().trim().min(1, "Please confirm the access code."),
  })
  .refine((d) => d.accessCode === d.confirmAccessCode.toUpperCase(), {
    path: ["confirmAccessCode"],
    message: "Access codes do not match.",
  });

const nonNegativeNumberString = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .refine((v) => Number.isFinite(Number(v)), `${label} must be a number.`)
    .refine((v) => Number(v) >= 0, `${label} cannot be negative.`)
    .refine((v) => Number(v) <= max, `${label} must be at most ${max.toLocaleString()}.`);

export const systemSettingsSchema = z.object({
  systemName: requiredText("Hotel name", 100),
  header: optionalText("Hero tagline", 200),
  facebook: z
    .string()
    .trim()
    .refine((v) => v === "" || /^https?:\/\/\S+\.\S+/i.test(v), "Enter a full URL starting with http:// or https://"),
  contactEmail: optionalEmailSchema,
  paymentMin: nonNegativeNumberString("Minimum payment", 1000000),
  gracePeriodHours: nonNegativeNumberString("Grace period", 72),
  description: optionalText("Description", 1000),
  systemInfo: optionalText("Knowledge base", 20000),
});

export const refundSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Please describe why this payment is being refunded.")
    .max(300, "Reason must be at most 300 characters."),
  note: optionalText("Reference number", 100),
});

export const staffRegistrationSchema = z
  .object({
    name: requiredText("Name"),
    email: emailSchema,
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const adminRegistrationSchema = z
  .object({
    type: z.enum(["admin", "super admin"], { message: "Select an account type." }),
    email: emailSchema,
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const changeEmailSchema = z.object({
  newEmail: emailSchema,
  currentPassword: z.string().min(1, "Enter your current password to verify."),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Please repeat the new password."),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "New passwords do not match.",
  })
  .refine((d) => d.password !== d.currentPassword, {
    path: ["password"],
    message: "New password must be different from the current password.",
  });

const fromValidator = (validate: (value: string) => string | null) =>
  z.string().superRefine((value, ctx) => {
    const error = validate(value);
    if (error) ctx.addIssue({ code: "custom", message: error });
  });

export const guestRecordSchema = z
  .object({
    name: fromValidator(validateGuestName),
    email: z.string().trim().superRefine((value, ctx) => {
      if (!value) return;
      const error = validateEmailFormat(value);
      if (error) ctx.addIssue({ code: "custom", message: error });
    }),
    phone: z.string().trim().superRefine((value, ctx) => {
      if (!value) return;
      const error = validatePhoneFormat(value);
      if (error) ctx.addIssue({ code: "custom", message: error });
    }),
    address: fromValidator(validateAddress),
  })
  .refine((d) => d.email.trim() !== "" || d.phone.trim() !== "", {
    path: ["phone"],
    message: "Provide at least one contact detail — an email address or a contact number.",
  });
