import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/request.type";
import {
  normalizePermission,
  PermissionValue,
} from "../types/permission.type";

const isAdminType = (type?: string) =>
  type === "admin" || type === "super admin";

// Gate a route by a staff permission. Admins/super admins always pass.
export const requirePermission = (permission: PermissionValue) => {
  return (request: AuthRequest, response: Response, next: NextFunction) => {
    const account = request.account;
    if (!account) {
      response.status(401).json({ message: "No token provided" });
      return;
    }
    if (isAdminType(account.type)) {
      return next();
    }
    const grantedRaw: string[] = Array.isArray(account.permisions)
      ? account.permisions
      : [];
    const granted = grantedRaw.map((p) => normalizePermission(p)).filter(
      (p): p is NonNullable<typeof p> => !!p,
    );
    if (granted.includes(permission) || grantedRaw.includes("all")) {
      return next();
    }
    response.status(403).json({
      message: `Missing permission: ${permission}`,
    });
  };
};

export const requireSuperAdmin = (
  request: AuthRequest,
  response: Response,
  next: NextFunction,
) => {
  if (request.account?.type !== "super admin") {
    response.status(403).json({ message: "Super admin access required" });
    return;
  }
  next();
};

export const requireAdmin = (
  request: AuthRequest,
  response: Response,
  next: NextFunction,
) => {
  const type = request.account?.type;
  if (type !== "admin" && type !== "super admin") {
    response.status(403).json({ message: "Admin access required" });
    return;
  }
  next();
};

export default requireAdmin;
