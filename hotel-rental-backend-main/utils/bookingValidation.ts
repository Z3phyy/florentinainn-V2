export const MAX_STAY_NIGHTS = 30;
export const MAX_ADVANCE_DAYS = 365;
export const ARRIVAL_GRACE_MS = 5 * 60 * 1000;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;
const NAME_PATTERN = /^[\p{L}][\p{L}\s.'-]*$/u;

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

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
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

export function validateContact(
  email: string | undefined,
  phone: string | undefined,
  options: { requireEmail?: boolean } = {},
): string | null {
  const emailValue = (email || "").trim();
  const phoneValue = (phone || "").trim();

  if (options.requireEmail) {
    const emailErr = validateEmailFormat(emailValue);
    if (emailErr) return emailErr;
  } else if (emailValue) {
    const emailErr = validateEmailFormat(emailValue);
    if (emailErr) return emailErr;
  }

  if (phoneValue) {
    const phoneErr = validatePhoneFormat(phoneValue);
    if (phoneErr) return phoneErr;
  }

  if (!options.requireEmail && !emailValue && !phoneValue) {
    return "Provide at least one contact detail — an email address or a contact number.";
  }

  return null;
}

export function validateStayDates(input: {
  arrivalDate: string;
  arrivalTime: string;
  departureDate?: string;
  requireDeparture?: boolean;
}): string | null {
  const { arrivalDate, arrivalTime, departureDate, requireDeparture } = input;

  if (!arrivalDate || !arrivalTime) {
    return "Arrival date and arrival time are required";
  }

  if (!TIME_PATTERN.test(arrivalTime)) {
    return "Invalid arrival date or time format";
  }

  const arrival = parseDateOnly(arrivalDate);
  if (!arrival) {
    return "Invalid arrival date or time format";
  }

  const [hours, minutes] = arrivalTime.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes) || hours > 23 || minutes > 59) {
    return "Invalid arrival date or time format";
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

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (arrivalDateTime.getTime() < now.getTime() - ARRIVAL_GRACE_MS) {
    if (arrival.getTime() < todayStart.getTime()) {
      return "Arrival date cannot be in the past";
    }
    return "Arrival time cannot be in the past for today's arrival";
  }

  if (daysBetween(todayStart, arrival) > MAX_ADVANCE_DAYS) {
    return `Arrival date cannot be more than ${MAX_ADVANCE_DAYS} days ahead.`;
  }

  const departureValue = (departureDate || "").trim();

  if (!departureValue) {
    return requireDeparture ? "Departure (check-out) date is required." : null;
  }

  const departure = parseDateOnly(departureValue);
  if (!departure) {
    return "Invalid departure date format.";
  }

  if (departure.getTime() <= arrival.getTime()) {
    return "Departure date must be at least one night after the arrival date.";
  }

  const nights = daysBetween(arrival, departure);
  if (nights > MAX_STAY_NIGHTS) {
    return `A single stay cannot exceed ${MAX_STAY_NIGHTS} nights.`;
  }

  return null;
}

export function validateGuestCount(
  guests: unknown,
  maxHead?: number,
): string | null {
  if (guests === undefined || guests === null || guests === "") {
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
