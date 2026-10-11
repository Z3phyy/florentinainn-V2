"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import axiosInstance from "@/app/utils/axios";
import { chatInterface, ChatMessage } from "@/app/types/chat.type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Send,
  MessageCircle,
  ChevronLeft,
  Search,
  Check,
  CheckCheck,
  CheckCircle2,
  RotateCcw,
  Trash2,
  X,
  Clock,
  Inbox,
  Archive,
  Sparkles,
  Zap,
} from "lucide-react";
import { getChatStatus, ChatStatusType } from "@/app/utils/customFunction";
import { successAlert, errorAlert, confirmAlert } from "@/app/utils/alert";

function getInitials(name: string): string {
  if (!name) return "??";
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatMessageExactTime(dateStr?: string | Date): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";

  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const timePart = d.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (isToday) {
    return timePart;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return `Yesterday, ${timePart}`;
  }

  const datePart = d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
  return `${datePart}, ${timePart}`;
}

function formatLastUpdated(dateStr?: string | Date): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

function getLastMessage(convo: ChatMessage[]): string {
  if (!convo || convo.length === 0) return "No messages yet";
  const last = convo[convo.length - 1];
  const prefix = last.user === "staff" ? "You: " : "";
  const text = last.message;
  const full = `${prefix}${text}`;
  return full.length > 55 ? full.slice(0, 55) + "…" : full;
}

