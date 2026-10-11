import { NotificationService, CreateNotificationInput } from "../services/notification.service";
import { broadcastSSE } from "./sse";

export async function notify(params: CreateNotificationInput): Promise<void> {
  try {
    const created = await NotificationService.create(params);
    const audience = params.audience || "admin";
    if (audience === "all") {
      broadcastSSE("admin", { type: "notification", id: created?._id });
      broadcastSSE("staff", { type: "notification", id: created?._id });
    } else {
      broadcastSSE(audience === "staff" ? "staff" : "admin", {
        type: "notification",
        id: created?._id,
      });
    }
  } catch (err) {
    console.error("Notification creation error:", err);
  }
}