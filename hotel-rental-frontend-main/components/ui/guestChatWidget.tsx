"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import axiosInstance from "@/app/utils/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Sparkles,
  Send,
  X,
  Bot,
  User,
  MessageCircle,
  Headphones,
  Check,
  CheckCheck,
  HelpCircle,
  Building2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { playMessageChime } from "@/app/utils/sound";

interface AiMessage {
  role: "user" | "ai";
  text: string;
}

interface StaffChatMessage {
  user: "client" | "staff";
  message: string;
  timestamp?: string | Date;
  seen?: boolean;
}

type ChatMode = "ai" | "staff";

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

export function GuestChatWidget() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ChatMode>("ai");

  // ─── AI Mode State ───
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // ─── Staff Mode State ───
  const [chatId, setChatId] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [staffConvo, setStaffConvo] = useState<StaffChatMessage[]>([]);
  const [staffInput, setStaffInput] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffSubmitting, setStaffSubmitting] = useState(false);
  const [hasUnreadStaffMessage, setHasUnreadStaffMessage] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);
  const staffInputRef = useRef<HTMLInputElement>(null);
  const prevMsgCountRef = useRef<number>(0);

  // Suggested Quick Prompts for AI Concierge
  const QUICK_PROMPTS = [
    "What are your room rates and types?",
    "What amenities do you provide?",
    "Is check-in and check-out flexible?",
    "What payment methods do you accept?",
  ];

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages, staffConvo, mode, open]);

  // Focus appropriate input when opening or switching modes
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        if (mode === "ai") {
          aiInputRef.current?.focus();
        } else if (mode === "staff" && chatId) {
          staffInputRef.current?.focus();
        }
      }, 150);
    }
  }, [open, mode, chatId]);

  // Poll for new messages from staff
  useEffect(() => {
    if (!chatId) return;

    const interval = setInterval(async () => {
      try {
        const res = await axiosInstance.get(`/system/chat/${chatId}`);
        if (res.data?.convo) {
          const newConvo: StaffChatMessage[] = res.data.convo;
          if (newConvo.length > prevMsgCountRef.current) {
            const last = newConvo[newConvo.length - 1];
            if (last && last.user === "staff") {
              playMessageChime();
              if (mode !== "staff" || !open) {
                setHasUnreadStaffMessage(true);
              }
            }
          }
          prevMsgCountRef.current = newConvo.length;
          setStaffConvo(newConvo);

          // Mark as seen if currently in staff chat mode and modal is open
          if (mode === "staff" && open) {
            const hasUnseenStaffMsg = newConvo.some(
              (m) => m.user === "staff" && !m.seen
            );
            if (hasUnseenStaffMsg) {
              axiosInstance
                .put(`/system/chat/${chatId}/seen`, { viewer: "client" })
                .catch(() => {});
            }
            setHasUnreadStaffMessage(false);
          }
        }
      } catch {
        // Silently fail on background poll
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [chatId, mode, open]);

  // ─── AI Chat Handlers ───
  const buildAiConvo = (msgs: AiMessage[]): string[] => {
    return msgs.map((m) => `${m.role === "user" ? "User" : "Ai"}: ${m.text}`);
  };

  const handleSendAi = async (customPrompt?: string) => {
    const textToSend = (customPrompt || aiInput).trim();
    if (!textToSend || aiLoading) return;

    const userMsg: AiMessage = { role: "user", text: textToSend };
    const updated = [...aiMessages, userMsg];
    setAiMessages(updated);
    if (!customPrompt) setAiInput("");
    setAiLoading(true);

    try {
      const convo = buildAiConvo(updated);
      const res = await axiosInstance.post("/system/ai", {
        input: textToSend,
        convo,
      });

      const aiReply = res.data;
      setAiMessages((prev) => [...prev, { role: "ai", text: aiReply }]);
    } catch {
      setAiMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "I'm having a brief connection issue. You can click 'Talk to Live Receptionist' above to chat with our staff directly!",
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  // ─── Staff Chat Handlers ───
  const handleNameSubmit = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || staffSubmitting) return;

    setStaffSubmitting(true);
    try {
      const res = await axiosInstance.post("/system/chat", {
        clientName: trimmed,
      });
      const chat = res.data;
      setChatId(chat._id);
      setClientName(trimmed);
      setStaffConvo(chat.convo || []);
      prevMsgCountRef.current = (chat.convo || []).length;
    } catch (error) {
      console.error("Failed to create chat:", error);
    } finally {
      setStaffSubmitting(false);
    }
  };

  const handleSendStaff = async () => {
    const trimmed = staffInput.trim();
    if (!trimmed || staffLoading || !chatId) return;

    const newMsg: StaffChatMessage = {
      user: "client",
      message: trimmed,
      timestamp: new Date(),
      seen: false,
    };
    setStaffConvo((prev) => [...prev, newMsg]);
    prevMsgCountRef.current = staffConvo.length + 1;
    setStaffInput("");
    setStaffLoading(true);

    try {
      await axiosInstance.post("/system/chat/message", {
        id: chatId,
        user: "client",
        message: trimmed,
      });
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setStaffLoading(false);
    }
  };

  const switchToStaffMode = () => {
    setMode("staff");
    setHasUnreadStaffMessage(false);
    if (chatId) {
      axiosInstance
        .put(`/system/chat/${chatId}/seen`, { viewer: "client" })
        .catch(() => {});
    }
  };

  return (
    <>
      {/* ── Single Luxury Floating Button ── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 group">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <span className="text-[11px] font-semibold text-white bg-stone-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-lg border border-white/10 whitespace-nowrap flex items-center gap-1.5">
            <Sparkles className="size-3 text-amber-400" />
            <span>Concierge & Live Support</span>
          </span>
        </div>

        <button
          onClick={() => {
            setOpen((prev) => !prev);
            if (!open && mode === "staff") {
              setHasUnreadStaffMessage(false);
            }
          }}
          className="relative flex size-14 items-center justify-center rounded-full bg-[#900546] text-white shadow-xl shadow-[#900546]/30 border border-[#F968AC]/40 transition-all duration-300 hover:scale-110 hover:shadow-2xl hover:bg-[#720336] active:scale-95 cursor-pointer"
          aria-label="Open Guest Concierge Chat"
        >
          {open ? (
            <X className="size-6 text-white transition-transform duration-200 rotate-90" />
          ) : (
            <>
              <Sparkles className="size-6 text-[#F968AC] animate-pulse" />
              {/* Unread beacon if staff replied */}
              {hasUnreadStaffMessage && (
                <span className="absolute -top-1 -right-1 flex size-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F968AC] opacity-75" />
                  <span className="relative inline-flex rounded-full size-4 bg-[#F968AC] border-2 border-background" />
                </span>
              )}
            </>
          )}
        </button>
      </div>

      {/* ── Chat Modal Window ── */}
      {open && (
        <>
          {/* Backdrop for mobile */}
          <div
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-xs md:hidden"
            onClick={() => setOpen(false)}
          />

          {/* Unified Floating Card */}
          <div className="fixed bottom-24 right-6 z-50 flex w-[390px] max-w-[calc(100vw-2rem)] flex-col rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] shadow-2xl shadow-black/20 overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
            {/* Luxury Header */}
            <div className="bg-[#130005] p-4 text-white border-b border-[#900546]/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8.5 items-center justify-center rounded-xl bg-[#900546]/30 text-[#F968AC] border border-[#900546]/50 shadow-inner">
                    {mode === "ai" ? (
                      <Bot className="size-4.5" />
                    ) : (
                      <Headphones className="size-4.5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                      <span>Hotel Concierge</span>
                      <span className="text-[10px] font-normal px-1.5 py-0.2 rounded-full bg-[#900546]/30 text-[#F968AC] border border-[#900546]/40">
                        24/7
                      </span>
                    </h3>
                    <p className="text-[10px] text-[#E4D1D1]/70">
                      {mode === "ai"
                        ? "AI Assistant for instant answers"
                        : chatId
                        ? `Live Reception · ${clientName}`
                        : "Connect with front-desk staff"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setOpen(false)}
                  className="flex size-7 items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Segmented Mode Switcher */}
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-black/40 border border-white/10 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setMode("ai")}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    mode === "ai"
                      ? "bg-[#900546] text-white font-bold shadow-md shadow-[#900546]/30"
                      : "text-[#E4D1D1]/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Sparkles className="size-3.5" />
                  <span>AI Assistant</span>
                </button>

                <button
                  type="button"
                  onClick={switchToStaffMode}
                  className={`relative flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    mode === "staff"
                      ? "bg-[#900546] text-white font-bold shadow-md shadow-[#900546]/30"
                      : "text-[#E4D1D1]/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Headphones className="size-3.5" />
                  <span>Live Staff</span>

                  {/* Red dot if unread staff message */}
                  {hasUnreadStaffMessage && (
                    <span className="size-2 rounded-full bg-[#F968AC] animate-ping absolute top-1.5 right-2" />
                  )}
                </button>
              </div>
            </div>

            {/* ── MODE 1: AI ASSISTANT ── */}
            {mode === "ai" && (
              <>
                {/* Handover Banner to Live Staff */}
                <div className="bg-[#FAF5F5] dark:bg-[#25121B] border-b border-[#D9C3C3] dark:border-white/10 px-3.5 py-2 flex items-center justify-between text-[11px] text-[#5C454B] dark:text-gray-300">
                  <span className="truncate">Need personalized front desk help?</span>
                  <button
                    onClick={switchToStaffMode}
                    className="inline-flex items-center gap-1 font-semibold text-[#900546] dark:text-[#F968AC] hover:underline shrink-0 ml-2 cursor-pointer"
                  >
                    <span>Talk to Live Staff</span>
                    <ArrowRight className="size-3" />
                  </button>
                </div>

                {/* AI Messages Thread */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[380px] bg-[#FAF5F5]/60 dark:bg-[#130005]/50">
                  {aiMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-6">
                      <div className="size-11 rounded-2xl bg-[#900546]/10 border border-[#900546]/20 flex items-center justify-center mb-2.5 text-[#900546] dark:text-[#F968AC]">
                        <Sparkles className="size-5" />
                      </div>
                      <h4 className="text-xs font-bold text-[#130005] dark:text-white">
                        How can I assist your stay?
                      </h4>
                      <p className="text-[11px] text-[#5C454B] dark:text-gray-400 mt-0.5 max-w-[240px]">
                        Ask about room rates, reservations, amenities, or policies.
                      </p>

                      {/* Quick Prompt Suggestions */}
                      <div className="mt-3.5 space-y-1.5 w-full">
                        {QUICK_PROMPTS.map((prompt, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSendAi(prompt)}
                            disabled={aiLoading}
                            className="w-full text-left px-3 py-2 rounded-xl text-[11px] font-medium bg-white dark:bg-[#1A0E13] hover:bg-[#FAF5F5] dark:hover:bg-[#25121B] border border-[#D9C3C3] dark:border-white/10 transition-colors flex items-center justify-between text-[#5C454B] hover:text-[#130005] dark:text-gray-300 dark:hover:text-white group shadow-xs cursor-pointer"
                          >
                            <span>{prompt}</span>
                            <ArrowRight className="size-3 text-[#5C454B]/40 group-hover:text-[#900546] transition-colors" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    aiMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex gap-2.5 ${
                          msg.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        {msg.role === "ai" && (
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#130005] text-[#F968AC] border border-[#900546]/40 mt-0.5 shadow-xs">
                            <Bot className="size-3.5" />
                          </div>
                        )}
                        <div
                          className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs ${
                            msg.role === "user"
                              ? "bg-[#900546] text-white rounded-tr-xs"
                              : "bg-white dark:bg-[#25121B] text-[#130005] dark:text-gray-100 border border-[#D9C3C3] dark:border-white/10 rounded-tl-xs"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        </div>
                        {msg.role === "user" && (
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#E4D1D1]/60 text-[#130005] mt-0.5">
                            <User className="size-3.5" />
                          </div>
                        )}
                      </div>
                    ))
                  )}

                  {aiLoading && (
                    <div className="flex gap-2.5 justify-start">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#130005] text-[#F968AC] border border-[#900546]/40 mt-0.5 shadow-xs">
                        <Bot className="size-3.5" />
                      </div>
                      <div className="max-w-[80%] rounded-2xl rounded-tl-xs bg-white dark:bg-[#25121B] border border-[#D9C3C3] dark:border-white/10 px-3.5 py-2.5 shadow-xs">
                        <div className="flex items-center gap-2 text-xs text-[#5C454B] dark:text-gray-300">
                          <Loader2 className="size-3.5 animate-spin text-[#900546]" />
                          <span>Finding answers...</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* AI Input */}
                <div className="border-t border-[#D9C3C3] dark:border-white/10 p-3 bg-white dark:bg-[#1A0E13]">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendAi();
                    }}
                    className="flex items-center gap-2"
                  >
                    <Input
                      ref={aiInputRef}
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      placeholder="Ask the AI Concierge anything..."
                      disabled={aiLoading}
                      className="flex-1 h-9.5 text-xs bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 rounded-xl focus-visible:ring-[#900546]"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!aiInput.trim() || aiLoading}
                      className="shrink-0 h-9.5 px-3.5 rounded-xl gap-1 text-xs font-semibold bg-[#900546] hover:bg-[#720336] text-white cursor-pointer"
                    >
                      {aiLoading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Send className="size-3.5" />
                      )}
                    </Button>
                  </form>
                </div>
              </>
            )}

            {/* ── MODE 2: LIVE RECEPTIONIST ── */}
            {mode === "staff" && (
              <>
                {/* Switch to AI Banner */}
                <div className="bg-[#FAF5F5] dark:bg-[#25121B] border-b border-[#D9C3C3] dark:border-white/10 px-3.5 py-2 flex items-center justify-between text-[11px] text-[#5C454B] dark:text-gray-300">
                  <span className="truncate">Need instant answers about policies?</span>
                  <button
                    onClick={() => setMode("ai")}
                    className="inline-flex items-center gap-1 font-semibold text-[#900546] dark:text-[#F968AC] hover:underline shrink-0 ml-2 cursor-pointer"
                  >
                    <Sparkles className="size-3 text-[#F968AC]" />
                    <span>Switch to AI</span>
                  </button>
                </div>

                {!chatId ? (
                  /* Name Intake Form */
                  <div className="flex flex-col items-center justify-center p-6 min-h-[340px] text-center bg-[#FAF5F5]/60 dark:bg-[#130005]/50">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-[#900546]/10 text-[#900546] dark:text-[#F968AC] border border-[#900546]/20 mb-3 shadow-xs">
                      <Headphones className="size-7" />
                    </div>
                    <h4 className="text-sm font-bold text-[#130005] dark:text-white">
                      Connect with Front Desk
                    </h4>
                    <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-1 mb-5 max-w-[260px]">
                      Please enter your name so our receptionist can address you personally.
                    </p>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleNameSubmit();
                      }}
                      className="w-full space-y-2.5 max-w-[280px]"
                    >
                      <Input
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        placeholder="Your full name..."
                        disabled={staffSubmitting}
                        className="h-9.5 text-xs bg-white dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 text-center font-medium focus-visible:ring-[#900546]"
                        required
                        autoFocus
                      />
                      <Button
                        type="submit"
                        disabled={!nameInput.trim() || staffSubmitting}
                        className="w-full h-9.5 text-xs font-semibold gap-1.5 bg-[#900546] hover:bg-[#720336] text-white cursor-pointer"
                      >
                        {staffSubmitting ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <span>Start Live Chat</span>
                            <ArrowRight className="size-3.5" />
                          </>
                        )}
                      </Button>
                    </form>
                  </div>
                ) : (
                  /* Live Staff Conversation Thread */
                  <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[380px] bg-[#FAF5F5]/60 dark:bg-[#130005]/50">
                      {staffConvo.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-[#5C454B] dark:text-gray-400 py-10 text-center">
                          <MessageCircle className="size-8 mb-2 text-[#618685]" />
                          <p className="text-xs font-semibold text-[#130005] dark:text-white">
                            Connected to Reception
                          </p>
                          <p className="text-[11px] text-[#5C454B] dark:text-gray-400 mt-0.5 max-w-[240px]">
                            Type your message below. A staff member will reply shortly.
                          </p>
                        </div>
                      )}

                      {staffConvo.map((msg, i) => {
                        const timeFormatted = formatMessageExactTime(msg.timestamp);
                        const isClient = msg.user === "client";

                        return (
                          <div
                            key={i}
                            className={`flex flex-col ${
                              isClient ? "items-end" : "items-start"
                            }`}
                          >
                            <div
                              className={`flex gap-2 max-w-[82%] ${
                                isClient ? "flex-row-reverse" : "flex-row"
                              }`}
                            >
                              {!isClient && (
                                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#618685] text-white mt-0.5 shadow-xs">
                                  <Headphones className="size-3.5" />
                                </div>
                              )}
                              <div
                                className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs ${
                                  isClient
                                    ? "bg-[#900546] text-white rounded-tr-xs"
                                    : "bg-white dark:bg-[#25121B] text-[#130005] dark:text-gray-100 border border-[#D9C3C3] dark:border-white/10 rounded-tl-xs"
                                }`}
                              >
                                <p className="whitespace-pre-wrap break-words">
                                  {msg.message}
                                </p>
                              </div>
                            </div>

                            {/* Exact Timestamp & Delivery/Seen Checkmark */}
                            {timeFormatted && (
                              <div
                                className={`flex items-center gap-1 mt-0.5 px-1 text-[10px] text-[#5C454B] dark:text-gray-400 ${
                                  isClient ? "justify-end" : "justify-start"
                                }`}
                              >
                                <span>{timeFormatted}</span>
                                {isClient && (
                                  msg.seen ? (
                                    <span
                                      className="flex items-center text-[#618685] font-medium"
                                      title="Seen by staff"
                                    >
                                      <CheckCheck className="size-3" />
                                    </span>
                                  ) : (
                                    <span
                                      className="flex items-center text-muted-foreground"
                                      title="Delivered"
                                    >
                                      <Check className="size-3" />
                                    </span>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {staffLoading && (
                        <div className="flex flex-col items-end">
                          <div className="rounded-2xl rounded-tr-xs bg-[#900546] text-white px-3.5 py-2 text-xs shadow-xs">
                            <div className="flex items-center gap-2">
                              <Loader2 className="size-3 animate-spin" />
                              <span>Sending message...</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div ref={messagesEndRef} />
                    </div>

                    {/* Staff Chat Input */}
                    <div className="border-t border-[#D9C3C3] dark:border-white/10 p-3 bg-white dark:bg-[#1A0E13]">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSendStaff();
                        }}
                        className="flex items-center gap-2"
                      >
                        <Input
                          ref={staffInputRef}
                          value={staffInput}
                          onChange={(e) => setStaffInput(e.target.value)}
                          placeholder="Type a message to front desk..."
                          disabled={staffLoading}
                          className="flex-1 h-9.5 text-xs bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 rounded-xl focus-visible:ring-[#900546]"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          disabled={!staffInput.trim() || staffLoading}
                          className="shrink-0 h-9.5 px-3.5 rounded-xl gap-1 text-xs font-semibold bg-[#900546] hover:bg-[#720336] text-white cursor-pointer"
                        >
                          {staffLoading ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Send className="size-3.5" />
                          )}
                        </Button>
                      </form>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
