import { Response, response } from "express";
import { AuthRequest } from "../types/request.type";
import {
  accountInterface,
  accountInterfaceInput,
} from "../types/accounts.type";
import { AccountService } from "../services/acccount.service";
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
  ACCESS_CODE_POLICY,
  ACCESS_CODE_IP_POLICY,
  ACCESS_CODE_MAX_FAILED_ATTEMPTS,
  ACCESS_CODE_CHALLENGE_TTL_SECONDS,
} from "../config/loginPolicy";
import {
  validatePassword,
  validateEmail,
  validateAccessCode,
  normalizeAccessCode,
  isValidObjectId,
} from "../utils/validation";
import { logAuditAction } from "../utils/auditLogger";
import { notify } from "../utils/notification";
import {
  AccountRole,
  AccessCodeStage,
  signChallengeToken,
  signSessionToken,
  verifyChallengeToken,
} from "../utils/authToken";
import { AccessCodeService, AccessCodeOwner } from "../services/accessCode.service";
import { isStaffBlocked, isAdminBlocked } from "../middleware/auth";
import { sendApprovalEmail, sendRejectionEmail } from "../utils/sendEmail";
import {
  PERMISSION_VALUES,
  PERMISSION_MATRIX,
  normalizePermission,
  PermissionValue,
} from "../types/permission.type";

const sanitizePermissions = (value: unknown): PermissionValue[] => {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((p) => (typeof p === "string" ? normalizePermission(p) : null))
    .filter((p): p is PermissionValue => !!p);
  return [...new Set(normalized)];
};

const lockoutPayload = (status: LockStatus) => ({
  locked: true,
  lockedUntil: status.lockedUntil ? status.lockedUntil.toISOString() : null,
  retryAfterSeconds: status.retryAfterSeconds,
  remainingAttempts: 0,
  maxAttempts: MAX_FAILED_ATTEMPTS,
  message: `Too many failed login attempts. Try again in ${Math.ceil(status.retryAfterSeconds / 60)} minute(s).`,
});

const accessCodeLockoutPayload = (status: LockStatus) => ({
  locked: true,
  code: "ACCESS_CODE_LOCKED",
  lockedUntil: status.lockedUntil ? status.lockedUntil.toISOString() : null,
  retryAfterSeconds: status.retryAfterSeconds,
  remainingAttempts: 0,
  maxAttempts: ACCESS_CODE_MAX_FAILED_ATTEMPTS,
  message: `Too many invalid access code attempts. Try again in ${Math.ceil(status.retryAfterSeconds / 60)} minute(s).`,
});

export class AccountController {
  static createAccount = async (request: AuthRequest, response: Response) => {
    const body = request.body || {};
    const accountData: accountInterfaceInput = {
      name: typeof body.name === "string" ? body.name.trim() : "",
      position: typeof body.position === "string" ? body.position.trim() : "",
      email: typeof body.email === "string" ? body.email.trim() : "",
      password: typeof body.password === "string" ? body.password : "",
      permisions: [],
      isApproved: false,
      isActive: true,
      isSuspended: false,
      otp: null,
    };

    const inputErr = await AccountController.validateNewStaff(accountData);
    if (inputErr) {
      response.status(400).send(inputErr);
      return;
    }

    accountData.password = await bcrypt.hash(accountData.password, 10);

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

    response.send(AccountController.sanitize(account));
  };

