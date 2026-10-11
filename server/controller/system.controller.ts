import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { generateAiText, generateAiWithTools, GROUNDING_RULES, sanitizeAiText, sanitizeAiHistory } from "../utils/ai";
import { HOTEL_TIME_ZONE } from "../utils/hotelTime";
import { nightlyRate } from "../utils/pricing";
import {
  CHATBOT_TOOLS,
  ChatbotToolContext,
  executeChatbotTool,
  extractReservationCodes,
  hotelDateContext,
} from "../services/chatbotTools.service";
import {
  buildKnowledgeContext,
  buildStaffInstructions,
  SYSTEM_INFO_MAX,
  validateAiKnowledge,
} from "../services/knowledge.service";
import { Paymentservice } from "../services/payment.service";
import { ChatService } from "../services/chat.service";
import { SystemService } from "../services/system.service";
import { AdminService } from "../services/admin.service";
import { AccountService } from "../services/acccount.service";
import { uploadToCloudinary } from "../utils/cloudinaryUpload";
import { RoomService } from "../services/room.service";
import { BookingService } from "../services/booking.service";
import { AuditLogModel } from "../model/audit.model";
import AdminModel from "../model/admin.model";
import AccountModel from "../model/account.model";
import { logAuditAction } from "../utils/auditLogger";
import { NotificationService } from "../services/notification.service";
import { notify } from "../utils/notification";
import { notificationTemplates } from "../utils/notificationTemplates";
import { initSSE } from "../utils/sse";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import {
  sendOtpEmail,
  sendContactInquiryEmail,
  describeEmailFailure,
  getEmailProviderStatus,
  getRecipientDeliveryEvents,
} from "../utils/sendEmail";
import crypto from "crypto";
import {
  validatePassword,
  validateEmail,
  validateAccessCode,
  normalizeAccessCode,
  isValidObjectId,
} from "../utils/validation";
import { AccessCodeService } from "../services/accessCode.service";
import { LoginAttemptService } from "../services/loginAttempt.service";
import { EMAIL_POLICY } from "../config/loginPolicy";
import { ReservationMonitor, resolveGraceMinutes } from "../services/reservationMonitor.service";
import { ForecastError, ForecastService } from "../services/forecast.service";

// Escape user-supplied text so it is treated as a literal string, not a regex
// pattern, when used inside $regex queries (prevents ReDoS / unexpected matches).
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseGuestChatHistory(raw: unknown, currentInput: string) {
  if (!Array.isArray(raw)) return [] as { role: "user" | "model"; text: string }[];
  const entries: { role: "user" | "model"; text: string }[] = [];
  for (const item of raw.slice(-40)) {
    let role: "user" | "model" | null = null;
    let text = "";
    if (typeof item === "string") {
      const match = item.match(/^\s*(User|Ai|Guest|Assistant)\s*:\s*([\s\S]*)$/i);
      if (!match) continue;
      role = /^(user|guest)$/i.test(match[1]) ? "user" : "model";
      text = match[2];
    } else if (item && typeof item === "object") {
      const r = String((item as any).role || "");
      role = r === "user" ? "user" : r === "ai" || r === "model" ? "model" : null;
      text = typeof (item as any).text === "string" ? (item as any).text : "";
    }
    const clean = sanitizeAiText(text, 800);
    if (!role || !clean) continue;
    const last = entries[entries.length - 1];
    if (last && last.role === role) last.text = `${last.text}\n${clean}`.slice(0, 1600);
    else entries.push({ role, text: clean });
  }
  const last = entries[entries.length - 1];
  if (last && last.role === "user" && last.text === currentInput) entries.pop();
  while (entries.length && entries[0].role !== "user") entries.shift();
  const trimmed = entries.slice(-16);
  while (trimmed.length && trimmed[0].role !== "user") trimmed.shift();
  return trimmed;
}

export class SystemController {

   static getAllPayments = async (request : AuthRequest , response : Response) => {
      const { page, limit, search } = request.query;
      const result = await Paymentservice.list({
        page: Number(page) || 1,
        limit: Number(limit) || 50,
        search: typeof search === "string" ? search : "",
      });
      response.send(result)
    }

   static refundPayment = async (request : AuthRequest , response : Response) => {
     try {
       const { paymentId } = request.body || {};
       const reason = typeof request.body?.reason === "string" ? request.body.reason.trim() : "";
       const note = typeof request.body?.note === "string" ? request.body.note.trim() : "";

       if (!isValidObjectId(paymentId)) {
         response.status(400).send("Payment id is required");
         return;
       }

       if (reason.length < 3 || reason.length > 300) {
         response.status(400).send("A refund reason of 3-300 characters is required");
         return;
       }

       if (note.length > 100) {
         response.status(400).send("Reference number must be at most 100 characters");
         return;
       }

       const payment = await Paymentservice.get(paymentId);
       if (!payment) {
         response.status(404).send("Payment not found");
         return;
       }

       if (payment.status === "refunded") {
         response.status(409).send("This payment has already been refunded");
         return;
       }

       const account = request.account;
       const refundedBy = account?.name || "Staff";

       const refundRef = note || `RFN-${paymentId.slice(-6).toUpperCase()}`;

       const refunded = await Paymentservice.markRefunded(paymentId, {
         refundedBy,
         refundReason: reason,
         refundRef,
       });

       if (!refunded) {
         response.status(409).send("This payment has already been refunded");
         return;
       }

       await logAuditAction({
         action: "PAYMENT_REFUNDED",
         details: `Refunded payment ${paymentId} (₱${payment.amount || 0} via ${payment.method || "Cash"}, ${payment.refNumber || ""}) to ${payment.paymentBy || "Guest"}${reason ? ` — ${reason}` : ""}`,
         actorName: refundedBy,
         actorRole: account?.type || "employee",
         targetType: "payment",
         targetId: String(payment._id),
       });

       await notify({
         type: "payment",
         title: `Payment Refunded: ${payment.paymentBy || "Guest"}`,
         message: `Refund of ₱${payment.amount || 0} recorded${reason ? ` (${reason})` : ""}`,
         severity: "warning",
         link: "/pages/admin/payments",
         targetType: "payment",
         targetId: String(payment._id),
       });

       response.send(await Paymentservice.getAll());
     } catch (error) {
       console.log("Failed to refund payment: " + (error as Error).message);
       response.status(500).send("Failed to refund payment");
     }
   }

   static restorePayment = async (request : AuthRequest , response : Response) => {
     try {
       const { paymentId } = request.body;

       if (!paymentId) {
         response.status(400).send("Payment id is required");
         return;
       }

       const payment = await Paymentservice.get(paymentId);
       if (!payment) {
         response.status(404).send("Payment not found");
         return;
       }

       if (payment.status !== "refunded") {
         response.status(409).send("This payment is not refunded");
         return;
       }

       await Paymentservice.update(paymentId, {
         date: payment.date,
         amount: payment.amount,
         receivedBy: payment.receivedBy,
         paymentBy: payment.paymentBy,
         method: payment.method,
         refNumber: payment.refNumber,
         folio: payment.folio,
         balance: payment.balance,
         status: "paid",
         refundedAt: null,
         refundedBy: "",
         refundReason: "",
         refundRef: "",
       });

       await logAuditAction({
         action: "PAYMENT_RESTORED",
         details: `Restored refunded payment ${paymentId} (₱${payment.amount || 0})`,
         actorName: request.account?.name || "Staff",
         actorRole: request.account?.type || "employee",
         targetType: "payment",
         targetId: String(payment._id),
       });

       response.send(await Paymentservice.getAll());
     } catch (error) {
       console.log("Failed to restore payment: " + (error as Error).message);
       response.status(500).send("Failed to restore payment");
     }
   }

