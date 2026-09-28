import { Router } from "express";
import { ReviewController } from "../controller/review.controller";
import { reviewLimiter } from "../config/rateLimit";
import { authenticateJWT } from "../middleware/auth";
import { requireAdmin } from "../middleware/requireAdmin";

const route = Router();

route.get("/latest", ReviewController.latest);
route.get("/manage", authenticateJWT, requireAdmin, ReviewController.listForAdmin);
route.delete("/:id", authenticateJWT, requireAdmin, ReviewController.archive);
route.get("/room/:roomId", ReviewController.listForRoom);
route.post("/eligibility", reviewLimiter, ReviewController.eligibility);
route.post("/", reviewLimiter, ReviewController.create);

export default route;
