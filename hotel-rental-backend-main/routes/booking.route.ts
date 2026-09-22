import { Router } from "express";
import { BookingController } from "../controller/booking.controller";
import { authenticateJWT } from "../middleware/auth";
import { paymentLimiter } from "../config/rateLimit";

const route = Router()

route.get("/:id", BookingController.getBooking)
route.get("/", authenticateJWT, BookingController.getAllBookings)
route.post("/", authenticateJWT, BookingController.createBooking)
route.post("/checkout",authenticateJWT ,BookingController.checkOut)
route.post("/reservation", BookingController.reservation)
route.post("/reservation/session", paymentLimiter, BookingController.reservationSession)
route.post("/reservationPayment", paymentLimiter, BookingController.reservationPayment)
route.post("/reservation/active", authenticateJWT, BookingController.reservationActivate)
route.post("/reservation/cancel", authenticateJWT, BookingController.reservationCancel)
route.post("/partialPayment", authenticateJWT, BookingController.partialPayment)
route.put("/", authenticateJWT, BookingController.updateBooking)
route.delete("/", authenticateJWT, BookingController.deleteBooking)

export default route
