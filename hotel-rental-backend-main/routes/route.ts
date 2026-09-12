import { Router } from "express";
import accountRoute from "./account.route"
import roomRoute from "./room.route"
import bookingRoute from "./booking.route"
import systemRoute from "./system.route"
import reportRoute from "./report.route"

const routes = Router()

routes.use("/account", accountRoute)
routes.use("/room", roomRoute)
routes.use("/booking", bookingRoute)
routes.use("/system", systemRoute)
routes.use("/reports", reportRoute)

export default routes