const AVATAR_COLORS = [
  "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border-rose-200 dark:border-rose-900",
  "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400 border-sky-200 dark:border-sky-900",
  "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400 border-violet-200 dark:border-violet-900",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900",
  "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-900",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-400 border-cyan-200 dark:border-cyan-900",
  "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-400 border-fuchsia-200 dark:border-fuchsia-900",
  "bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400 border-teal-200 dark:border-teal-900",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

type FilterTab = "all" | "needs_reply" | "active" | "resolved";

export default function StaffChatPage() {
  const [chats, setChats] = useState<chatInterface[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedConvo, setSelectedConvo] = useState<ChatMessage[]>([]);
  const [selectedName, setSelectedName] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"active" | "resolved">("active");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [generatingReply, setGeneratingReply] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTab, setCurrentTab] = useState<FilterTab>("all");
  const [loadingChats, setLoadingChats] = useState(true);

  // Canned Response Templates
  const CANNED_RESPONSES = [
    {
      label: "🕒 Flexible Check-in / Out",
      text: "We offer flexible 24/7 check-in and check-out anytime. Our front-desk reception is open around the clock to welcome you!",
    },
    {
      label: "✨ Hotel Amenities",
      text: "Our amenities include Airconditioned rooms, Hot and cold shower, Cable TV / DVD, Free WiFi internet, Breakfast service, Private parking, and 24/7 Backup power generator.",
    },
    {
      label: "💳 Payment Methods",
      text: "We accept Cash, GCash, and Online Payment (Debit / Credit card) via our secure reservation system.",
    },
    {
      label: "📍 Location",
      text: "We are located in Francia Sur, Jose D. Aspiras Hwy, Tubao, La Union. Open 24/7.",
    },
    {
      label: "👋 Warm Welcome",
      text: "Good day! Welcome to Florentina Inn. How may we assist you with your stay today?",
    },
  ];

  const handleAiSuggestReply = async () => {
    if (!selectedChatId || generatingReply) return;
    setGeneratingReply(true);

    try {
      const res = await axiosInstance.post("/system/ai-suggest-reply", {
        convo: selectedConvo,
        clientName: selectedName,
      });

      if (res.data?.suggestion) {
        setInput(res.data.suggestion);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    } catch (error) {
      console.error("Failed to generate AI suggestion:", error);
      errorAlert("Failed to generate AI suggested reply.");
    } finally {
      setGeneratingReply(false);
    }
  };

  const handleInsertCannedResponse = (text: string) => {
    setInput(text);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConvo]);

  // Focus input when a chat is selected
  useEffect(() => {
    if (selectedChatId) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [selectedChatId]);

  // Fetch all chats on mount and poll every 3s
  useEffect(() => {
    const fetchChats = async () => {
      try {
        const res = await axiosInstance.get("/system/chat");
        const list: chatInterface[] = res.data || [];
        setChats(list);
      } catch {
        // Silently fail on background poll
      } finally {
        setLoadingChats(false);
      }
    };

    fetchChats();
    const interval = setInterval(fetchChats, 3000);
    return () => clearInterval(interval);
  }, []);

  // Fetch selected chat details periodically
  useEffect(() => {
    if (!selectedChatId) return;

    const fetchChat = async () => {
      try {
        const res = await axiosInstance.get(`/system/chat/${selectedChatId}`);
        if (res.data) {
          setSelectedConvo(res.data.convo || []);
          setSelectedStatus(res.data.status || "active");
          setSelectedName(res.data.clientName || "");
        }
      } catch {
        // Silently fail
      }
    };

    fetchChat();
    const interval = setInterval(fetchChat, 3000);
    return () => clearInterval(interval);
  }, [selectedChatId]);

  // Mark messages as seen when staff views a chat
  useEffect(() => {
    if (!selectedChatId) return;
    const hasUnseen = selectedConvo.some((m) => m.user === "client" && !m.seen);
    if (hasUnseen) {
      axiosInstance
        .put(`/system/chat/${selectedChatId}/seen`, { viewer: "staff" })
        .catch(() => {});
    }
  }, [selectedChatId, selectedConvo]);

  // Tab counts
  const counts = useMemo(() => {
    let needsReplyCount = 0;
    let activeCount = 0;
    let resolvedCount = 0;

    chats.forEach((c) => {
      const status = getChatStatus(c);
      if (status === "needs_reply") needsReplyCount++;
      else if (status === "active") activeCount++;
      else if (status === "resolved") resolvedCount++;
    });

    return {
      all: chats.length,
      needs_reply: needsReplyCount,
      active: activeCount,
      resolved: resolvedCount,
    };
  }, [chats]);

  // Filtered & Searched conversations
  const filteredChats = useMemo(() => {
    return chats.filter((c) => {
      const status = getChatStatus(c);

      // 1. Tab Filter
      if (currentTab === "needs_reply" && status !== "needs_reply") return false;
      if (currentTab === "active" && status !== "active") return false;
      if (currentTab === "resolved" && status !== "resolved") return false;

      // 2. Search Filter (by guest name or message content)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = c.clientName?.toLowerCase().includes(query);
        const matchesMessage = c.convo?.some((m) =>
          m.message?.toLowerCase().includes(query)
        );
        if (!matchesName && !matchesMessage) return false;
      }

      return true;
    });
  }, [chats, currentTab, searchQuery]);

  const selectChat = (chat: chatInterface) => {
    setSelectedChatId(chat._id);
    setSelectedConvo(chat.convo || []);
    setSelectedName(chat.clientName);
    setSelectedStatus(chat.status || "active");

    // Immediately mark as seen on select
    axiosInstance
      .put(`/system/chat/${chat._id}/seen`, { viewer: "staff" })
      .catch(() => {});
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending || !selectedChatId) return;

    const newMsg: ChatMessage = {
      user: "staff",
      message: trimmed,
      timestamp: new Date(),
      seen: false,
    };
    setSelectedConvo((prev) => [...prev, newMsg]);
    setInput("");
    setSending(true);

    // If chat was resolved, sending message reopens it to active
    if (selectedStatus === "resolved") {
      setSelectedStatus("active");
    }

    try {
      await axiosInstance.post("/system/chat/message", {
        id: selectedChatId,
        user: "staff",
        message: trimmed,
      });

      // Update in local chat list
      setChats((prev) =>
        prev.map((c) =>
          c._id === selectedChatId
            ? {
                ...c,
                status: "active",
                convo: [...(c.convo || []), newMsg],
                updatedAt: new Date().toISOString(),
              }
            : c
        )
      );
    } catch (error) {
      console.error("Failed to send message:", error);
      errorAlert("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedChatId || updatingStatus) return;

    const newStatus = selectedStatus === "resolved" ? "active" : "resolved";
    setUpdatingStatus(true);

    try {
      await axiosInstance.put(`/system/chat/${selectedChatId}/status`, {
        status: newStatus,
      });

      setSelectedStatus(newStatus);
      setChats((prev) =>
        prev.map((c) =>
          c._id === selectedChatId ? { ...c, status: newStatus } : c
        )
      );

      if (newStatus === "resolved") {
        successAlert(`Conversation with ${selectedName} marked as Resolved.`);
      } else {
        successAlert(`Conversation with ${selectedName} reopened.`);
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      errorAlert("Failed to update conversation status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeleteChat = () => {
    if (!selectedChatId) return;

    confirmAlert(
      `Are you sure you want to delete the conversation with ${selectedName}? All messages will be permanently removed.`,
      "Yes, Delete",
      async () => {
        try {
          await axiosInstance.delete(`/system/chat/${selectedChatId}`);
          setChats((prev) => prev.filter((c) => c._id !== selectedChatId));
          setSelectedChatId(null);
          setSelectedConvo([]);
          successAlert("Conversation deleted successfully.");
        } catch (error) {
          console.error("Failed to delete chat:", error);
          errorAlert("Failed to delete conversation.");
        }
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectedChatObj = useMemo(() => {
    return chats.find((c) => c._id === selectedChatId);
  }, [chats, selectedChatId]);

  const selectedComputedStatus: ChatStatusType = useMemo(() => {
    if (!selectedChatObj) {
      return selectedStatus === "resolved" ? "resolved" : "active";
    }
    return getChatStatus({ ...selectedChatObj, status: selectedStatus, convo: selectedConvo });
  }, [selectedChatObj, selectedStatus, selectedConvo]);

  return (
    <div className="flex h-[calc(100dvh-4rem)] w-full min-w-0 bg-background overflow-hidden border-t border-border">
      {/* ── Left Panel: Chat Inbox & Filters ── */}
      <div
        className={`w-full lg:w-[360px] xl:w-[400px] min-w-0 shrink-0 border-r border-border bg-card flex-col h-full ${
          selectedChatId ? "hidden lg:flex" : "flex"
        }`}
      >
        {/* Header & Inbox Title */}
        <div className="border-b border-border p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Inbox className="size-4" />
              </div>
              <div>
                <h1 className="text-sm font-semibold tracking-tight">Guest Inbox</h1>
                <p className="text-[11px] text-muted-foreground">
                  Manage real-time guest inquiries & support
                </p>
              </div>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or message..."
              className="pl-8.5 pr-8 h-9 text-xs bg-muted/40 border-border focus:bg-background rounded-lg"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Tabs */}
          <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-muted/60 text-[11px] font-medium text-muted-foreground">
            <button
              onClick={() => setCurrentTab("all")}
              className={`flex items-center justify-center gap-1 py-1.5 rounded-md transition-all ${
                currentTab === "all"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "hover:text-foreground"
              }`}
            >
              <span>All</span>
              <span className="text-[10px] opacity-70">({counts.all})</span>
            </button>

            <button
              onClick={() => setCurrentTab("needs_reply")}
              className={`flex items-center justify-center gap-1 py-1.5 rounded-md transition-all ${
                currentTab === "needs_reply"
                  ? "bg-background text-rose-600 dark:text-rose-400 shadow-xs font-semibold"
                  : "hover:text-rose-600 dark:hover:text-rose-400"
              }`}
            >
              <span className="size-1.5 rounded-full bg-rose-500 shrink-0" />
              <span>Reply</span>
              <span className="text-[10px] opacity-70">({counts.needs_reply})</span>
            </button>

            <button
              onClick={() => setCurrentTab("active")}
              className={`flex items-center justify-center gap-1 py-1.5 rounded-md transition-all ${
                currentTab === "active"
                  ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold"
                  : "hover:text-emerald-600 dark:hover:text-emerald-400"
              }`}
            >
              <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>Active</span>
              <span className="text-[10px] opacity-70">({counts.active})</span>
            </button>

            <button
              onClick={() => setCurrentTab("resolved")}
              className={`flex items-center justify-center gap-1 py-1.5 rounded-md transition-all ${
                currentTab === "resolved"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "hover:text-foreground"
              }`}
            >
              <CheckCircle2 className="size-3 shrink-0 text-muted-foreground" />
              <span>Done</span>
              <span className="text-[10px] opacity-70">({counts.resolved})</span>
            </button>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/60">
          {loadingChats ? (
            <div className="space-y-1 p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-3 animate-pulse">
                  <div className="size-10 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-3/4 rounded bg-muted" />
                    <div className="h-2.5 w-1/2 rounded bg-muted/60" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16 px-6 text-center">
              <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center mb-3 text-muted-foreground/60">
                {currentTab === "needs_reply" ? (
                  <CheckCircle2 className="size-6 text-emerald-500" />
                ) : currentTab === "resolved" ? (
                  <Archive className="size-6" />
                ) : (
                  <MessageCircle className="size-6" />
                )}
              </div>
              <p className="text-xs font-semibold text-foreground">
                {searchQuery
                  ? "No matching conversations"
                  : currentTab === "needs_reply"
                  ? "Inbox zero! No pending replies"
                  : currentTab === "resolved"
                  ? "No resolved conversations yet"
                  : "No conversations found"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 max-w-[220px]">
                {searchQuery
                  ? "Try searching with a different guest name or keyword."
                  : currentTab === "needs_reply"
                  ? "All guest inquiries have been answered by staff."
                  : "Guest chats will appear here as they connect."}
              </p>
            </div>
          ) : (
            filteredChats.map((chat) => {
              const isSelected = chat._id === selectedChatId;
              const chatStatus = getChatStatus(chat);
              const lastMsg = getLastMessage(chat.convo);
              const avatarColor = getAvatarColor(chat.clientName);
              const lastUpdated = formatLastUpdated(
                chat.convo?.[chat.convo.length - 1]?.timestamp || chat.updatedAt || chat.createdAt
              );

              return (
                <button
                  key={chat._id}
                  onClick={() => selectChat(chat)}
                  className={`w-full text-left px-4 py-3.5 transition-all duration-150 cursor-pointer flex items-start gap-3 relative border-l-2 ${
                    isSelected
                      ? "bg-muted/70 border-primary"
                      : "border-transparent hover:bg-muted/40"
                  }`}
                >
                  {/* Avatar with Initials */}
                  <div
                    className={`relative flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold border ${avatarColor}`}
                  >
                    {getInitials(chat.clientName)}
                    {chatStatus === "needs_reply" && (
                      <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-rose-500 border-2 border-card animate-pulse" />
                    )}
                  </div>

                  {/* Chat Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <p
                        className={`text-xs truncate ${
                          chatStatus === "needs_reply"
                            ? "font-bold text-foreground"
                            : "font-semibold text-foreground/90"
                        }`}
                      >
                        {chat.clientName}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {lastUpdated}
                      </span>
                    </div>

                    {/* Last message snippet */}
                    <p
                      className={`text-[11px] truncate mt-0.5 ${
                        chatStatus === "needs_reply"
                          ? "text-foreground font-medium"
                          : "text-muted-foreground"
                      }`}
                    >
                      {lastMsg}
                    </p>

                    {/* Status Badge */}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {chatStatus === "needs_reply" && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          <span className="size-1.5 rounded-full bg-rose-500" />
                          Needs Reply
                        </span>
                      )}

                      {chatStatus === "active" && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      )}

                      {chatStatus === "resolved" && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-medium bg-muted text-muted-foreground border border-border">
                          <CheckCircle2 className="size-2.5 text-muted-foreground" />
                          Resolved
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right Panel: Active Conversation View ── */}
      <div
        className={`flex-1 min-w-0 flex-col bg-muted/10 h-full ${
          selectedChatId ? "flex" : "hidden lg:flex"
        }`}
      >
        {!selectedChatId ? (
          /* No chat selected empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground px-6 text-center">
            <div className="size-16 rounded-2xl bg-muted/60 border border-border flex items-center justify-center mb-4 text-muted-foreground/60 shadow-xs">
              <MessageCircle className="size-8" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Select a conversation</h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-[320px]">
              Choose a guest from the inbox on the left to read messages, provide assistance, or mark conversations as resolved.
            </p>
          </div>
        ) : (
          <>
            {/* Conversation Header */}
            <div className="border-b border-border px-3 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between gap-2 bg-card shrink-0">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <button
                  onClick={() => setSelectedChatId(null)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg hover:bg-muted transition-colors cursor-pointer lg:hidden"
                  aria-label="Back to conversations"
                >
                  <ChevronLeft className="size-4 text-muted-foreground" />
                </button>

                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold border ${getAvatarColor(
                    selectedName
                  )}`}
                >
                  {getInitials(selectedName)}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-2 gap-y-0.5">
                    <h2 className="text-sm font-bold text-foreground truncate min-w-0 max-w-full">
                      {selectedName}
                    </h2>

                    {/* Header Status Badge */}
                    {selectedComputedStatus === "needs_reply" && (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                        <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
                        Needs Reply
                      </span>
                    )}

                    {selectedComputedStatus === "active" && (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    )}

                    {selectedComputedStatus === "resolved" && (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                        <CheckCircle2 className="size-3 text-muted-foreground" />
                        Resolved
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="size-3" />
                    <span>{selectedConvo.length} messages</span>
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <Button
                  variant={selectedStatus === "resolved" ? "outline" : "default"}
                  size="sm"
                  onClick={handleToggleStatus}
                  disabled={updatingStatus}
                  className="gap-1.5 text-xs h-8.5 px-2.5 sm:px-3 font-medium"
                  title={selectedStatus === "resolved" ? "Reopen Chat" : "Mark as Resolved"}
                  aria-label={selectedStatus === "resolved" ? "Reopen Chat" : "Mark as Resolved"}
                >
                  {updatingStatus ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : selectedStatus === "resolved" ? (
                    <>
                      <RotateCcw className="size-3.5 text-amber-500" />
                      <span className="hidden sm:inline">Reopen Chat</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-3.5" />
                      <span className="hidden sm:inline">Mark as Resolved</span>
                    </>
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDeleteChat}
                  className="size-8.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="Delete conversation"
                  aria-label="Delete conversation"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            {/* Resolved Banner */}
            {selectedStatus === "resolved" && (
              <div className="bg-muted/60 border-b border-border px-3 sm:px-6 py-2 flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-start sm:items-center gap-2 min-w-0">
                  <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                  <span>
                    This conversation is marked as <strong>Resolved</strong>. Sending a new message will automatically reopen it.
                  </span>
                </div>
              </div>
            )}

            {/* Message Thread */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-6 space-y-3 bg-muted/20">
              {selectedConvo.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center py-12">
                  <div className="size-12 rounded-full bg-card border border-border flex items-center justify-center mb-3">
                    <MessageCircle className="size-6 text-muted-foreground/60" />
                  </div>
                  <p className="text-xs font-semibold text-foreground">No messages yet</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Type a message below to begin chatting with {selectedName}.
                  </p>
                </div>
              ) : (
                selectedConvo.map((msg, i) => {
                  const isStaff = msg.user === "staff";
                  const timeFormatted = formatMessageExactTime(msg.timestamp);

                  return (
                    <div
                      key={i}
                      className={`flex flex-col ${
                        isStaff ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`flex gap-2 min-w-0 max-w-[88%] sm:max-w-[78%] ${
                          isStaff ? "flex-row-reverse" : "flex-row"
                        }`}
                      >
                        {/* Bubble */}
                        <div
                          className={`min-w-0 rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs leading-relaxed shadow-xs ${
                            isStaff
                              ? "bg-primary text-primary-foreground rounded-tr-xs"
                              : "bg-card text-card-foreground border border-border rounded-tl-xs"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{msg.message}</p>
                        </div>
                      </div>

                      {/* Timestamp & Delivery / Seen Checkmark under bubble */}
                      {timeFormatted && (
                        <div
                          className={`flex items-center gap-1 mt-1 px-1.5 max-w-full min-w-0 text-[10px] text-muted-foreground ${
                            isStaff ? "justify-end" : "justify-start"
                          }`}
                        >
                          <span className="truncate">
                            {isStaff ? "You · " : `${selectedName} · `}
                            {timeFormatted}
                          </span>
                          {isStaff && (
                            msg.seen ? (
                              <span
                                className="flex items-center text-sky-500 font-medium"
                                title="Seen by guest"
                              >
                                <CheckCheck className="size-3.5" />
                              </span>
                            ) : (
                              <span
                                className="flex items-center text-muted-foreground"
                                title="Delivered"
                              >
                                <Check className="size-3.5" />
                              </span>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {sending && (
                <div className="flex flex-col items-end">
                  <div className="rounded-2xl rounded-tr-xs bg-primary text-primary-foreground px-4 py-2.5 text-xs shadow-xs">
                    <div className="flex items-center gap-2">
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Sending reply...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar & AI Co-Pilot / Quick Replies */}
            <div className="border-t border-border p-2.5 sm:p-3.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] bg-card shrink-0 space-y-2.5">
              {/* Quick Actions Bar: AI Suggest Reply & Canned Response Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar max-w-4xl mx-auto">
                {/* AI Suggest Reply Button */}
                <button
                  type="button"
                  onClick={handleAiSuggestReply}
                  disabled={generatingReply || sending || selectedConvo.length === 0}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all border shadow-xs ${
                    generatingReply
                      ? "bg-amber-500/20 text-amber-600 border-amber-500/40 animate-pulse cursor-wait"
                      : "bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-rose-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/25 active:scale-95"
                  }`}
                  title="Generate polite smart reply based on guest inquiry using Gemini AI"
                >
                  {generatingReply ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin text-amber-600" />
                      <span>Drafting with AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5 text-amber-500 animate-pulse" />
                      <span>✨ AI Suggest Reply</span>
                    </>
                  )}
                </button>

                <div className="h-4 w-px bg-border shrink-0 mx-0.5" />

                {/* Canned Response Chips */}
                {CANNED_RESPONSES.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleInsertCannedResponse(chip.text)}
                    disabled={sending || generatingReply}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/70 hover:border-border shrink-0 transition-colors active:scale-95"
                    title={chip.text}
                  >
                    <span>{chip.label}</span>
                  </button>
                ))}
              </div>

              {/* Message Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2 sm:gap-2.5 max-w-4xl mx-auto min-w-0"
              >
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Reply to ${selectedName}... (or click AI Suggest Reply)`}
                  disabled={sending || generatingReply}
                  className="flex-1 min-w-0 h-10 bg-muted/40 border-border focus:bg-background rounded-xl text-base sm:text-xs"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!input.trim() || sending || generatingReply}
                  className="shrink-0 h-10 px-3 sm:px-4 rounded-xl gap-1.5 text-xs font-semibold"
                  aria-label="Send message"
                >
                  {sending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <span className="hidden sm:inline">Send</span>
                      <Send className="size-3.5" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
