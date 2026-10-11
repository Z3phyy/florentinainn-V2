import axiosInstance from "@/app/utils/axios";

export function getDaysFromDate(dateString: string): number {
  // Parse date as local time to match new Date() behavior
  const [y, m, d] = dateString.split("-").map(Number);
  const arrival = new Date(y, m - 1, d);
  const now = new Date();

  // Reset time parts to compare dates only
  arrival.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diffMs = now.getTime() - arrival.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(0, days);
}

// Converts a 24-hour "HH:MM" service string to a 12-hour AM/PM label (Philippines style)
export function formatTime12hr(timeStr?: string | null): string {
  if (!timeStr) return "Flexible";

  const [hStr, mStr] = timeStr.split(":");
  const hour = Number(hStr);
  const minute = Number(mStr || 0);

  if (isNaN(hour) || isNaN(minute)) return timeStr;

  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;

  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

// Checks whether an email is available for registration (staff or admin account)
export async function checkEmailAvailability(
  email: string
): Promise<{ available: boolean; takenBy: "staff" | "admin" | null }> {
  const { data } = await axiosInstance.get(`/account/check-email/${encodeURIComponent(email.trim())}`);
  return data as { available: boolean; takenBy: "staff" | "admin" | null };
}

// Returns true if the last message in a conversation is from the client (needs a staff reply)
export function needsReply(convo: { user: "client" | "staff"; message: string }[], status?: string): boolean {
  if (status === "resolved") return false;
  if (!convo || convo.length === 0) return false;
  return convo[convo.length - 1].user === "client";
}

export type ChatStatusType = "needs_reply" | "active" | "resolved";

export function getChatStatus(chat: { status?: "active" | "resolved"; convo: { user: "client" | "staff"; message: string }[] }): ChatStatusType {
  if (chat.status === "resolved") return "resolved";
  if (needsReply(chat.convo, chat.status)) return "needs_reply";
  return "active";
}
