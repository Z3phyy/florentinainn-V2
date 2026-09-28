import { ClientSession, Types } from "mongoose";
import AddOnModel from "../model/addOn.model";
import BookingsModel from "../model/bookings.model";
import { AvailabilityService } from "./availability.service";
import { addOnLineSubtotal, PricedAddOn, plannedNights } from "../utils/pricing";

export class AddOnError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface AddOnSelection {
  addOnId: string;
  quantity: number;
}

export interface AddOnInput {
  name: string;
  description: string;
  price: number;
  pricingUnit: "per_stay" | "per_night";
  maxPerBooking: number;
  stock: number | null;
  isActive: boolean;
}

export function parseAddOnSelection(raw: unknown): AddOnSelection[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new AddOnError("Add-ons must be a list of { addOnId, quantity } items.");
  }
  if (raw.length > 20) throw new AddOnError("Too many add-ons selected.");
  const merged = new Map<string, number>();
  for (const item of raw) {
    const addOnId = typeof item?.addOnId === "string" ? item.addOnId : "";
    const quantity = Number(item?.quantity);
    if (!Types.ObjectId.isValid(addOnId) || String(new Types.ObjectId(addOnId)) !== addOnId) {
      throw new AddOnError("One of the selected add-ons is invalid.");
    }
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100) {
      throw new AddOnError("Add-on quantities must be whole numbers between 0 and 100.");
    }
    if (quantity === 0) continue;
    merged.set(addOnId, (merged.get(addOnId) || 0) + quantity);
  }
  return Array.from(merged.entries()).map(([addOnId, quantity]) => ({ addOnId, quantity }));
}

export function validateAddOnInput(body: any, partial = false): { value?: Partial<AddOnInput>; error?: string } {
  const value: Partial<AddOnInput> = {};
  if (!partial || body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return { error: "Add-on name is required." };
    if (name.length > 60) return { error: "Add-on name must be at most 60 characters." };
    value.name = name;
  }
  if (!partial || body.description !== undefined) {
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (description.length > 300) return { error: "Description must be at most 300 characters." };
    value.description = description;
  }
  if (!partial || body.price !== undefined) {
    const price = Number(body.price);
    if (body.price === "" || body.price === null || !Number.isFinite(price) || price < 0 || price > 1000000) {
      return { error: "Price must be a number between 0 and 1,000,000." };
    }
    value.price = Math.round(price * 100) / 100;
  }
  if (!partial || body.pricingUnit !== undefined) {
    if (!["per_stay", "per_night"].includes(body.pricingUnit)) {
      return { error: "Pricing unit must be per stay or per night." };
    }
    value.pricingUnit = body.pricingUnit;
  }
  if (!partial || body.maxPerBooking !== undefined) {
    const max = Number(body.maxPerBooking);
    if (!Number.isInteger(max) || max < 1 || max > 100) {
      return { error: "Maximum per booking must be a whole number between 1 and 100." };
    }
    value.maxPerBooking = max;
  }
  if (!partial || body.stock !== undefined) {
    if (body.stock === null || body.stock === "" || body.stock === undefined) {
      value.stock = null;
    } else {
      const stock = Number(body.stock);
      if (!Number.isInteger(stock) || stock < 0 || stock > 100000) {
        return { error: "Stock must be empty (unlimited) or a whole number of 0 or more." };
      }
      value.stock = stock;
    }
  }
  if (!partial || body.isActive !== undefined) {
    value.isActive = body.isActive === undefined ? true : body.isActive === true;
  }
  return { value };
}

