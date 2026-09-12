"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { roomInterface } from "@/app/types/room.type";
import { bookingInterface } from "@/app/types/bookings.type";
import { paymentInterface } from "@/app/types/payment.type";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  TrendingUp,
  CalendarDays,
  BarChart3,
  Printer,
  Building2,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───

interface PopularRoomEntry {
  category: string;
  price: number;
  count: number;
}

interface RevenueReportData {
  month: number;
  year: number;
  totalRevenue: number;
  payments: paymentInterface[];
}

interface PopularRoomReportData {
  month: number;
  year: number;
  popularRooms: PopularRoomEntry[];
}

// ─── Constants ───

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type ReportType = "occupancy" | "revenue" | "reservation" | "popular" | null;

// Helper to trigger browser CSV file download
function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Report Modal Component ───

function ReportModal({
  open,
  onOpenChange,
  title,
  children,
  onPrint,
  onExportCSV,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  onPrint: () => void;
  onExportCSV?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          Official {title} statement and operational breakdown for Florentina Inn
        </DialogDescription>
        {/* Toolbar */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-6 py-3 no-print">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            {onExportCSV && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExportCSV}
                className="gap-1.5 text-xs h-8.5 border-[#618685]/30 text-[#618685] dark:text-[#88afae] hover:bg-[#618685]/10 cursor-pointer"
              >
                <Download className="size-3.5" />
                Export CSV
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onPrint}
              className="gap-1.5 text-xs h-8.5 bg-[#900546] hover:bg-[#720336] text-white border-transparent cursor-pointer"
            >
              <Printer className="size-3.5" />
              Download / Print PDF
            </Button>
          </div>
        </div>
        {/* Report Content */}
        <div id="printable-report-sheet" className="p-6 bg-white dark:bg-[#1A0E13] text-[#130005] dark:text-white">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Paper Report Layout ───

function PaperHeader({ title, month, year }: { title: string; month?: number; year?: number }) {
  const today = new Date();
  return (
    <div className="text-center mb-8">
      {/* Decorative top border */}
      <div className="flex items-center gap-2 mb-4">
        <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-[#900546]/40 to-transparent" />
        <Building2 className="size-5 text-[#900546]" />
        <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-[#900546]/40 to-transparent" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-[#130005] dark:text-white uppercase font-serif">
        {title}
      </h1>
      {month !== undefined && year !== undefined && (
        <p className="text-sm text-[#5C454B] dark:text-gray-300 mt-1 font-medium">
          For the period of {MONTHS[month]} {year}
        </p>
      )}
      <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5">
        Date Generated: {today.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </p>
      {/* Decorative bottom line */}
      <div className="h-px bg-gradient-to-r from-transparent via-[#D9C3C3] to-transparent mt-4" />
    </div>
  );
}

function PaperFooter() {
  return (
    <div className="mt-10 pt-4 border-t border-border print-footer">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <Building2 className="size-3 text-[#900546]" />
          <span>Florentina Inn • Hotel Management System</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Report ID: RPT-{Date.now().toString(36).toUpperCase()}</span>
          <span>Page 1 of 1</span>
        </div>
      </div>
    </div>
  );
}

function PaperTable({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/80">
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

function SignatureSection() {
  return (
    <div className="mt-10 grid grid-cols-2 gap-12">
      <div className="text-center">
        <div className="h-px bg-border mb-1" />
        <p className="text-xs font-medium text-foreground">Prepared By</p>
        <p className="text-[10px] text-muted-foreground">Authorized Signatory</p>
      </div>
      <div className="text-center">
        <div className="h-px bg-border mb-1" />
        <p className="text-xs font-medium text-foreground">Reviewed By</p>
        <p className="text-[10px] text-muted-foreground">Management</p>
      </div>
    </div>
  );
}

// ─── Occupancy Report Content ───

function OccupancyReportContent({ rooms }: { rooms: roomInterface[] }) {
  const total = rooms.length;
  const available = rooms.filter((r) => r.status === "available").length;
  const occupied = rooms.filter((r) => r.status === "occupied").length;
  const maintenanceRooms = rooms.filter((r) => r.status === "maintenance").length;

  return (
    <div className="relative">
      <PaperHeader title="Occupancy Status Report" />

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Rooms", value: total, color: "text-foreground" },
          { label: "Available", value: available, color: "text-emerald-600" },
          { label: "Occupied", value: occupied, color: "text-amber-600" },
          { label: "Maintenance", value: maintenanceRooms, color: "text-red-600" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-border bg-card p-3 text-center"
          >
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
              {item.label}
            </p>
          </div>
        ))}
      </div>

      {/* Occupancy Rate */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Overall Occupancy Rate
          </span>
          <span className="text-lg font-bold">
            {total > 0 ? ((occupied / total) * 100).toFixed(1) : "0.0"}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${total > 0 ? (occupied / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      <PaperTable
        headers={["#", "Room #", "Category", "Price (₱)", "Current Status", "Remarks"]}
      >
        {rooms.map((room, i) => {
          const statusColor =
            room.status === "available"
              ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
              : room.status === "occupied"
              ? "text-amber-600 bg-amber-50 dark:bg-amber-950/30"
              : room.status === "reserved"
              ? "text-violet-600 bg-violet-50 dark:bg-violet-950/30"
              : "text-red-600 bg-red-50 dark:bg-red-950/30";
          return (
            <tr key={room._id} className="hover:bg-muted/30">
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{i + 1}</td>
              <td className="px-4 py-2.5 font-bold text-primary">{room.roomNumber ? `Room ${room.roomNumber}` : "—"}</td>
              <td className="px-4 py-2.5 font-medium">{room.category}</td>
              <td className="px-4 py-2.5 font-mono">₱{room.price.toLocaleString()}</td>
              <td className="px-4 py-2.5">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusColor}`}
                >
                  {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
                </span>
              </td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">
                {room.maintenance || "\u2014"}
              </td>
            </tr>
          );
        })}
      </PaperTable>

      <SignatureSection />
      <PaperFooter />
    </div>
  );
}

// ─── Revenue Report Content ───

function RevenueReportContent({ data }: { data: RevenueReportData }) {
  const { payments, totalRevenue } = data;

  return (
    <div className="relative">
      <PaperHeader title="Monthly Revenue Report" month={data.month} year={data.year} />

      {/* Revenue Summary */}
      <div className="rounded-lg border-2 border-primary/20 bg-primary/[0.02] p-5 mb-6 text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
          Total Revenue for {MONTHS[data.month]} {data.year}
        </p>
        <p className="text-4xl font-bold text-foreground">
          &#x20B1;{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Total Transactions: {payments.length}
        </p>
      </div>

      {payments.length > 0 ? (
        <>
          <PaperTable
            headers={["#", "Date", "Amount (₱)", "Received By", "Reference"]}
          >
            {payments.map((p, i) => (
              <tr key={p._id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-2.5 font-medium">
                  {new Date(p.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="px-4 py-2.5 font-mono font-semibold text-green-600 dark:text-green-400">
                  &#x20B1;{p.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{p.receivedBy}</td>
                <td className="px-4 py-2.5 text-[10px] font-mono text-muted-foreground">
                  {p._id.slice(-8).toUpperCase()}
                </td>
              </tr>
            ))}
          </PaperTable>

          {/* Running Total */}
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Grand Total
              </span>
              <span className="text-lg font-bold">
                &#x20B1;{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <TrendingUp className="size-10 mb-3" />
          <p className="text-sm font-medium">No revenue records found</p>
          <p className="text-xs mt-1">No payments were recorded for this period.</p>
        </div>
      )}

      <SignatureSection />
      <PaperFooter />
    </div>
  );
}

// ─── Reservation Report Content ───

function ReservationReportContent({
  bookings,
  month,
  year,
}: {
  bookings: bookingInterface[];
  month: number;
  year: number;
}) {
  return (
    <div className="relative">
      <PaperHeader title="Reservation Report" month={month} year={year} />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Total Reservations", value: bookings.length },
          { label: "Active", value: bookings.filter((b) => b.status === "active" || b.status === "reservation").length },
          { label: "Completed/Canceled", value: bookings.filter((b) => b.status === "completed" || b.status === "canceled").length },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-border bg-card p-3 text-center"
          >
            <p className="text-2xl font-bold">{item.value}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
              {item.label}
            </p>
          </div>
        ))}
      </div>

      {bookings.length > 0 ? (
        <PaperTable
          headers={["#", "Client Name", "Room", "Arrival Date", "Arrival Time", "Status"]}
        >
          {bookings.map((b, i) => {
            const statusBg =
              b.status === "active" || b.status === "reservation"
                ? "text-blue-600 bg-blue-50 dark:bg-blue-950/30"
                : b.status === "completed"
                ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
                : "text-muted-foreground bg-muted";
            return (
              <tr key={b._id} className="hover:bg-muted/30">
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-2.5 font-medium">{b.clientName}</td>
                <td className="px-4 py-2.5">{b.room?.category || "\u2014"}</td>
                <td className="px-4 py-2.5">
                  {new Date(b.arrivalDate).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{b.arrivalTime}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusBg}`}
                  >
                    {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                  </span>
                </td>
              </tr>
            );
          })}
        </PaperTable>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <CalendarDays className="size-10 mb-3" />
          <p className="text-sm font-medium">No reservations found</p>
          <p className="text-xs mt-1">
            No reservations were recorded for {MONTHS[month]} {year}.
          </p>
        </div>
      )}

      <SignatureSection />
      <PaperFooter />
    </div>
  );
}

// ─── Popular Room Report Content ───

function PopularRoomReportContent({ data }: { data: PopularRoomReportData }) {
  const { popularRooms, month, year } = data;
  const maxCount = popularRooms.length > 0 ? popularRooms[0].count : 0;

  return (
    <div className="relative">
      <PaperHeader title="Popular Room Report" month={month} year={year} />

      {/* Summary */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 mb-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground text-center mb-1">
          Most Booked Room
        </p>
        {popularRooms.length > 0 ? (
          <p className="text-2xl font-bold text-center">
            {popularRooms[0].category}
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({popularRooms[0].count} bookings)
            </span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground text-center">No data available</p>
        )}
      </div>

      {popularRooms.length > 0 ? (
        <>
          <PaperTable
            headers={["Rank", "Room Category", "Price (₱)", "Total Bookings", "Popularity"]}
          >
            {popularRooms.map((room, i) => {
              const percentage = maxCount > 0 ? (room.count / maxCount) * 100 : 0;
              const barColor =
                i === 0
                  ? "bg-amber-500"
                  : i === 1
                  ? "bg-slate-400"
                  : i === 2
                  ? "bg-orange-600"
                  : "bg-primary/40";
              const rankIcon =
                i === 0 ? "\uD83E\uDD47" : i === 1 ? "\uD83E\uDD48" : i === 2 ? "\uD83E\uDD49" : `#${i + 1}`;
              return (
                <tr key={room.category} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 text-xs">{rankIcon}</td>
                  <td className="px-4 py-2.5 font-medium">{room.category}</td>
                  <td className="px-4 py-2.5 font-mono">&#x20B1;{room.price.toLocaleString()}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-bold text-lg">{room.count}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden max-w-[120px]">
                        <div
                          className={`h-full rounded-full ${barColor} transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-8 text-right">
                        {percentage.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </PaperTable>

          {/* Additional Summary */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Total Unique Rooms Booked
              </p>
              <p className="text-xl font-bold mt-1">{popularRooms.length}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Total Bookings This Period
              </p>
              <p className="text-xl font-bold mt-1">
                {popularRooms.reduce((sum, r) => sum + r.count, 0)}
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <BarChart3 className="size-10 mb-3" />
          <p className="text-sm font-medium">No booking data found</p>
          <p className="text-xs mt-1">
            No bookings were recorded for {MONTHS[month]} {year}.
          </p>
        </div>
      )}

      <SignatureSection />
      <PaperFooter />
    </div>
  );
}

// ─── Print utility — silent in-page iframe print renderer (no tabs/popups) ───

function printReport() {
  const elem = document.getElementById("printable-report-sheet");
  if (!elem) {
    window.print();
    return;
  }

  // Create or reuse hidden iframe
  let printIframe = document.getElementById("hidden-print-iframe") as HTMLIFrameElement;
  if (!printIframe) {
    printIframe = document.createElement("iframe");
    printIframe.id = "hidden-print-iframe";
    printIframe.style.position = "fixed";
    printIframe.style.top = "0";
    printIframe.style.left = "0";
    printIframe.style.width = "0";
    printIframe.style.height = "0";
    printIframe.style.border = "none";
    printIframe.style.visibility = "hidden";
    printIframe.style.zIndex = "-999";
    document.body.appendChild(printIframe);
  }

  const iframeDoc = printIframe.contentDocument || printIframe.contentWindow?.document;
  if (!iframeDoc) {
    window.print();
    return;
  }

  iframeDoc.open();
  iframeDoc.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Florentina Inn - Official Report</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            color: #111827;
          }
          body {
            background-color: #ffffff;
            color: #111827;
            padding: 12px;
          }
          h1, h2, h3 {
            font-family: Georgia, serif;
            color: #111827;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 14px;
            margin-bottom: 20px;
            font-size: 11px;
          }
          th {
            background-color: #f3f4f6 !important;
            color: #374151 !important;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.05em;
            padding: 9px 12px;
            border: 1px solid #e5e7eb;
            text-align: left;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          td {
            padding: 9px 12px;
            border: 1px solid #e5e7eb;
            font-size: 11px;
            color: #1f2937;
          }
          tr:nth-child(even) td {
            background-color: #f9fafb !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .grid {
            display: grid;
          }
          .grid-cols-2 { grid-template-columns: repeat(2, 1fr); gap: 14px; }
          .grid-cols-3 { grid-template-columns: repeat(3, 1fr); gap: 12px; }
          .grid-cols-4 { grid-template-columns: repeat(4, 1fr); gap: 10px; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: 700; }
          .font-semibold { font-weight: 600; }
          .font-medium { font-weight: 500; }
          .font-mono { font-family: monospace; }
          .uppercase { text-transform: uppercase; }
          .text-sm { font-size: 13px; }
          .text-xs { font-size: 11px; }
          .text-2xl { font-size: 22px; }
          .text-4xl { font-size: 30px; }
          .rounded-lg { border-radius: 8px; }
          .border { border: 1px solid #e5e7eb; }
          .border-2 { border: 2px solid #900546; }
          .p-3 { padding: 10px; }
          .p-4 { padding: 14px; }
          .p-5 { padding: 18px; }
          .mb-1 { margin-bottom: 4px; }
          .mb-2 { margin-bottom: 8px; }
          .mb-4 { margin-bottom: 14px; }
          .mb-6 { margin-bottom: 20px; }
          .mb-8 { margin-bottom: 28px; }
          .mt-0\\.5 { margin-top: 2px; }
          .mt-1 { margin-top: 4px; }
          .mt-2 { margin-top: 8px; }
          .mt-4 { margin-top: 14px; }
          .mt-10 { margin-top: 36px; }
          .pt-4 { padding-top: 14px; }
          .border-t { border-top: 1px solid #e5e7eb; }
          .text-emerald-600 { color: #059669 !important; }
          .text-amber-600 { color: #d97706 !important; }
          .text-red-600 { color: #dc2626 !important; }
          .text-green-600 { color: #16a34a !important; }
          .text-primary { color: #900546 !important; }
          .text-muted-foreground { color: #6b7280 !important; }
          .bg-muted\\/30 { background-color: #f9fafb !important; }
          .flex { display: flex; }
          .items-center { align-items: center; }
          .justify-between { justify-content: space-between; }
          .no-print { display: none !important; }
        </style>
      </head>
      <body>
        ${elem.innerHTML}
      </body>
    </html>
  `);
  iframeDoc.close();

  setTimeout(() => {
    printIframe.contentWindow?.focus();
    printIframe.contentWindow?.print();
  }, 200);
}

// ─── Main Page ───

export default function Page() {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [activeReport, setActiveReport] = useState<ReportType>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const reportYears = Array.from({ length: 7 }, (_, i) => currentYear - 6 + i);

  // ── Fetch all rooms (for occupancy) ──
  const {
    data: rooms,
    isLoading: roomsLoading,
  } = useQuery<roomInterface[]>({
    queryKey: ["rooms"],
    queryFn: async () => {
      const res = await axiosInstance.get("/room");
      return res.data;
    },
  });

  // ── Fetch payments (for revenue report) ──
  const {
    data: revenueData,
    isLoading: revenueLoading,
  } = useQuery<RevenueReportData>({
    queryKey: ["report-revenue", selectedMonth, selectedYear],
    queryFn: async () => {
      const res = await axiosInstance.get(
        `/reports/revenue?month=${selectedMonth}&year=${selectedYear}`
      );
      return res.data;
    },
    enabled: activeReport === "revenue",
  });

  // ── Fetch reservations (for reservation report) ──
  const {
    data: reservations,
    isLoading: reservationLoading,
  } = useQuery<bookingInterface[]>({
    queryKey: ["report-reservations", selectedMonth, selectedYear],
    queryFn: async () => {
      const res = await axiosInstance.get(
        `/reports/reservations?month=${selectedMonth}&year=${selectedYear}`
      );
      return res.data;
    },
    enabled: activeReport === "reservation",
  });

  // ── Fetch popular rooms ──
  const {
    data: popularData,
    isLoading: popularLoading,
  } = useQuery<PopularRoomReportData>({
    queryKey: ["report-popular", selectedMonth, selectedYear],
    queryFn: async () => {
      const res = await axiosInstance.get(
        `/reports/popular-rooms?month=${selectedMonth}&year=${selectedYear}`
      );
      return res.data;
    },
    enabled: activeReport === "popular",
  });

  // ── Open report handler ──
  const openReport = useCallback((type: ReportType) => {
    setActiveReport(type);
    setReportOpen(true);
  }, []);

  // ── Close handler ──
  const closeReport = useCallback(() => {
    setReportOpen(false);
    setActiveReport(null);
  }, []);

  // ── Print handler ──
  const handlePrint = useCallback(() => {
    printReport();
  }, []);

  // ── CSV Export Handlers ──
  const handleExportOccupancyCSV = useCallback(() => {
    if (!rooms || rooms.length === 0) {
      toast.error("No room inventory data available to export.");
      return;
    }
    const total = rooms.length;
    const available = rooms.filter((r) => r.status === "available").length;
    const occupied = rooms.filter((r) => r.status === "occupied").length;
    const maintenance = rooms.filter((r) => r.status === "maintenance").length;
    const occupancyRate = total > 0 ? ((occupied / total) * 100).toFixed(1) : "0.0";

    const summaryRows = [
      `"FLORENTINA INN - OCCUPANCY STATUS REPORT"`,
      `"Generated Date","${new Date().toLocaleDateString("en-PH")}"`,
      `"Total Rooms",${total}`,
      `"Available",${available}`,
      `"Occupied",${occupied}`,
      `"Maintenance",${maintenance}`,
      `"Occupancy Rate","${occupancyRate}%"`,
      `""`,
      `"#","Room Number","Suite Category","Nightly Rate (PHP)","Current Status","Maintenance Remarks"`,
    ];

    const dataRows = rooms.map((r, i) => {
      const roomNo = r.roomNumber ? `"${r.roomNumber}"` : `""`;
      const cat = `"${(r.category || "").replace(/"/g, '""')}"`;
      const price = Number(r.price || 0).toFixed(2);
      const status = `"${r.status || ""}"`;
      const remarks = `"${(r.maintenance || "None").replace(/"/g, '""')}"`;
      return `${i + 1},${roomNo},${cat},${price},${status},${remarks}`;
    });

    const csv = [...summaryRows, ...dataRows].join("\r\n");
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCSV(`Florentina_Inn_Occupancy_${dateStr}.csv`, csv);
    toast.success("Occupancy report exported to CSV successfully.");
  }, [rooms]);

  const handleExportRevenueCSV = useCallback(() => {
    if (!revenueData || !revenueData.payments || revenueData.payments.length === 0) {
      toast.error("No revenue transactions recorded for this month.");
      return;
    }
    const { payments, totalRevenue, month, year } = revenueData;
    const monthName = MONTHS[month];

    const summaryRows = [
      `"FLORENTINA INN - MONTHLY REVENUE REPORT"`,
      `"Period","${monthName} ${year}"`,
      `"Total Revenue (PHP)",${Number(totalRevenue || 0).toFixed(2)}`,
      `"Total Transactions",${payments.length}`,
      `""`,
      `"#","Transaction Date","Reference No.","Payment Channel / Received By","Amount (PHP)"`,
    ];

    const dataRows = payments.map((p, i) => {
      const pDate = p.date ? new Date(p.date) : new Date();
      const dateStr = !isNaN(pDate.getTime()) ? pDate.toLocaleDateString("en-PH") : "";
      const ref = `"${(p.refNumber || p._id || "").slice(-8).toUpperCase()}"`;
      const channel = `"${(p.receivedBy || "Front Desk").replace(/"/g, '""')}"`;
      const amt = Number(p.amount || 0).toFixed(2);
      return `${i + 1},"${dateStr}",${ref},${channel},${amt}`;
    });

    const csv = [...summaryRows, ...dataRows].join("\r\n");
    downloadCSV(`Florentina_Inn_Revenue_${monthName}_${year}.csv`, csv);
    toast.success("Revenue report exported to CSV successfully.");
  }, [revenueData]);

  const handleExportReservationCSV = useCallback(() => {
    if (!reservations || reservations.length === 0) {
      toast.error("No reservations recorded for this month.");
      return;
    }
    const monthName = MONTHS[selectedMonth];
    const summaryRows = [
      `"FLORENTINA INN - RESERVATION LEDGER"`,
      `"Period","${monthName} ${selectedYear}"`,
      `"Total Reservations",${reservations.length}`,
      `""`,
      `"#","Booking ID","Guest Name","Client Address","Suite Category","Arrival Date","Arrival Time","Booking Status"`,
    ];

    const dataRows = reservations.map((b, i) => {
      const id = `"${(b._id || "").slice(-8).toUpperCase()}"`;
      const name = `"${(b.clientName || "Guest").replace(/"/g, '""')}"`;
      const addr = `"${(b.clientAddress || "").replace(/"/g, '""')}"`;
      const cat = `"${(b.room?.category || "Room").replace(/"/g, '""')}"`;
      const arrDate = b.arrivalDate ? new Date(b.arrivalDate).toLocaleDateString("en-PH") : "";
      const arrTime = `"${b.arrivalTime || ""}"`;
      const status = `"${b.status || ""}"`;
      return `${i + 1},${id},${name},${addr},${cat},"${arrDate}",${arrTime},${status}`;
    });

    const csv = [...summaryRows, ...dataRows].join("\r\n");
    downloadCSV(`Florentina_Inn_Reservations_${monthName}_${selectedYear}.csv`, csv);
    toast.success("Reservation ledger exported to CSV successfully.");
  }, [reservations, selectedMonth, selectedYear]);

  const handleExportPopularRoomsCSV = useCallback(() => {
    if (!popularData || !popularData.popularRooms || popularData.popularRooms.length === 0) {
      toast.error("No popular rooms data available for this month.");
      return;
    }
    const { popularRooms, month, year } = popularData;
    const monthName = MONTHS[month];
    const totalBookings = popularRooms.reduce((sum, r) => sum + r.count, 0);

    const summaryRows = [
      `"FLORENTINA INN - POPULAR SUITES REPORT"`,
      `"Period","${monthName} ${year}"`,
      `"Total Bookings Analyzed",${totalBookings}`,
      `""`,
      `"Rank","Suite Category","Nightly Rate (PHP)","Total Bookings Recorded","Share of Total (%)"`,
    ];

    const dataRows = popularRooms.map((r, i) => {
      const rank = i + 1;
      const cat = `"${(r.category || "").replace(/"/g, '""')}"`;
      const price = Number(r.price || 0).toFixed(2);
      const count = r.count;
      const share = totalBookings > 0 ? ((r.count / totalBookings) * 100).toFixed(1) : "0.0";
      return `${rank},${cat},${price},${count},"${share}%"`;
    });

    const csv = [...summaryRows, ...dataRows].join("\r\n");
    downloadCSV(`Florentina_Inn_Popular_Suites_${monthName}_${year}.csv`, csv);
    toast.success("Popular rooms report exported to CSV successfully.");
  }, [popularData]);

  // ── Report type config ──
  const reportButtons: {
    type: ReportType;
    label: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      type: "occupancy",
      label: "Occupancy Report",
      description: "View all rooms and their current status in real-time",
      icon: <Building2 className="size-6" />,
    },
    {
      type: "revenue",
      label: "Revenue Report",
      description: "Monthly revenue breakdown with payment history",
      icon: <TrendingUp className="size-6" />,
    },
    {
      type: "reservation",
      label: "Reservation Report",
      description: "All reservations for the selected month with guest details",
      icon: <CalendarDays className="size-6" />,
    },
    {
      type: "popular",
      label: "Popular Room Report",
      description: "Most booked rooms ranked from highest to lowest",
      icon: <BarChart3 className="size-6" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Print/PDF styles — perfectly renders printable-report-sheet when printing */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-report-sheet,
          #printable-report-sheet * {
            visibility: visible !important;
          }
          #printable-report-sheet {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 24px 30px !important;
            background: #ffffff !important;
            color: #111827 !important;
            box-shadow: none !important;
            border: none !important;
            overflow: visible !important;
            z-index: 999999 !important;
          }
          #printable-report-sheet table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          #printable-report-sheet th,
          #printable-report-sheet td {
            color: #111827 !important;
            border-color: #e5e7eb !important;
          }
          #printable-report-sheet thead tr {
            background-color: #f3f4f6 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print,
          button[data-slot="dialog-close"],
          [data-slot="dialog-overlay"] {
            display: none !important;
          }
          @page {
            margin: 12mm;
            size: A4 portrait;
          }
        }
      `}</style>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3 py-1 text-xs font-semibold text-[#900546] dark:text-[#F968AC] mb-2">
            Audit & Statements
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#130005] dark:text-white">
            Financial & Operational Reports
          </h1>
          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5">
            Generate, preview, and print official audited business reports or export raw CSV ledgers.
          </p>
        </div>
        {/* Month & Year Selectors */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[#5C454B] dark:text-gray-400 font-semibold">Select Month:</span>
          <Select
            value={String(selectedMonth)}
            onValueChange={(val) => setSelectedMonth(Number(val))}
          >
            <SelectTrigger className="w-[180px] h-10 rounded-xl bg-white dark:bg-[#1A0E13] border-[#D9C3C3] dark:border-white/10 text-xs font-semibold text-[#130005] dark:text-white">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13]">
              {MONTHS.map((name, idx) => (
                <SelectItem key={idx} value={String(idx)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-xs text-[#5C454B] dark:text-gray-400 font-semibold">Select Year:</span>
          <Select
            value={String(selectedYear)}
            onValueChange={(val) => setSelectedYear(Number(val))}
          >
            <SelectTrigger className="w-[110px] h-10 rounded-xl bg-white dark:bg-[#1A0E13] border-[#D9C3C3] dark:border-white/10 text-xs font-semibold text-[#130005] dark:text-white">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13]">
              {reportYears.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Report Type Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {reportButtons.map((btn) => (
          <button
            key={btn.type}
            onClick={() => openReport(btn.type)}
            className="group flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5 text-left transition-all duration-200 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 active:scale-[0.98] cursor-pointer"
          >
            <div className="flex items-center gap-3 w-full">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/20 transition-all duration-200">
                {btn.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm group-hover:text-primary transition-colors">
                  {btn.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {btn.description}
                </p>
              </div>
              <FileText className="size-4 text-muted-foreground/40 group-hover:text-primary/60 transition-colors shrink-0" />
            </div>
            <div className="w-full flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider">
                {MONTHS[selectedMonth]} {selectedYear}
              </span>
              <span className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Generate &rarr;
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Info Card */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Official Document & Raw Data Export</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              All reports are formatted as official business documents suitable for printing,
              record-keeping, and presentation. Use the <strong>Export CSV</strong> button to download spreadsheet data, or <strong>Download / Print PDF</strong> to save as a document.
            </p>
          </div>
        </div>
      </div>

      {/* ─── Active Report Modal ─── */}

      {/* Occupancy Report Modal */}
      <ReportModal
        open={reportOpen && activeReport === "occupancy"}
        onOpenChange={closeReport}
        title="Occupancy Status Report"
        onPrint={handlePrint}
        onExportCSV={handleExportOccupancyCSV}
      >
        {roomsLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-1/3 mx-auto" />
            <Skeleton className="h-4 w-1/2 mx-auto" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : rooms ? (
          <OccupancyReportContent rooms={rooms} />
        ) : (
          <p className="text-center text-muted-foreground py-8">Failed to load occupancy data.</p>
        )}
      </ReportModal>

      {/* Revenue Report Modal */}
      <ReportModal
        open={reportOpen && activeReport === "revenue"}
        onOpenChange={closeReport}
        title="Monthly Revenue Report"
        onPrint={handlePrint}
        onExportCSV={handleExportRevenueCSV}
      >
        {revenueLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-1/3 mx-auto" />
            <Skeleton className="h-4 w-1/2 mx-auto" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : revenueData ? (
          <RevenueReportContent data={revenueData} />
        ) : (
          <p className="text-center text-muted-foreground py-8">Failed to load revenue data.</p>
        )}
      </ReportModal>

      {/* Reservation Report Modal */}
      <ReportModal
        open={reportOpen && activeReport === "reservation"}
        onOpenChange={closeReport}
        title="Reservation Report"
        onPrint={handlePrint}
        onExportCSV={handleExportReservationCSV}
      >
        {reservationLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-1/3 mx-auto" />
            <Skeleton className="h-4 w-1/2 mx-auto" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : reservations ? (
          <ReservationReportContent
            bookings={reservations}
            month={selectedMonth}
            year={selectedYear}
          />
        ) : (
          <p className="text-center text-muted-foreground py-8">Failed to load reservation data.</p>
        )}
      </ReportModal>

      {/* Popular Room Report Modal */}
      <ReportModal
        open={reportOpen && activeReport === "popular"}
        onOpenChange={closeReport}
        title="Popular Room Report"
        onPrint={handlePrint}
        onExportCSV={handleExportPopularRoomsCSV}
      >
        {popularLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-1/3 mx-auto" />
            <Skeleton className="h-4 w-1/2 mx-auto" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : popularData ? (
          <PopularRoomReportContent data={popularData} />
        ) : (
          <p className="text-center text-muted-foreground py-8">Failed to load popular room data.</p>
        )}
      </ReportModal>
    </div>
  );
}
