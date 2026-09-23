import { Router } from "express";
import { BookingController } from "../controller/booking.controller";
import { authenticateJWT } from "../middleware/auth";
import { requirePermission } from "../middleware/requireAdmin";
import { paymentLimiter } from "../config/rateLimit";

const route = Router()

route.get("/directory", authenticateJWT, requirePermission("guest records"), BookingController.guestDirectory);
route.put("/directory", authenticateJWT, requirePermission("guest records"), BookingController.updateGuestRecord);
route.get("/:id", BookingController.getBooking)
route.post("/status/lookup", BookingController.guestStatusLookup)
route.get("/", authenticateJWT, BookingController.getAllBookings)
route.post("/", authenticateJWT, requirePermission("frontdesk management"), BookingController.createBooking)
route.post("/checkout", authenticateJWT, requirePermission("frontdesk management"), BookingController.checkOut)
route.post("/reservation", BookingController.reservation)
route.post("/reservation/session", paymentLimiter, BookingController.reservationSession)
route.post("/reservationPayment", paymentLimiter, BookingController.reservationPayment)
route.post("/reservation/active", authenticateJWT, requirePermission("reservation management"), BookingController.reservationActivate)
route.post("/reservation/cancel", authenticateJWT, requirePermission("reservation management"), BookingController.reservationCancel)
route.post("/reservation/no-show", authenticateJWT, requirePermission("reservation management"), BookingController.markNoShow)
route.post("/reservation/reschedule", authenticateJWT, requirePermission("reservation management"), BookingController.rescheduleBooking)
route.post("/extend", authenticateJWT, requirePermission("reservation management"), BookingController.extendStay)
route.post("/partialPayment", authenticateJWT, requirePermission("frontdesk management"), BookingController.partialPayment)
route.put("/", authenticateJWT, requirePermission("reservation management"), BookingController.updateBooking)
route.delete("/", authenticateJWT, requirePermission("reservation management"), BookingController.deleteBooking)

export default route
