import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { roomInterfaceInput } from "../types/room.type";
import { RoomService } from "../services/room.service";
import { uploadToCloudinary, uploadMultipleToCloudinary } from "../utils/cloudinaryUpload";
import { BookingService } from "../services/booking.service";
import { logAuditAction } from "../utils/auditLogger";
import { notify } from "../utils/notification";
import { NotificationService } from "../services/notification.service";


// Helper to build a human-readable room label for audit logs & notifications
function getRoomLabel(room: any): string {
  if (!room) return "Unknown suite";
  const base = room.roomNumber ? `Unit ${room.roomNumber}` : "Suite";
  return room.category ? `${base} (${room.category})` : base;
}

// Helper to parse an array field that may arrive as a plain string, a single value, or a JSON array.
function parseArrayField(field: any): string[] {
  if (Array.isArray(field)) {
    return field.filter((item): item is string => typeof item === "string");
  }
  if (typeof field === "string") {
    const trimmed = field.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string");
      }
    } catch {
      // Not JSON — treat as a single value.
    }
    return [trimmed];
  }
  return [];
}

export class RoomController {

  static getAllRooms = async (request: AuthRequest, response: Response) => {
    const rooms = await RoomService.getAll()
    response.send(rooms)
  }

  static getRoom = async (request: AuthRequest, response: Response) => {
    const { id } = request.params
    const room = await RoomService.get(id)
    response.send(room)
  }

  static createRoom = async (request: AuthRequest, response: Response) => {
    try {


      // Handle file upload for the 'image' field
      let imageUrl = "";
      if (request.file) {
        imageUrl = await uploadToCloudinary(request.file.path);
      }

      // Build room data from form fields, converting stringified arrays
      const roomData: roomInterfaceInput = {
        roomNumber: request.body.roomNumber || "",
        category: request.body.category,
        amenities: parseArrayField(request.body.amenities),
        bedding: parseArrayField(request.body.bedding),
        price: Number(request.body.price),
        maxHead: request.body.maxHead,
        discount: Number(request.body.discount),
        image: imageUrl || request.body.image,
        description: request.body.description,
        images: typeof request.body.images === "string"
          ? JSON.parse(request.body.images)
          : request.body.images || [],
        status: request.body.status,
        maintenance: "",
        housekeeping: typeof request.body.housekeeping === "string"
          ? JSON.parse(request.body.housekeeping)
          : request.body.housekeeping || [],
      };

      await RoomService.create(roomData)
      await logAuditAction({
        action: "ROOM_CREATED",
        details: `Created new room ${roomData.roomNumber ? `Unit ${roomData.roomNumber}` : ""} (${roomData.category}) priced at ₱${roomData.price}`,
        actorName: request.account?.name || "Administrator",
        actorRole: request.account?.type || "admin",
        targetType: "room",
      });
      const rooms = await RoomService.getAll()
      response.send(rooms)
    } catch (error) {
      console.log("Failed to create room: " + (error as Error).message)
      response.status(500).send("Failed to create room: " + (error as Error).message)
    }
  }

  static updateRoom = async (request: AuthRequest, response: Response) => {
    try {
      const {
        _id,
        roomNumber,
        category,
        price,
        discount,
        description,
        status,
        maintenance,
        maxHead,
      } = request.body;

      const files = request.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

      // Handle thumbnail image
      let imageUrl = request.body.image || "";
      if (files && files["image"] && files["image"].length > 0) {
        imageUrl = await uploadToCloudinary(files["image"][0].path);
      }

      // Handle gallery images
      let currentGallery: string[] = [];
      if (request.body.images) {
        currentGallery = typeof request.body.images === "string"
          ? JSON.parse(request.body.images)
          : request.body.images;
      }

      // Handle newly uploaded gallery images
      if (files && files["images"] && files["images"].length > 0) {
        const filePaths = files["images"].map((f) => f.path);
        const newUrls = await uploadMultipleToCloudinary(filePaths);
        currentGallery = [...currentGallery, ...newUrls];
      }

      const amenities = parseArrayField(request.body.amenities);
      const bedding = parseArrayField(request.body.bedding);
      const housekeeping = typeof request.body.housekeeping === "string"
        ? JSON.parse(request.body.housekeeping)
        : request.body.housekeeping || [];

      await RoomService.update(_id, {
        roomNumber: roomNumber !== undefined ? roomNumber : "",
        category,
        amenities,
        bedding,
        price: Number(price),
        discount: Math.min(100, Math.max(0, Number(discount || 0))),
        image: imageUrl,
        description: description || "",
        images: currentGallery,
        status,
        maintenance: maintenance || "",
        housekeeping,
        maxHead: Number(maxHead),
      });

      await logAuditAction({
        action: "ROOM_UPDATED",
        details: `Updated suite ${roomNumber ? `Unit ${roomNumber}` : ""} (${category}) - Rate: ₱${price}`,
        actorName: request.account?.name || "Administrator",
        actorRole: request.account?.type || "admin",
        targetType: "room",
        targetId: _id,
      });

      const rooms = await RoomService.getAll();
      response.send(rooms);
    } catch (error) {
      console.log("Failed to update room: " + (error as Error).message);
      response.status(500).send("Failed to update room: " + (error as Error).message);
    }
  };