   static getSystemInfo = async (request : AuthRequest , response : Response) => {
      const systemInfo: any = await SystemService.get()
      if (!systemInfo) {
        response.send(systemInfo)
        return
      }
      const { securityAlertEmail, securityAlertScope, aiKnowledge, ...publicInfo } = systemInfo.toObject()
      const { instructions, ...publicKnowledge } = aiKnowledge || {}
      response.send({ ...publicInfo, aiKnowledge: publicKnowledge })
    }

   static getSystemSettings = async (request : AuthRequest , response : Response) => {
      const systemInfo = await SystemService.get()
      response.send(systemInfo)
    }

   static checkAdminRegistrationStatus = async (request: AuthRequest, response: Response) => {
     try {
       const admins = await AdminService.getAll();
       const hasAdmin = admins.some((a) => a.type === "admin");
       const hasSuperAdmin = admins.some((a) => a.type === "super admin");

       response.send({
         canRegister: !hasSuperAdmin,
         hasAdmin,
         hasSuperAdmin,
       });
     } catch (error) {
       console.log("Failed to check admin status: " + (error as Error).message);
       response.status(500).send("Failed to check admin status");
     }
   };

   static getAdmins = async (request: AuthRequest, response: Response) => {
     try {
       const admins = await AdminService.getAllAdmins();
       response.send(
         admins.map((a) => {
           const plain: Record<string, unknown> = a.toObject();
           delete plain.accessCodeHash;
           plain.hasAccessCode = !!plain.accessCodeUpdatedAt;
           return plain;
         }),
       );
     } catch (error) {
       console.log("Failed to get admins: " + (error as Error).message);
       response.status(500).send("Failed to get admins");
     }
   };

   static toggleAdminActive = async (request: AuthRequest, response: Response) => {
     try {
       const { _id, isActive } = request.body || {};
       const reason =
         typeof request.body?.reason === "string" ? request.body.reason.trim().slice(0, 300) : "";
       const action: string =
         typeof request.body?.action === "string"
           ? request.body.action
           : isActive === false
             ? "deactivate"
             : "reactivate";

       if (!isValidObjectId(_id)) {
         response.status(400).json({ message: "A valid admin id is required." });
         return;
       }
       if (!["suspend", "unsuspend", "deactivate", "reactivate"].includes(action)) {
         response.status(400).json({ message: "Invalid account action." });
         return;
       }
       if (_id === request.account?._id) {
         response.status(400).json({ message: "You cannot change the status of your own account." });
         return;
       }
       const admin = await AdminService.get(_id);
       if (!admin) {
         response.status(404).json({ message: "Admin not found" });
         return;
       }
       if (admin.type === "super admin") {
         response.status(400).json({ message: "The super admin account cannot be suspended or deactivated." });
         return;
       }

       const actorName = request.account?.name || "Super Admin";
       let auditAction = "";
       let details = "";

       if (action === "suspend") {
         if (admin.isActive === false) {
           response.status(400).json({ message: "Admin access has already been revoked." });
           return;
         }
         if (admin.isSuspended) {
           response.status(400).json({ message: "Admin is already suspended." });
           return;
         }
         await AdminService.suspend(_id, reason, actorName);
         auditAction = "ADMIN_SUSPENDED";
         details = `Suspended admin ${admin.email}${reason ? ` — ${reason}` : ""}`;
       } else if (action === "unsuspend") {
         if (!admin.isSuspended) {
           response.status(400).json({ message: "Admin is not suspended." });
           return;
         }
         await AdminService.unsuspend(_id);
         auditAction = "ADMIN_UNSUSPENDED";
         details = `Unsuspended admin ${admin.email}`;
       } else if (action === "deactivate") {
         if (admin.isActive === false) {
           response.status(400).json({ message: "Admin access has already been revoked." });
           return;
         }
         await AdminService.deactivate(_id, actorName);
         auditAction = "ADMIN_DEACTIVATED";
         details = `Revoked access for admin ${admin.email}${reason ? ` — ${reason}` : ""}`;
       } else {
         if (admin.isActive !== false) {
           response.status(400).json({ message: "Admin is already active." });
           return;
         }
         await AdminService.reactivate(_id);
         auditAction = "ADMIN_REACTIVATED";
         details = `Reactivated admin ${admin.email}`;
       }

       await logAuditAction({
         action: auditAction,
         details,
         actorName,
         actorRole: request.account?.type || "super admin",
         targetType: "admin",
         targetId: _id,
       });
       response.send({ message: "Admin status updated" });
     } catch (error) {
       console.log("Failed to update admin status: " + (error as Error).message);
       response.status(500).json({ message: "Failed to update admin status" });
     }
   };

   static createAdminAccount = async (request: AuthRequest, response: Response) => {
     try {
       const body = request.body || {};
       const name = typeof body.name === "string" ? body.name.trim() : "";
       const email = typeof body.email === "string" ? body.email.trim() : "";
       const password = typeof body.password === "string" ? body.password : "";

       if (!name) {
         response.status(400).json({ message: "Name is required." });
         return;
       }
       const emailError = validateEmail(email);
       if (emailError) {
         response.status(400).json({ message: emailError });
         return;
       }
       const passError = validatePassword(password);
       if (passError) {
         response.status(400).json({ message: passError });
         return;
       }
       const accessCode = normalizeAccessCode(body.accessCode);
       const codeError = validateAccessCode(accessCode);
       if (codeError) {
         response.status(400).json({ message: codeError });
         return;
       }
       if (accessCode !== normalizeAccessCode(body.confirmAccessCode)) {
         response.status(400).json({ message: "Access codes do not match." });
         return;
       }
       if (await AdminService.getByEmail(email)) {
         response.status(400).json({ message: "Email already used by an admin account" });
         return;
       }
       if (await AccountService.checkEmail(email)) {
         response.status(400).json({ message: "Email already used by a staff account" });
         return;
       }

       const admin = await AdminService.create({
         name,
         email,
         password: await bcrypt.hash(password, 10),
         otp: null,
         type: "admin",
       });
       if (!admin) {
         response.status(409).json({
           message: "An admin account already exists. Revoke and remove it before creating a replacement.",
         });
         return;
       }
       await AccessCodeService.set("admin", String(admin._id), accessCode);

       await logAuditAction({
         action: "ADMIN_CREATED",
         details: `Created admin account ${email}`,
         actorName: request.account?.name || "Super Admin",
         actorRole: request.account?.type || "super admin",
         targetType: "admin",
         targetId: String(admin._id),
       });
       response.status(201).json({ message: "Admin account created" });
     } catch (error) {
       console.log("Failed to create admin account: " + (error as Error).message);
       response.status(500).json({ message: "Failed to create admin account" });
     }
   };

   static removeAdminAccount = async (request: AuthRequest, response: Response) => {
     try {
       const { _id } = request.body || {};
       if (!isValidObjectId(_id)) {
         response.status(400).json({ message: "A valid admin id is required." });
         return;
       }
       const admin = await AdminService.get(_id);
       if (!admin) {
         response.status(404).json({ message: "Admin not found" });
         return;
       }
       if (admin.type === "super admin") {
         response.status(400).json({ message: "The super admin account cannot be removed." });
         return;
       }
       if (admin.isActive !== false) {
         response.status(400).json({ message: "Revoke the admin's access before removing the account." });
         return;
       }
       await AdminService.delete(_id);
       await logAuditAction({
         action: "ADMIN_REMOVED",
         details: `Permanently removed admin account ${admin.email}`,
         actorName: request.account?.name || "Super Admin",
         actorRole: request.account?.type || "super admin",
         targetType: "admin",
         targetId: _id,
       });
       response.send({ message: "Admin account removed" });
     } catch (error) {
       console.log("Failed to remove admin: " + (error as Error).message);
       response.status(500).json({ message: "Failed to remove admin account" });
     }
   };

