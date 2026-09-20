"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { AuditLog } from "@/app/types/notification.type";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  History,
  Clock,
  Search,
  Download,
  RefreshCw,
  Shield,
  Tag,
  Wrench,
  Users,
  Mail,
  Sliders,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileSpreadsheet,
} from "lucide-react";
import { downloadCSV, downloadPDF, getExportTimestamp } from "@/app/utils/exportFile";
import { FALLBACK_LOGO, getLogoDataUrl } from "@/app/utils/brand";

type AuditCategoryFilter = "ALL" | "DISCOUNT" | "MAINTENANCE" | "STAFF" | "INQUIRY" | "SYSTEM";

function formatTimeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const formatLogFullDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getActionBadge = (action: string) => {
  const act = action.toUpperCase();
  if (act.includes("DISCOUNT")) {
    return {
      label: action,
      icon: <Tag className="size-3" />,
      className: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800",
    };
  }
  if (act.includes("MAINTENANCE")) {
    return {
      label: action,
      icon: <Wrench className="size-3" />,
      className: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800",
    };
  }
  if (act.includes("REGISTER") || act.includes("STAFF") || act.includes("ACCOUNT") || act.includes("ROLE")) {
    return {
      label: action,
      icon: <Users className="size-3" />,
      className: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800",
    };
  }
  if (act.includes("INQUIRY") || act.includes("CONTACT") || act.includes("EMAIL")) {
    return {
      label: action,
      icon: <Mail className="size-3" />,
      className: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-800",
    };
  }
  if (act.includes("CREATE") || act.includes("RESERVATION") || act.includes("APPROVE")) {
    return {
      label: action,
      icon: <CheckCircle2 className="size-3" />,
      className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800",
    };
  }
  if (act.includes("DELETE") || act.includes("REJECT") || act.includes("CANCEL")) {
    return {
      label: action,
      icon: <Shield className="size-3" />,
      className: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800",
    };
  }
  return {
    label: action,
    icon: <Sliders className="size-3" />,
    className: "bg-[#900546]/10 text-[#900546] dark:text-[#F968AC] border-[#900546]/30",
  };
};

const categories: { key: AuditCategoryFilter; label: string }[] = [
  { key: "ALL", label: "All Activity" },
  { key: "DISCOUNT", label: "Discounts & Rates" },
  { key: "MAINTENANCE", label: "Maintenance" },
  { key: "STAFF", label: "Staff & Accounts" },
  { key: "INQUIRY", label: "Inquiries & Contact" },
  { key: "SYSTEM", label: "System & Auth" },
];

