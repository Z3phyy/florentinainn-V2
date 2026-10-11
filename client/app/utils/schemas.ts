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
  gracePeriodMinutes: z
    .string()
    .trim()
    .min(1, "Grace period is required.")
    .refine((v) => Number.isInteger(Number(v)), "Use whole minutes.")
    .refine((v) => Number(v) >= 1 && Number(v) <= 1440, "Grace period must be between 1 and 1440 minutes (24 hours)."),
  description: optionalText("Description", 1000),
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

export const ROOM_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
export const ROOM_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

const positiveNumberString = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .refine((v) => Number.isFinite(Number(v)), `${label} must be a number.`)
    .refine((v) => Number(v) > 0, `${label} must be greater than 0.`)
    .refine((v) => Number(v) <= max, `${label} must be at most ${max.toLocaleString()}.`);

export const roomCreateSchema = z.object({
  roomNumber: z
    .string()
    .trim()
    .max(20, "Room number must be at most 20 characters.")
    .refine((v) => v === "" || /^[A-Za-z0-9][A-Za-z0-9 -]*$/.test(v), "Room number may only contain letters, numbers, spaces, and hyphens."),
  category: requiredText("Category", 50),
  price: positiveNumberString("Price", 1000000),
  status: z.string().refine((v) => v === "available" || v === "maintenance", "Status is required."),
  bedding: z.string(),
  maxHead: z
    .string()
    .trim()
    .min(1, "Max guests is required.")
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 20, "Max guests must be a whole number from 1 to 20."),
  description: z
    .string()
    .trim()
    .min(1, "Description is required.")
    .min(10, "Description must be at least 10 characters.")
    .max(1000, "Description must be at most 1000 characters."),
  image: z.custom<File | null>().superRefine((file, ctx) => {
    if (!file || typeof File === "undefined" || !(file instanceof File)) {
      ctx.addIssue({ code: "custom", message: "Room image is required." });
      return;
    }
    if (!ROOM_IMAGE_TYPES.includes(file.type)) {
      ctx.addIssue({ code: "custom", message: "Room image must be a JPG, PNG, WebP, GIF, or AVIF file." });
    } else if (file.size > ROOM_IMAGE_MAX_BYTES) {
      ctx.addIssue({ code: "custom", message: "Room image must be 10 MB or smaller." });
    }
  }),
  amenities: z.array(z.string()).max(30, "At most 30 amenities."),
});

export const addOnFormSchema = z.object({
  name: requiredText("Name", 60),
  description: optionalText("Description", 300),
  price: z
    .string()
    .trim()
    .min(1, "Price is required.")
    .refine((v) => Number.isFinite(Number(v)) && Number(v) >= 0, "Price must be 0 or more.")
    .refine((v) => Number(v) <= 1000000, "Price must be at most 1,000,000."),
  pricingUnit: z.enum(["per_stay", "per_night"], { message: "Choose how this add-on is charged." }),
  maxPerBooking: z
    .string()
    .trim()
    .min(1, "Maximum per booking is required.")
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 100, "Use a whole number from 1 to 100."),
  stock: z
    .string()
    .trim()
    .refine((v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 100000), "Leave empty for unlimited, or enter a whole number."),
  isActive: z.boolean(),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1, "Please choose a rating.").max(5, "Rating must be between 1 and 5."),
  comment: z
    .string()
    .trim()
    .min(1, "Please write a short review.")
    .min(10, "Please write at least 10 characters about your stay.")
    .max(1000, "Reviews can be at most 1000 characters."),
});

export const RESERVATION_CODE_PATTERN = /^RES-?[0-9A-HJKMNP-TV-Z]{5}-?[0-9A-HJKMNP-TV-Z]{5}$/;
export const LEGACY_CODE_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export const isLegacyReservationCode = (value: string) => LEGACY_CODE_PATTERN.test(value.trim().toUpperCase());

export const reservationCodeSchema = z
  .string()
  .trim()
  .min(1, "Reservation code is required.")
  .refine(
    (v) => {
      const upper = v.toUpperCase().replace(/\s/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
      return RESERVATION_CODE_PATTERN.test(upper) || LEGACY_CODE_PATTERN.test(v.trim().toUpperCase());
    },
    "Enter the code from your confirmation, e.g. RES-7K2QD-M9X4P.",
  );

export const trackBookingSchema = z
  .object({
    code: reservationCodeSchema,
    bookingId: z.string().trim(),
  })
  .refine((d) => !isLegacyReservationCode(d.code) || /^[a-f0-9]{24}$/i.test(d.bookingId), {
    path: ["bookingId"],
    message: "Older codes also need the 24-character booking reference from your confirmation link.",
  });

export const aiKnowledgeSchema = z.object({
  location: optionalText("Location", 300),
  contactPhone: optionalText("Contact phone", 100),
  frontDesk: optionalText("Front desk information", 500),
  support: optionalText("Customer support information", 500),
  checkInPolicy: optionalText("Check-in policy", 1500),
  checkOutPolicy: optionalText("Check-out policy", 1500),
  bookingPolicy: optionalText("Booking policy", 1500),
  cancellationPolicy: optionalText("Cancellation policy", 1500),
  refundPolicy: optionalText("Refund policy", 1500),
  paymentPolicy: optionalText("Payment policy", 1500),
  idRequirements: optionalText("ID requirements", 1000),
  houseRules: optionalText("House rules", 2000),
  petPolicy: optionalText("Pet policy", 1000),
  smokingPolicy: optionalText("Smoking policy", 1000),
  visitorPolicy: optionalText("Visitor policy", 1000),
  otherPolicies: optionalText("Other policies", 3000),
  instructions: optionalText("Assistant instructions", 2000),
  systemInfo: optionalText("Additional notes", 20000),
  amenities: z
    .array(z.object({ value: requiredText("Amenity", 120) }))
    .max(50, "At most 50 amenities are allowed."),
  faqs: z
    .array(
      z.object({
        question: requiredText("Question", 200),
        answer: requiredText("Answer", 1000),
      }),
    )
    .max(40, "At most 40 FAQs are allowed."),
});