   static setAdminAccessCode = async (request: AuthRequest, response: Response) => {
     try {
       const { _id } = request.body || {};
       if (!isValidObjectId(_id)) {
         response.status(400).json({ message: "A valid admin id is required." });
         return;
       }
       const accessCode = normalizeAccessCode(request.body?.accessCode);
       const codeError = validateAccessCode(accessCode);
       if (codeError) {
         response.status(400).json({ message: codeError });
         return;
       }
       if (accessCode !== normalizeAccessCode(request.body?.confirmAccessCode)) {
         response.status(400).json({ message: "Access codes do not match." });
         return;
       }
       const admin = await AdminService.get(_id);
       if (!admin) {
         response.status(404).json({ message: "Admin not found" });
         return;
       }
       if (admin.type === "super admin" && _id !== request.account?._id) {
         response.status(403).json({ message: "You cannot change another super admin's access code." });
         return;
       }
       const { accessCodeUpdatedAt } = await AccessCodeService.set("admin", _id, accessCode);
       await LoginAttemptService.reset([`access:${_id}`]);
       await logAuditAction({
         action: "ADMIN_ACCESS_CODE_CHANGED",
         details: `Access code updated for admin ${admin.email}`,
         actorName: request.account?.name || "Super Admin",
         actorRole: request.account?.type || "super admin",
         targetType: "admin",
         targetId: _id,
       });
       response.send({ message: "Admin access code updated.", accessCodeUpdatedAt });
     } catch (error) {
       console.log("Failed to set admin access code: " + (error as Error).message);
       response.status(500).json({ message: "Failed to update access code" });
     }
   };

   static getOwnAccessCodeStatus = async (request: AuthRequest, response: Response) => {
     try {
       const admin = await AdminService.get(request.account?._id || "");
       if (!admin) {
         response.status(404).json({ message: "Admin not found" });
         return;
       }
       response.send({
         hasAccessCode: !!admin.accessCodeUpdatedAt,
         accessCodeUpdatedAt: admin.accessCodeUpdatedAt || null,
       });
     } catch (error) {
       response.status(500).json({ message: "Failed to load access code status" });
     }
   };

   static changeOwnAccessCode = async (request: AuthRequest, response: Response) => {
     try {
       const adminId = request.account?._id || "";
       const currentPassword =
         typeof request.body?.currentPassword === "string" ? request.body.currentPassword : "";
       if (!currentPassword) {
         response.status(400).json({ message: "Current password is required." });
         return;
       }
       const accessCode = normalizeAccessCode(request.body?.accessCode);
       const codeError = validateAccessCode(accessCode);
       if (codeError) {
         response.status(400).json({ message: codeError });
         return;
       }
       if (accessCode !== normalizeAccessCode(request.body?.confirmAccessCode)) {
         response.status(400).json({ message: "Access codes do not match." });
         return;
       }
       const admin = await AdminService.get(adminId);
       if (!admin) {
         response.status(404).json({ message: "Admin not found" });
         return;
       }

       const passwordKey = `access-change:${adminId}`;
       const lockStatus = await LoginAttemptService.getStatus(passwordKey, EMAIL_POLICY);
       if (lockStatus.locked) {
         response.status(429).json({
           message: `Too many incorrect password attempts. Try again in ${Math.ceil(lockStatus.retryAfterSeconds / 60)} minute(s).`,
         });
         return;
       }
       const isMatch = await bcrypt.compare(currentPassword, admin.password);
       if (!isMatch) {
         await LoginAttemptService.registerFailure(passwordKey, "access-change", EMAIL_POLICY);
         response.status(400).json({ message: "Incorrect current password." });
         return;
       }
       await LoginAttemptService.reset([passwordKey]);

       const { accessCodeUpdatedAt } = await AccessCodeService.set("admin", adminId, accessCode);
       await logAuditAction({
         action: "ADMIN_ACCESS_CODE_CHANGED",
         details: `${admin.email} changed their access code`,
         actorName: request.account?.name || "Administrator",
         actorRole: request.account?.type || "admin",
         targetType: "admin",
         targetId: adminId,
       });
       response.send({ message: "Access code updated.", accessCodeUpdatedAt });
     } catch (error) {
       console.log("Failed to change access code: " + (error as Error).message);
       response.status(500).json({ message: "Failed to update access code" });
     }
   };

   static updateSystemInfo = async (request: AuthRequest, response: Response) => {
    try {
      const { systemInfo, paymentMin, gracePeriodHours, gracePeriodMinutes, systemName, header, description, facebook, contactEmail } = request.body

      const updateData: any = { systemInfo, systemName, header, description, facebook, contactEmail };
      if (systemInfo !== undefined && (typeof systemInfo !== "string" || systemInfo.length > SYSTEM_INFO_MAX)) {
        response.status(400).send(`Additional hotel notes must be text of at most ${SYSTEM_INFO_MAX} characters.`)
        return
      }
      if (request.body?.aiKnowledge !== undefined) {
        const knowledge = validateAiKnowledge(request.body.aiKnowledge)
        if (knowledge.error) {
          response.status(400).send(knowledge.error)
          return
        }
        updateData.aiKnowledge = knowledge.value
      }
      const sanitizedPaymentMin = Number(paymentMin);
      if (Number.isFinite(sanitizedPaymentMin) && sanitizedPaymentMin >= 0) {
        updateData.paymentMin = sanitizedPaymentMin;
      }
      if (gracePeriodMinutes !== undefined && gracePeriodMinutes !== null && gracePeriodMinutes !== "") {
        const minutes = Number(gracePeriodMinutes);
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
          response.status(400).send("Grace period must be a whole number of minutes between 1 and 1440 (24 hours).")
          return
        }
        updateData.gracePeriodMinutes = minutes;
        updateData.gracePeriodHours = Math.round((minutes / 60) * 100) / 100;
      } else if (gracePeriodHours !== undefined && gracePeriodHours !== null && gracePeriodHours !== "") {
        const hours = Number(gracePeriodHours);
        if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
          response.status(400).send("Grace period must be greater than 0 and at most 24 hours.")
          return
        }
        updateData.gracePeriodHours = hours;
        updateData.gracePeriodMinutes = Math.min(1440, Math.max(1, Math.round(hours * 60)));
      }

      const { securityAlertEmail, securityAlertScope } = request.body || {}
      if (securityAlertEmail !== undefined || securityAlertScope !== undefined) {
        const current: any = await SystemService.get()
        const nextEmail = securityAlertEmail === undefined ? current?.securityAlertEmail || "" : String(securityAlertEmail || "").trim()
        const nextScope = securityAlertScope === undefined ? current?.securityAlertScope || "admins" : String(securityAlertScope)
        const changed = nextEmail !== (current?.securityAlertEmail || "") || nextScope !== (current?.securityAlertScope || "admins")
        if (changed) {
          if (request.account?.type !== "super admin") {
            response.status(403).send("Only the super admin can change security alert settings.")
            return
          }
          if (nextEmail && validateEmail(nextEmail)) {
            response.status(400).send("Security alert email must be a valid email address.")
            return
          }
          if (!["off", "admins", "all"].includes(nextScope)) {
            response.status(400).send("Security alert scope must be off, admins, or all.")
            return
          }
          updateData.securityAlertEmail = nextEmail
          updateData.securityAlertScope = nextScope
          await logAuditAction({
            action: "SECURITY_ALERT_SETTINGS_UPDATED",
            details: `Login alert emails: ${nextScope}${nextEmail ? ` → ${nextEmail}` : " (hotel contact email)"}`,
            actorName: request.account?.name || "Super Admin",
            actorRole: request.account?.type || "super admin",
            targetType: "system",
          })
        }
      }

