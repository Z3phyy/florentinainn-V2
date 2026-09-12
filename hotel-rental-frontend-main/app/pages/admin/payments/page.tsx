"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { paymentInterface } from "@/app/types/payment.type";
import { systemInterface } from "@/app/types/system.type";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Receipt,
  AlertCircle,
  Search,
  Calendar,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Banknote,
  Smartphone,
  Globe,
  Building2,
  TrendingUp,
  CreditCard,
  Printer,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { downloadCSV, downloadPDF, getExportTimestamp } from "@/app/utils/exportFile";

type DatePreset = "all" | "today" | "week" | "month" | "custom";
type SortOption = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";
type PaymentMethodFilter = "all" | "cash" | "gcash" | "online";

// Determine payment method and format standard badge
function resolvePaymentMethod(p: paymentInterface): {
  type: "cash" | "gcash" | "online";
  label: string;
} {
  const methodStr = (p.method || "").toLowerCase();
  const receivedBy = (p.receivedBy || "").toLowerCase();
  const paymentBy = (p.paymentBy || "").toLowerCase();

  if (methodStr.includes("gcash") || paymentBy.includes("gcash") || receivedBy.includes("gcash")) {
    return { type: "gcash", label: "GCash" };
  }
  if (methodStr.includes("online") || receivedBy.includes("online payment") || methodStr.includes("card")) {
    return { type: "online", label: "Online Payment" };
  }
  return { type: "cash", label: "Cash" };
}

