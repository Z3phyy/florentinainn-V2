import { Response, response } from "express";
import { AuthRequest } from "../types/request.type";
import {
  accountInterface,
  accountInterfaceInput,
} from "../types/accounts.type";
import { AccountService } from "../services/acccount.service";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

import { AdminService } from "../services/admin.service";
import {
  LoginAttemptService,
  LockStatus,
} from "../services/loginAttempt.service";
import {
  EMAIL_POLICY,
  IP_POLICY,
  MAX_FAILED_ATTEMPTS,
} from "../config/loginPolicy";
import { validatePassword, validateEmail } from "../utils/validation";
import { logAuditAction } from "../utils/auditLogger";
import { notify } from "../utils/notification";
import { getJwtSecret } from "../config/jwt";
import { sendApprovalEmail, sendRejectionEmail } from "../utils/sendEmail";
import { PERMISSION_VALUES, PERMISSION_MATRIX } from "../types/permission.type";

const secret = getJwtSecret();

const lockoutPayload = (status: LockStatus) => ({
  locked: true,
  lockedUntil: status.lockedUntil ? status.lockedUntil.toISOString() : null,
  retryAfterSeconds: status.retryAfterSeconds,
  remainingAttempts: 0,
  maxAttempts: MAX_FAILED_ATTEMPTS,
  message: `Too many failed login attempts. Try again in ${Math.ceil(status.retryAfterSeconds / 60)} minute(s).`,
});

export class AccountController {
  static createAccount = async (request: AuthRequest, response: Response) => {
    const accountData: accountInterfaceInput = request.body;

    // isApproved is a required schema field; the staff registration form sends it.
    // Default to pending approval so an omitted value cannot crash the request.
    if (typeof accountData.isApproved !== "boolean") {
      accountData.isApproved = false;
    }

    // A public self-registration must never be able to grant itself
    // permissions or skip the approval queue.
    if (accountData.isApproved !== true) {
      accountData.permisions = [];
    } else if (!Array.isArray(accountData.permisions)) {
      accountData.permisions = [];
    }

    accountData.isActive = true;
    accountData.isSuspended = false;
    accountData.position =
      typeof accountData.position === "string" ? accountData.position.trim() : "";

    const emailErr = validateEmail(accountData.email);
    if (emailErr) {
      response.status(400).send(emailErr);
      return;
    }

    const passErr = validatePassword(accountData.password);
    if (passErr) {
      response.status(400).send(passErr);
      return;
    }

    if (await AccountService.checkEmail(accountData.email)) {
      response.status(400).send("Email already registered");
      return;
    }

    if (await AdminService.getByEmail(accountData.email)) {
      response.status(400).send("Email already registered in admin account");
      return;
    }

    const hashedPassword = await bcrypt.hash(accountData.password, 10);
    accountData.password = hashedPassword;

    const account = await AccountService.create(accountData);
    await logAuditAction({
      action: "STAFF_REGISTERED",
      details: `New staff registered: ${accountData.name} (${accountData.email})`,
      actorName: accountData.name,
      targetType: "staff",
    });

    await notify({
      type: "account",
      title: `Staff Registration Awaiting Approval: ${accountData.name}`,
      message: `${accountData.email} registered and is awaiting admin approval.`,
      severity: "warning",
      link: "/pages/admin/staff",
      targetType: "staff",
      targetId: account._id ? String(account._id) : undefined,
    });

    response.send(account);
  };

  static checkEmailAvailability = async (
    request: AuthRequest,
    response: Response,
  ) => {
    const email = (request.params.email || "").toLowerCase().trim();

    if (!email) {
      response.status(400).send("Email is required");
      return;
    }

    const emailErr = validateEmail(email);
    if (emailErr) {
      response.status(400).send(emailErr);
      return;
    }

    const isStaff = !!(await AccountService.checkEmail(email));
    const isAdmin = !!(await AdminService.getByEmail(email));

    response.send({
      available: !isStaff && !isAdmin,
      takenBy: isAdmin ? "admin" : isStaff ? "staff" : null,
    });
  };

  static getPermissionMatrix = async (
    request: AuthRequest,
    response: Response,
  ) => {
    response.send({
      permissions: PERMISSION_VALUES.map((value) => ({
        value,
        operations: PERMISSION_MATRIX[value] || [],
      })),
    });
  };

