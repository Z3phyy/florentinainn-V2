import { Router } from "express";
import { AccountController } from "../controller/accounts.controller";
import { authenticateJWT } from "../middleware/auth";
import { requireAdmin, requireSuperAdmin } from "../middleware/requireAdmin";
import { authLimiter } from "../config/rateLimit";

const route = Router()

route.post("/", authLimiter, AccountController.createAccount)
route.post("/login", authLimiter, AccountController.login)
route.get("/check-email/:email", authLimiter, AccountController.checkEmailAvailability)
route.get("/permissions", authenticateJWT, requireAdmin, AccountController.getPermissionMatrix)

route.put("/change-credentials", authenticateJWT, AccountController.changeCredentials)
route.get("/", authenticateJWT, requireAdmin, AccountController.getAccounts)
route.put("/", authenticateJWT, requireAdmin, AccountController.updateAccount)
route.put("/approve", authenticateJWT, requireAdmin, AccountController.approveAccount)
route.put("/reactivate", authenticateJWT, requireAdmin, AccountController.reactivateAccount)
route.put("/suspend", authenticateJWT, requireAdmin, AccountController.suspendAccount)
route.put("/unsuspend", authenticateJWT, requireAdmin, AccountController.unsuspendAccount)
route.put("/force-logout", authenticateJWT, requireSuperAdmin, AccountController.forceLogout)
route.put("/reset-password", authenticateJWT, requireSuperAdmin, AccountController.resetStaffPassword)
route.delete("/", authenticateJWT, requireAdmin, AccountController.deleteAccount)
route.delete("/reject", authenticateJWT, requireAdmin, AccountController.rejectAccount)
route.delete("/permanent", authenticateJWT, requireSuperAdmin, AccountController.removeAccountPermanently)

export default route