function formatDate(dateStr: string) {
  if (!dateStr) return "\u2014";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(amount: number) {
  return `₱${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function Page() {
  const { data: payments = [], isLoading, isError } = useQuery<paymentInterface[]>({
    queryKey: ["payments"],
    queryFn: async () => {
      const res = await axiosInstance.get("/system/payments");
      return res.data || [];
    },
  });

  const { data: systemInfo } = useQuery<systemInterface>({
    queryKey: ["systeminfo"],
    queryFn: async () => {
      const res = await axiosInstance.get("/system");
      return res.data;
    },
  });

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [methodFilter, setMethodFilter] = useState<PaymentMethodFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("date-desc");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selected Payment for Receipt Modal
  const [selectedPayment, setSelectedPayment] = useState<paymentInterface | null>(null);

  // Filtered & Sorted Payments
  const filteredPayments = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // One week ago timestamp
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(now.getDate() - 7);

    // First day of current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return payments
      .filter((p) => {
        // 1. Search Query (Guest Name, Cashier, Reference ID, or Ref Number)
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const matchesGuest = p.paymentBy?.toLowerCase().includes(query);
          const matchesCashier = p.receivedBy?.toLowerCase().includes(query);
          const matchesId = p._id?.toLowerCase().includes(query);
          const matchesRef = p.refNumber?.toLowerCase().includes(query);
          const matchesFolio = p.folio?.toLowerCase().includes(query);
          if (!matchesGuest && !matchesCashier && !matchesId && !matchesRef && !matchesFolio) return false;
        }

        // 2. Method Filter
        if (methodFilter !== "all") {
          const resolved = resolvePaymentMethod(p);
          if (resolved.type !== methodFilter) return false;
        }

        // 3. Date Presets & Custom Range
        const paymentDate = new Date(p.date);
        if (isNaN(paymentDate.getTime())) return true;

        const pDateStr = p.date.split("T")[0];

        if (datePreset === "today") {
          if (pDateStr !== todayStr) return false;
        } else if (datePreset === "week") {
          if (paymentDate < oneWeekAgo) return false;
        } else if (datePreset === "month") {
          if (paymentDate < startOfMonth) return false;
        } else if (datePreset === "custom") {
          if (startDate && pDateStr < startDate) return false;
          if (endDate && pDateStr > endDate) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Sorting
        if (sortBy === "date-desc") {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
        if (sortBy === "date-asc") {
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        }
        if (sortBy === "amount-desc") {
          return b.amount - a.amount;
        }
        if (sortBy === "amount-asc") {
          return a.amount - b.amount;
        }
        return 0;
      });
  }, [payments, searchQuery, methodFilter, datePreset, sortBy, startDate, endDate]);

  // Method Counts for Breakdown Chips
  const methodCounts = useMemo(() => {
    let cash = 0;
    let gcash = 0;
    let online = 0;

    payments.forEach((p) => {
      const { type } = resolvePaymentMethod(p);
      if (type === "cash") cash++;
      else if (type === "gcash") gcash++;
      else if (type === "online") online++;
    });

    return {
      all: payments.length,
      cash,
      gcash,
      online,
    };
  }, [payments]);

  // KPI Metrics (Calculated on current filtered dataset)
  const metrics = useMemo(() => {
    const totalRevenue = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const count = filteredPayments.length;
    const avgTicket = count > 0 ? totalRevenue / count : 0;

    return {
      totalRevenue,
      count,
      avgTicket,
    };
  }, [filteredPayments]);

  // Pagination Calculations
  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredPayments.length);
  const paginatedPayments = filteredPayments.slice(startIndex, endIndex);

  const resetFilters = () => {
    setSearchQuery("");
    setDatePreset("all");
    setMethodFilter("all");
    setSortBy("date-desc");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };

  const buildExportRows = () => {
    return filteredPayments.map((p) => {
      const resolved = resolvePaymentMethod(p);
      const paymentDate = p.date ? new Date(p.date) : new Date();
      const dateOnly = !isNaN(paymentDate.getTime())
        ? paymentDate.toLocaleDateString("en-PH", { year: "numeric", month: "2-digit", day: "2-digit" })
        : "";
      const timeOnly = !isNaN(paymentDate.getTime())
        ? paymentDate.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })
        : "";

      const refNo = p.refNumber || `RCP-${p._id.slice(-8).toUpperCase()}`;
      const folioNo = p.folio || "";
      const guest = p.paymentBy || "Guest";
      const channel = resolved.label;
      const cashier = p.receivedBy || "Front Desk";
      const amount = Number(p.amount || 0).toFixed(2);
      const balance = Number(p.balance || 0).toFixed(2);

      return [refNo, folioNo, dateOnly, timeOnly, guest, channel, cashier, amount, balance];
    });
  };

  const exportHeaders = [
    "Receipt / Ref No.",
    "Folio No.",
    "Date",
    "Time",
    "Guest Name",
    "Payment Channel",
    "Received By / Cashier",
    "Amount (PHP)",
    "Balance (PHP)",
  ];

  const exportToCSV = () => {
    if (!filteredPayments || filteredPayments.length === 0) {
      toast.error("No payment records to export.");
      return;
    }
    downloadCSV(`Florentina_Inn_Payments_${getExportTimestamp()}.csv`, exportHeaders, buildExportRows());
    toast.success(`Exported ${filteredPayments.length} transaction records to CSV.`);
  };

  const exportToPDF = () => {
    if (!filteredPayments || filteredPayments.length === 0) {
      toast.error("No payment records to export.");
      return;
    }
    const total = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    downloadPDF({
      filename: `Florentina_Inn_Payments_${getExportTimestamp()}.pdf`,
      title: `${systemInfo?.systemName || "Florentina Inn"} - Payment Records`,
      subtitle: `${filteredPayments.length} transaction(s) - Total: PHP ${total.toFixed(2)}`,
      headers: exportHeaders,
      rows: buildExportRows(),
    });
    toast.success(`Exported ${filteredPayments.length} transaction records to PDF.`);
  };

  const hasActiveFilters =
    searchQuery !== "" ||
    datePreset !== "all" ||
    methodFilter !== "all" ||
    sortBy !== "date-desc" ||
    startDate !== "" ||
    endDate !== "";

  return (
    <div className="space-y-6">
      {/* Print Styles for Official Receipt Modal */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-payment-receipt,
          #printable-payment-receipt * {
            visibility: visible !important;
          }
          #printable-payment-receipt {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 30px !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3 py-1 text-xs font-semibold text-[#900546] dark:text-[#F968AC] mb-2">
            Ledger & Receipts
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#130005] dark:text-white">
            Payment Records & Folio
          </h1>
          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5">
            Audit transactions, filter payment channels, and generate printable guest receipts or export raw CSV ledgers.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="gap-1.5 text-xs h-9"
            >
              <X className="size-3.5" />
              <span>Reset Filters</span>
            </Button>
          )}

          <Button
            onClick={exportToCSV}
            disabled={filteredPayments.length === 0}
            className="gap-2 text-xs h-9 bg-[#900546] hover:bg-[#720336] text-white shadow-xs rounded-xl cursor-pointer"
          >
            <Download className="size-3.5" />
            <span>Export CSV</span>
          </Button>

          <Button
            onClick={exportToPDF}
            disabled={filteredPayments.length === 0}
            variant="outline"
            className="gap-2 text-xs h-9 rounded-xl cursor-pointer border-[#618685]/30 text-[#618685] hover:bg-[#618685]/10"
          >
            <FileSpreadsheet className="size-3.5" />
            <span>Export PDF</span>
          </Button>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Revenue
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">
            {formatCurrency(metrics.totalRevenue)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Across {metrics.count} recorded transaction{metrics.count !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Transactions
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <CreditCard className="size-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{metrics.count}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Matching current active filters
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Average Ticket
            </span>
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Banknote className="size-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">
            {formatCurrency(metrics.avgTicket)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">Average transaction spend</p>
        </div>
      </div>

      {/* ── Toolbar: Search, Date Presets, Method Chips, Sort ── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4 shadow-xs">
        {/* Search & Sort Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Multi-field Search */}
          <div className="md:col-span-8 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by Guest Name, Cashier / Staff, Reference No., or Payment ID..."
              className="pl-10 pr-9 h-10 text-xs bg-muted/30 border-border focus:bg-background rounded-lg"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="md:col-span-4">
            <Select
              value={sortBy}
              onValueChange={(val: SortOption) => {
                setSortBy(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-10 text-xs bg-muted/30 border-border">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="size-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Sort by" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Newest Date First</SelectItem>
                <SelectItem value="date-asc">Oldest Date First</SelectItem>
                <SelectItem value="amount-desc">Highest Amount (₱)</SelectItem>
                <SelectItem value="amount-asc">Lowest Amount (₱)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Date Filter Tabs & Custom Inputs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border/60">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground mr-1 flex items-center gap-1">
              <Calendar className="size-3" />
              Date:
            </span>
            {(
              [
                { id: "all", label: "All Time" },
                { id: "today", label: "Today" },
                { id: "week", label: "This Week" },
                { id: "month", label: "This Month" },
                { id: "custom", label: "Custom Range" },
              ] as { id: DatePreset; label: string }[]
            ).map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  setDatePreset(preset.id);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  datePreset === preset.id
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          {datePreset === "custom" && (
            <div className="flex items-center gap-2 animate-in fade-in duration-200">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 text-xs w-[130px] bg-muted/30"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 text-xs w-[130px] bg-muted/30"
              />
            </div>
          )}
        </div>

        {/* Payment Method Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
          <span className="text-[11px] font-semibold text-muted-foreground mr-1">Method:</span>

          <button
            onClick={() => {
              setMethodFilter("all");
              setCurrentPage(1);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border ${
              methodFilter === "all"
                ? "bg-primary/10 text-primary border-primary/30 font-semibold"
                : "border-border/60 bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>All Methods</span>
            <span className="text-[10px] opacity-70">({methodCounts.all})</span>
          </button>

          <button
            onClick={() => {
              setMethodFilter("cash");
              setCurrentPage(1);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border ${
              methodFilter === "cash"
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold"
                : "border-border/60 bg-card text-muted-foreground hover:text-emerald-600"
            }`}
          >
            <Banknote className="size-3 text-emerald-600" />
            <span>Cash</span>
            <span className="text-[10px] opacity-70">({methodCounts.cash})</span>
          </button>

          <button
            onClick={() => {
              setMethodFilter("gcash");
              setCurrentPage(1);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border ${
              methodFilter === "gcash"
                ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 font-semibold"
                : "border-border/60 bg-card text-muted-foreground hover:text-blue-600"
            }`}
          >
            <Smartphone className="size-3 text-blue-600" />
            <span>GCash</span>
            <span className="text-[10px] opacity-70">({methodCounts.gcash})</span>
          </button>

          <button
            onClick={() => {
              setMethodFilter("online");
              setCurrentPage(1);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border ${
              methodFilter === "online"
                ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 font-semibold"
                : "border-border/60 bg-card text-muted-foreground hover:text-purple-600"
            }`}
          >
            <Globe className="size-3 text-purple-600" />
            <span>Online Payment</span>
            <span className="text-[10px] opacity-70">({methodCounts.online})</span>
          </button>
        </div>
      </div>

      {/* ── Content States ── */}
      {isLoading && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground rounded-xl border border-border bg-card">
          <AlertCircle className="size-12 mb-3 text-destructive" />
          <h3 className="text-base font-semibold text-foreground">Failed to load payments</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Could not fetch payment records. Please try again.
          </p>
        </div>
      )}

      {!isLoading && !isError && payments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground rounded-xl border border-border bg-card text-center">
          <div className="size-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-3">
            <Receipt className="size-7 text-muted-foreground/60" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No payments recorded yet</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
            Payments will appear automatically when guests reserve or check in.
          </p>
        </div>
      )}

      {!isLoading && !isError && payments.length > 0 && filteredPayments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground rounded-xl border border-border bg-card text-center">
          <div className="size-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
            <Search className="size-6 text-muted-foreground/60" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No matching payments found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-[300px]">
            Try adjusting your search keywords, payment method, or date range filters.
          </p>
          <Button variant="outline" size="sm" onClick={resetFilters} className="mt-4 text-xs">
            Clear Filters
          </Button>
        </div>
      )}

      {/* ── Payments Table ── */}
      {!isLoading && !isError && filteredPayments.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[120px] text-xs font-semibold uppercase tracking-wider">
                    Date
                  </TableHead>
                  <TableHead className="w-[150px] text-xs font-semibold uppercase tracking-wider">
                    Reference No.
                  </TableHead>
                  <TableHead className="w-[110px] text-xs font-semibold uppercase tracking-wider">
                    Folio
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">
                    Guest (Payment By)
                  </TableHead>
                  <TableHead className="w-[150px] text-xs font-semibold uppercase tracking-wider">
                    Method
                  </TableHead>
                  <TableHead className="w-[150px] text-xs font-semibold uppercase tracking-wider">
                    Received By
                  </TableHead>
                  <TableHead className="w-[130px] text-right text-xs font-semibold uppercase tracking-wider">
                    Amount
                  </TableHead>
                  <TableHead className="w-[130px] text-right text-xs font-semibold uppercase tracking-wider">
                    Balance
                  </TableHead>
                  <TableHead className="w-[120px] text-center text-xs font-semibold uppercase tracking-wider">
                    Receipt
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/60">
                {paginatedPayments.map((payment) => {
                  const resolvedMethod = resolvePaymentMethod(payment);
                  const displayRef =
                    payment.refNumber || `RCP-${payment._id.slice(-6).toUpperCase()}`;

                  return (
                    <TableRow
                      key={payment._id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {/* Date */}
                      <TableCell className="text-xs font-medium whitespace-nowrap">
                        {formatDate(payment.date)}
                      </TableCell>

                      {/* Reference No. */}
                      <TableCell className="text-[11px] font-mono text-muted-foreground whitespace-nowrap font-semibold">
                        {displayRef}
                      </TableCell>

                      {/* Folio */}
                      <TableCell className="text-[11px] font-mono text-muted-foreground whitespace-nowrap font-semibold">
                        {payment.folio || "—"}
                      </TableCell>

                      {/* Guest Name */}
                      <TableCell>
                        <span className="text-xs font-semibold text-foreground">
                          {payment.paymentBy || "Guest"}
                        </span>
                      </TableCell>

                      {/* Method Badge */}
                      <TableCell>
                        {resolvedMethod.type === "cash" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <Banknote className="size-3 shrink-0" />
                            <span>Cash</span>
                          </span>
                        )}

                        {resolvedMethod.type === "gcash" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            <Smartphone className="size-3 shrink-0" />
                            <span>GCash</span>
                          </span>
                        )}

                        {resolvedMethod.type === "online" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                            <Globe className="size-3 shrink-0" />
                            <span>Online</span>
                          </span>
                        )}
                      </TableCell>

                      {/* Cashier / Received By */}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {payment.receivedBy || "Front Desk"}
                      </TableCell>

                      {/* Amount */}
                      <TableCell className="text-right">
                        <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(payment.amount)}
                        </span>
                      </TableCell>

                      {/* Balance */}
                      <TableCell className="text-right">
                        {Number(payment.balance || 0) > 0 ? (
                          <span className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
                            {formatCurrency(Number(payment.balance || 0))}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Print Receipt Action Button */}
                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedPayment(payment)}
                          className="h-7 px-2 text-[11px] gap-1 font-medium hover:text-primary hover:border-primary/40 shadow-none"
                          title="View & Print Official Receipt"
                        >
                          <Printer className="size-3 text-primary" />
                          <span>Receipt</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* ── Pagination Footer ── */}
          <div className="border-t border-border px-4 py-3 bg-muted/15 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            {/* Rows Per Page */}
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-7 w-[70px] text-xs bg-card">
                  <SelectValue placeholder={String(pageSize)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Showing Info */}
            <div>
              <span>
                Showing <strong className="text-foreground">{startIndex + 1}</strong> to{" "}
                <strong className="text-foreground">{endIndex}</strong> of{" "}
                <strong className="text-foreground">{filteredPayments.length}</strong> payments
              </span>
            </div>

            {/* Page Navigation Buttons */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(1)}
                disabled={validCurrentPage <= 1}
                className="size-7"
                title="First Page"
              >
                <ChevronsLeft className="size-3.5" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={validCurrentPage <= 1}
                className="size-7"
                title="Previous Page"
              >
                <ChevronLeft className="size-3.5" />
              </Button>

              <span className="px-2.5 text-xs font-semibold text-foreground">
                Page {validCurrentPage} of {totalPages}
              </span>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={validCurrentPage >= totalPages}
                className="size-7"
                title="Next Page"
              >
                <ChevronRight className="size-3.5" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(totalPages)}
                disabled={validCurrentPage >= totalPages}
                className="size-7"
                title="Last Page"
              >
                <ChevronsRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Official Printable Receipt Modal ── */}
      {selectedPayment && (
        <Dialog
          open={!!selectedPayment}
          onOpenChange={(open) => {
            if (!open) setSelectedPayment(null);
          }}
        >
          <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto p-0 gap-0">
            <DialogHeader className="p-6 pb-4 border-b border-border bg-card">
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Receipt className="size-5 text-primary" />
                Payment Receipt
              </DialogTitle>
              <DialogDescription className="text-xs">
                Official transaction record for {selectedPayment.paymentBy}.
              </DialogDescription>
            </DialogHeader>

            <div className="p-6 space-y-4">
              {/* Receipt Document */}
              <div
                id="printable-payment-receipt"
                className="rounded-xl border border-border bg-card p-5 space-y-4 text-xs font-sans shadow-xs"
              >
                {/* Header */}
                <div className="text-center space-y-1 border-b border-border pb-3">
                  <div className="flex items-center justify-center gap-1.5">
                    <Building2 className="size-4 text-primary" />
                    <h2 className="font-bold text-sm tracking-tight text-foreground uppercase">
                      {systemInfo?.systemName || "Hotel Management System"}
                    </h2>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Official Hotel Payment Receipt
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    Ref:{" "}
                    {selectedPayment.refNumber ||
                      `RCP-${selectedPayment._id.slice(-6).toUpperCase()}`}{" "}
                    · {formatDate(selectedPayment.date)}
                  </p>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-2.5 text-xs border-b border-border pb-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Guest Name</p>
                    <p className="font-bold">{selectedPayment.paymentBy || "Guest"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Received By</p>
                    <p className="font-medium">{selectedPayment.receivedBy || "Staff"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Payment Date</p>
                    <p className="font-medium">{formatDate(selectedPayment.date)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Payment Method</p>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {resolvePaymentMethod(selectedPayment).label}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Folio No.</p>
                    <p className="font-mono font-medium">{selectedPayment.folio || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Reference No.</p>
                    <p className="font-mono font-medium">
                      {selectedPayment.refNumber || "—"}
                    </p>
                  </div>
                </div>

                {/* Amount Paid */}
                <div className="space-y-2 text-xs border-b border-border pb-3">
                  <div className="flex justify-between items-center text-sm font-bold pt-1">
                    <span>Amount Paid</span>
                    <span className="font-mono text-base text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(selectedPayment.amount)}
                    </span>
                  </div>
                  {Number(selectedPayment.balance || 0) > 0 && (
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="text-muted-foreground">Remaining Balance</span>
                      <span className="font-mono text-amber-600 dark:text-amber-400">
                        {formatCurrency(Number(selectedPayment.balance || 0))}
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer / Stamp */}
                <div className="pt-1 flex justify-between items-end text-[10px] text-muted-foreground">
                  <div>
                    <p>Status: Verified Payment</p>
                    <p>Thank you for choosing us!</p>
                  </div>
                  <div className="text-right">
                    {Number(selectedPayment.balance || 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400">
                        PARTIAL
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="size-3" /> PAID
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <DialogFooter className="flex-row items-center justify-between sm:justify-between gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                  className="text-xs gap-1.5"
                >
                  <Printer className="size-3.5 text-primary" />
                  Print Receipt
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => setSelectedPayment(null)}
                  className="text-xs"
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
