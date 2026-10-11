import { Router } from "express";
import { RoomController } from "../controller/room.controller";
import { upload } from "../utils/upload";
import { authenticateJWT } from "../middleware/auth";
import { requirePermission, requireSuperAdmin } from "../middleware/requireAdmin";

const route = Router();

route.get("/housekeeping/report", authenticateJWT, requirePermission("housekeeping"), RoomController.getHousekeepingReport);
route.get("/:id", RoomController.getRoom);
route.get("/", RoomController.getAllRooms);

route.post("/", authenticateJWT, requirePermission("room management"), upload.single("image"), RoomController.createRoom);
route.put("/", authenticateJWT, requirePermission("room management"), upload.fields([{ name: "image", maxCount: 1 }, { name: "images", maxCount: 10 }]), RoomController.updateRoom);
route.delete("/", authenticateJWT, requirePermission("room management"), RoomController.deleteRoom);
route.post("/images", authenticateJWT, requirePermission("room management"), upload.array("images", 10), RoomController.uploadRoomImages);
route.delete("/images", authenticateJWT, requirePermission("room management"), RoomController.deleteRoomImage);
route.patch("/maintenance", authenticateJWT, requirePermission("maintenance"), RoomController.toggleMaintenance);
route.patch("/discount", authenticateJWT, requirePermission("room management"), RoomController.updateDiscount);
route.patch("/housekeeping", authenticateJWT, requirePermission("housekeeping"), RoomController.updateHousekeeping);
route.post("/housekeeping/dirty", authenticateJWT, requirePermission("housekeeping"), RoomController.markHousekeepingDirty);

export default route;
