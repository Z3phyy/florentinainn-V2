import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../types/request.type";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { AccountService } from "../services/acccount.service";
import { AdminService } from "../services/admin.service";
import { accountInterface } from "../types/accounts.type";
import { getJwtSecretCandidates } from "../config/jwt";

dotenv.config();

const jwtSecrets = getJwtSecretCandidates();

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
  otp: accountDoc.otp ?? null,
  type,
});

export const authenticateJWT = async (
  request: AuthRequest,
  response: Response,
  next: NextFunction,
) => {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("No token provided");
    response.status(401).json({ message: "No token provided" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    let decoded: { id: string; role?: string; name?: string } | undefined;
    for (const candidate of jwtSecrets) {
      try {
        decoded = jwt.verify(token, candidate) as {
          id: string;
          role?: string;
          name?: string;
        };
        break;
      } catch {
        // try next candidate
      }
    }
    if (!decoded) {
      console.log(
        "JWT Auth error: none of the known secrets matched the token signature",
      );
      response.status(401).json({ message: "Invalid token" });
      return;
    }
    const { id, role, name } = decoded;

    // 1. Check in Staff/Employee Accounts
    const accountDoc = await AccountService.get(id);
    if (accountDoc) {
      request.account = buildStaffAccount(accountDoc, name, "employee");
      return next();
    }

    // 2. Check in Admin / Super Admin collection
    const adminDoc = await AdminService.get(id);
    if (adminDoc) {
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
        otp: null,
        type: adminDoc.type || "admin",
      };
      return next();
    }

    // 3. Unknown identity — fail closed. Never trust client-supplied claims.
    console.log("JWT identity not found in DB:", id);
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