      for (const key of Object.keys(updateData)) {
        if (updateData[key] === undefined) delete updateData[key]
      }
      if (updateData.systemName !== undefined && !String(updateData.systemName).trim()) {
        response.status(400).send("Hotel name cannot be empty.")
        return
      }
      const system = await SystemService.update(updateData)
      response.send(system)
    } catch (error) {
      console.log("Failed to update system info: " + (error as Error).message)
      response.status(500).send("Failed to update system info: " + (error as Error).message)
    }
  }

  static createAdmin = async (request: AuthRequest, response: Response) => {
    try {
      const { email, password, type, name } = request.body

      if (!email || !password || !type) {
        response.status(400).send("Email, password and type are required")
        return
      }

      const emailError = validateEmail(email)
      if (emailError) {
        response.status(400).send(emailError)
        return
      }

      const passError = validatePassword(password)
      if (passError) {
        response.status(400).send(passError)
        return
      }

      if (type !== "admin" && type !== "super admin") {
        response.status(400).send("Invalid admin type")
        return
      }

      const existingAdmins = await AdminService.getAll()
      if (existingAdmins.some((a) => a.type === "super admin")) {
        response.status(403).send("Public admin registration is closed. The super admin creates administrator accounts from System Configuration.")
        return
      }

      if (await AdminService.getByEmail(email)) {
        response.status(400).send("Email already used by an admin account")
        return
      }

      if (await AccountService.checkEmail(email)) {
        response.status(400).send("Email already used by a staff account")
        return
      }

      const hashedPassword = await bcrypt.hash(password, 10)

      const admin = await AdminService.create({
        name: name || (type === "super admin" ? "Super Admin" : "Administrator"),
        email,
        password: hashedPassword,
        otp: null,
        type
      })

      if (!admin) {
        response.status(400).send(`${type} account already exists`)
        return
      }

      response.status(201).send("Admin account created successfully")
    } catch (error) {
      console.log("Failed to create admin: " + (error as Error).message)
      response.status(500).send("Failed to create admin: " + (error as Error).message)
    }
  }

  static sendForgotPasswordOtp = async (request: AuthRequest, response: Response) => {
    try {
      const { email } = request.body

      if (!email) {
        response.status(400).send("Email is required")
        return
      }

      const admin = await AdminService.getByEmail(email)
      const account = await AccountService.checkEmail(email)

      if (!admin && !account) {
        response.status(404).send("No account found with that email")
        return
      }

      const otp = crypto.randomInt(1000, 10000).toString()

      if (admin) {
        await AdminService.updateOtp(email, otp)
      } else {
        await AccountService.updateOtp(email, otp)
      }

      try {
        await sendOtpEmail({ to: email, otp })
      } catch (emailError) {
        const failure = describeEmailFailure(emailError)
        if (admin) await AdminService.clearOtp(email)
        else await AccountService.clearOtp(email)
        console.log(`Failed to send OTP email: code=${failure.code}`)
        response.status(502).send("We couldn't send the verification code right now. Please try again later or contact the front desk.")
        return
      }

      response.send("OTP sent to your email")
    } catch (error) {
      console.log("Failed to send OTP: " + (error as Error).message)
      response.status(500).send("Failed to send OTP")
    }
  }

  static verifyForgotPasswordOtp = async (request: AuthRequest, response: Response) => {
    try {
      const { email, inputOtp } = request.body

      if (!email || !inputOtp) {
        response.status(400).send("Email and OTP are required")
        return
      }

      const admin = await AdminService.getByEmail(email)
      const account = await AccountService.checkEmail(email)

      const isValid = admin
        ? await AdminService.verifyOtp(email, inputOtp)
        : account
        ? await AccountService.verifyOtp(email, inputOtp)
        : null

      if (!isValid) {
        response.status(400).send("Invalid OTP")
        return
      }

      response.send("OTP verified successfully")
    } catch (error) {
      console.log("Failed to verify OTP: " + (error as Error).message)
      response.status(500).send("Failed to verify OTP")
    }
  }

  static resetPassword = async (request: AuthRequest, response: Response) => {
    try {
      const { email, newPassword, inputOtp } = request.body

      if (!email || !newPassword) {
        response.status(400).send("Email and new password are required")
        return
      }

      if (!inputOtp) {
        response.status(400).send("OTP is required to reset password")
        return
      }

      const passError = validatePassword(newPassword)
      if (passError) {
        response.status(400).send(passError)
        return
      }

      const admin = await AdminService.getByEmail(email)
      const account = await AccountService.checkEmail(email)

      const isVerified = admin
        ? await AdminService.verifyOtp(email, inputOtp)
        : account
        ? await AccountService.verifyOtp(email, inputOtp)
        : null

      if (!isVerified) {
        response.status(400).send("Invalid or expired OTP")
        return
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10)

      if (admin) {
        await AdminService.updatePassword(email, hashedPassword)
        await AdminService.clearOtp(email)
      } else if (account) {
        await AccountService.updatePassword(email, hashedPassword)
        await AccountService.clearOtp(email)
      } else {
        response.status(404).send("No account found with that email")
        return
      }

      response.send("Password updated successfully")
    } catch (error) {
      console.log("Failed to reset password: " + (error as Error).message)
      response.status(500).send("Failed to reset password")
    }
  }

  static changeAdminCredentials = async (request: AuthRequest, response: Response) => {
    try {
      const { currentEmail, currentPassword, newEmail, newPassword } = request.body

      if (!currentEmail || !currentPassword) {
        response.status(400).send("Current email and current password are required")
        return
      }

      const admin = await AdminService.getByEmail(currentEmail)
      if (!admin || String(admin._id) !== request.account?._id) {
        response.status(404).send("Admin account not found")
        return
      }

      const isMatch = await bcrypt.compare(currentPassword, admin.password)
      if (!isMatch) {
        response.status(400).send("Incorrect current password")
        return
      }

      if (!newEmail && !newPassword) {
        response.status(400).send("Please provide a new email or new password to update")
        return
      }

      const updateData: { email?: string; password?: string } = {}

      if (newEmail && newEmail !== currentEmail) {
        const emailErr = validateEmail(newEmail)
        if (emailErr) {
          response.status(400).send(emailErr)
          return
        }

        if (await AdminService.getByEmail(newEmail)) {
          response.status(400).send("New email is already in use by an admin account")
          return
        }
        if (await AccountService.checkEmail(newEmail)) {
          response.status(400).send("New email is already in use by a staff account")
          return
        }
        updateData.email = newEmail
      }

      if (newPassword) {
        const passErr = validatePassword(newPassword)
        if (passErr) {
          response.status(400).send(passErr)
          return
        }
        updateData.password = await bcrypt.hash(newPassword, 10)
      }

      const updated = await AdminService.updateCredentials(admin._id.toString(), updateData)

      response.send({
        message: "Admin credentials updated successfully",
        admin: {
          _id: updated?._id,
          email: updated?.email,
          type: updated?.type,
        },
      })
    } catch (error) {
      console.log("Failed to update admin credentials: " + (error as Error).message)
      response.status(500).send("Failed to update admin credentials: " + (error as Error).message)
    }
  }

  static emailDiagnostics = async (request: AuthRequest, response: Response) => {
    try {
      const provider = await getEmailProviderStatus()
      const email = typeof request.query.email === "string" ? request.query.email.trim() : ""
      let events: Awaited<ReturnType<typeof getRecipientDeliveryEvents>> | null = null
      let eventsError = ""
      if (email) {
        if (validateEmail(email)) {
          response.status(400).send("Please provide a valid email address.")
          return
        }
        try {
          events = await getRecipientDeliveryEvents(email, 20)
        } catch (error) {
          eventsError = describeEmailFailure(error).message
        }
      }
      response.send({ provider, email: email || null, events, eventsError })
    } catch (error) {
      console.log("Failed to run email diagnostics: " + (error as Error).message)
      response.status(500).send("Failed to run email diagnostics")
    }
  }

  static uploadLogo = async (request: AuthRequest, response: Response) => {
    try {
      if (!request.file) {
        response.status(400).send("No logo image provided")
        return
      }

      const logoUrl = await uploadToCloudinary(request.file.path, "system")
      const system = await SystemService.updateLogo(logoUrl)

      response.send(system)
    } catch (error) {
      console.log("Failed to upload logo: " + (error as Error).message)
      response.status(500).send("Failed to upload logo: " + (error as Error).message)
    }
  }

  static uploadSystemImage = async (request: AuthRequest, response: Response) => {
    try {
      if (!request.file) {
        response.status(400).send("No image provided")
        return
      }

      const { field } = request.body
      const allowedFields = ["heroBackground", "aboutImg1", "aboutImg2", "aboutImg3", "aboutImg4"]
      if (!field || !allowedFields.includes(field)) {
        response.status(400).send("Invalid image field specified")
        return
      }

      const imageUrl = await uploadToCloudinary(request.file.path, "system")
      const system = await SystemService.updateField(field, imageUrl)

      response.send(system)
    } catch (error) {
      console.log("Failed to upload system image: " + (error as Error).message)
      response.status(500).send("Failed to upload system image: " + (error as Error).message)
    }
  }

