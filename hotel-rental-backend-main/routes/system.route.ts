import { Router } from "express";
import { SystemController } from "../controller/system.controller";
import { BackupController } from "../controller/backup.controller";
import { handleBackupUpload } from "../utils/backupUpload";
import { upload } from "../utils/upload";
import { authenticateJWT, authenticateChatSender } from "../middleware/auth";
import { requireAdmin, requireSuperAdmin, requirePermission } from "../middleware/requireAdmin";
import { attachTokenFromQuery } from "../middleware/sseAuth";
import { authLimiter, otpLimiter, aiLimiter, contactLimiter } from "../config/rateLimit";

const route = Router()

const adminAuth = [authenticateJWT, requireAdmin];
const superAdminAuth = [authenticateJWT, requireSuperAdmin];

route.post("/ai", aiLimiter, SystemController.aiChatBot)
route.post("/ai-suggest-reply", authenticateJWT, SystemController.aiSuggestReply)
route.post("/ai-forecast", aiLimiter, adminAuth, SystemController.aiForecastSuggestions)
route.get("/", SystemController.getSystemInfo)
route.get("/settings", adminAuth, SystemController.getSystemSettings)
route.get("/payments", adminAuth, SystemController.getAllPayments)
route.post("/payments/refund", authenticateJWT, requirePermission("payments"), SystemController.refundPayment)
route.post("/payments/restore", adminAuth, SystemController.restorePayment)
route.put("/info", adminAuth, SystemController.updateSystemInfo)
route.post("/logo", adminAuth, upload.single("logo"), SystemController.uploadLogo)
route.post("/image", adminAuth, upload.single("image"), SystemController.uploadSystemImage)
route.get("/backups", superAdminAuth, BackupController.list)
route.post("/backups", superAdminAuth, BackupController.create)
route.post("/backups/upload", superAdminAuth, handleBackupUpload, BackupController.upload)
route.get("/backups/:id/download", superAdminAuth, BackupController.download)
route.post("/backups/:id/restore", superAdminAuth, BackupController.restore)
route.delete("/backups/:id", superAdminAuth, BackupController.remove)
route.post("/admin", authLimiter, SystemController.createAdmin)
route.get("/admin/status", SystemController.checkAdminRegistrationStatus)
route.get("/admins", superAdminAuth, SystemController.getAdmins)
route.post("/admins", superAdminAuth, SystemController.createAdminAccount)
route.put("/admin/status", superAdminAuth, SystemController.toggleAdminActive)
route.put("/admin/access-code", superAdminAuth, SystemController.setAdminAccessCode)
route.delete("/admin", superAdminAuth, SystemController.removeAdminAccount)
route.get("/access-code", adminAuth, SystemController.getOwnAccessCodeStatus)
route.get("/email/diagnostics", adminAuth, SystemController.emailDiagnostics)
route.put("/access-code", adminAuth, SystemController.changeOwnAccessCode)
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
// Note: literal staff/prefs routes must be declared BEFORE the generic "/:id"
// routes so "notifications/prefs" is not captured by "/notifications/:id".
route.get("/notifications/prefs", adminAuth, SystemController.getNotificationPrefs)
route.get("/notifications/staff/prefs", authenticateJWT, SystemController.getNotificationPrefsStaff)
route.put("/notifications/prefs", adminAuth, SystemController.updateNotificationPrefs)
route.put("/notifications/staff/prefs", authenticateJWT, SystemController.updateNotificationPrefsStaff)
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

route.post("/contact", contactLimiter, SystemController.sendContactInquiry)

export default route
