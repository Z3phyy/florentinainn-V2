import { Router } from "express";
import { ReportController } from "../controller/report.controller";
import { authenticateJWT } from "../middleware/auth";
import { requireAdmin } from "../middleware/requireAdmin";

const route = Router()

const adminAuth = [authenticateJWT, requireAdmin];

route.get("/occupancy", adminAuth, ReportController.getOccupancyReport)
route.get("/revenue", adminAuth, ReportController.getRevenueReport)
route.get("/reservations", adminAuth, ReportController.getReservationReport)
route.get("/popular-rooms", adminAuth, ReportController.getPopularRoomReport)

export default route
