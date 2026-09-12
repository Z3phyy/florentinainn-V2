import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/request.type";

export const requireAdmin = (request: AuthRequest, response: Response, next: NextFunction) => {
  const account = request.account;
  const type = account?.type;
  if (type !== "admin" && type !== "super admin") {
    response.status(403).json({ message: "Admin access required" });
    return;
  }
  next();
};