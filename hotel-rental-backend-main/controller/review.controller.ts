import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { ReviewError, ReviewService } from "../services/review.service";
import { logAuditAction } from "../utils/auditLogger";
import { notify } from "../utils/notification";

const handle = (response: Response, error: unknown, fallback: string) => {
  if (error instanceof ReviewError) {
    response.status(error.status).json({ message: error.message });
    return;
  }
  console.log(`${fallback}: ` + (error as Error).message);
  response.status(500).json({ message: fallback });
};

const identityFrom = (request: AuthRequest) => ({
  reservationCode: request.body?.reservationCode,
  bookingId: request.body?.bookingId,
  verificationCode: request.body?.verificationCode,
  roomId: request.body?.roomId,
  ip: request.ip,
});

export class ReviewController {
  static latest = async (request: AuthRequest, response: Response) => {
    try {
      response.send(await ReviewService.latest(Number(request.query.limit)));
    } catch (error) {
      handle(response, error, "Failed to load reviews");
    }
  };

  static eligibility = async (request: AuthRequest, response: Response) => {
    try {
      response.send(await ReviewService.eligibility(identityFrom(request)));
    } catch (error) {
      handle(response, error, "Failed to check review eligibility");
    }
  };

  static create = async (request: AuthRequest, response: Response) => {
    try {
      const { review, booking } = await ReviewService.create({
        ...identityFrom(request),
        rating: request.body?.rating,
        comment: request.body?.comment,
      });
      await logAuditAction({
        action: "ROOM_REVIEW_SUBMITTED",
        details: `${booking.clientName} rated their stay ${review.rating}/5`,
        actorName: booking.clientName || "Guest",
        actorRole: "guest",
        targetType: "review",
        targetId: review._id,
      });
      await notify({
        type: "reservation",
        title: `New Room Review: ${review.rating}/5`,
        message: `${review.guestName} reviewed ${booking.room?.roomNumber ? `Room ${booking.room.roomNumber}` : booking.room?.category || "their room"}.`,
        severity: review.rating <= 2 ? "warning" : "info",
        link: "/pages/admin/dashboard",
        targetType: "review",
        targetId: review._id,
      });
      response.status(201).send(review);
    } catch (error) {
      handle(response, error, "Failed to submit review");
    }
  };

  static listForAdmin = async (request: AuthRequest, response: Response) => {
    try {
      response.send(
        await ReviewService.listForAdmin({
          page: Number(request.query.page),
          limit: Number(request.query.limit),
          search: typeof request.query.search === "string" ? request.query.search : "",
        }),
      );
    } catch (error) {
      handle(response, error, "Failed to load reviews");
    }
  };

  static archive = async (request: AuthRequest, response: Response) => {
    try {
      const reason = typeof request.body?.reason === "string" ? request.body.reason.trim().slice(0, 300) : "";
      const review = await ReviewService.archive(String(request.params.id || ""), request.account?.name || "Administrator", reason);
      await logAuditAction({
        action: "REVIEW_ARCHIVED",
        details: `Archived review by ${review.guestName} (${review.rating}/5)${reason ? ` — ${reason}` : ""}`,
        actorName: request.account?.name || "Administrator",
        actorRole: request.account?.type || "admin",
        targetType: "review",
        targetId: String(review._id),
      });
      response.send({ message: "Review archived." });
    } catch (error) {
      handle(response, error, "Failed to archive review");
    }
  };

  static listForRoom = async (request: AuthRequest, response: Response) => {
    try {
      response.send(
        await ReviewService.listForRoom(
          String(request.params.roomId || ""),
          Number(request.query.page),
          Number(request.query.limit),
        ),
      );
    } catch (error) {
      handle(response, error, "Failed to load reviews");
    }
  };
}
