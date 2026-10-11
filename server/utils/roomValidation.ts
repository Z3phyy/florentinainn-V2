export const ROOM_CREATE_STATUSES = ["available", "maintenance"] as const;

export interface RoomFieldErrors {
  [field: string]: string;
}

export interface ParsedRoomInput {
  roomNumber: string;
  category: string;
  price: number;
  discount: number;
  maxHead: number;
  status: string;
  description: string;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function validateRoomCreate(
  body: Record<string, unknown>,
  hasImage: boolean,
): { errors: RoomFieldErrors; value: ParsedRoomInput } {
  const errors: RoomFieldErrors = {};

  const roomNumber = str(body.roomNumber);
  if (roomNumber.length > 20) errors.roomNumber = "Room number must be at most 20 characters.";
  else if (roomNumber && !/^[A-Za-z0-9][A-Za-z0-9 -]*$/.test(roomNumber)) {
    errors.roomNumber = "Room number may only contain letters, numbers, spaces, and hyphens.";
  }

  const category = str(body.category);
  if (!category) errors.category = "Category is required.";
  else if (category.length > 50) errors.category = "Category must be at most 50 characters.";

  const priceRaw = str(String(body.price ?? ""));
  const price = Number(priceRaw);
  if (!priceRaw) errors.price = "Price is required.";
  else if (!Number.isFinite(price) || price <= 0) errors.price = "Price must be greater than 0.";
  else if (price > 1000000) errors.price = "Price must be at most 1,000,000.";

  const discountRaw = str(String(body.discount ?? "0")) || "0";
  const discount = Number(discountRaw);
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
    errors.discount = "Discount must be between 0 and 100.";
  }

  const maxHeadRaw = str(String(body.maxHead ?? ""));
  const maxHead = Number(maxHeadRaw);
  if (!maxHeadRaw) errors.maxHead = "Max guests is required.";
  else if (!Number.isInteger(maxHead) || maxHead < 1 || maxHead > 20) {
    errors.maxHead = "Max guests must be a whole number from 1 to 20.";
  }

  const status = str(body.status);
  if (!status) errors.status = "Status is required.";
  else if (!(ROOM_CREATE_STATUSES as readonly string[]).includes(status)) {
    errors.status = "New rooms can only be Available or under Maintenance.";
  }

  const description = str(body.description);
  if (!description) errors.description = "Description is required.";
  else if (description.length < 10) errors.description = "Description must be at least 10 characters.";
  else if (description.length > 1000) errors.description = "Description must be at most 1000 characters.";

  if (!hasImage) errors.image = "Room image is required.";

  return {
    errors,
    value: { roomNumber, category, price, discount, maxHead, status, description },
  };
}
