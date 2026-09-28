import { Router } from "express";
import { AddOnController } from "../controller/addOn.controller";
import { authenticateJWT } from "../middleware/auth";
import { requireAdmin } from "../middleware/requireAdmin";

const route = Router();

route.get("/", AddOnController.listActive);
route.get("/manage", authenticateJWT, requireAdmin, AddOnController.listAll);
route.post("/", authenticateJWT, requireAdmin, AddOnController.create);
route.put("/:id", authenticateJWT, requireAdmin, AddOnController.update);
route.delete("/:id", authenticateJWT, requireAdmin, AddOnController.remove);

export default route;
