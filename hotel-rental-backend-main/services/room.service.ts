import RoomModel from "../model/room.model"
import { roomInterface, roomInterfaceInput } from "../types/room.type";

export class RoomService {

  static async getAll() {
    const rooms = RoomModel.find();
    return rooms
  }

  static async get( id : string) {
    const rooms = RoomModel.findById(id);
    return rooms
  }

  static async create(data : roomInterfaceInput) {
    await RoomModel.create(data)
  }

  static async update(id : string, data : roomInterfaceInput) {
    await RoomModel.findByIdAndUpdate(id, data);
  }

  static async updateStatus(id : string, status : string) {
    await RoomModel.findByIdAndUpdate(id, {status});
  }

  static async toggleMaintenance(
    id: string,
    options?: {
      reason?: string;
      assignedMaintainer?: string;
      notes?: string;
      changedBy?: string;
    },
  ) {
    const room = await RoomModel.findById(id);
    if (!room) throw new Error("Room not found");
    if (room.status !== "available" && room.status !== "maintenance") {
      throw new Error(`Room cannot be toggled while it is ${room.status}`);
    }
    const newStatus = room.status === "maintenance" ? "available" : "maintenance";
    const now = new Date();
    await RoomModel.findByIdAndUpdate(id, {
      status: newStatus,
      ...(newStatus === "maintenance"
        ? {
            maintenanceReason: options?.reason || room.maintenanceReason || "",
            assignedMaintainer:
              options?.assignedMaintainer || room.assignedMaintainer || "",
            maintenanceNotes: options?.notes || "",
            maintenanceStartedAt: now,
            maintenanceCompletedAt: null,
          }
        : {
            maintenanceCompletedAt: now,
          }),
      $push: {
        maintenanceHistory: {
          action: newStatus === "maintenance" ? "flagged" : "resolved",
          note:
            newStatus === "maintenance"
              ? options?.notes || options?.reason || "Flagged for maintenance"
              : "Maintenance completed",
          changedBy: options?.changedBy || "Administrator",
          changedAt: now,
        },
      },
    });
    return newStatus;
  }

  static async updateDiscount(id: string, discount: number) {
    await RoomModel.findByIdAndUpdate(id, { discount });
  }

  static async delete(id : string) {
    const room = RoomModel.findByIdAndDelete(id);
    return room
  }

  static async insertImg(id: string, urls: string[]) {
    await RoomModel.findByIdAndUpdate(
      id,
      {
        $push: {
          images: {
            $each: urls,
          },
        },
      }
    );
  }

  static async deleteImg(id: string, url: string) {
    await RoomModel.findByIdAndUpdate(id, {
      $pull: { images: url },
    });
  }

  static async updateHousekeeping(
    id: string,
    data: {
      housekeepingStatus: string;
      assignedHousekeeper?: string;
      housekeepingNotes?: string;
      changedBy?: string;
    },
  ) {
    const room = await RoomModel.findById(id);
    if (!room) throw new Error("Room not found");

    const from = room.housekeepingStatus || "clean";
    const target = data.housekeepingStatus;

    const transitions: Record<string, string[]> = {
      clean: ["dirty", "cleaning"],
      dirty: ["cleaning"],
      cleaning: ["clean"],
      inspected: ["dirty", "out-of-service"],
      "out-of-service": ["dirty"],
    };

    if (target === from) {
      throw new Error(`Room is already marked as ${target}`);
    }
    const allowed = transitions[from] || [];
    if (!allowed.includes(target)) {
      throw new Error(
        `Cannot change housekeeping from "${from}" to "${target}". Allowed: ${allowed.join(", ")} or none (no change).`,
      );
    }

    const isStarted = target === "cleaning" && (!room.housekeepingStartedAt || room.housekeepingStatus === "dirty");
    const now = new Date();

    return RoomModel.findByIdAndUpdate(
      id,
      {
        housekeepingStatus: target,
        ...(data.assignedHousekeeper !== undefined
          ? { assignedHousekeeper: data.assignedHousekeeper }
          : {}),
        ...(data.housekeepingNotes !== undefined
          ? { housekeepingNotes: data.housekeepingNotes }
          : {}),
        ...(isStarted
          ? { housekeepingStartedAt: now, housekeepingUpdatedAt: now }
          : { housekeepingUpdatedAt: now }),
        $push: {
          housekeepingHistory: {
            status: target,
            from,
            note: data.housekeepingNotes || "",
            changedBy: data.changedBy || "",
            changedAt: now,
          },
        },
      },
      { new: true },
    );
  }

  static async updateMaintenanceDetails(
    id: string,
    data: {
      reason?: string;
      assignedMaintainer?: string;
      notes?: string;
      changedBy?: string;
    },
  ) {
    const room = await RoomModel.findById(id);
    if (!room) throw new Error("Room not found");
    const now = new Date();
    return RoomModel.findByIdAndUpdate(
      id,
      {
        maintenanceReason: data.reason || room.maintenanceReason || "",
        assignedMaintainer:
          data.assignedMaintainer || room.assignedMaintainer || "",
        maintenanceNotes:
          data.notes !== undefined ? data.notes : room.maintenanceNotes || "",
        maintenanceStartedAt: room.maintenanceStartedAt || now,
        $push: {
          maintenanceHistory: {
            action: "details",
            note: data.notes || "Maintenance details updated",
            changedBy: data.changedBy || "Administrator",
            changedAt: now,
          },
        },
      },
      { new: true },
    );
  }

  static async markHousekeepingDirty(
    id: string,
    changedBy?: string,
    note?: string,
  ) {
    return RoomModel.findByIdAndUpdate(
      id,
      {
        housekeepingStatus: "dirty",
        housekeepingUpdatedAt: new Date(),
        $push: {
          housekeepingHistory: {
            status: "dirty",
            from: "",
            note: note || "",
            changedBy: changedBy || "",
            changedAt: new Date(),
          },
        },
      },
      { new: true },
    );
  }
}
