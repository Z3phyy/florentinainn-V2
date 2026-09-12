import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Paymentservice } from "../services/payment.service";
import { ChatService } from "../services/chat.service";
import { SystemService } from "../services/system.service";
import { AdminService } from "../services/admin.service";
import { AccountService } from "../services/acccount.service";
import { uploadToCloudinary } from "../utils/cloudinaryUpload";
import { RoomService } from "../services/room.service";
import { BookingService } from "../services/booking.service";
import { AuditLogModel } from "../model/audit.model";
import { logAuditAction } from "../utils/auditLogger";
import { NotificationService } from "../services/notification.service";
import { notify } from "../utils/notification";
import { initSSE } from "../utils/sse";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { sendOtpEmail, sendContactInquiryEmail } from "../utils/sendEmail";
import { validatePassword, validateEmail } from "../utils/validation";

export class SystemController {

   static getAllPayments = async (request : AuthRequest , response : Response) => {
      const payments = await Paymentservice.getAll()
      response.send(payments)
    }

   static getSystemInfo = async (request : AuthRequest , response : Response) => {
      const systemInfo = await SystemService.get()
      response.send(systemInfo)
    }

   static checkAdminRegistrationStatus = async (request: AuthRequest, response: Response) => {
     try {
       const admins = await AdminService.getAll();
       const hasAdmin = admins.some((a) => a.type === "admin");
       const hasSuperAdmin = admins.some((a) => a.type === "super admin");
       const allRegistered = hasAdmin && hasSuperAdmin;

       response.send({
         canRegister: !allRegistered,
         hasAdmin,
         hasSuperAdmin,
         admins: admins.map((a) => ({ _id: a._id, email: a.email, type: a.type })),
       });
     } catch (error) {
       console.log("Failed to check admin status: " + (error as Error).message);
       response.status(500).send("Failed to check admin status: " + (error as Error).message);
     }
   };

