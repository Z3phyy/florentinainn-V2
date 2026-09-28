import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import AddOnModel from "../model/addOn.model";
import BookingsModel from "../model/bookings.model";
import { AddOnService, validateAddOnInput } from "../services/addOn.service";
import { logAuditAction } from "../utils/auditLogger";
import { isValidObjectId } from "../utils/validation";
import { isValidDateStr } from "../utils/hotelTime";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export class AddOnController {
  static listActive = async (request: AuthRequest, response: Response) => {
    try {
      const arrivalDate = str(request.query.arrivalDate);
      const departureDate = str(request.query.departureDate);
      if ((arrivalDate && !isValidDateStr(arrivalDate)) || (departureDate && !isValidDateStr(departureDate))) {
        response.status(400).json({ message: "Dates must use the YYYY-MM-DD format" });
        return;
      }
      response.send(await AddOnService.listActive(arrivalDate || undefined, departureDate || undefined));
    } catch (error) {
      console.log("Failed to list add-ons: " + (error as Error).message);
      response.status(500).json({ message: "Failed to load add-ons" });
    }
  };

  static listAll = async (request: AuthRequest, response: Response) => {
    try {
      response.send(await AddOnService.listAll());
    } catch (error) {
      console.log("Failed to list add-ons: " + (error as Error).message);
      response.status(500).json({ message: "Failed to load add-ons" });
    }
  };

  static create = async (request: AuthRequest, response: Response) => {
    try {
      const { value, error } = validateAddOnInput(request.body || {});
      if (error || !value) {
        response.status(400).json({ message: error });
        return;
      }
      if (await AddOnService.isNameTaken(value.name as string)) {
        response.status(409).json({ message: "An add-on with this name already exists." });
        return;
      }
      const created = await AddOnModel.create(value);
      await logAuditAction({
        action: "ADDON_CREATED",
        details: `Created add-on ${created.name} (₱${created.price} ${created.pricingUnit === "per_night" ? "per night" : "per stay"})`,
        actorName: request.account?.name || "Administrator",
        actorRole: request.account?.type || "admin",
        targetType: "addon",
        targetId: String(created._id),
      });
      response.status(201).send(AddOnService.serialize(created.toObject()));
    } catch (error) {
      console.log("Failed to create add-on: " + (error as Error).message);
      response.status(500).json({ message: "Failed to create add-on" });
    }
  };

  static update = async (request: AuthRequest, response: Response) => {
    try {
      const id = String(request.params.id || "");
      if (!isValidObjectId(id)) {
        response.status(400).json({ message: "Invalid add-on id" });
        return;
      }
      const existing = await AddOnModel.findById(id);
      if (!existing) {
        response.status(404).json({ message: "Add-on not found" });
        return;
      }
      const { value, error } = validateAddOnInput(request.body || {}, true);
      if (error || !value) {
        response.status(400).json({ message: error });
        return;
      }
      if (value.name && (await AddOnService.isNameTaken(value.name, id))) {
        response.status(409).json({ message: "An add-on with this name already exists." });
        return;
      }
      existing.set(value);
      await existing.save();
      await logAuditAction({
        action: "ADDON_UPDATED",
        details: `Updated add-on ${existing.name}. Existing bookings keep the price recorded when they were made.`,
        actorName: request.account?.name || "Administrator",
        actorRole: request.account?.type || "admin",
        targetType: "addon",
        targetId: id,
      });
      response.send(AddOnService.serialize(existing.toObject()));
    } catch (error) {
      console.log("Failed to update add-on: " + (error as Error).message);
      response.status(500).json({ message: "Failed to update add-on" });
    }
  };

  static remove = async (request: AuthRequest, response: Response) => {
    try {
      const id = String(request.params.id || "");
      if (!isValidObjectId(id)) {
        response.status(400).json({ message: "Invalid add-on id" });
        return;
      }
      const existing = await AddOnModel.findById(id);
      if (!existing) {
        response.status(404).json({ message: "Add-on not found" });
        return;
      }
      const used = await BookingsModel.exists({ "addOns.addOn": existing._id });
      if (used) {
        existing.set({ isActive: false });
        await existing.save();
        response.send({ message: "Add-on is used by existing bookings, so it was deactivated instead of deleted.", deactivated: true });
      } else {
        await AddOnModel.findByIdAndDelete(id);
        response.send({ message: "Add-on deleted", deleted: true });
      }
      await logAuditAction({
        action: used ? "ADDON_DEACTIVATED" : "ADDON_DELETED",
        details: `${used ? "Deactivated" : "Deleted"} add-on ${existing.name}`,
        actorName: request.account?.name || "Administrator",
        actorRole: request.account?.type || "admin",
        targetType: "addon",
        targetId: id,
      });
    } catch (error) {
      console.log("Failed to delete add-on: " + (error as Error).message);
      response.status(500).json({ message: "Failed to delete add-on" });
    }
  };
}
