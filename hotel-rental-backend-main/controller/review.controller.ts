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

export class ReviewController {
  static eligibility = async (request: AuthRequest, response: Response) => {
    try {
      response.send(await ReviewService.eligibility(request.body?.bookingId, request.body?.verificationCode));
    } catch (error) {
      handle(response, error, "Failed to check review eligibility");
    }
  };

  static create = async (request: AuthRequest, response: Response) => {
    try {
      const { review, booking } = await ReviewService.create({
        bookingId: request.body?.bookingId,
        verificationCode: request.body?.verificationCode,
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
