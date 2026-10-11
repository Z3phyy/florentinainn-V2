import { Router } from "express";
import { ArchiveController } from "../controller/archive.controller";
import { authenticateJWT } from "../middleware/auth";
import { requireAdmin } from "../middleware/requireAdmin";

const route = Router();

route.get("/:type", authenticateJWT, requireAdmin, ArchiveController.list);
route.post("/:type/:id/restore", authenticateJWT, requireAdmin, ArchiveController.restore);

export default route;