static aiChatBot = async (request: AuthRequest, response: Response) => {
    try {
      const input = sanitizeAiText(request.body?.input, 1000);
      if (!input) {
        response.status(400).json({ message: "Message text is required." });
        return;
      }
      if (!process.env.GEMINI_API_KEY) {
        response.status(503).json({ message: "The AI concierge is not available right now." });
        return;
      }

      const history = parseGuestChatHistory(request.body?.history ?? request.body?.convo, input);
      const system = await SystemService.get();
      const { today, time, calendar } = hotelDateContext();
      const hotelName = sanitizeAiText(system?.systemName, 100) || "the hotel";
      const staffInstructions = buildStaffInstructions(system);

      const systemInstruction = `
You are the online concierge for ${hotelName}. You chat with guests on the hotel website.

${GROUNDING_RULES}

HOW TO ANSWER:
A. General questions (amenities, location, contact, policies, house rules, FAQs) are answered only from HOTEL KNOWLEDGE below.
B. Live questions MUST use a lookup tool, never HOTEL KNOWLEDGE, earlier chat messages, or memory:
   - room availability for any date or guest count -> check_room_availability
   - room prices or room types without dates -> get_room_rates
   - extra services / add-ons and their prices -> get_add_ons
   - cost of a stay (with or without add-ons) for dates -> quote_stay
   - status/payment/details of the guest's reservation -> lookup_booking (only with a RES-XXXXX-XXXXX code the guest typed)
   Call a tool again for every new live question, even if an earlier message mentioned prices or rooms.
C. Only state room names, room numbers, prices, totals, capacity, availability, add-on prices, booking status or payment status that appear in a tool result from this turn. Copy numbers exactly; do not do your own price math beyond what the tool returned.
D. If a tool returns ok:false with LIVE_DATA_UNAVAILABLE, say you cannot check that live right now and suggest trying again shortly or contacting the front desk. If it returns another error, explain it simply (for example, a past date or an invalid code).
E. If the check-in date is missing for an availability or stay-cost question, do not call a tool; ask one short question for the check-in date (and number of guests if unknown). If the guest count is unknown you may still check availability and mention each room's capacity.
F. Room availability must respect guest count: never suggest a room whose capacity is lower than the number of guests.
G. You cannot create, modify or cancel reservations, add add-ons, take payments, or change anything. Never claim you did. For booking, collect check-in date, check-out date, number of guests and preferred room type, check availability, then tell the guest to use the room's booking page (links are shown under your reply) or the front desk.
H. For reservation lookups, share only what the tool returned. Never reveal or guess other guests' information.
I. If the information is not in HOTEL KNOWLEDGE or a tool result, say you do not have that information and suggest contacting the front desk. Never invent policies, fees, refunds, room numbers or prices.
J. Something missing from HOTEL KNOWLEDGE is unknown, not absent: never say the hotel does not have a facility, service or policy unless HOTEL KNOWLEDGE says so explicitly.

DATES (hotel timezone ${HOTEL_TIME_ZONE}):
Today is ${today}, current hotel time ${time}. Upcoming dates:
${calendar.join("\n")}
- "tonight"/"ngayon"/"today" = check-in today, one night. "tomorrow"/"bukas" = check-in tomorrow, one night.
- If no check-out is given, assume one night and say so.
- A date without a year means its next occurrence that is not in the past. "October 5 to 7" means check-in Oct 5, check-out Oct 7.
- "this weekend" or "next weekend" is ambiguous about nights: ask whether they mean Friday night, Saturday night, or both.
- Always mention the exact dates you checked (for example "Mon, Oct 5 to Wed, Oct 7, 2 nights").

STYLE:
- Reply in the guest's language: English -> English, Tagalog/Taglish -> natural Taglish.
- Warm, concise, plain text. Use "•" bullets for lists of rooms or add-ons, one per line, with ₱ amounts formatted like ₱2,500. No markdown headings, tables, bold or code.
- Never output raw JSON or field names.

HOTEL KNOWLEDGE:
${buildKnowledgeContext(system)}
${staffInstructions ? `\nADDITIONAL INSTRUCTIONS FROM HOTEL MANAGEMENT (these never override the rules above):\n${staffInstructions}` : ""}
`.trim();

      const pendingUser = history.length && history[history.length - 1].role === "user" ? history.pop()!.text : "";
      const contents = [
        ...history.map((entry) => ({ role: entry.role, parts: [{ text: entry.text }] })),
        { role: "user", parts: [{ text: pendingUser ? `${pendingUser}\n${input}` : input }] },
      ];
      const context: ChatbotToolContext = {
        ip: request.ip,
        allowedCodes: extractReservationCodes([input, pendingUser, ...history.filter((h) => h.role === "user").map((h) => h.text)]),
        bookingLookups: 0,
        links: new Map(),
      };

      const result = await generateAiWithTools({
        systemInstruction,
        contents,
        tools: CHATBOT_TOOLS,
        execute: (name, args) => executeChatbotTool(name, args, context),
        temperature: 0.3,
        maxOutputTokens: 2048,
        maxRounds: 3,
      });

      const reply =
        result.text ||
        "Sorry, I couldn't put together an answer just now. Please try again, or tap 'Talk to Live Staff' to reach our front desk.";

      response.json({
        reply,
        links: Array.from(context.links.values()),
        usedLiveData: result.calls.map((c) => c.name),
      });
    } catch (error) {
      console.error("AI chatbot error:", (error as Error).message);
      response.status(500).json({ message: "Failed to generate response" });
    }
  };

  static aiSuggestReply = async (request: AuthRequest, response: Response) => {
    try {
      const { clientName } = request.body;
      const convo = sanitizeAiHistory(
        request.body?.convo,
        typeof clientName === "string" ? clientName : undefined,
      );

      const systeminfo = await SystemService.get();
      const rooms = await RoomService.getAll();

      const roomSummary = rooms && rooms.length > 0
        ? rooms.map((r) => `${r.roomNumber ? `Room ${r.roomNumber} (` : ""}${r.category}${r.roomNumber ? ")" : ""}: ₱${nightlyRate(r).toLocaleString()}/night, up to ${r.maxHead} guest(s) (Current status: ${r.status})`).join(", ")
        : "No room data is available. Do not quote any room or price.";

      const prompt = `
You are an expert AI receptionist and co-pilot assisting front-desk staff for "${sanitizeAiText(systeminfo?.systemName, 100) || "Hotel"}".

${GROUNDING_RULES}

Hotel Knowledge (policies, amenities, contact, FAQs):
${buildKnowledgeContext(systeminfo)}

Current Room Types & Rates from the hotel system (verify against this list, never guess prices; this is not date availability):
${roomSummary}

Conversation with Guest:
${convo.length > 0 ? convo.join("\n") : "(no previous messages)"}

Task:
Draft a polite, professional, warm, and concise reply that the staff member can send to the guest right now.
Directly answer the guest's latest question or inquiry using ONLY the hotel information above.
Return ONLY the suggested reply message text without any quotes, conversational intros, or Markdown code fences.
`;

      const reply = (await generateAiText(prompt, { temperature: 0.5, maxOutputTokens: 900 })).trim();

      response.send({ suggestion: reply });
    } catch (error) {
      console.error("AI reply suggestion error:", error);
      response.status(500).json({
        message: "Failed to generate reply suggestion: " + (error as Error).message,
      });
    }
  };

  static getAllChats = async (request: AuthRequest, response: Response) => {
    try {
      const chats = await ChatService.getAll()
      response.send(chats)
    } catch (error) {
      console.log("Failed to get chats: " + (error as Error).message)
      response.status(500).send("Failed to get chats: " + (error as Error).message)
    }
  }

  static getChat = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params
      const chat = await ChatService.get(id)
      if (!chat) {
        response.status(404).send("Chat not found")
        return
      }
      response.send(chat)
    } catch (error) {
      console.log("Failed to get chat: " + (error as Error).message)
      response.status(500).send("Failed to get chat")
    }
  }

  static createChat = async (request: AuthRequest, response: Response) => {
    try {
      const { clientName } = request.body
      const chat = await ChatService.create(clientName)
      response.send(chat)
    } catch (error) {
      console.log("Failed to create chat: " + (error as Error).message)
      response.status(500).send("Failed to create chat")
    }
  }

  static sendChatMessage = async (request: AuthRequest, response: Response) => {
    try {
      const { id, user, message } = request.body

      if (user === "staff" && !request.account) {
        response.status(401).send("Authentication required to send a staff message")
        return
      }

      const chat = await ChatService.sendMessage(id, user, message)
      if (!chat) {
        response.status(404).send("Chat not found")
        return
      }

      if (user === "client") {
        await notify({
          type: "chat",
          title: `Guest Message: ${chat.clientName}`,
          message: message.slice(0, 120),
          severity: "info",
          link: "/pages/staff/chat",
          targetType: "chat",
          targetId: String(chat._id),
          audience: "staff",
          permission: "chat management",
        });
      }

      response.send(chat)
    } catch (error) {
      console.log("Failed to send message: " + (error as Error).message)
      response.status(500).send("Failed to send message")
    }
  }

  static updateChatStatus = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params
      const { status } = request.body

      if (status !== "active" && status !== "resolved") {
        response.status(400).send("Invalid status. Must be 'active' or 'resolved'")
        return
      }

      const chat = await ChatService.updateStatus(id, status)
      if (!chat) {
        response.status(404).send("Chat not found")
        return
      }
      response.send(chat)
    } catch (error) {
      console.log("Failed to update chat status: " + (error as Error).message)
      response.status(500).send("Failed to update chat status: " + (error as Error).message)
    }
  }

  static deleteChat = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params
      const chat = await ChatService.delete(id)
      if (!chat) {
        response.status(404).send("Chat not found")
        return
      }
      response.send({ message: "Chat deleted successfully", chat })
    } catch (error) {
      console.log("Failed to delete chat: " + (error as Error).message)
      response.status(500).send("Failed to delete chat: " + (error as Error).message)
    }
  }

  static markChatAsSeen = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params
      const { viewer } = request.body // "staff" or "client"

      if (viewer !== "staff" && viewer !== "client") {
        response.status(400).send("Invalid viewer. Must be 'staff' or 'client'")
        return
      }

      const chat = await ChatService.markAsSeen(id, viewer)
      if (!chat) {
        response.status(404).send("Chat not found")
        return
      }
      response.send(chat)
    } catch (error) {
      console.log("Failed to mark chat as seen: " + (error as Error).message)
      response.status(500).send("Failed to mark chat as seen: " + (error as Error).message)
    }
  }

  static sendContactInquiry = async (request: AuthRequest, response: Response) => {
    try {
      const { name, email, subject, message } = request.body;

      if (!name || !email || !message) {
        response.status(400).send("Name, email, and message are required.");
        return;
      }

      // 1. Dispatch Automated Email via Brevo to both Guest & Hotel Admin
      const system = await SystemService.get();
      if (validateEmail(String(email).trim())) {
        response.status(400).send("Please provide a valid email address.");
        return;
      }

      const delivery = await sendContactInquiryEmail({
        guestName: name.trim(),
        guestEmail: email.trim(),
        subject: subject?.trim(),
        message: message.trim(),
        adminEmail: system?.contactEmail,
      });

      // 2. Log Audit Action for administrative tracking
      await logAuditAction({
        action: "INQUIRY_RECEIVED",
        details: `Guest inquiry from ${name} (${email}) - ${subject || "General Inquiry"}`,
        actorName: name.trim(),
        actorRole: "guest",
        targetType: "email",
      });

      // 3. Create a notification for the admin alert center
      await notify({
        type: "inquiry",
        title: `Contact Inquiry: ${name.trim()}`,
        message: `${subject || "General Inquiry"} - ${message.trim().slice(0, 120)}`,
        severity: "info",
        link: "/pages/admin/settings",
        targetType: "email",
      });

      if (!delivery.admin.sent) {
        console.log(`Contact inquiry admin email failed: code=${"code" in delivery.admin ? delivery.admin.code : "unknown"}`);
      }
      response.send({
        success: true,
        message: delivery.guest.sent
          ? "Your message was sent. A confirmation email is on its way."
          : "Your message was received by the hotel, but we couldn't send a confirmation email to your address.",
        confirmationEmailSent: delivery.guest.sent,
      });
    } catch (error) {
      console.error("Failed to process contact inquiry email:", error);
      response.status(500).send("Failed to send inquiry email");
    }
  };

  static aiForecastSuggestions = async (request: AuthRequest, response: Response) => {
    let metrics: Awaited<ReturnType<typeof ForecastService.compute>>;
    try {
      const params = ForecastService.parseQuery((request.body || {}) as Record<string, unknown>);
      metrics = await ForecastService.compute(params);
    } catch (error) {
      if (error instanceof ForecastError) {
        response.status(error.status).json({ message: error.message });
        return;
      }
      console.error("Forecast metrics error:", error);
      response.status(500).json({ message: "Failed to compute forecast metrics" });
      return;
    }

    const digest = {
      period: `${metrics.period.from} to ${metrics.period.to}`,
      roomFilter: metrics.filters.roomCategory,
      activeRooms: metrics.activeRooms,
      dataQuality: metrics.dataQuality,
      totals: metrics.totals,
      trend: metrics.trend,
      monthly: metrics.monthly
        .filter((m) => !m.isFuture)
        .map((m) => ({
          month: m.label,
          partial: m.isPartial,
          bookings: m.bookings,
          canceled: m.canceled,
          noShow: m.noShow,
          occupancyRate: m.occupancyRate,
          bookedRevenue: m.bookedRevenue,
          collectedRevenue: m.collectedRevenue,
        })),
      seasonality: metrics.seasonality,
      roomPerformance: metrics.roomPerformance,
      forecast: {
        method: metrics.forecast.method,
        months: metrics.forecast.months.map((m) => ({
          month: m.label,
          bookings: m.bookings,
          range: `${m.low}-${m.high}`,
          occupancyRate: m.occupancyRate,
        })),
      },
    };

    if (metrics.dataQuality.confidence === "insufficient") {
      response.send({
        status: "insufficient_data",
        confidence: "insufficient",
        summary: "There is not enough booking history in the selected range to produce reliable recommendations.",
        notes: metrics.dataQuality.notes,
        recommendations: [],
        metricsUsed: digest,
        generatedAt: new Date().toISOString(),
        source: "rules",
      });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      response.status(503).json({ message: "AI recommendations are not configured (GEMINI_API_KEY is missing).", metricsUsed: digest });
      return;
    }

    const prompt = `You are a hotel revenue-management analyst for a small inn in the Philippines (currency PHP).
You are given metrics that the hotel's system calculated from its own database. These numbers are the only source of truth.

METRICS (JSON):
${JSON.stringify(digest)}

RULES:
- Base every statement on the metrics above. Never invent, estimate, or change numbers, dates, room types, or percentages.
- Every recommendation must cite at least one specific metric value from the JSON in "supportingMetric".
- Only describe a trend if the metrics show it. If a pattern is weak, or dataQuality.confidence is "low", say so explicitly.
- Prefer insights about: occupancy changes, room-type performance differences, cancellation or no-show levels, revenue direction, seasonality, and forecast demand.
- Do not mention guests, names, or personal data.
- Return between 3 and 6 recommendations, most important first.

Respond with ONLY a JSON object (no markdown) in exactly this shape:
{
  "summary": "2-3 sentences describing what the data shows and the main priority",
  "confidenceNote": "one sentence on how much the data supports these conclusions",
  "recommendations": [
    {
      "category": "pricing | operations | marketing | inventory | revenue",
      "title": "short title",
      "observedTrend": "what the data shows",
      "supportingMetric": "the exact metric(s) and values used",
      "implication": "why it matters for the business",
      "action": "specific suggested action"
    }
  ]
}`;

    try {
      const rawText = (await generateAiText(prompt, { temperature: 0.2, maxOutputTokens: 2048 })).trim();
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
      let parsed: any;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        console.error("AI forecast returned non-JSON output");
        response.status(502).json({ message: "The AI service returned an unreadable response. Please try again.", metricsUsed: digest });
        return;
      }
      const allowedCategories = ["pricing", "operations", "marketing", "inventory", "revenue"];
      const recommendations = (Array.isArray(parsed?.recommendations) ? parsed.recommendations : [])
        .map((r: any) => ({
          category: allowedCategories.includes(String(r?.category).toLowerCase()) ? String(r.category).toLowerCase() : "revenue",
          title: sanitizeAiText(String(r?.title || ""), 120),
          observedTrend: sanitizeAiText(String(r?.observedTrend || ""), 500),
          supportingMetric: sanitizeAiText(String(r?.supportingMetric || ""), 300),
          implication: sanitizeAiText(String(r?.implication || ""), 500),
          action: sanitizeAiText(String(r?.action || ""), 500),
        }))
        .filter((r: any) => r.title && r.action && /\d/.test(r.supportingMetric))
        .slice(0, 6);
      if (recommendations.length === 0) {
        response.status(502).json({ message: "The AI response did not contain recommendations grounded in the metrics. Please try again.", metricsUsed: digest });
        return;
      }
      response.send({
        status: "ok",
        confidence: metrics.dataQuality.confidence,
        summary: sanitizeAiText(String(parsed?.summary || ""), 800),
        confidenceNote: sanitizeAiText(String(parsed?.confidenceNote || ""), 400),
        notes: metrics.dataQuality.notes,
        recommendations,
        metricsUsed: digest,
        generatedAt: new Date().toISOString(),
        source: "ai",
      });
    } catch (error) {
      console.error("AI forecast generation error:", (error as Error).message);
      response.status(502).json({
        message: "The AI service is unavailable right now. The forecast figures above are still accurate; please try the recommendations again later.",
        metricsUsed: digest,
      });
    }
  };

  static getAuditLogs = async (request: AuthRequest, response: Response) => {
    try {
      const limit = Math.min(500, Math.max(1, Math.floor(Number(request.query.limit) || 100)));
      const search = request.query.search as string;
      const action = request.query.action as string;

      const query: any = {};

      if (action && action !== "all") {
        query.action = { $regex: escapeRegex(action), $options: "i" };
      }

      if (search && search.trim()) {
        const searchRegex = { $regex: escapeRegex(search.trim()), $options: "i" };
        query.$or = [
          { actorName: searchRegex },
          { details: searchRegex },
          { action: searchRegex },
          { targetType: searchRegex },
          { actorRole: searchRegex },
        ];
      }

      const logs = await AuditLogModel.find(query).sort({ createdAt: -1 }).limit(limit);
      response.send(logs);
    } catch (error) {
      response.status(500).send("Failed to get audit logs: " + (error as Error).message);
    }
  };

  static getSystemHealth = async (request: AuthRequest, response: Response) => {
    try {
      const isMongoConnected = mongoose.connection.readyState === 1;
      const isCloudinaryConfigured = !!(process.env.CLOUDINARY_CLOUD_NAME);
      const isStripeConfigured = !!(process.env.STRIPE_SECRET_KEY);
      const isPaymongoConfigured = !!(process.env.PAYMONGO_SECRET_KEY);
      const isGeminiConfigured = !!(process.env.GEMINI_API_KEY);
      const isBrevoConfigured = !!(process.env.BREVO_API_KEY);

      response.send({
        timestamp: new Date().toISOString(),
        services: {
          database: {
            name: "MongoDB Atlas",
            status: isMongoConnected ? "operational" : "disconnected",
            connected: isMongoConnected,
          },
          gemini: {
            name: "Google Gemini AI",
            status: isGeminiConfigured ? "configured" : "missing_key",
            configured: isGeminiConfigured,
          },
          cloudinary: {
            name: "Cloudinary CDN",
            status: isCloudinaryConfigured ? "configured" : "missing_credentials",
            configured: isCloudinaryConfigured,
          },
          stripe: {
            name: "Stripe Payments",
            status: isStripeConfigured ? "configured" : "missing_secret",
            configured: isStripeConfigured,
          },
          paymongo: {
            name: "PayMongo Gateway",
            status: isPaymongoConfigured ? "configured" : "missing_secret",
            configured: isPaymongoConfigured,
          },
          brevo: {
            name: "Brevo Email Gateway",
            status: isBrevoConfigured ? "configured" : "missing_api_key",
            configured: isBrevoConfigured,
          },
        },
        overall: isMongoConnected && isCloudinaryConfigured ? "healthy" : "degraded",
      });
    } catch (error) {
      response.status(500).send("Failed to run health check: " + (error as Error).message);
    }
  };

  static getAdminNotifications = async (request: AuthRequest, response: Response) => {
    try {
      const prefs = request.account?.notificationPrefs;
      const [items, unreadCount, typeCounts] = await Promise.all([
        NotificationService.getForAdmin(prefs, 100),
        NotificationService.getUnreadCountForAdmin(prefs),
        NotificationService.countByType(prefs),
      ]);

      const countsByType = new Map(typeCounts.map((t) => [t._id, t.count]));

      const notifications = items.map((n: any) => ({
        id: String(n._id),
        type: n.type,
        title: n.title,
        message: n.message,
        severity: n.severity,
        status: n.read ? "read" : "unread",
        read: n.read,
        timestamp: n.createdAt || new Date().toISOString(),
        link: n.link || "/pages/admin/dashboard",
      }));

      response.send({
        totalUnread: unreadCount,
        pendingAccountsCount: countsByType.get("account") || 0,
        recentBookingsCount: countsByType.get("reservation") || 0,
        maintenanceCount: countsByType.get("maintenance") || 0,
        activeChatsCount: countsByType.get("chat") || 0,
        items: notifications,
      });
    } catch (error) {
      response.status(500).send("Failed to get notifications: " + (error as Error).message);
    }
  };

  static getStaffNotifications = async (request: AuthRequest, response: Response) => {
    try {
      await ReservationMonitor.run();

      const permissions = request.account?.permisions || [];
      const prefs = request.account?.notificationPrefs;
      const [items, unreadCount, typeCounts] = await Promise.all([
        NotificationService.getForStaff(permissions, prefs, 100),
        NotificationService.getUnreadCountForStaff(permissions, prefs),
        NotificationService.countByTypeForStaff(permissions, prefs),
      ]);

      const countsByType = new Map(typeCounts.map((t) => [t._id, t.count]));

      const notifications = items.map((n: any) => ({
        id: String(n._id),
        type: n.type,
        title: n.title,
        message: n.message,
        severity: n.severity,
        status: n.read ? "read" : "unread",
        read: n.read,
        timestamp: n.createdAt || new Date().toISOString(),
        link: n.link || "/pages/staff/home",
      }));

      response.send({
        totalUnread: unreadCount,
        pendingAccountsCount: countsByType.get("account") || 0,
        recentBookingsCount: countsByType.get("reservation") || 0,
        maintenanceCount: countsByType.get("maintenance") || 0,
        activeChatsCount: countsByType.get("chat") || 0,
        items: notifications,
      });
    } catch (error) {
      response.status(500).send("Failed to get staff notifications: " + (error as Error).message);
    }
  };

  // Normalizes the incoming preference payload against the known enum sets and
  // persists it to whichever collection owns the authenticated identity.
  static updateNotificationPrefs = async (request: AuthRequest, response: Response) => {
    try {
      const prefs = SystemController.normalizePrefs(request.body);
      const id = request.account?._id;
      const isAdminType =
        request.account?.type === "admin" || request.account?.type === "super admin";
      if (!id) {
        response.status(401).send("Unauthenticated");
        return;
      }
      if (isAdminType) {
        await AdminModel.findByIdAndUpdate(id, { notificationPrefs: prefs });
      } else {
        await AccountModel.findByIdAndUpdate(id, { notificationPrefs: prefs });
      }
      await logAuditAction({
        action: "NOTIFICATION_PREFS_UPDATED",
        details: "Notification preferences updated",
        actorName: request.account?.name,
        actorRole: request.account?.type || "employee",
        targetType: "system",
        targetId: String(id),
        metadata: { mutedTypes: prefs.mutedTypes, mutedSeverities: prefs.mutedSeverities },
      });
      response.send({ notificationPrefs: prefs });
    } catch (error) {
      response.status(500).send("Failed to update notification preferences: " + (error as Error).message);
    }
  };

  static updateNotificationPrefsStaff = SystemController.updateNotificationPrefs;

  static getNotificationPrefs = async (request: AuthRequest, response: Response) => {
    try {
      const prefs = request.account?.notificationPrefs || {};
      const id = request.account?._id;
      const isAdminType =
        request.account?.type === "admin" || request.account?.type === "super admin";
      if (!id) {
        response.status(401).send("Unauthenticated");
        return;
      }
      const stored = isAdminType
        ? await AdminModel.findById(id).select("notificationPrefs")
        : await AccountModel.findById(id).select("notificationPrefs");
      response.send({
        notificationPrefs:
          stored?.notificationPrefs || request.account?.notificationPrefs || {
            mutedTypes: [],
            mutedSeverities: [],
          },
      });
    } catch (error) {
      response.status(500).send("Failed to get notification preferences: " + (error as Error).message);
    }
  };

  static getNotificationPrefsStaff = SystemController.getNotificationPrefs;

  private static normalizePrefs(body: any) {
    const allowedTypes = ["account", "reservation", "maintenance", "chat", "payment", "inquiry", "system", "housekeeping", "security"];
    const allowedSeverities = ["info", "success", "warning", "danger"];
    const mutedTypes = Array.isArray(body?.mutedTypes)
      ? body.mutedTypes.filter((t: unknown) => typeof t === "string" && allowedTypes.includes(t))
      : [];
    const mutedSeverities = Array.isArray(body?.mutedSeverities)
      ? body.mutedSeverities.filter((s: unknown) => typeof s === "string" && allowedSeverities.includes(s))
      : [];
    return { mutedTypes, mutedSeverities };
  }

  static streamAdminNotifications = async (request: AuthRequest, response: Response) => {
    initSSE(response, "admin");
  };

  static streamStaffNotifications = async (request: AuthRequest, response: Response) => {
    initSSE(response, "staff");
  };

  static markNotificationAsRead = async (request: AuthRequest, response: Response) => {
    try {
      const id = String(request.params.id).replace(/^notif_/, "");
      const notification = await NotificationService.markAsRead(id);
      if (!notification) {
        response.status(404).send("Notification not found");
        return;
      }
      response.send(notification);
    } catch (error) {
      response.status(500).send("Failed to mark notification as read: " + (error as Error).message);
    }
  };

  static markAllNotificationsRead = async (request: AuthRequest, response: Response) => {
    try {
      const result = await NotificationService.markAllAsRead();
      response.send({ success: true, modifiedCount: result.modifiedCount });
    } catch (error) {
      response.status(500).send("Failed to mark notifications as read: " + (error as Error).message);
    }
  };

  static markAllStaffNotificationsRead = async (request: AuthRequest, response: Response) => {
    try {
      const permissions = request.account?.permisions || [];
      const result = await NotificationService.markAllAsReadForStaff(permissions);
      response.send({ success: true, modifiedCount: result.modifiedCount });
    } catch (error) {
      response.status(500).send("Failed to mark staff notifications as read: " + (error as Error).message);
    }
  };

  static deleteNotification = async (request: AuthRequest, response: Response) => {
    try {
      const id = String(request.params.id).replace(/^notif_/, "");
      const notification = await NotificationService.delete(id);
      if (!notification) {
        response.status(404).send("Notification not found");
        return;
      }
      response.send({ success: true });
    } catch (error) {
      response.status(500).send("Failed to delete notification: " + (error as Error).message);
    }
  };

  static deleteStaffNotification = async (request: AuthRequest, response: Response) => {
    try {
      const id = String(request.params.id).replace(/^notif_/, "");
      const notification = await NotificationService.delete(id);
      if (!notification) {
        response.status(404).send("Notification not found");
        return;
      }
      response.send({ success: true });
    } catch (error) {
      response.status(500).send("Failed to delete staff notification: " + (error as Error).message);
    }
  };

  static clearNotifications = async (request: AuthRequest, response: Response) => {
    try {
      const result = await NotificationService.deleteAllForAdmin();
      response.send({ success: true, deletedCount: result.deletedCount });
    } catch (error) {
      response.status(500).send("Failed to clear notifications: " + (error as Error).message);
    }
  };

  static clearStaffNotifications = async (request: AuthRequest, response: Response) => {
    try {
      const permissions = request.account?.permisions || [];
      const result = await NotificationService.deleteAllForStaff(permissions);
      response.send({ success: true, deletedCount: result.deletedCount });
    } catch (error) {
      response.status(500).send("Failed to clear staff notifications: " + (error as Error).message);
    }
  };
}
