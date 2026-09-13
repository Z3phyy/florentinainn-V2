import dotenv from 'dotenv';

dotenv.config();

const BREVO_API_KEY = process.env.brevo_api_key || "";
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
  });
};

const sendEmail = async ({ to, subject, htmlContent }: { to: string; subject: string; htmlContent: string }) => {
  const body = {
    sender: { name: "Noreply - Florentina Inn", email: "openapp174@gmail.com" },
    to: [{ email: to }],
    subject,
    htmlContent,
  };

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": BREVO_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brevo email failed (${response.status}): ${errorText}`);
  }

  return response.json();
};

export interface SendStatusEmailInput {
  to: string;
  email: string;
}

export const sendApprovalEmail = async ({ to, email }: SendStatusEmailInput) => {
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
  });
};

export const sendRejectionEmail = async ({ to, email }: SendStatusEmailInput) => {
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

  // 1. Confirmation acknowledgement to the guest
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
  const hotelAdminEmail = adminEmail || process.env.HOTEL_ADMIN_EMAIL || "openapp174@gmail.com";
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

  await Promise.allSettled([
    sendEmail({
      to: guestEmail,
      subject: `Florentina Inn - Inquiry Received: ${safeSubject}`,
      htmlContent: guestHtmlContent,
    }),
    sendEmail({
      to: hotelAdminEmail,
      subject: `[New Inquiry] ${guestName} - ${safeSubject}`,
      htmlContent: adminHtmlContent,
    }),
  ]);
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
}: ReservationVoucherEmailInput) => {
  const formatDate = (dateStr?: string) =>
    dateStr
      ? new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
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
    to,
    subject: `Florentina Inn - Reservation Payment Confirmed (Ref: ${refNumber || `RSV-${bookingId.slice(-6).toUpperCase()}`})`,
    htmlContent,
  });
};
