import { Router } from "express";
import { RoomController } from "../controller/room.controller";
import { upload } from "../utils/upload";
import { authenticateJWT } from "../middleware/auth";

const route = Router();

route.get("/:id", RoomController.getRoom);
route.get("/", RoomController.getAllRooms);

route.post("/", authenticateJWT, upload.single("image"), RoomController.createRoom);
route.put("/", authenticateJWT, upload.fields([{ name: "image", maxCount: 1 }, { name: "images", maxCount: 10 }]), RoomController.updateRoom);
route.delete("/", authenticateJWT, RoomController.deleteRoom);
route.post("/images", authenticateJWT, upload.array("images", 10), RoomController.uploadRoomImages);
route.delete("/images", authenticateJWT, RoomController.deleteRoomImage);
route.patch("/maintenance", authenticateJWT, RoomController.toggleMaintenance);
route.patch("/discount", authenticateJWT, RoomController.updateDiscount);

export default route;
