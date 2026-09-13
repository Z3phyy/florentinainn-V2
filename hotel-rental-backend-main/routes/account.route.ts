import { Router } from "express";
import { AccountController } from "../controller/accounts.controller";
import { authenticateJWT } from "../middleware/auth";
import { requireAdmin } from "../middleware/requireAdmin";
import { authLimiter } from "../config/rateLimit";

const route = Router()

route.post("/", authLimiter, AccountController.createAccount)
route.post("/login", authLimiter, AccountController.login)
route.get("/check-email/:email", authLimiter, AccountController.checkEmailAvailability)

route.put("/change-credentials", authenticateJWT, AccountController.changeCredentials)
route.get("/", authenticateJWT, requireAdmin, AccountController.getAccounts)
route.put("/", authenticateJWT, requireAdmin, AccountController.updateAccount)
route.put("/approve", authenticateJWT, requireAdmin, AccountController.approveAccount)
route.delete("/", authenticateJWT, requireAdmin, AccountController.deleteAccount)
route.delete("/reject", authenticateJWT, requireAdmin, AccountController.rejectAccount)

export default route