export class AddOnService {
  static serialize(doc: any, remaining?: number | null) {
    return {
      _id: String(doc._id),
      name: doc.name,
      description: doc.description || "",
      price: doc.price,
      pricingUnit: doc.pricingUnit,
      maxPerBooking: doc.maxPerBooking,
      stock: doc.stock ?? null,
      isActive: doc.isActive !== false,
      ...(remaining !== undefined ? { remaining } : {}),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  static async listActive(arrivalDate?: string, departureDate?: string) {
    const docs = await AddOnModel.find({ isActive: true }).sort({ name: 1 }).lean();
    let usage = new Map<string, number>();
    if (arrivalDate) {
      usage = await AvailabilityService.addOnUsage(
        docs.filter((d) => d.stock !== null && d.stock !== undefined).map((d) => String(d._id)),
        arrivalDate,
        departureDate,
      );
    }
    return docs.map((doc) => {
      const remaining =
        doc.stock === null || doc.stock === undefined
          ? null
          : Math.max(0, doc.stock - (usage.get(String(doc._id)) || 0));
      return AddOnService.serialize(doc, arrivalDate ? remaining : undefined);
    });
  }

  static async listAll() {
    const docs = await AddOnModel.find().sort({ isActive: -1, name: 1 }).lean();
    const counts = await BookingsModel.aggregate([
      { $unwind: "$addOns" },
      { $group: { _id: "$addOns.addOn", bookings: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.bookings]));
    return docs.map((doc) => ({ ...AddOnService.serialize(doc), bookingCount: countMap.get(String(doc._id)) || 0 }));
  }

  static async isNameTaken(name: string, excludeId?: string) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filter: Record<string, unknown> = { name: { $regex: `^${escaped}$`, $options: "i" } };
    if (excludeId) filter._id = { $ne: excludeId };
    return !!(await AddOnModel.exists(filter));
  }

  static async price(
    selection: AddOnSelection[],
    stay: { arrivalDate: string; departureDate?: string },
    options: { excludeBookingId?: string; session?: ClientSession; allowInactiveIds?: string[] } = {},
  ): Promise<{ items: PricedAddOn[]; total: number }> {
    if (selection.length === 0) return { items: [], total: 0 };
    const nights = plannedNights(stay.arrivalDate, stay.departureDate);
    const docs = await AddOnModel.find({ _id: { $in: selection.map((s) => s.addOnId) } })
      .session(options.session || null)
      .lean();
    const byId = new Map(docs.map((d) => [String(d._id), d]));
    const allowInactive = new Set(options.allowInactiveIds || []);

    const limited = docs.filter((d) => d.stock !== null && d.stock !== undefined).map((d) => String(d._id));
    const usage = await AvailabilityService.addOnUsage(
      limited,
      stay.arrivalDate,
      stay.departureDate,
      options.excludeBookingId,
      options.session,
    );

    const items: PricedAddOn[] = [];
    for (const { addOnId, quantity } of selection) {
      const doc = byId.get(addOnId);
      if (!doc) throw new AddOnError("One of the selected add-ons no longer exists.", 404);
      if (doc.isActive === false && !allowInactive.has(addOnId)) {
        throw new AddOnError(`"${doc.name}" is no longer available.`, 409);
      }
      if (quantity > doc.maxPerBooking) {
        throw new AddOnError(`You can request at most ${doc.maxPerBooking} × ${doc.name} per booking.`);
      }
      if (doc.stock !== null && doc.stock !== undefined) {
        const remaining = Math.max(0, doc.stock - (usage.get(addOnId) || 0));
        if (quantity > remaining) {
          throw new AddOnError(
            remaining === 0
              ? `"${doc.name}" is fully booked for the selected dates.`
              : `Only ${remaining} × ${doc.name} left for the selected dates.`,
            409,
          );
        }
      }
      items.push({
        addOn: addOnId,
        name: doc.name,
        unitPrice: doc.price,
        quantity,
        pricingUnit: doc.pricingUnit as "per_stay" | "per_night",
        nights: doc.pricingUnit === "per_night" ? nights : 1,
        subtotal: addOnLineSubtotal(doc.price, quantity, doc.pricingUnit, nights),
      });
    }
    return { items, total: items.reduce((sum, i) => sum + i.subtotal, 0) };
  }

  static async lock(addOnIds: string[], session?: ClientSession) {
    if (!session || addOnIds.length === 0) return;
    await AddOnModel.updateMany(
      { _id: { $in: addOnIds.map((id) => new Types.ObjectId(id)) } },
      { $inc: { lockVersion: 1 } },
      { session },
    );
  }
}