  static deleteRoom = async (request: AuthRequest, response: Response) => {
    try {
      const { _id } = request.body
      const room = await RoomService.get(_id)

      if (!room) {
        response.status(404).send("Room not found")
        return
      }

      const bookingCount = await BookingService.countByRoom(_id)
      if (bookingCount > 0) {
        response.status(409).send(`Room cannot be deleted because it has ${bookingCount} booking record${bookingCount === 1 ? "" : "s"}. Delete or reassign those bookings first.`)
        return
      }

      await RoomService.delete(_id)
      await logAuditAction({
        action: "ROOM_DELETED",
        details: `Deleted room ${getRoomLabel(room)}`,
        actorName: request.account?.name || "Administrator",
        actorRole: request.account?.type || "admin",
        targetType: "room",
        targetId: _id,
      });
      const rooms = await RoomService.getAll()
      response.send(rooms)
    } catch (error) {
      console.log("Failed to delete room: " + (error as Error).message)
      response.status(500).send("Failed to delete room: " + (error as Error).message)
    }
  }

  static toggleMaintenance = async (request: AuthRequest, response: Response) => {
    try {
      const { _id } = request.body;
      const room = await RoomService.get(_id);
      const roomLabel = getRoomLabel(room);
      const newStatus = await RoomService.toggleMaintenance(_id);
      await logAuditAction({
        action: "MAINTENANCE_TOGGLED",
        details: `Toggled room status for ${roomLabel} to ${newStatus}`,
        actorName: request.account?.name || "Administrator",
        actorRole: request.account?.type || "admin",
        targetType: "room",
        targetId: _id,
      });

      if (newStatus === "maintenance") {
        await NotificationService.deleteByTarget("room", _id);
        await notify({
          type: "maintenance",
          title: `Room Maintenance Required: ${roomLabel}`,
          message: `${roomLabel} has been flagged for maintenance.`,
          severity: "warning",
          link: "/pages/admin/rooms",
          targetType: "room",
          targetId: _id,
        });
      }
      const rooms = await RoomService.getAll();
      response.send(rooms);
    } catch (error) {
      console.log("Failed to toggle maintenance: " + (error as Error).message);
      response.status(500).send("Failed to toggle maintenance: " + (error as Error).message);
    }
  };

  static updateDiscount = async (request: AuthRequest, response: Response) => {
    try {
      const { _id, discount } = request.body;
      const discountNum = Math.min(100, Math.max(0, Number(discount || 0)));
      const room = await RoomService.get(_id);
      const roomLabel = getRoomLabel(room);
      await RoomService.updateDiscount(_id, discountNum);
      await logAuditAction({
        action: "DISCOUNT_UPDATED",
        details: discountNum > 0
          ? `Applied ${discountNum}% promotional discount to ${roomLabel}`
          : `Removed promotional discount from ${roomLabel}`,
        actorName: request.account?.name || (request.account?.email || "Administrator"),
        actorRole: request.account?.type || (request.account ? "employee" : "admin"),
        targetType: "room",
        targetId: _id,
      });
      const rooms = await RoomService.getAll();
      response.send(rooms);
    } catch (error) {
      console.log("Failed to update discount: " + (error as Error).message);
      response.status(500).send("Failed to update discount: " + (error as Error).message);
    }
  };

  static uploadRoomImages = async (request: AuthRequest, response: Response) => {
    try {

      const { roomId } = request.body

      const files = request.files as Express.Multer.File[]
      if (!files || files.length === 0) {
        response.status(400).send("No images provided")
        return
      }

      const filePaths = files.map(file => file.path)
      const urls = await uploadMultipleToCloudinary(filePaths)

      await RoomService.insertImg(roomId, urls)

      response.send({ urls })
    } catch (error) {
      response.status(500).send("Failed to upload images: " + (error as Error).message)
    }
  }

  static deleteRoomImage = async (request: AuthRequest, response: Response) => {
    try {
      const { roomId, imageUrl } = request.body;
      if (!roomId || !imageUrl) {
        response.status(400).send("roomId and imageUrl are required");
        return;
      }
      await RoomService.deleteImg(roomId, imageUrl);
      const rooms = await RoomService.getAll();
      response.send(rooms);
    } catch (error) {
      console.log("Failed to delete room image: " + (error as Error).message);
      response.status(500).send("Failed to delete image: " + (error as Error).message);
    }
  };
}

