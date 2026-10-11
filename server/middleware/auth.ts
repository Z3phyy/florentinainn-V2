import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../types/request.type";
import dotenv from "dotenv";
import { AccountService } from "../services/acccount.service";
import { AdminService } from "../services/admin.service";
import { verifyAnyToken, SessionTokenPayload } from "../utils/authToken";

dotenv.config();

const buildStaffAccount = (
  accountDoc: any,
  fallbackName?: string,
  type = "employee",
): any => ({
  _id: accountDoc._id.toString(),
  name: accountDoc.name || fallbackName || accountDoc.email,
  permisions: accountDoc.permisions || [],
  password: "",
  email: accountDoc.email,
  isApproved: accountDoc.isApproved,
  isActive: accountDoc.isActive !== false,
  isSuspended: accountDoc.isSuspended === true,
  sessionVersion: accountDoc.sessionVersion || 0,
  otp: accountDoc.otp ?? null,
  notificationPrefs: accountDoc.notificationPrefs || {
    mutedTypes: [],
    mutedSeverities: [],
  },
  type,
});

// A staff/account document that is blocked from accessing the system.
export const isStaffBlocked = (doc: any) => {
  if (doc.isApproved === false) {
    return { blocked: true, message: "Account is pending approval" };
  }
  if (doc.isSuspended === true) {
    return {
      blocked: true,
      message: doc.suspensionReason
        ? `Account is suspended: ${doc.suspensionReason}`
        : "Account is suspended",
    };
  }
  if (doc.isActive === false) {
    return { blocked: true, message: "Account is deactivated" };
  }
  return { blocked: false };
};

export const isAdminBlocked = (doc: any) => {
  if (doc.isActive === false) {
    return { blocked: true, message: "Admin account is deactivated" };
  }
  if (doc.isSuspended === true) {
    return {
      blocked: true,
      message: doc.suspensionReason
        ? `Admin account is suspended: ${doc.suspensionReason}`
        : "Admin account is suspended",
    };
  }
  return { blocked: false };
};

export const authenticateJWT = async (
  request: AuthRequest,
  response: Response,
  next: NextFunction,
) => {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    response.status(401).json({ message: "No token provided" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyAnyToken<SessionTokenPayload>(token);
    if (!decoded || typeof decoded.id !== "string") {
      response.status(401).json({ message: "Invalid token" });
      return;
    }

    if (decoded.purpose || decoded.acv !== true) {
      response.status(401).json({
        message: "Access code verification required. Please log in again.",
        code: "ACCESS_CODE_REQUIRED",
      });
      return;
    }

    const { id, name } = decoded;
    const tokenVersion = typeof decoded.sv === "number" ? decoded.sv : -1;

    const accountDoc = await AccountService.get(id);
    if (accountDoc) {
      const status = isStaffBlocked(accountDoc);
      if (status.blocked) {
        response
          .status(403)
          .json({ message: status.message, code: "ACCOUNT_DISABLED" });
        return;
      }
      if (tokenVersion !== (accountDoc.sessionVersion || 0)) {
        response.status(401).json({
          message: "Session revoked. Please log in again.",
          code: "SESSION_REVOKED",
        });
        return;
      }
      request.account = buildStaffAccount(accountDoc, name, "employee");
      return next();
    }

    const adminDoc = await AdminService.get(id);
    if (adminDoc) {
      const status = isAdminBlocked(adminDoc);
      if (status.blocked) {
        response
          .status(403)
          .json({ message: status.message, code: "ACCOUNT_DISABLED" });
        return;
      }
      const sessionVersion = adminDoc.sessionVersion || 0;
      if (tokenVersion !== sessionVersion) {
        response.status(401).json({
          message: "Session revoked. Please log in again.",
          code: "SESSION_REVOKED",
        });
        return;
      }
      request.account = {
        _id: adminDoc._id.toString(),
        name:
          adminDoc.name ||
          name ||
          (adminDoc.type === "super admin" ? "Super Admin" : "Administrator"),
        permisions: ["all"],
        password: "",
        email: adminDoc.email,
        isApproved: true,
        isActive: adminDoc.isActive ?? true,
        isSuspended: adminDoc.isSuspended === true,
        sessionVersion,
        otp: null,
        notificationPrefs: adminDoc.notificationPrefs || {
          mutedTypes: [],
          mutedSeverities: [],
        },
        type: adminDoc.type || "admin",
      };
      return next();
    }

    response.status(401).json({ message: "Invalid token" });
  } catch (err) {
    console.log("JWT Auth error:", err);
    response.status(401).json({ message: "Invalid token" });
  }
};

export const authenticateChatSender = (
  request: AuthRequest,
  response: Response,
  next: NextFunction,
) => {
  if (request.body?.user === "staff") {
    return authenticateJWT(request, response, next);
  }
  next();
};
