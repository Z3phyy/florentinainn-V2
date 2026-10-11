import dotenv from "dotenv";

dotenv.config();

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export interface SendOtpEmailInput {
  to: string;
  otp: string;
}

export const sendOtpEmail = async ({ to, otp }: SendOtpEmailInput) => {
  const htmlContent = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Florentina Inn Verification Code</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f1f3f4; font-family:'Segoe UI', Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f3f4; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
            <tr>
              <td align="center" style="background-color:#1a3a5c; padding:32px 24px 28px 24px;">
                <div style="font-size:28px; font-weight:700; color:#ffffff; letter-spacing:0.5px;">Florentina Inn</div>
                <div style="font-size:13px; color:#c9d6e3; margin-top:4px;">Trece Martires City, Cavite</div>
              </td>
            </tr>
            <tr>
              <td style="padding:40px 40px 24px 40px;">
                <h1 style="margin:0 0 16px 0; font-size:22px; font-weight:600; color:#202124;">Your verification code</h1>
                <p style="margin:0 0 24px 0; font-size:15px; line-height:1.6; color:#5f6368;">
                  We received a request to reset the password for your Florentina Inn account.
                  Use the verification code below to complete the process. This code is valid for a short time.
                </p>
                <div align="center" style="margin:0 0 24px 0;">
                  <div style="display:inline-block; padding:18px 40px; background-color:#f8fafc; border:1px solid #d8dee4; border-radius:8px; font-size:36px; font-weight:700; letter-spacing:12px; color:#1a3a5c;">${otp}</div>
                </div>
                <p style="margin:0 0 8px 0; font-size:14px; line-height:1.5; color:#5f6368;">
                  If you didn't request this, you can safely ignore this email. Your password won't change until you enter the code above.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 40px 40px; border-top:1px solid #eceff1;">
                <p style="margin:0 0 8px 0; font-size:13px; line-height:1.5; color:#80868b;">
                  <strong>Florentina Inn</strong> — Comfortable and affordable rooms for every stay.
                </p>
                <p style="margin:0; font-size:12px; line-height:1.5; color:#9aa0a6;">
                  This is an automated message. Please do not reply to this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  return sendEmail({
    to,
    subject: "Florentina Inn - Password Reset Verification Code",
    htmlContent,
    kind: "otp",
  });
};

export type EmailFailureCode =
  | "not_configured"
  | "invalid_recipient"
  | "auth_failed"
  | "insufficient_credits"
  | "rate_limited"
  | "rejected"
  | "provider_unavailable"
  | "timeout"
  | "network";

