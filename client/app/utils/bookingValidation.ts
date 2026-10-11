export const MAX_STAY_NIGHTS = 30;
export const MAX_ADVANCE_DAYS = 365;
export const ARRIVAL_GRACE_MS = 5 * 60 * 1000;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NAME_PATTERN = /^[\p{L}][\p{L}\s.'-]*$/u;

export type FieldErrors = Record<string, string>;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function todayDateStr(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateOnly(value: string): Date | null {
  if (!DATE_PATTERN.test(value || "")) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function addDays(value: string, days: number): string {
  const base = parseDateOnly(value);
  if (!base) return value;
  const next = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + days,
  );
  return todayDateStr(next);
}

export function nightsBetween(
  arrivalDate: string,
  departureDate: string,
): number {
  const arrival = parseDateOnly(arrivalDate);
  const departure = parseDateOnly(departureDate);
  if (!arrival || !departure) return 0;
  return Math.round((departure.getTime() - arrival.getTime()) / 86400000);
}

export function validateGuestName(name: string): string | null {
  const value = (name || "").trim();
  if (!value) return "Guest name is required.";
  if (value.length < 2) return "Guest name must be at least 2 characters.";
  if (value.length > 80) return "Guest name must be 80 characters or fewer.";
  if (!NAME_PATTERN.test(value)) {
    return "Guest name may only contain letters, spaces, hyphens, apostrophes and periods.";
  }
  return null;
}

export function validateAddress(address: string): string | null {
  const value = (address || "").trim();
  if (!value) return "Guest address is required.";
  if (value.length < 5)
    return "Please enter a complete address (at least 5 characters).";
  if (value.length > 160) return "Address must be 160 characters or fewer.";
  return null;
}

export function validateEmailFormat(email: string): string | null {
  const value = (email || "").trim();
  if (!value) return "Email address is required.";
  if (value.length > 120)
    return "Email address must be 120 characters or fewer.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
    return "Please enter a valid email address.";
  }
  return null;
}

export function validatePhoneFormat(phone: string): string | null {
  const value = (phone || "").trim();
  if (!value) return "Contact number is required.";
  if (!/^\+?[\d\s()-]{7,20}$/.test(value)) {
    return "Please enter a valid contact number.";
  }
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return "Contact number must contain between 7 and 15 digits.";
  }
  return null;
}

export function validateArrival(
  arrivalDate: string,
  arrivalTime: string,
): string | null {
  if (!arrivalDate) return "Arrival date is required.";
  if (!arrivalTime) return "Arrival time is required.";

  const arrival = parseDateOnly(arrivalDate);
  if (!arrival) return "Please enter a valid arrival date.";

  const [hours, minutes] = arrivalTime.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes) || hours > 23 || minutes > 59) {
    return "Please enter a valid arrival time.";
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (arrival.getTime() < todayStart.getTime()) {
    return "Arrival date cannot be in the past.";
  }

  const arrivalDateTime = new Date(
    arrival.getFullYear(),
    arrival.getMonth(),
    arrival.getDate(),
    hours,
    minutes,
    0,
    0,
  );

  if (arrivalDateTime.getTime() < now.getTime() - ARRIVAL_GRACE_MS) {
    return "Arrival time cannot be in the past for today's arrival.";
  }

  const daysAhead = Math.round(
    (arrival.getTime() - todayStart.getTime()) / 86400000,
  );
  if (daysAhead > MAX_ADVANCE_DAYS) {
    return `Arrival date cannot be more than ${MAX_ADVANCE_DAYS} days ahead.`;
  }

  return null;
}

export function validateDeparture(
  arrivalDate: string,
  departureDate: string,
): string | null {
  if (!departureDate) return "Check-out date is required.";

  const arrival = parseDateOnly(arrivalDate);
  const departure = parseDateOnly(departureDate);

  if (!departure) return "Please enter a valid check-out date.";
  if (!arrival) return null;

  if (departure.getTime() <= arrival.getTime()) {
    return "Check-out must be at least one night after check-in.";
  }

  const nights = nightsBetween(arrivalDate, departureDate);
  if (nights > MAX_STAY_NIGHTS) {
    return `A single stay cannot exceed ${MAX_STAY_NIGHTS} nights.`;
  }

  return null;
}

export function validateGuestCount(
  guests: string | number,
  maxHead?: number,
): string | null {
  if (guests === "" || guests === null || guests === undefined) {
    return "Number of guests is required.";
  }

  const value = Number(guests);
  if (!Number.isInteger(value) || value < 1) {
    return "Number of guests must be a whole number of at least 1.";
  }

  const capacity = Number(maxHead) > 0 ? Number(maxHead) : 0;
  if (capacity && value > capacity) {
    return `This room accommodates up to ${capacity} guest(s).`;
  }
  if (!capacity && value > 20) {
    return "Number of guests must be 20 or fewer.";
  }

  return null;
}

export interface BookingFormValues {
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  clientPhone: string;
  arrivalDate: string;
  arrivalTime: string;
  departureDate: string;
  guests: string | number;
}

export interface BookingFormRules {
  requireEmail: boolean;
  maxHead?: number;
}

export function validateBookingForm(
  values: BookingFormValues,
  rules: BookingFormRules,
): FieldErrors {
  const errors: FieldErrors = {};

  const nameError = validateGuestName(values.clientName);
  if (nameError) errors.clientName = nameError;

  const addressError = validateAddress(values.clientAddress);
  if (addressError) errors.clientAddress = addressError;

  const email = (values.clientEmail || "").trim();
  const phone = (values.clientPhone || "").trim();

  if (rules.requireEmail) {
    const emailError = validateEmailFormat(email);
    if (emailError) errors.clientEmail = emailError;
  } else if (email) {
    const emailError = validateEmailFormat(email);
    if (emailError) errors.clientEmail = emailError;
  }

  if (phone) {
    const phoneError = validatePhoneFormat(phone);
    if (phoneError) errors.clientPhone = phoneError;
  }

  if (!rules.requireEmail && !email && !phone) {
    errors.clientPhone =
      "Provide at least one contact detail — an email address or a contact number.";
  }

  const arrivalError = validateArrival(values.arrivalDate, values.arrivalTime);
  if (arrivalError) {
    if (arrivalError.toLowerCase().includes("time"))
      errors.arrivalTime = arrivalError;
    else errors.arrivalDate = arrivalError;
  }

  const departureError = validateDeparture(
    values.arrivalDate,
    values.departureDate,
  );
  if (departureError) errors.departureDate = departureError;

  const guestError = validateGuestCount(values.guests, rules.maxHead);
  if (guestError) errors.guests = guestError;

  return errors;
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object") {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}