   static updateSystemInfo = async (request: AuthRequest, response: Response) => {
    try {
      const { systemInfo, paymentMin, systemName, header, description, facebook, contactEmail } = request.body
      const system = await SystemService.update({ systemInfo, paymentMin, systemName, header, description, facebook, contactEmail })
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

      const otp = Math.floor(1000 + Math.random() * 9000).toString()

      if (admin) {
        await AdminService.updateOtp(email, otp)
      } else {
        await AccountService.updateOtp(email, otp)
      }

      await sendOtpEmail({ to: email, otp })

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
      if (!admin) {
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
      const { input, convo } = request.body;

      const systeminfo = await SystemService.get()

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });


     
      
  
      const prompt = `
            ${systeminfo?.systemInfo}

            Previous Conversation:
            ${Array.isArray(convo) ? convo.join("\n") : ""}

            User:
            ${input}
       `;

      const result = await model.generateContent(prompt);
      const aiReply = result.response.text();

      response.send(aiReply)

    } catch (error) {
      console.error(error);

      response.status(500).json({
        success: false,
        message: "Failed to generate response",
      });
    }
  };

  static aiSuggestReply = async (request: AuthRequest, response: Response) => {
    try {
      const { convo, clientName } = request.body;

      const systeminfo = await SystemService.get();
      const rooms = await RoomService.getAll();

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const roomSummary = rooms && rooms.length > 0
        ? rooms.map((r) => `${r.roomNumber ? `Room ${r.roomNumber} (` : ""}${r.category}${r.roomNumber ? ")" : ""}: ₱${r.price.toLocaleString()}/night (Status: ${r.status})`).join(", ")
        : "Standard luxury rooms available.";

      const prompt = `
You are an expert AI receptionist and co-pilot assisting front-desk staff for "${systeminfo?.systemName || "Hotel"}".

Hotel Information & Policies:
${systeminfo?.systemInfo || "Standard hotel policies apply."}

Available Room Types & Rates:
${roomSummary}

Location & Hours:
Francia Sur, Jose D. Aspiras Hwy, Tubao, La Union. Open 24/7.
Payment methods accepted: GCash, Online payment, Cash at front desk.

Conversation with Guest (${clientName || "Guest"}):
${Array.isArray(convo) ? convo.map((m: any) => `${m.user === "staff" ? "Front Desk" : clientName || "Guest"}: ${m.message}`).join("\n") : ""}

Task:
Draft a polite, professional, warm, and concise reply that the staff member can send to the guest right now.
Directly answer the guest's latest question or inquiry.
Return ONLY the suggested reply message text without any quotes, conversational intros, or Markdown code fences.
`;

      const result = await model.generateContent(prompt);
      const reply = result.response.text().trim();

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
      await sendContactInquiryEmail({
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

      response.send({ success: true, message: "Inquiry email dispatched successfully" });
    } catch (error) {
      console.error("Failed to process contact inquiry email:", error);
      response.status(500).send("Failed to send inquiry email");
    }
  };

  static aiForecastSuggestions = async (request: AuthRequest, response: Response) => {
    try {
      const { forecastData, baseline, peakMonths, slowMonths, totalForecast, projectedOccupancy } = request.body;

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `
You are a senior hotel revenue management and hospitality operations consultant.
Analyze the following 6-month hotel occupancy forecast and historical baseline data:

Forecast Metrics:
- Monthly Baseline: ${baseline} average bookings/month
- 6-Month Projected Volume: ${totalForecast} total bookings
- Projected Peak Surge Months: ${JSON.stringify(peakMonths || [])}
- Projected Low Occupancy Months: ${JSON.stringify(slowMonths || [])}
- Full 6-Month Breakdown: ${JSON.stringify(forecastData || [])}
- Full-House / Sell-Out Risk by Month (projected occupancy % vs rooms): ${JSON.stringify(
  projectedOccupancy || []
)}

Provide strategic, professional recommendations divided into exactly these 4 categories:
1. Dynamic Pricing Strategy (Specific percentage surge pricing, minimum stay rules for peak months, low-demand discount packages, flash sales)
2. Staffing & Operations Plan (Housekeeping and reception shift scaling, deep cleaning, scheduled AC and room maintenance during slow periods)
3. Marketing & Outreach Campaign (Early-bird campaigns, launch lead-times 30-45 days before peak dates, corporate weekday packages, repeat guest incentives)
4. Inventory & Resource Planning (Linen and guest amenity pre-ordering, preventative inspections, supplies buffer)

Respond in clean JSON format with this exact structure:
{
  "summary": "2-sentence executive summary of the forecast outlook and primary strategic recommendation.",
  "pricing": ["Recommendation 1", "Recommendation 2", "Recommendation 3"],
  "staffing": ["Recommendation 1", "Recommendation 2", "Recommendation 3"],
  "marketing": ["Recommendation 1", "Recommendation 2", "Recommendation 3"],
  "inventory": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
}

Important: Return ONLY the JSON object. Do not include markdown code fences or backticks.
`;

      const result = await model.generateContent(prompt);
      const rawText = result.response.text().trim();

      let parsed;
      try {
        const cleaned = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
        parsed = JSON.parse(cleaned);
      } catch (err) {
        parsed = {
          summary: "Forecast analysis generated.",
          pricing: [
            `Implement dynamic surge pricing (+15% to +25%) during projected peak months.`,
            `Offer early-bird and multi-night packages during lower-occupancy periods.`,
            `Enforce 2-night minimum stay rules on anticipated high-demand weekends.`
          ],
          staffing: [
            `Scale up housekeeping and front-desk coverage by 30% during peak surge windows.`,
            `Schedule preventative room maintenance and deep cleaning during projected slow months.`,
            `Implement on-call shift rotations for high check-in turnaround days.`
          ],
          marketing: [
            `Launch early-bird promotional campaigns 30-45 days prior to peak seasonal dates.`,
            `Target corporate retreats and remote workers with special weekday packages.`,
            `Send exclusive discount vouchers to past guests to boost off-peak reservations.`
          ],
          inventory: [
            `Pre-order extra linens, toiletries, and supplies 3-4 weeks before peak season.`,
            `Conduct pre-season audits of air-conditioning units, water heaters, and electronics.`
          ]
        };
      }

      response.send(parsed);
    } catch (error) {
      console.error("AI forecast generation error:", error);
      response.status(500).json({
        message: "Failed to generate AI suggestions: " + (error as Error).message,
      });
    }
  };

  static getAuditLogs = async (request: AuthRequest, response: Response) => {
    try {
      const limit = Number(request.query.limit) || 100;
      const search = request.query.search as string;
      const action = request.query.action as string;

      const query: any = {};

      if (action && action !== "all") {
        query.action = { $regex: action, $options: "i" };
      }

      if (search && search.trim()) {
        const searchRegex = { $regex: search.trim(), $options: "i" };
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
      const isCloudinaryConfigured = !!(process.env.cloud_name || process.env.CLOUDINARY_CLOUD_NAME);
      const isStripeConfigured = !!(process.env.STRIPE_SECRET_KEY);
      const isPaymongoConfigured = !!(process.env.PAYMONGO_SECRET_KEY);
      const isGeminiConfigured = !!(process.env.GEMINI_API_KEY);
      const isBrevoConfigured = !!(process.env.brevo_api_key);

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
      const [items, unreadCount, typeCounts] = await Promise.all([
        NotificationService.getForAdmin(100),
        NotificationService.getUnreadCountForAdmin(),
        NotificationService.countByType(),
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
      await SystemController.generateArrivalReminders();
      await SystemController.generateOverdueReminders();

      const permissions = request.account?.permisions || [];
      const [items, unreadCount, typeCounts] = await Promise.all([
        NotificationService.getForStaff(permissions, 100),
        NotificationService.getUnreadCountForStaff(permissions),
        NotificationService.countByTypeForStaff(permissions),
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

  private static generateArrivalReminders = async () => {
    try {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const todayStr = `${yyyy}-${mm}-${dd}`;

      const bookings = await BookingService.getTodayArrivals(todayStr);

      for (const booking of bookings) {
        const bookingId = String(booking._id);
        const existing = await NotificationService.existsByDedupeKey(
          bookingId,
          "reservation",
          "Arrival Today"
        );
        if (existing) {
          await BookingService.markArrivalNotified(bookingId);
          continue;
        }

        await notify({
          type: "reservation",
          title: "Arrival Today",
          message: `${booking.clientName}${booking.clientPhone ? ` (${booking.clientPhone})` : ""} is expected to arrive today at ${booking.arrivalTime}.`,
          severity: "info",
          link: "/pages/staff/reservation",
          targetType: "booking",
          targetId: bookingId,
          audience: "staff",
          permission: "frontdesk management",
        });

        await BookingService.markArrivalNotified(bookingId);
      }
    } catch (error) {
      console.log("Failed to generate arrival reminders: " + (error as Error).message);
    }
  };

  private static generateOverdueReminders = async () => {
    try {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const todayStr = `${yyyy}-${mm}-${dd}`;

      const bookings = await BookingService.getOverdueReservations(todayStr);

      for (const booking of bookings) {
        const bookingId = String(booking._id);
        const existing = await NotificationService.existsByDedupeKey(
          bookingId,
          "reservation",
          "Overdue Arrival"
        );
        if (existing) {
          await BookingService.markOverdueNotified(bookingId);
          continue;
        }

        await notify({
          type: "reservation",
          title: "Overdue Arrival",
          message: `${booking.clientName}${booking.clientPhone ? ` (${booking.clientPhone})` : ""} was expected to arrive on ${booking.arrivalDate} at ${booking.arrivalTime} but has not checked in.`,
          severity: "warning",
          link: "/pages/staff/reservation",
          targetType: "booking",
          targetId: bookingId,
          audience: "staff",
          permission: "frontdesk management",
        });

        await BookingService.markOverdueNotified(bookingId);
      }
    } catch (error) {
      console.log("Failed to generate overdue reminders: " + (error as Error).message);
    }
  };
}