export class EmailDeliveryError extends Error {
  code: EmailFailureCode;
  httpStatus?: number;
  constructor(code: EmailFailureCode, message: string, httpStatus?: number) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export interface EmailResult {
  accepted: true;
  messageId: string | null;
  sandbox: boolean;
}

const EMAIL_TIMEOUT_MS = 15000;
const EMAIL_PATTERN = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

export const maskEmail = (email: string) =>
  String(email || "").replace(/^(.)[^@]*(@.*)$/, "$1***$2");

export const emailSenderConfig = () => ({
  name: (process.env.EMAIL_SENDER_NAME || "Noreply - Florentina Inn").trim(),
  email: (process.env.EMAIL_SENDER_ADDRESS || "openapp174@gmail.com").trim(),
});

const isSandbox = () =>
  String(process.env.EMAIL_SANDBOX || "").toLowerCase() === "true";

const classify = (status: number): EmailFailureCode => {
  if (status === 401 || status === 403) return "auth_failed";
  if (status === 402) return "insufficient_credits";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "provider_unavailable";
  return "rejected";
};

const sendEmail = async ({
  to,
  subject,
  htmlContent,
  kind = "general",
  replyTo,
}: {
  to: string;
  subject: string;
  htmlContent: string;
  kind?: string;
  replyTo?: string;
}): Promise<EmailResult> => {
  const recipient = String(to || "").trim();
  const apiKey = (process.env.BREVO_API_KEY || BREVO_API_KEY || "").trim();
  const log = (status: string, detail = "") =>
    console.log(
      `[email] kind=${kind} to=${maskEmail(recipient)} status=${status}${detail ? ` ${detail}` : ""}`,
    );

  if (!EMAIL_PATTERN.test(recipient)) {
    log("failed", "code=invalid_recipient");
    throw new EmailDeliveryError(
      "invalid_recipient",
      "The recipient email address is not valid.",
    );
  }
  if (!apiKey) {
    log("failed", "code=not_configured");
    throw new EmailDeliveryError(
      "not_configured",
      "Email delivery is not configured (BREVO_API_KEY is missing).",
    );
  }

  const sender = emailSenderConfig();
  const body: Record<string, unknown> = {
    sender,
    to: [{ email: recipient }],
    subject,
    htmlContent,
  };
  if (replyTo && EMAIL_PATTERN.test(replyTo)) body.replyTo = { email: replyTo };
  const sandbox = isSandbox();
  if (sandbox) body.headers = { "X-Sib-Sandbox": "drop" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    const timedOut = (error as Error).name === "AbortError";
    log("failed", `code=${timedOut ? "timeout" : "network"}`);
    throw new EmailDeliveryError(
      timedOut ? "timeout" : "network",
      timedOut
        ? "The email provider did not respond in time."
        : "Could not reach the email provider.",
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const code = classify(response.status);
    const providerMessage =
      typeof data.message === "string"
        ? data.message.slice(0, 200)
        : `HTTP ${response.status}`;
    log(
      "failed",
      `code=${code} http=${response.status} provider="${providerMessage}"`,
    );
    throw new EmailDeliveryError(
      code,
      `Email provider rejected the message: ${providerMessage}`,
      response.status,
    );
  }

  const messageId = typeof data.messageId === "string" ? data.messageId : null;
  log(
    sandbox ? "accepted-sandbox" : "accepted",
    messageId ? `messageId=${messageId}` : "",
  );
  return { accepted: true, messageId, sandbox };
};

export const describeEmailFailure = (
  error: unknown,
): { code: EmailFailureCode | "unknown"; message: string } => {
  if (error instanceof EmailDeliveryError)
    return { code: error.code, message: error.message };
  return { code: "unknown", message: "The email could not be sent." };
};

export interface RecipientDeliveryEvent {
  event: string;
  date: string;
  subject: string;
  reason: string;
}

export const getRecipientDeliveryEvents = async (
  email: string,
  limit = 20,
): Promise<RecipientDeliveryEvent[]> => {
  const apiKey = (process.env.BREVO_API_KEY || "").trim();
  if (!apiKey)
    throw new EmailDeliveryError(
      "not_configured",
      "Email delivery is not configured (BREVO_API_KEY is missing).",
    );
  const url = `https://api.brevo.com/v3/smtp/statistics/events?email=${encodeURIComponent(email)}&limit=${Math.min(100, Math.max(1, limit))}&sort=desc&days=90`;
  const response = await fetch(url, {
    headers: { "api-key": apiKey, accept: "application/json" },
  });
  if (!response.ok) {
    throw new EmailDeliveryError(
      classify(response.status),
      `Could not read delivery events (HTTP ${response.status}).`,
      response.status,
    );
  }
  const data = (await response.json()) as {
    events?: Record<string, unknown>[];
  };
  return (data.events || []).map((e) => ({
    event: String(e.event || ""),
    date: String(e.date || ""),
    subject: String(e.subject || ""),
    reason: String(e.reason || ""),
  }));
};

export const getEmailProviderStatus = async () => {
  const apiKey = (process.env.BREVO_API_KEY || "").trim();
  const sender = emailSenderConfig();
  const status = {
    configured: !!apiKey,
    reachable: false,
    senderVerified: false,
    sender: sender.email,
    sandbox: isSandbox(),
    plan: "",
    credits: null as number | null,
    error: "",
  };
  if (!apiKey) {
    status.error = "BREVO_API_KEY is missing.";
    return status;
  }
  try {
    const headers = { "api-key": apiKey, accept: "application/json" };
    const account = await fetch("https://api.brevo.com/v3/account", {
      headers,
    });
    if (!account.ok) {
      status.error = `Provider rejected the API key (HTTP ${account.status}).`;
      return status;
    }
    status.reachable = true;
    const accountData = (await account.json()) as {
      plan?: { type?: string; credits?: number }[];
    };
    const plan = (accountData.plan || [])[0];
    status.plan = plan?.type || "";
    status.credits = typeof plan?.credits === "number" ? plan.credits : null;
    const senders = await fetch("https://api.brevo.com/v3/senders", {
      headers,
    });
    if (senders.ok) {
      const senderData = (await senders.json()) as {
        senders?: { email?: string; active?: boolean }[];
      };
      status.senderVerified = (senderData.senders || []).some(
        (s) =>
          (s.email || "").toLowerCase() === sender.email.toLowerCase() &&
          s.active !== false,
      );
    }
  } catch {
    status.error = "Could not reach the email provider.";
  }
  return status;
};

export interface SendStatusEmailInput {
  to: string;
  email: string;
}

export const sendApprovalEmail = async ({
  to,
  email,
}: SendStatusEmailInput) => {
  const htmlContent = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Florentina Inn - Account Approved</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f1f3f4; font-family:'Segoe UI', Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f3f4; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
            <tr>
              <td align="center" style="background-color:#1a3a5c; padding:32px 24px 28px 24px;">
                <div style="font-size:28px; font-weight:700; color:#ffffff; letter-spacing:0.5px;">Florentina Inn</div>
                <div style="font-size:13px; color:#c9d6e3; margin-top:4px;">Trece Martires City, Cavite</div>
              </td>
            </tr>
            <tr>
              <td style="padding:40px 40px 24px 40px;">
                <h1 style="margin:0 0 16px 0; font-size:22px; font-weight:600; color:#202124;">Your account has been approved</h1>
                <p style="margin:0 0 16px 0; font-size:15px; line-height:1.6; color:#5f6368;">
                  Congratulations, your staff account has been approved by the administrator.
                  You can now sign in using your email.
                </p>
                <p style="margin:0 0 8px 0; font-size:14px; line-height:1.5; color:#5f6368;">
                  Email: <strong>${email}</strong>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 40px 40px; border-top:1px solid #eceff1;">
                <p style="margin:0 0 8px 0; font-size:13px; line-height:1.5; color:#80868b;">
                  <strong>Florentina Inn</strong> — Comfortable and affordable rooms for every stay.
                </p>
                <p style="margin:0; font-size:12px; line-height:1.5; color:#9aa0a6;">
                  This is an automated message. Please do not reply to this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  return sendEmail({
    to,
    subject: "Florentina Inn - Account Approved",
    htmlContent,
    kind: "approval",
  });
};

export const sendRejectionEmail = async ({
  to,
  email,
}: SendStatusEmailInput) => {
  const htmlContent = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Florentina Inn - Account Rejected</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f1f3f4; font-family:'Segoe UI', Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f3f4; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
            <tr>
              <td align="center" style="background-color:#1a3a5c; padding:32px 24px 28px 24px;">
                <div style="font-size:28px; font-weight:700; color:#ffffff; letter-spacing:0.5px;">Florentina Inn</div>
                <div style="font-size:13px; color:#c9d6e3; margin-top:4px;">Trece Martires City, Cavite</div>
              </td>
            </tr>
            <tr>
              <td style="padding:40px 40px 24px 40px;">
                <h1 style="margin:0 0 16px 0; font-size:22px; font-weight:600; color:#202124;">Your account request was rejected</h1>
                <p style="margin:0 0 16px 0; font-size:15px; line-height:1.6; color:#5f6368;">
                  We are sorry to inform you that your staff account registration for Florentina Inn has been rejected by the administrator.
                </p>
                <p style="margin:0 0 8px 0; font-size:14px; line-height:1.5; color:#5f6368;">
                  Email: <strong>${email}</strong>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 40px 40px; border-top:1px solid #eceff1;">
                <p style="margin:0 0 8px 0; font-size:13px; line-height:1.5; color:#80868b;">
                  <strong>Florentina Inn</strong> — Comfortable and affordable rooms for every stay.
                </p>
                <p style="margin:0; font-size:12px; line-height:1.5; color:#9aa0a6;">
                  This is an automated message. Please do not reply to this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  return sendEmail({
    to,
    subject: "Florentina Inn - Account Rejected",
    htmlContent,
    kind: "rejection",
  });
};

export interface SendInquiryEmailInput {
  guestName: string;
  guestEmail: string;
  subject?: string;
  message: string;
}

export const sendContactInquiryEmail = async ({
  guestName,
  guestEmail,
  subject,
  message,
  adminEmail,
}: SendInquiryEmailInput & { adminEmail?: string }) => {
  const safeSubject = subject || "General Inquiry";

  const guestHtmlContent = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Inquiry Received - Florentina Inn</title>
  </head>
  <body style="margin:0; padding:0; background-color:#FAF5F5; font-family:'Segoe UI', Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF5F5; padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 16px rgba(144,5,70,0.06); border:1px solid #E4D1D1;">
            <tr>
              <td align="center" style="background-color:#900546; padding:32px 24px;">
                <div style="font-size:24px; font-weight:700; color:#ffffff; font-family:Georgia, serif;">Florentina Inn</div>
                <div style="font-size:12px; color:#F2E3E3; margin-top:4px;">Jose D. Aspiras Hwy, Tubao, 2506 La Union</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h2 style="margin:0 0 12px 0; font-size:20px; color:#130005;">Thank you, ${guestName}!</h2>
                <p style="margin:0 0 20px 0; font-size:14px; line-height:1.6; color:#5C454B;">
                  We have received your message regarding <strong>${safeSubject}</strong>. Our front desk reception and concierge team in Tubao, La Union will reply shortly.
                </p>
                <div style="background-color:#FAF5F5; border-left:4px solid #900546; padding:16px; border-radius:8px; margin-bottom:24px;">
                  <div style="font-size:11px; font-weight:bold; color:#618685; text-transform:uppercase; margin-bottom:4px;">Your Message Summary</div>
                  <div style="font-size:13px; color:#130005; white-space:pre-line;">${message}</div>
                </div>
                <div style="background-color:#F5FAFA; border:1px solid #618685; padding:14px; border-radius:10px; font-size:12px; color:#385251;">
                  <strong>Need Immediate Assistance?</strong><br/>
                  Call our 24/7 Front Desk at <strong>0917-123-4567</strong> or reach us via live chat.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px; background-color:#FAF5F5; border-top:1px solid #E4D1D1; font-size:11px; color:#886F75; text-align:center;">
                Florentina Inn • Tubao, 2506 La Union, Philippines • 24/7 Front Desk Reception
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  // 2. Alert notification to the Hotel Management email (from Settings)
  const hotelAdminEmail =
    adminEmail || process.env.HOTEL_ADMIN_EMAIL || "openapp174@gmail.com";
  const adminHtmlContent = `
  <!DOCTYPE html>
  <html>
  <body style="font-family:Arial, sans-serif; background-color:#f9f9f9; padding:20px;">
    <div style="max-width:600px; background:#fff; padding:24px; border-radius:12px; border:1px solid #ddd;">
      <h3 style="color:#900546; margin-top:0;">New Guest Inquiry Received</h3>
      <p><strong>Guest Name:</strong> ${guestName}</p>
      <p><strong>Email:</strong> <a href="mailto:${guestEmail}">${guestEmail}</a></p>
      <p><strong>Subject:</strong> ${safeSubject}</p>
      <hr style="border:none; border-top:1px solid #eee; margin:16px 0;" />
      <p><strong>Message:</strong></p>
      <div style="background:#f4f4f4; padding:12px; border-radius:6px; white-space:pre-line;">${message}</div>
      <p style="font-size:12px; color:#666; margin-top:20px;">You can reply to this guest directly at ${guestEmail} or via the Staff Chat Portal.</p>
    </div>
  </body>
  </html>
  `;

  const [guest, admin] = await Promise.allSettled([
    sendEmail({
      to: guestEmail,
      subject: `Florentina Inn - Inquiry Received: ${safeSubject}`,
      htmlContent: guestHtmlContent,
      kind: "inquiry_guest",
    }),
    sendEmail({
      to: hotelAdminEmail,
      subject: `[New Inquiry] ${guestName} - ${safeSubject}`,
      htmlContent: adminHtmlContent,
      kind: "inquiry_admin",
      replyTo: guestEmail,
    }),
  ]);
  return {
    guest:
      guest.status === "fulfilled"
        ? { sent: true }
        : { sent: false, ...describeEmailFailure(guest.reason) },
    admin:
      admin.status === "fulfilled"
        ? { sent: true }
        : { sent: false, ...describeEmailFailure(admin.reason) },
  };
};

export interface ReservationVoucherEmailInput {
  to: string;
  guestName: string;
  bookingId: string;
  voucherUrl: string;
  amount: number;
  roomCategory?: string;
  arrivalDate?: string;
  arrivalTime?: string;
  departureDate?: string;
  refNumber?: string;
  verificationCode?: string;
  totalAmount?: number;
  addOns?: { name: string; quantity: number; subtotal: number }[];
}

export const sendReservationVoucherEmail = async ({
  to,
  guestName,
  bookingId,
  voucherUrl,
  amount,
  roomCategory,
  arrivalDate,
  arrivalTime,
  departureDate,
  refNumber,
  verificationCode,
  totalAmount,
  addOns,
}: ReservationVoucherEmailInput) => {
  const peso = (value: number) =>
    `₱${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const escapeHtml = (value: string) =>
    String(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c] as string,
    );
  const addOnRows = (addOns || [])
    .map(
      (a) => `<tr>
                    <td style="padding:6px 12px; font-size:12px; color:#886F75;">Add-on: ${a.quantity}× ${escapeHtml(a.name)}</td>
                    <td style="padding:6px 12px; font-size:13px; font-weight:bold; color:#130005; text-align:right;">${peso(a.subtotal)}</td>
                  </tr>`,
    )
    .join("");
  const formatDate = (dateStr?: string) =>
    dateStr
      ? new Date(dateStr).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  const htmlContent = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Reservation Payment Confirmation - Florentina Inn</title>
  </head>
  <body style="margin:0; padding:0; background-color:#FAF5F5; font-family:'Segoe UI', Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF5F5; padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 16px rgba(144,5,70,0.06); border:1px solid #E4D1D1;">
            <tr>
              <td align="center" style="background-color:#900546; padding:32px 24px;">
                <div style="font-size:24px; font-weight:700; color:#ffffff; font-family:Georgia, serif;">Florentina Inn</div>
                <div style="font-size:12px; color:#F2E3E3; margin-top:4px;">Jose D. Aspiras Hwy, Tubao, 2506 La Union</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h2 style="margin:0 0 8px 0; font-size:20px; color:#130005;">Payment Received — Thank you, ${guestName}!</h2>
                <p style="margin:0 0 20px 0; font-size:14px; line-height:1.6; color:#5C454B;">
                  Your online reservation payment has been confirmed. Your booking is now secured. Please present your
                  payment voucher at the front desk upon arrival.
                </p>

                <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF5F5; border:1px solid #E4D1D1; border-radius:12px; padding:16px;">
                  <tr>
                    <td style="padding:6px 12px; font-size:12px; color:#886F75;">Booking Reference</td>
                    <td style="padding:6px 12px; font-size:13px; font-weight:bold; color:#130005; text-align:right;">${refNumber || `RSV-${bookingId.slice(-6).toUpperCase()}`}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 12px; font-size:12px; color:#886F75;">Room</td>
                    <td style="padding:6px 12px; font-size:13px; font-weight:bold; color:#130005; text-align:right;">${roomCategory || "Standard Suite"}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 12px; font-size:12px; color:#886F75;">Check-In</td>
                    <td style="padding:6px 12px; font-size:13px; font-weight:bold; color:#130005; text-align:right;">${formatDate(arrivalDate)}${arrivalTime ? ` · ${arrivalTime}` : ""}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 12px; font-size:12px; color:#886F75;">Check-Out</td>
                    <td style="padding:6px 12px; font-size:13px; font-weight:bold; color:#130005; text-align:right;">${formatDate(departureDate)}</td>
                  </tr>
                  ${addOnRows}
                  ${
                    totalAmount
                      ? `<tr>
                    <td style="padding:6px 12px; font-size:12px; color:#886F75;">Estimated Stay Total</td>
                    <td style="padding:6px 12px; font-size:13px; font-weight:bold; color:#130005; text-align:right;">${peso(totalAmount)}</td>
                  </tr>`
                      : ""
                  }
                  ${
                    verificationCode
                      ? `<tr>
                    <td style="padding:6px 12px; font-size:12px; color:#886F75;">Verification Code</td>
                    <td style="padding:6px 12px; font-size:14px; font-weight:bold; color:#130005; text-align:right; font-family:monospace; letter-spacing:2px;">${escapeHtml(verificationCode)}</td>
                  </tr>`
                      : ""
                  }
                  <tr>
                    <td style="padding:6px 12px; font-size:12px; color:#886F75;">Amount Paid</td>
                    <td style="padding:6px 12px; font-size:14px; font-weight:bold; color:#900546; text-align:right;">₱${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                </table>

                <div align="center" style="margin:28px 0 20px 0;">
                  <a href="${voucherUrl}" style="display:inline-block; padding:14px 32px; background-color:#900546; color:#ffffff; text-decoration:none; font-size:14px; font-weight:bold; border-radius:12px;">
                    View / Print Payment Voucher
                  </a>
                </div>

                <div style="background-color:#F5FAFA; border:1px solid #618685; padding:14px; border-radius:10px; font-size:12px; color:#385251;">
                  <strong>Need help?</strong> Call our 24/7 Front Desk at <strong>0917-123-4567</strong> or chat with us on the website.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px; background-color:#FAF5F5; border-top:1px solid #E4D1D1; font-size:11px; color:#886F75; text-align:center;">
                Florentina Inn • Tubao, 2506 La Union, Philippines • 24/7 Front Desk Reception
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

  return sendEmail({
    kind: "voucher",
    to,
    subject: `Florentina Inn - Reservation Payment Confirmed (Ref: ${refNumber || `RSV-${bookingId.slice(-6).toUpperCase()}`})`,
    htmlContent,
  });
};

export interface SecurityLoginEmailInput {
  to: string;
  accountName: string;
  accountEmail: string;
  roleLabel: string;
  occurredAt: string;
  ipAddress: string;
  device: string;
}

export const sendSecurityLoginEmail = async (
  input: SecurityLoginEmailInput,
) => {
  const escape = (value: string) =>
    String(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c] as string,
    );
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 12px; font-size:12px; color:#886F75;">${label}</td><td style="padding:6px 12px; font-size:13px; font-weight:bold; color:#130005; text-align:right;">${escape(value)}</td></tr>`;
  const htmlContent = `
  <!DOCTYPE html>
  <html lang="en">
  <head><meta charset="UTF-8"><title>Security Alert - Successful Sign-in</title></head>
  <body style="margin:0; padding:0; background-color:#FAF5F5; font-family:'Segoe UI', Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr><td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background:#ffffff; border-radius:16px; border:1px solid #E4D1D1; overflow:hidden;">
          <tr><td style="background:#900546; padding:24px; color:#ffffff; font-size:20px; font-weight:700; font-family:Georgia, serif;">Florentina Inn · Security Alert</td></tr>
          <tr><td style="padding:24px 28px;">
            <p style="margin:0 0 16px 0; font-size:14px; line-height:1.6; color:#5C454B;">A ${escape(input.roleLabel.toLowerCase())} account signed in successfully (password and access code verified).</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF5F5; border:1px solid #E4D1D1; border-radius:12px;">
              ${row("Account", input.accountName)}
              ${row("Email", input.accountEmail)}
              ${row("Role", input.roleLabel)}
              ${row("Time", input.occurredAt)}
              ${row("IP address", input.ipAddress)}
              ${row("Device", input.device)}
            </table>
            <p style="margin:16px 0 0 0; font-size:12px; line-height:1.6; color:#5C454B;">If this sign-in was not expected, suspend the account and revoke its sessions from Staff Management or System Configuration.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>`;
  return sendEmail({
    to: input.to,
    subject: `Security Alert: ${input.roleLabel} sign-in (${input.accountName})`,
    htmlContent,
    kind: "security_login",
  });
};