  static login = async (request: AuthRequest, response: Response) => {
    try {
      const email =
        typeof request.body?.email === "string"
          ? request.body.email.trim()
          : "";
      const password =
        typeof request.body?.password === "string" ? request.body.password : "";

      if (!email || !password) {
        response
          .status(400)
          .json({ message: "Email and password are required." });
        return;
      }

      const emailKey = LoginAttemptService.emailKey(email);
      const ipKey = LoginAttemptService.ipKey(request.ip || "unknown");

      const emailStatus = await LoginAttemptService.getStatus(
        emailKey,
        EMAIL_POLICY,
      );
      if (emailStatus.locked) {
        response.status(429).json(lockoutPayload(emailStatus));
        return;
      }

      const ipStatus = await LoginAttemptService.getStatus(ipKey, IP_POLICY);
      if (ipStatus.locked) {
        response.status(429).json(lockoutPayload(ipStatus));
        return;
      }

      const failAndRespond = async (status: number, message: string) => {
        const emailFailure = await LoginAttemptService.registerFailure(
          emailKey,
          "email",
          EMAIL_POLICY,
        );
        const ipFailure = await LoginAttemptService.registerFailure(
          ipKey,
          "ip",
          IP_POLICY,
        );

        const lock = emailFailure.locked
          ? emailFailure
          : ipFailure.locked
            ? ipFailure
            : null;

        if (lock) {
          await logAuditAction({
            action: "LOGIN_LOCKED",
            details: `Login locked after ${MAX_FAILED_ATTEMPTS} failed attempts for ${email}`,
            actorName: email,
            targetType: "account",
          });
          response.status(429).json(lockoutPayload(lock));
          return;
        }

        response.status(status).json({
          message,
          locked: false,
          lockedUntil: null,
          retryAfterSeconds: 0,
          remainingAttempts: emailFailure.remainingAttempts,
          maxAttempts: MAX_FAILED_ATTEMPTS,
        });
      };

      // Check both employee account and admin account
      const account = await AccountService.checkEmail(email);
      const adminAccount = await AdminService.getByEmail(email);

      // User does not exist
      if (!account && !adminAccount) {
        await failAndRespond(404, "User not found");
        return;
      }

      let authenticatedAccount: any = null;
      let role: "super admin" | "admin" | "employee" = "employee";

      // 1. Try checking Admin credentials first if admin exists
      if (adminAccount) {
        const isMatch = await bcrypt.compare(password, adminAccount.password);
        if (isMatch) {
          authenticatedAccount = adminAccount;
          role = adminAccount.type as "super admin" | "admin";
        }
      }

      // 2. If not authenticated as admin, try checking Staff/Employee credentials
      if (!authenticatedAccount && account) {
        if (account.isApproved === false) {
          response.status(403).json({ message: "Account is pending approval" });
          return;
        }
        if (account.isSuspended === true) {
          response.status(403).json({
            message: account.suspensionReason
              ? `Account is suspended: ${account.suspensionReason}`
              : "Account is suspended",
          });
          return;
        }
        if (account.isActive === false) {
          response.status(403).json({ message: "Account is deactivated" });
          return;
        }
        const isMatch = await bcrypt.compare(password, account.password);
        if (isMatch) {
          authenticatedAccount = account;
          role = "employee";
        }
      }

      // Admin account deactivation guard
      if (authenticatedAccount && adminAccount && adminAccount.isActive === false) {
        await failAndRespond(403, "Admin account is deactivated");
        return;
      }

      // If neither matched
      if (!authenticatedAccount) {
        await failAndRespond(401, "Incorrect password");
        return;
      }

      await LoginAttemptService.reset([emailKey, ipKey]);

      // Track last login + session version (used for force-logout/session revocation)
      await AccountService.touchLastLogin(authenticatedAccount._id);
      await AdminService.touchLastLogin(authenticatedAccount._id);
      const sessionVersion = authenticatedAccount.sessionVersion || 0;

      // Create token with id, role, and name
      const token = jwt.sign(
        {
          id: authenticatedAccount._id,
          role,
          name:
            authenticatedAccount.name ||
            (role === "super admin"
              ? "Super Admin"
              : role === "admin"
                ? "Admin"
                : "Staff"),
          sv: sessionVersion,
        },
        secret,
        { expiresIn: "3d" },
      );

      const safeAccount = authenticatedAccount?.toObject
        ? authenticatedAccount.toObject()
        : { ...authenticatedAccount };
      delete safeAccount.password;
      delete safeAccount.otp;
      delete safeAccount.otpExpiresAt;

      response.send({
        account: safeAccount,
        token,
        role,
      });
    } catch (error) {
      console.error(error);
      response.status(500).send("Server error");
    }
  };