export default function Page() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<AuditCategoryFilter>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const {
    data: auditLogs,
    isLoading: auditLoading,
    refetch: refetchAudit,
    isFetching: auditFetching,
  } = useQuery<AuditLog[]>({
    queryKey: ["admin-audit-logs"],
    queryFn: async () => {
      const res = await axiosInstance.get("/system/audit-logs?limit=100");
      return res.data;
    },
    refetchInterval: 30000,
  });

  const filteredLogs = useMemo(() => {
    if (!auditLogs) return [];
    return auditLogs.filter((log) => {
      if (activeCategory === "DISCOUNT" && !log.action.includes("DISCOUNT")) return false;
      if (activeCategory === "MAINTENANCE" && !log.action.includes("MAINTENANCE")) return false;
      if (
        activeCategory === "STAFF" &&
        !log.action.includes("STAFF") &&
        !log.action.includes("REGISTER") &&
        !log.action.includes("ACCOUNT") &&
        !log.action.includes("ROLE")
      ) {
        return false;
      }
      if (
        activeCategory === "INQUIRY" &&
        !log.action.includes("INQUIRY") &&
        !log.action.includes("CONTACT") &&
        !log.action.includes("EMAIL")
      ) {
        return false;
      }
      if (
        activeCategory === "SYSTEM" &&
        !log.action.includes("SYSTEM") &&
        !log.action.includes("CREDENTIALS") &&
        !log.action.includes("INFO")
      ) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchActor = log.actorName?.toLowerCase().includes(q);
        const matchAction = log.action?.toLowerCase().includes(q);
        const matchDetails = log.details?.toLowerCase().includes(q);
        const matchRole = log.actorRole?.toLowerCase().includes(q);
        if (!matchActor && !matchAction && !matchDetails && !matchRole) return false;
      }

      return true;
    });
  }, [auditLogs, activeCategory, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredLogs.length);
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

  const buildAuditRows = () => {
    return filteredLogs.map((l) => {
      const d = new Date(l.createdAt);
      const dateStr = d.toLocaleDateString("en-US");
      const timeStr = d.toLocaleTimeString("en-US");
      return [
        l._id,
        dateStr,
        timeStr,
        l.action,
        l.actorName || "Admin",
        l.actorRole || "admin",
        l.targetType || "system",
        l.details || "",
      ];
    });
  };

  const auditExportHeaders = ["Event ID", "Date", "Time", "Action", "Actor Name", "Actor Role", "Target Type", "Details"];

  const exportAuditToCSV = () => {
    if (!filteredLogs || filteredLogs.length === 0) {
      toast.error("No audit logs to export.");
      return;
    }
    downloadCSV(`Florentina_Inn_Audit_Trail_${getExportTimestamp()}.csv`, auditExportHeaders, buildAuditRows());
    toast.success("Audit trail exported to CSV successfully.");
  };

  const exportAuditToPDF = async () => {
    if (!filteredLogs || filteredLogs.length === 0) {
      toast.error("No audit logs to export.");
      return;
    }
    const logoDataUrl = await getLogoDataUrl(FALLBACK_LOGO);
    await downloadPDF({
      filename: `Florentina_Inn_Audit_Trail_${getExportTimestamp()}.pdf`,
      title: "Florentina Inn - Audit Trail",
      subtitle: `${filteredLogs.length} recorded event(s)`,
      headers: auditExportHeaders,
      rows: buildAuditRows(),
      logoDataUrl,
    });
    toast.success("Audit trail exported to PDF successfully.");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3 py-1 text-xs font-semibold text-[#900546] dark:text-[#F968AC] mb-2">
            <Shield className="size-3" />
            System & Security
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#130005] dark:text-white">
            Audit Trail & Activity Log
          </h1>
          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-1">
            Chronological ledger of discount adjustments, maintenance changes, staff actions, and system events.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportAuditToCSV}
            className="h-8.5 rounded-xl border-[#618685]/30 text-[#618685] hover:bg-[#618685]/10 text-xs font-semibold gap-1.5 cursor-pointer"
            title="Export Filtered Logs to CSV"
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportAuditToPDF}
            className="h-8.5 rounded-xl border-[#618685]/30 text-[#618685] hover:bg-[#618685]/10 text-xs font-semibold gap-1.5 cursor-pointer"
            title="Export Filtered Logs to PDF"
          >
            <FileSpreadsheet className="size-3.5" />
            Export PDF
          </Button>

          <button
            type="button"
            onClick={async () => {
              await refetchAudit();
              toast.success("Audit Trail updated: Recent activities loaded.");
            }}
            disabled={auditFetching}
            className="p-2 rounded-xl border border-[#D9C3C3] bg-[#FAF5F5] dark:bg-[#130005] text-[#5C454B] hover:text-[#900546] transition-colors cursor-pointer"
            title="Refresh Audit Trail"
          >
            <RefreshCw className={`size-4 ${auditFetching ? "animate-spin text-[#900546]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-5 shadow-xs space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#5C454B]" />
          <Input
            type="text"
            placeholder="Search by actor name, action, or details..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 h-9 text-xs rounded-xl bg-[#FAF5F5] dark:bg-[#130005] border-[#D9C3C3] dark:border-white/10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#5C454B] hover:text-[#130005] cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => {
                setActiveCategory(cat.key);
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-full font-medium whitespace-nowrap transition-all cursor-pointer text-[11px] ${
                activeCategory === cat.key
                  ? "bg-[#900546] text-white shadow-xs"
                  : "bg-[#FAF5F5] dark:bg-[#130005] text-[#5C454B] dark:text-gray-400 hover:bg-[#900546]/10 hover:text-[#900546] border border-[#D9C3C3] dark:border-white/10"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#5C454B] dark:text-gray-400 px-1">
          <span>
            Showing <strong>{filteredLogs.length}</strong> recorded event{filteredLogs.length === 1 ? "" : "s"}
          </span>
          <span className="text-[10px]">Auto-refreshes every 30s</span>
        </div>
      </div>

      {/* Audit Logs List */}
      <div className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 shadow-xs">
        <div className="max-h-[580px] overflow-y-auto space-y-3 pr-1 divide-y divide-[#D9C3C3]/30 dark:divide-white/5">
          {auditLoading ? (
            <div className="space-y-3 pt-2">
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#5C454B]">
              <Clock className="size-10 text-[#5C454B]/30 mx-auto mb-2" />
              <p className="font-bold text-[#130005] dark:text-white">No Matching Events Found</p>
              <p className="text-[11px] mt-0.5">
                {searchQuery || activeCategory !== "ALL"
                  ? "Try clearing your search query or selecting another category filter."
                  : "Actions will be recorded here automatically."}
              </p>
              {(searchQuery || activeCategory !== "ALL") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setActiveCategory("ALL");
                  }}
                  className="mt-3 text-xs font-semibold text-[#900546] hover:underline cursor-pointer"
                >
                  Reset All Filters
                </button>
              )}
            </div>
          ) : (
            paginatedLogs.map((log) => {
              const badge = getActionBadge(log.action);
              return (
                <div
                  key={log._id}
                  className="pt-3 first:pt-0 p-3.5 rounded-2xl bg-[#FAF5F5]/60 dark:bg-[#130005]/60 border border-[#D9C3C3]/60 dark:border-white/10 text-xs space-y-2 hover:border-[#900546]/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-md border ${badge.className}`}
                    >
                      {badge.icon}
                      {badge.label}
                    </span>

                    <span
                      className="text-[11px] text-[#5C454B] dark:text-gray-400 font-medium cursor-help"
                      title={formatLogFullDate(log.createdAt)}
                    >
                      {formatTimeAgo(log.createdAt)}
                    </span>
                  </div>

                  <p className="font-medium text-[#130005] dark:text-white text-xs leading-relaxed">
                    {log.details}
                  </p>

                  <div className="flex items-center justify-between text-[11px] pt-1 text-[#5C454B] dark:text-gray-400 border-t border-[#D9C3C3]/30 dark:border-white/5">
                    <div className="flex items-center gap-1.5">
                      <div className="size-5 rounded-full bg-[#900546]/10 text-[#900546] flex items-center justify-center font-bold text-[10px]">
                        {log.actorName ? log.actorName.charAt(0).toUpperCase() : "A"}
                      </div>
                      <span className="font-semibold text-[#130005] dark:text-white">
                        {log.actorName || "Admin"}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 uppercase font-mono">
                        {log.actorRole || "staff"}
                      </span>
                    </div>

                    <div className="text-[10px] text-[#5C454B] dark:text-gray-400">
                      {formatLogFullDate(log.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!auditLoading && filteredLogs.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#D9C3C3]/50 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#5C454B] dark:text-gray-400">
            <div className="flex items-center gap-2">
              <span>Events per page:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-7 w-[70px] text-xs bg-[#FAF5F5] dark:bg-[#130005]">
                  <SelectValue placeholder={String(pageSize)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <span>
              Showing <strong className="text-[#130005] dark:text-white">{startIndex + 1}</strong> to{" "}
              <strong className="text-[#130005] dark:text-white">{endIndex}</strong> of{" "}
              <strong className="text-[#130005] dark:text-white">{filteredLogs.length}</strong> events
            </span>

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

              <span className="px-2.5 text-xs font-semibold text-[#130005] dark:text-white">
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
        )}
      </div>
    </div>
  );
}