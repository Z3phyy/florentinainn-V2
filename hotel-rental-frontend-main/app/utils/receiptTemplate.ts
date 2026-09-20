export interface ReceiptData {
  hotelName: string;
  logoUrl: string;
  referenceNo: string;
  folioNo: string;
  guestName: string;
  receivedBy: string;
  dateLabel: string;
  methodLabel: string;
  amount: number;
  balance: number;
  issuedAt: string;
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function peso(amount: number): string {
  return `PHP ${Number(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const RECEIPT_STYLES = `
  .rcpt {
    width: 100%;
    max-width: 420px;
    margin: 0 auto;
    padding: 22px 22px 18px;
    background: #ffffff;
    color: #130005;
    border: 1px solid #e3d6d9;
    border-radius: 10px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    font-size: 12px;
    line-height: 1.45;
  }
  .rcpt-head { text-align: center; padding-bottom: 14px; border-bottom: 1px solid #e3d6d9; }
  .rcpt-logo {
    display: block;
    height: 64px;
    width: auto;
    max-width: 180px;
    margin: 0 auto 8px;
    object-fit: contain;
  }
  .rcpt-hotel { margin: 0; font-size: 15px; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase; color: #130005; }
  .rcpt-doc { margin: 2px 0 0; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: #900546; font-weight: 700; }
  .rcpt-meta { margin: 6px 0 0; font-size: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #5c454b; }
  .rcpt-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; padding: 14px 0; border-bottom: 1px solid #e3d6d9; }
  .rcpt-label { display: block; font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; color: #8a7276; margin-bottom: 1px; }
  .rcpt-value { display: block; font-size: 12px; font-weight: 600; color: #130005; word-break: break-word; }
  .rcpt-value.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 500; }
  .rcpt-amounts { padding: 14px 0; border-bottom: 1px solid #e3d6d9; }
  .rcpt-row { display: flex; align-items: center; justify-content: space-between; }
  .rcpt-row + .rcpt-row { margin-top: 6px; }
  .rcpt-total-label { font-size: 13px; font-weight: 700; }
  .rcpt-total-value { font-size: 16px; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #0f7a4e; }
  .rcpt-balance-label { font-size: 11px; color: #5c454b; font-weight: 600; }
  .rcpt-balance-value { font-size: 12px; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #b45309; }
  .rcpt-foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; padding-top: 12px; font-size: 10px; color: #5c454b; }
  .rcpt-foot p { margin: 0; }
  .rcpt-stamp { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; }
  .rcpt-stamp.paid { background: #dcfce7; color: #14663f; }
  .rcpt-stamp.partial { background: #fef3c7; color: #92400e; }
  .rcpt-sign { margin-top: 18px; padding-top: 6px; border-top: 1px dashed #d9c3c3; text-align: center; font-size: 9px; color: #8a7276; }
`;

export const RECEIPT_PAGE_CSS = `
  @page { size: A5 portrait; margin: 12mm; }
`;

export const STAY_RECEIPT_STYLES = `
  .rcpt-lines { padding: 12px 0; border-bottom: 1px solid #e3d6d9; }
  .rcpt-line { display: flex; align-items: center; justify-content: space-between; font-size: 11px; }
  .rcpt-line + .rcpt-line { margin-top: 5px; }
  .rcpt-line span:last-child { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .rcpt-line.muted span { color: #5c454b; }
  .rcpt-line.credit span { color: #0f7a4e; }
  .rcpt-line.total { margin-top: 8px; padding-top: 8px; border-top: 1px solid #e3d6d9; font-size: 13px; font-weight: 700; }
`;

export function buildReceiptHtml(data: ReceiptData): string {
  const isPartial = Number(data.balance || 0) > 0;

  return `
  <div class="rcpt">
    <div class="rcpt-head">
      <img class="rcpt-logo" src="${escapeHtml(data.logoUrl)}" alt="${escapeHtml(data.hotelName)} logo" />
      <h2 class="rcpt-hotel">${escapeHtml(data.hotelName)}</h2>
      <p class="rcpt-doc">Official Payment Receipt</p>
      <p class="rcpt-meta">Ref: ${escapeHtml(data.referenceNo)} &middot; ${escapeHtml(data.dateLabel)}</p>
    </div>

    <div class="rcpt-grid">
      <div>
        <span class="rcpt-label">Guest Name</span>
        <span class="rcpt-value">${escapeHtml(data.guestName)}</span>
      </div>
      <div>
        <span class="rcpt-label">Received By</span>
        <span class="rcpt-value">${escapeHtml(data.receivedBy)}</span>
      </div>
      <div>
        <span class="rcpt-label">Payment Date</span>
        <span class="rcpt-value">${escapeHtml(data.dateLabel)}</span>
      </div>
      <div>
        <span class="rcpt-label">Payment Method</span>
        <span class="rcpt-value">${escapeHtml(data.methodLabel)}</span>
      </div>
      <div>
        <span class="rcpt-label">Folio No.</span>
        <span class="rcpt-value mono">${escapeHtml(data.folioNo)}</span>
      </div>
      <div>
        <span class="rcpt-label">Reference No.</span>
        <span class="rcpt-value mono">${escapeHtml(data.referenceNo)}</span>
      </div>
    </div>

    <div class="rcpt-amounts">
      <div class="rcpt-row">
        <span class="rcpt-total-label">Amount Paid</span>
        <span class="rcpt-total-value">${escapeHtml(peso(data.amount))}</span>
      </div>
      ${
        isPartial
          ? `<div class="rcpt-row">
        <span class="rcpt-balance-label">Remaining Balance</span>
        <span class="rcpt-balance-value">${escapeHtml(peso(data.balance))}</span>
      </div>`
          : ""
      }
    </div>

    <div class="rcpt-foot">
      <div>
        <p>Status: Verified Payment</p>
        <p>Thank you for choosing ${escapeHtml(data.hotelName)}!</p>
      </div>
      <div>
        <span class="rcpt-stamp ${isPartial ? "partial" : "paid"}">${isPartial ? "PARTIAL" : "PAID"}</span>
      </div>
    </div>

    <p class="rcpt-sign">Generated ${escapeHtml(data.issuedAt)} &middot; This receipt is computer generated.</p>
  </div>`;
}

export interface StayReceiptLine {
  label: string;
  value: number;
  tone?: "muted" | "credit";
}

export interface StayReceiptData {
  hotelName: string;
  logoUrl: string;
  receiptNo: string;
  checkoutDate: string;
  guestName: string;
  roomLabel: string;
  nights: number;
  methodLabel: string;
  lines: StayReceiptLine[];
  totalBill: number;
  amountPaid: number;
  change: number;
  showChange: boolean;
  cashierName: string;
  issuedAt: string;
}

export function buildStayReceiptHtml(data: StayReceiptData): string {
  const lines = data.lines
    .map(
      (line) => `      <div class="rcpt-line ${line.tone || ""}">
        <span>${escapeHtml(line.label)}</span>
        <span>${escapeHtml(peso(line.value))}</span>
      </div>`,
    )
    .join("\n");

  return `
  <div class="rcpt">
    <div class="rcpt-head">
      <img class="rcpt-logo" src="${escapeHtml(data.logoUrl)}" alt="${escapeHtml(data.hotelName)} logo" />
      <h2 class="rcpt-hotel">${escapeHtml(data.hotelName)}</h2>
      <p class="rcpt-doc">Guest Checkout Folio &amp; Receipt</p>
      <p class="rcpt-meta">Ref: ${escapeHtml(data.receiptNo)} &middot; ${escapeHtml(data.checkoutDate)}</p>
    </div>

    <div class="rcpt-grid">
      <div>
        <span class="rcpt-label">Guest Name</span>
        <span class="rcpt-value">${escapeHtml(data.guestName)}</span>
      </div>
      <div>
        <span class="rcpt-label">Room / Category</span>
        <span class="rcpt-value">${escapeHtml(data.roomLabel)}</span>
      </div>
      <div>
        <span class="rcpt-label">Nights Stayed</span>
        <span class="rcpt-value">${escapeHtml(data.nights)} night(s)</span>
      </div>
      <div>
        <span class="rcpt-label">Payment Method</span>
        <span class="rcpt-value">${escapeHtml(data.methodLabel)}</span>
      </div>
    </div>

    <div class="rcpt-lines">
${lines}
      <div class="rcpt-line total">
        <span>Total Bill</span>
        <span>${escapeHtml(peso(data.totalBill))}</span>
      </div>
      <div class="rcpt-line muted">
        <span>Amount Tendered</span>
        <span>${escapeHtml(peso(data.amountPaid))}</span>
      </div>
      ${
        data.showChange
          ? `<div class="rcpt-line credit">
        <span>Change Given</span>
        <span>${escapeHtml(peso(data.change))}</span>
      </div>`
          : ""
      }
    </div>

    <div class="rcpt-foot">
      <div>
        <p>Processed by: ${escapeHtml(data.cashierName)}</p>
        <p>Thank you for staying with ${escapeHtml(data.hotelName)}!</p>
      </div>
      <div><span class="rcpt-stamp paid">PAID</span></div>
    </div>

    <p class="rcpt-sign">Generated ${escapeHtml(data.issuedAt)} &middot; This receipt is computer generated.</p>
  </div>`;
}