  static getAccounts = async (request: AuthRequest, response: Response) => {
    try {
      const search =
        typeof request.query.search === "string" ? request.query.search : "";
      const status =
        typeof request.query.status === "string" ? request.query.status : "all";
      const permission =
        typeof request.query.permission === "string" ? request.query.permission : "";
      const hasPaging =
        request.query.page !== undefined || request.query.limit !== undefined;
      const page = Number(request.query.page) || 1;
      const limit = Number(request.query.limit) || 10;
      const sortField =
        typeof request.query.sortField === "string"
          ? request.query.sortField
          : "name";
      const sortDir =
        (request.query.sortDir === "desc" ? "desc" : "asc") as "asc" | "desc";

      const result = await AccountService.list({
        search,
        status,
        permission,
        page,
        limit,
        sortField,
        sortDir,
      });

      const sanitize = (doc: any) => {
        const plain = doc.toObject ? doc.toObject() : { ...doc };
        delete plain.password;
        delete plain.otp;
        delete plain.otpExpiresAt;
        delete plain.otpAttempts;
        return plain;
      };

      if (hasPaging) {
        response.send({
          items: (result as { items: any[] }).items.map(sanitize),
          total: (result as { total: number }).total,
          page: (result as { page: number }).page,
          limit: (result as { limit: number }).limit,
          totalPages: (result as { totalPages: number }).totalPages,
        });
        return;
      }

      const items = result as any[];
      response.send(items.map(sanitize));
    } catch (error) {
      console.error("getAccounts error:", error);
      response.status(500).send("Server error");
    }
  };

  static updateAccount = async (request: AuthRequest, response: Response) => {
    try {
      const { _id, name, email, password, permisions, position } = request.body;
      const actorType = request.account?.type;
      const updateData: any = {
        name,
        email,
        isApproved: true,
        otp: null,
      };

      if (typeof position === "string") {
        updateData.position = position.trim();
      }

      // Only super admins may change staff permissions (permission matrix).
      if (actorType === "super admin" && Array.isArray(permisions)) {
        updateData.permisions = [...new Set<string>(permisions)];
      }

      if (password && typeof password === "string" && password.trim() !== "") {
        if (/^\$2[aby]\$/.test(password)) {
          updateData.password = password;
        } else {
          updateData.password = await bcrypt.hash(password, 10);
        }
      }

      await AccountService.update(_id, updateData as accountInterfaceInput);
      await logAuditAction({
        action: "STAFF_UPDATED",
        details: `Updated staff ${name || email}${
          actorType === "super admin" ? " (incl. permissions)" : ""
        }`,
        actorName: request.account?.name || "Administrator",
        actorRole: request.account?.type || "admin",
        targetType: "staff",
        targetId: _id,
      });
      response.send({ message: "Staff updated" });
    } catch (error) {
      console.error("updateAccount error:", error);
      response.status(500).send("Server error");
    }
  };

  static deleteAccount = async (request: AuthRequest, response: Response) => {
    try {
      const { _id } = request.body;
      const actorName = request.account?.name || "Administrator";
      const account = await AccountService.get(_id);
      if (!account || account.isActive === false) {
        response.status(400).send({ message: "Staff has already been deactivated" });
        return;
      }
      await AccountService.deactivate(_id, actorName);
      await logAuditAction({
        action: "STAFF_DEACTIVATED",
        details: `Deactivated staff account ${account.name} (${account.email})`,
        actorName,
        actorRole: request.account?.type || "admin",
        targetType: "staff",
        targetId: _id,
      });
      response.send({ message: "Staff deactivated" });
    } catch (error) {
      console.error("deleteAccount error:", error);
      response.status(500).send("Server error");
    }
  };

  // Hard deletion (super admin only use; normal "delete" is the soft deactivate above)
  static removeAccountPermanently = async (request: AuthRequest, response: Response) => {
    try {
      const { _id } = request.body;
      await AccountService.delete(_id);
      await logAuditAction({
        action: "STAFF_DELETED",
        details: `Permanently removed staff account ${_id}`,
        actorName: request.account?.name || "Administrator",
        actorRole: request.account?.type || "admin",
        targetType: "staff",
        targetId: _id,
      });
      response.send({ message: "Staff permanently removed" });
    } catch (error) {
      console.error("removeAccountPermanently error:", error);
      response.status(500).send("Server error");
    }
  };

