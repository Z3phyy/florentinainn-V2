import { Router } from "express";
import { ReviewController } from "../controller/review.controller";
import { reviewLimiter } from "../config/rateLimit";

const route = Router();

route.get("/room/:roomId", ReviewController.listForRoom);
route.post("/eligibility", reviewLimiter, ReviewController.eligibility);
route.post("/", reviewLimiter, ReviewController.create);

export default route;