  static createStaffAccount = async (request: AuthRequest, response: Response) => {
    try {
      const body = request.body || {};
      const accountData: accountInterfaceInput = {
        name: typeof body.name === "string" ? body.name.trim() : "",
        position: typeof body.position === "string" ? body.position.trim() : "",
        email: typeof body.email === "string" ? body.email.trim() : "",
        password: typeof body.password === "string" ? body.password : "",
        permisions: sanitizePermissions(body.permisions),
        isApproved: true,
        isActive: true,
        isSuspended: false,
        otp: null,
      };

      const inputErr = await AccountController.validateNewStaff(accountData);
      if (inputErr) {
        response.status(400).json({ message: inputErr });
        return;
      }

      const accessCode = normalizeAccessCode(body.accessCode);
      const codeErr = validateAccessCode(accessCode);
      if (codeErr) {
        response.status(400).json({ message: codeErr });
        return;
      }
      if (accessCode !== normalizeAccessCode(body.confirmAccessCode)) {
        response.status(400).json({ message: "Access codes do not match." });
        return;
      }

      accountData.password = await bcrypt.hash(accountData.password, 10);
      const account = await AccountService.create(accountData);
      await AccessCodeService.set("staff", String(account._id), accessCode);

      await logAuditAction({
        action: "STAFF_CREATED",
        details: `Created staff ${accountData.name} (${accountData.email}) with permissions: ${
          accountData.permisions.join(", ") || "none"
        }`,
        actorName: request.account?.name || "Administrator",
        actorRole: request.account?.type || "admin",
        targetType: "staff",
        targetId: String(account._id),
      });

      response.status(201).send(AccountController.sanitize(await AccountService.get(String(account._id))));
    } catch (error) {
      console.error("createStaffAccount error:", error);
      response.status(500).json({ message: "Failed to create staff account" });
    }
  };

  private static validateNewStaff = async (
    data: accountInterfaceInput,
  ): Promise<string | null> => {
    if (!data.name) return "Name is required.";
    if (data.name.length > 100) return "Name must be at most 100 characters.";
    if ((data.position || "").length > 100) {
      return "Position must be at most 100 characters.";
    }
    const emailErr = validateEmail(data.email);
    if (emailErr) return emailErr;
    const passErr = validatePassword(data.password);
    if (passErr) return passErr;
    if (await AccountService.checkEmail(data.email)) {
      return "Email already registered";
    }
    if (await AdminService.getByEmail(data.email)) {
      return "Email already registered in admin account";
    }
    return null;
  };