  static approveAccount = async (request: AuthRequest, response: Response) => {
    try {
      const { _id } = request.body;

      if (!_id) {
        response.status(400).send("Account id is required");
        return;
      }

      const account = await AccountService.get(_id);

      if (!account) {
        response.status(404).send("Account not found");
        return;
      }

      await AccountService.approve(_id);

      if (account.email) {
        try {
          await sendApprovalEmail({ to: account.email, email: account.email });
        } catch (emailError) {
          console.log("Approval email failed: " + (emailError as Error).message);
        }
      }

      await logAuditAction({
        action: "STAFF_APPROVED",
        details: `Approved staff access for ${account.name} (${account.email})`,
        actorName: request.account?.name || "Administrator",
        actorRole: request.account?.type || "admin",
        targetType: "staff",
        targetId: _id,
      });

      await notify({
        type: "account",
        title: `Staff Approved: ${account.name}`,
        message: `${account.email} was granted staff access.`,
        severity: "success",
        link: "/pages/admin/staff",
        targetType: "staff",
        targetId: _id,
      });

      const accounts = await AccountService.getAll();
      response.send(accounts);
    } catch (error) {
      console.log("Failed to approve account: " + (error as Error).message);
      response
        .status(500)
        .send("Failed to approve account: " + (error as Error).message);
    }
  };

  static rejectAccount = async (request: AuthRequest, response: Response) => {
    try {
      const { _id, reason } = request.body;

      if (!_id) {
        response.status(400).send("Account id is required");
        return;
      }

      const actorName = request.account?.name || "Administrator";
      const account = await AccountService.get(_id);
      if (!account) {
        response.status(404).send("Account not found");
        return;
      }
      if (account.rejectedAt) {
        response.status(400).send({ message: "Account has already been rejected" });
        return;
      }

      if (account.email) {
        try {
          await sendRejectionEmail({ to: account.email, email: account.email });
        } catch (emailError) {
          console.log("Rejection email failed: " + (emailError as Error).message);
        }
      }

      // Soft reject: revoke access, keep the record + reason
      await AccountService.reject(_id, reason || "", actorName);
      await logAuditAction({
        action: "STAFF_REJECTED",
        details: `Rejected staff application for ${account.name} (${account.email})${
          reason ? ` — ${reason}` : ""
        }`,
        actorName,
        actorRole: request.account?.type || "admin",
        targetType: "staff",
        targetId: _id,
      });

      await notify({
        type: "account",
        title: `Staff Application Rejected: ${account.name}`,
        message: `${account.email} application was rejected.${
          reason ? ` Reason: ${reason}` : ""
        }`,
        severity: "danger",
        link: "/pages/admin/staff",
        targetType: "staff",
        targetId: _id,
      });

      response.send({ message: "Staff application rejected" });
    } catch (error) {
      console.log("Failed to reject account: " + (error as Error).message);
      response
        .status(500)
        .send("Failed to reject account: " + (error as Error).message);
    }
  };

  static reactivateAccount = async (request: AuthRequest, response: Response) => {
    try {
      const { _id } = request.body;
      const account = await AccountService.get(_id);
      if (!account) {
        response.status(404).send({ message: "Account not found" });
        return;
      }
      await AccountService.reactivate(_id);
      await logAuditAction({
        action: "STAFF_REACTIVATED",
        details: `Reactivated staff account ${account.name} (${account.email})`,
        actorName: request.account?.name || "Administrator",
        actorRole: request.account?.type || "admin",
        targetType: "staff",
        targetId: _id,
      });
      response.send({ message: "Staff reactivated" });
    } catch (error) {
      console.error("reactivateAccount error:", error);
      response.status(500).send("Server error");
    }
  };

  static suspendAccount = async (request: AuthRequest, response: Response) => {
    try {
      const { _id, reason } = request.body;
      const account = await AccountService.get(_id);
      if (!account) {
        response.status(404).send({ message: "Account not found" });
        return;
      }
      if (account.isSuspended) {
        response.status(400).send({ message: "Account is already suspended" });
        return;
      }
      await AccountService.suspend(_id, reason || "", request.account?.name || "Administrator");
      await logAuditAction({
        action: "STAFF_SUSPENDED",
        details: `Suspended staff account ${account.name} (${account.email})${
          reason ? ` — ${reason}` : ""
        }`,
        actorName: request.account?.name || "Administrator",
        actorRole: request.account?.type || "admin",
        targetType: "staff",
        targetId: _id,
      });
      response.send({ message: "Staff suspended" });
    } catch (error) {
      console.error("suspendAccount error:", error);
      response.status(500).send("Server error");
    }
  };

