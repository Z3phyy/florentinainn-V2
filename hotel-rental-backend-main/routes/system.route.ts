import { Router } from "express";
import { SystemController } from "../controller/system.controller";
import { upload } from "../utils/upload";
import { authenticateJWT, authenticateChatSender } from "../middleware/auth";
import { requireAdmin } from "../middleware/requireAdmin";
import { attachTokenFromQuery } from "../middleware/sseAuth";
import { authLimiter, otpLimiter } from "../config/rateLimit";

const route = Router()

const adminAuth = [authenticateJWT, requireAdmin];

route.post("/ai", SystemController.aiChatBot)
route.post("/ai-suggest-reply", authenticateJWT, SystemController.aiSuggestReply)
route.post("/ai-forecast", authenticateJWT, SystemController.aiForecastSuggestions)
route.get("/", SystemController.getSystemInfo)
route.get("/payments", adminAuth, SystemController.getAllPayments)
route.put("/info", adminAuth, SystemController.updateSystemInfo)
route.post("/logo", adminAuth, upload.single("logo"), SystemController.uploadLogo)
route.post("/image", adminAuth, upload.single("image"), SystemController.uploadSystemImage)
route.post("/admin", authLimiter, SystemController.createAdmin)
route.get("/admin/status", SystemController.checkAdminRegistrationStatus)
route.put("/admin/change-credentials", adminAuth, SystemController.changeAdminCredentials)
route.post("/forgot-password/send-otp", otpLimiter, SystemController.sendForgotPasswordOtp)
route.post("/forgot-password/verify-otp", otpLimiter, SystemController.verifyForgotPasswordOtp)
route.post("/forgot-password/reset-password", otpLimiter, SystemController.resetPassword)

route.get("/audit-logs", adminAuth, SystemController.getAuditLogs)
route.get("/health", SystemController.getSystemHealth)
route.get("/notifications", adminAuth, SystemController.getAdminNotifications)
route.get("/notifications/staff", authenticateJWT, SystemController.getStaffNotifications)
route.get("/notifications/stream", attachTokenFromQuery, adminAuth, SystemController.streamAdminNotifications)
route.get("/notifications/staff/stream", attachTokenFromQuery, authenticateJWT, SystemController.streamStaffNotifications)
route.put("/notifications/read-all", adminAuth, SystemController.markAllNotificationsRead)
route.put("/notifications/staff/read-all", authenticateJWT, SystemController.markAllStaffNotificationsRead)
route.put("/notifications/:id/read", adminAuth, SystemController.markNotificationAsRead)
// Note: literal staff routes must be declared BEFORE the generic "/:id" routes,
// otherwise DELETE /notifications/staff is captured by /notifications/:id and rejected
// by adminAuth (403), breaking "Clear Alerts" for staff.
route.delete("/notifications/staff", authenticateJWT, SystemController.clearStaffNotifications)
route.delete("/notifications/staff/:id", authenticateJWT, SystemController.deleteStaffNotification)
route.delete("/notifications", adminAuth, SystemController.clearNotifications)
route.delete("/notifications/:id", adminAuth, SystemController.deleteNotification)

route.get("/chat", authenticateJWT, SystemController.getAllChats)
route.get("/chat/:id", SystemController.getChat)
route.post("/chat", SystemController.createChat)
route.post("/chat/message", authenticateChatSender, SystemController.sendChatMessage)
route.put("/chat/:id/status", authenticateJWT, SystemController.updateChatStatus)
route.put("/chat/:id/seen", authenticateJWT, SystemController.markChatAsSeen)
route.delete("/chat/:id", authenticateJWT, SystemController.deleteChat)

route.post("/contact", SystemController.sendContactInquiry)

export default route