  private static sanitize = (doc: any) => {
    if (!doc) return doc;
    const plain = doc.toObject ? doc.toObject() : { ...doc };
    delete plain.password;
    delete plain.otp;
    delete plain.otpExpiresAt;
    delete plain.otpAttempts;
    delete plain.accessCodeHash;
    plain.hasAccessCode = !!plain.accessCodeUpdatedAt;
    return plain;
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

      const account = await AccountService.checkEmail(email);
      const adminAccount = await AdminService.getByEmail(email);

      if (!account && !adminAccount) {
        await failAndRespond(404, "User not found");
        return;
      }

      let authenticatedAccount: any = null;
      let role: AccountRole = "employee";

      if (adminAccount) {
        const isMatch = await bcrypt.compare(password, adminAccount.password);
        if (isMatch) {
          authenticatedAccount = adminAccount;
          role = adminAccount.type as "super admin" | "admin";
        }
      }

      if (!authenticatedAccount && account) {
        const isMatch = await bcrypt.compare(password, account.password);
        if (isMatch) {
          authenticatedAccount = account;
          role = "employee";
        }
      }

      if (!authenticatedAccount) {
        await failAndRespond(401, "Incorrect password");
        return;
      }

      await LoginAttemptService.reset([emailKey, ipKey]);

      const blockStatus =
        role === "employee"
          ? isStaffBlocked(authenticatedAccount)
          : isAdminBlocked(authenticatedAccount);
      if (blockStatus.blocked) {
        response
          .status(403)
          .json({ message: blockStatus.message, code: "ACCOUNT_DISABLED" });
        return;
      }

      const owner = role === "employee" ? "staff" : "admin";
      const accountId = String(authenticatedAccount._id);
      const hasAccessCode = await AccessCodeService.hasAccessCode(owner, accountId);

      if (!hasAccessCode && role === "employee") {
        response.status(403).json({
          message:
            "No access code has been assigned to your account yet. Please contact an administrator.",
          code: "ACCESS_CODE_NOT_ASSIGNED",
        });
        return;
      }

      const stage: AccessCodeStage = hasAccessCode ? "verify" : "setup";
      const challengeToken = signChallengeToken({
        id: accountId,
        role,
        sv: authenticatedAccount.sessionVersion || 0,
        stage,
      });

      response.send({
        requiresAccessCode: true,
        stage,
        role,
        challengeToken,
        expiresInSeconds: ACCESS_CODE_CHALLENGE_TTL_SECONDS,
      });
    } catch (error) {
      console.error(error);
      response.status(500).json({ message: "Server error" });
    }
  };

  private static resolveChallenge = async (
    challengeToken: unknown,
    expectedStage: AccessCodeStage,
  ): Promise<
    | { ok: true; doc: any; role: AccountRole; owner: AccessCodeOwner; id: string }
    | { ok: false; status: number; body: Record<string, unknown> }
  > => {
    const challenge = verifyChallengeToken(challengeToken);
    if (!challenge || challenge.stage !== expectedStage) {
      return {
        ok: false,
        status: 401,
        body: {
          message: "Your sign-in session has expired. Please sign in again.",
          code: "CHALLENGE_INVALID",
        },
      };
    }

    const owner: AccessCodeOwner = challenge.role === "employee" ? "staff" : "admin";
    const doc: any =
      owner === "staff"
        ? await AccountService.get(challenge.id)
        : await AdminService.get(challenge.id);

    if (!doc || (owner === "admin" && doc.type !== challenge.role)) {
      return {
        ok: false,
        status: 401,
        body: {
          message: "Your sign-in session has expired. Please sign in again.",
          code: "CHALLENGE_INVALID",
        },
      };
    }

    const blockStatus =
      owner === "staff" ? isStaffBlocked(doc) : isAdminBlocked(doc);
    if (blockStatus.blocked) {
      return {
        ok: false,
        status: 403,
        body: { message: blockStatus.message, code: "ACCOUNT_DISABLED" },
      };
    }

    if ((doc.sessionVersion || 0) !== challenge.sv) {
      return {
        ok: false,
        status: 401,
        body: {
          message: "Your sign-in session has expired. Please sign in again.",
          code: "CHALLENGE_INVALID",
        },
      };
    }

    return { ok: true, doc, role: challenge.role, owner, id: challenge.id };
  };

  private static completeLogin = async (
    doc: any,
    role: AccountRole,
    response: Response,
  ) => {
    const id = String(doc._id);
    if (role === "employee") {
      await AccountService.touchLastLogin(id);
    } else {
      await AdminService.touchLastLogin(id);
    }

    const token = signSessionToken({
      id,
      role,
      name:
        doc.name ||
        (role === "super admin"
          ? "Super Admin"
          : role === "admin"
            ? "Admin"
            : "Staff"),
      sv: doc.sessionVersion || 0,
    });

    const safeAccount = doc?.toObject ? doc.toObject() : { ...doc };
    delete safeAccount.password;
    delete safeAccount.otp;
    delete safeAccount.otpExpiresAt;
    delete safeAccount.otpAttempts;
    delete safeAccount.accessCodeHash;

    response.send({
      account: safeAccount,
      token,
      role,
    });
  };

  static verifyAccessCode = async (request: AuthRequest, response: Response) => {
    try {
      const resolved = await AccountController.resolveChallenge(
        request.body?.challengeToken,
        "verify",
      );
      if (!resolved.ok) {
        response.status(resolved.status).json(resolved.body);
        return;
      }
      const { doc, role, owner, id } = resolved;

      const codeKey = `access:${id}`;
      const ipKey = `access-ip:${request.ip || "unknown"}`;

      const codeStatus = await LoginAttemptService.getStatus(codeKey, ACCESS_CODE_POLICY);
      const ipStatus = await LoginAttemptService.getStatus(ipKey, ACCESS_CODE_IP_POLICY);
      const activeLock = codeStatus.locked ? codeStatus : ipStatus.locked ? ipStatus : null;
      if (activeLock) {
        response.status(429).json(accessCodeLockoutPayload(activeLock));
        return;
      }

      const accessCode = normalizeAccessCode(request.body?.accessCode);
      const isValid =
        !validateAccessCode(accessCode) &&
        (await AccessCodeService.verify(owner, id, accessCode));

      if (!isValid) {
        const codeFailure = await LoginAttemptService.registerFailure(
          codeKey,
          "access-code",
          ACCESS_CODE_POLICY,
        );
        const ipFailure = await LoginAttemptService.registerFailure(
          ipKey,
          "access-code-ip",
          ACCESS_CODE_IP_POLICY,
        );
        const lock = codeFailure.locked ? codeFailure : ipFailure.locked ? ipFailure : null;

        if (lock) {
          await logAuditAction({
            action: "ACCESS_CODE_LOCKED",
            details: `Access code verification locked after repeated failures for ${doc.email}`,
            actorName: doc.email,
            actorRole: role,
            targetType: owner,
            targetId: id,
          });
          response.status(429).json(accessCodeLockoutPayload(lock));
          return;
        }

        response.status(401).json({
          message: "Invalid access code",
          code: "ACCESS_CODE_INVALID",
          locked: false,
          remainingAttempts: codeFailure.remainingAttempts,
          maxAttempts: ACCESS_CODE_MAX_FAILED_ATTEMPTS,
        });
        return;
      }

      await LoginAttemptService.reset([codeKey]);
      await AccountController.completeLogin(doc, role, response);
    } catch (error) {
      console.error("verifyAccessCode error:", error);
      response.status(500).json({ message: "Server error" });
    }
  };

  static setupAccessCode = async (request: AuthRequest, response: Response) => {
    try {
      const resolved = await AccountController.resolveChallenge(
        request.body?.challengeToken,
        "setup",
      );
      if (!resolved.ok) {
        response.status(resolved.status).json(resolved.body);
        return;
      }
      const { doc, role, owner, id } = resolved;

      if (owner !== "admin") {
        response.status(403).json({
          message: "Only administrators can set up their own access code.",
        });
        return;
      }

      const accessCode = normalizeAccessCode(request.body?.accessCode);
      const confirmAccessCode = normalizeAccessCode(request.body?.confirmAccessCode);
      const codeErr = validateAccessCode(accessCode);
      if (codeErr) {
        response.status(400).json({ message: codeErr });
        return;
      }
      if (accessCode !== confirmAccessCode) {
        response.status(400).json({ message: "Access codes do not match." });
        return;
      }

      const created = await AccessCodeService.setIfMissing(owner, id, accessCode);
      if (!created) {
        response.status(409).json({
          message: "An access code is already configured. Please sign in again.",
          code: "CHALLENGE_INVALID",
        });
        return;
      }

      await logAuditAction({
        action: "ACCESS_CODE_INITIALIZED",
        details: `Initial access code configured for ${doc.email}`,
        actorName: doc.name || doc.email,
        actorRole: role,
        targetType: owner,
        targetId: id,
      });

      await AccountController.completeLogin(doc, role, response);
    } catch (error) {
      console.error("setupAccessCode error:", error);
      response.status(500).json({ message: "Server error" });
    }
  };

  static setStaffAccessCode = async (request: AuthRequest, response: Response) => {
    try {
      const { _id } = request.body || {};
      if (!isValidObjectId(_id)) {
        response.status(400).json({ message: "A valid staff id is required." });
        return;
      }

      const accessCode = normalizeAccessCode(request.body?.accessCode);
      const confirmAccessCode = normalizeAccessCode(request.body?.confirmAccessCode);
      const codeErr = validateAccessCode(accessCode);
      if (codeErr) {
        response.status(400).json({ message: codeErr });
        return;
      }
      if (accessCode !== confirmAccessCode) {
        response.status(400).json({ message: "Access codes do not match." });
        return;
      }

      const account = await AccountService.get(_id);
      if (!account) {
        response.status(404).json({ message: "Staff account not found." });
        return;
      }

      const { accessCodeUpdatedAt } = await AccessCodeService.set("staff", _id, accessCode);
      await LoginAttemptService.reset([`access:${_id}`]);

      await logAuditAction({
        action: "STAFF_ACCESS_CODE_CHANGED",
        details: `Access code updated for staff ${account.name} (${account.email})`,
        actorName: request.account?.name || "Administrator",
        actorRole: request.account?.type || "admin",
        targetType: "staff",
        targetId: _id,
      });

      response.send({ message: "Staff access code updated.", accessCodeUpdatedAt });
    } catch (error) {
      console.error("setStaffAccessCode error:", error);
      response.status(500).json({ message: "Server error" });
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

      const sanitize = AccountController.sanitize;

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
      const { _id, name, email, password, permisions, position } = request.body || {};
      const actorType = request.account?.type;

      if (!isValidObjectId(_id)) {
        response.status(400).json({ message: "A valid staff id is required." });
        return;
      }

      const existing = await AccountService.get(_id);
      if (!existing) {
        response.status(404).json({ message: "Staff account not found." });
        return;
      }

      const trimmedName = typeof name === "string" ? name.trim() : "";
      if (!trimmedName) {
        response.status(400).json({ message: "Name is required." });
        return;
      }
      if (trimmedName.length > 100) {
        response.status(400).json({ message: "Name must be at most 100 characters." });
        return;
      }

      const normalizedEmail = typeof email === "string" ? email.trim() : "";
      const emailErr = validateEmail(normalizedEmail);
      if (emailErr) {
        response.status(400).json({ message: emailErr });
        return;
      }

      if (normalizedEmail !== String(existing.email || "")) {
        const taken = await AccountService.checkEmail(normalizedEmail);
        if (taken && String(taken._id) !== String(existing._id)) {
          response.status(400).json({ message: "Email already registered to another staff account." });
          return;
        }
        if (await AdminService.getByEmail(normalizedEmail)) {
          response.status(400).json({ message: "Email already registered in admin account." });
          return;
        }
      }

      const updateData: Record<string, unknown> = {
        name: trimmedName,
        email: normalizedEmail,
      };

      if (typeof position === "string") {
        if (position.trim().length > 100) {
          response.status(400).json({ message: "Position must be at most 100 characters." });
          return;
        }
        updateData.position = position.trim();
      }

      let permissionsChanged = false;
      if (actorType === "super admin" && Array.isArray(permisions)) {
        updateData.permisions = sanitizePermissions(permisions);
        permissionsChanged = true;
      }

      let passwordChanged = false;
      if (typeof password === "string" && password !== "") {
        const passErr = validatePassword(password);
        if (passErr) {
          response.status(400).json({ message: passErr });
          return;
        }
        updateData.password = await bcrypt.hash(password, 10);
        passwordChanged = true;
      }

      await AccountService.update(
        _id,
        passwordChanged
          ? ({ ...updateData, $inc: { sessionVersion: 1 } } as unknown as accountInterfaceInput)
          : (updateData as unknown as accountInterfaceInput),
      );
      await logAuditAction({
        action: "STAFF_UPDATED",
        details: `Updated staff ${trimmedName || normalizedEmail}${
          permissionsChanged ? " (incl. permissions)" : ""
        }${passwordChanged ? " (password reset)" : ""}`,
        actorName: request.account?.name || "Administrator",
        actorRole: request.account?.type || "admin",
        targetType: "staff",
        targetId: _id,
      });
      response.send({
        message: "Staff updated",
        account: AccountController.sanitize(await AccountService.get(_id)),
      });
    } catch (error) {
      console.error("updateAccount error:", error);
      response.status(500).json({ message: "Server error" });
    }
  };

  static deleteAccount = async (request: AuthRequest, response: Response) => {
    try {
      const { _id } = request.body || {};
      if (!isValidObjectId(_id)) {
        response.status(400).send({ message: "A valid staff id is required." });
        return;
      }
      const actorName = request.account?.name || "Administrator";
      const account = await AccountService.get(_id);
      if (!account) {
        response.status(404).send({ message: "Account not found" });
        return;
      }
      if (account.isActive === false) {
        response.status(400).send({ message: "Staff access has already been revoked" });
        return;
      }
      await AccountService.deactivate(_id, actorName);
      await logAuditAction({
        action: "STAFF_DEACTIVATED",
        details: `Revoked access for staff account ${account.name} (${account.email})`,
        actorName,
        actorRole: request.account?.type || "admin",
        targetType: "staff",
        targetId: _id,
      });
      response.send({ message: "Staff access revoked" });
    } catch (error) {
      console.error("deleteAccount error:", error);
      response.status(500).send({ message: "Server error" });
    }
  };

  // Hard deletion (super admin only use; normal "delete" is the soft deactivate above)
  static removeAccountPermanently = async (request: AuthRequest, response: Response) => {
    try {
      const { _id } = request.body || {};
      if (!isValidObjectId(_id)) {
        response.status(400).send({ message: "A valid staff id is required." });
        return;
      }
      const account = await AccountService.get(_id);
      if (!account) {
        response.status(404).send({ message: "Account not found" });
        return;
      }
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
      const { _id } = request.body || {};

      if (!isValidObjectId(_id)) {
        response.status(400).send("Account id is required");
        return;
      }

      const account = await AccountService.get(_id);

      if (!account) {
        response.status(404).send("Account not found");
        return;
      }

      if (account.isApproved === true) {
        response.status(400).send("Account is already approved");
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

      response.send({ message: "Staff account approved" });
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
      const { _id } = request.body || {};
      if (!isValidObjectId(_id)) {
        response.status(400).send({ message: "A valid staff id is required." });
        return;
      }
      const account = await AccountService.get(_id);
      if (!account) {
        response.status(404).send({ message: "Account not found" });
        return;
      }
      if (account.isActive !== false) {
        response.status(400).send({ message: "Account is already active" });
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
      response.status(500).send({ message: "Server error" });
    }
  };

  static suspendAccount = async (request: AuthRequest, response: Response) => {
    try {
      const { _id } = request.body || {};
      const reason =
        typeof request.body?.reason === "string" ? request.body.reason.trim().slice(0, 300) : "";
      if (!isValidObjectId(_id)) {
        response.status(400).send({ message: "A valid staff id is required." });
        return;
      }
      const account = await AccountService.get(_id);
      if (!account) {
        response.status(404).send({ message: "Account not found" });
        return;
      }
      if (account.isApproved === false) {
        response.status(400).send({ message: "Pending or rejected accounts cannot be suspended" });
        return;
      }
      if (account.isActive === false) {
        response.status(400).send({ message: "Account access has already been revoked" });
        return;
      }
      if (account.isSuspended) {
        response.status(400).send({ message: "Account is already suspended" });
        return;
      }
      await AccountService.suspend(_id, reason, request.account?.name || "Administrator");
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
      response.status(500).send({ message: "Server error" });
    }
  };

  static unsuspendAccount = async (request: AuthRequest, response: Response) => {
    try {
      const { _id } = request.body || {};
      if (!isValidObjectId(_id)) {
        response.status(400).send({ message: "A valid staff id is required." });
        return;
      }
      const account = await AccountService.get(_id);
      if (!account) {
        response.status(404).send({ message: "Account not found" });
        return;
      }
      if (!account.isSuspended) {
        response.status(400).send({ message: "Account is not suspended" });
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
      response.status(500).send({ message: "Server error" });
    }
  };

  static forceLogout = async (request: AuthRequest, response: Response) => {
    try {
      const { _id } = request.body || {};
      if (!isValidObjectId(_id)) {
        response.status(400).send({ message: "A valid staff id is required." });
        return;
      }
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
      const { _id, newPassword } = request.body || {};
      if (!isValidObjectId(_id)) {
        response.status(400).send({ message: "A valid staff id is required." });
        return;
      }
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