  static unsuspendAccount = async (request: AuthRequest, response: Response) => {
    try {
      const { _id } = request.body;
      const account = await AccountService.get(_id);
      if (!account) {
        response.status(404).send({ message: "Account not found" });
        return;
      }
      await AccountService.unsuspend(_id);
      await logAuditAction({
        action: "STAFF_UNSUSPENDED",
        details: `Unsuspended staff account ${account.name} (${account.email})`,
        actorName: request.account?.name || "Administrator",
        actorRole: request.account?.type || "admin",
        targetType: "staff",
        targetId: _id,
      });
      response.send({ message: "Staff unsuspended" });
    } catch (error) {
      console.error("unsuspendAccount error:", error);
      response.status(500).send("Server error");
    }
  };

  static forceLogout = async (request: AuthRequest, response: Response) => {
    try {
      const { _id } = request.body;
      const account = await AccountService.get(_id);
      if (!account) {
        response.status(404).send({ message: "Account not found" });
        return;
      }
      await AccountService.bumpSessionVersion(_id);
      await logAuditAction({
        action: "STAFF_LOGOUT_FORCED",
        details: `Forced logout for staff account ${account.name} (${account.email})`,
        actorName: request.account?.name || "Administrator",
        actorRole: request.account?.type || "admin",
        targetType: "staff",
        targetId: _id,
      });
      response.send({ message: "Staff sessions revoked" });
    } catch (error) {
      console.error("forceLogout error:", error);
      response.status(500).send("Server error");
    }
  };

  static resetStaffPassword = async (request: AuthRequest, response: Response) => {
    try {
      const { _id, newPassword } = request.body;
      const account = await AccountService.get(_id);
      if (!account) {
        response.status(404).send({ message: "Account not found" });
        return;
      }
      if (!newPassword || typeof newPassword !== "string") {
        response.status(400).send({ message: "New password is required" });
        return;
      }
      const passErr = validatePassword(newPassword);
      if (passErr) {
        response.status(400).json({ message: passErr });
        return;
      }
      const hashed = await bcrypt.hash(newPassword, 10);
      await AccountService.resetPassword(_id, hashed);
      await logAuditAction({
        action: "STAFF_PASSWORD_RESET",
        details: `Admin reset password for staff account ${account.name} (${account.email})`,
        actorName: request.account?.name || "Administrator",
        actorRole: request.account?.type || "admin",
        targetType: "staff",
        targetId: _id,
      });
      response.send({ message: "Staff password reset. They will need to log in again." });
    } catch (error) {
      console.error("resetStaffPassword error:", error);
      response.status(500).send("Server error");
    }
  };

  static changeCredentials = async (
    request: AuthRequest,
    response: Response,
  ) => {
    try {
      const { oldEmail, oldPassword, name, newEmail, newPassword } =
        request.body;
      const accountId = request.account?._id;

      if (!accountId) {
        response.status(401).json({ message: "Unauthorized" });
        return;
      }

      // Verify old credentials belong to the authenticated user
      const account = await AccountService.checkEmail(oldEmail);
      if (!account || account._id.toString() !== accountId) {
        response
          .status(400)
          .json({ message: "Account not found for provided current email" });
        return;
      }

      const isMatch = await bcrypt.compare(oldPassword, account.password);

      if (!isMatch) {
        response.status(400).json({ message: "Incorrect current password" });
        return;
      }

      // Check if new email is already taken (if changing email)
      if (newEmail && newEmail !== oldEmail) {
        const emailErr = validateEmail(newEmail);
        if (emailErr) {
          response.status(400).json({ message: emailErr });
          return;
        }

        const existing = await AccountService.checkEmail(newEmail);
        if (existing) {
          response.status(400).json({
            message: "New email is already taken by another staff account",
          });
          return;
        }
        if (await AdminService.getByEmail(newEmail)) {
          response.status(400).json({
            message: "New email is already taken by an admin account",
          });
          return;
        }
      }

      if (newPassword) {
        const passErr = validatePassword(newPassword);
        if (passErr) {
          response.status(400).json({ message: passErr });
          return;
        }
      }

      const updated = await AccountService.changeCredentials(accountId, {
        name: name ? name.trim() : undefined,
        email: newEmail ? newEmail.trim() : undefined,
        password: newPassword ? await bcrypt.hash(newPassword, 10) : undefined,
      });

      response.json({
        message: "Credentials updated successfully",
        account: {
          _id: updated?._id,
          name: updated?.name,
          email: updated?.email,
        },
      });
    } catch (error) {
      console.error(error);
      response.status(500).json({ message: "Failed to update credentials" });
    }
  };
}
