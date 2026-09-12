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
