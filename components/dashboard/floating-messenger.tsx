"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import {
  MessageCircle,
  X,
  ArrowLeft,
  Send,
  Loader2,
  MessageSquare,
  Plus,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

type View = "list" | "thread" | "new-message";

interface FloatingMessengerProps {
  profile: {
    _id: Id<"userProfiles">;
    role: string;
  };
  unreadCount?: number;
}

export function FloatingMessenger({
  profile,
  unreadCount,
}: FloatingMessengerProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("list");
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(
    null
  );
  const [selectedPartnerName, setSelectedPartnerName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        fabRef.current &&
        !fabRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const handleSelectConversation = useCallback(
    (partnerId: string, partnerName: string) => {
      setSelectedPartnerId(partnerId);
      setSelectedPartnerName(partnerName);
      setView("thread");
    },
    []
  );

  const handleBack = useCallback(() => {
    setView("list");
  }, []);

  const isNonAdmin = profile.role === "borrower" || profile.role === "investor";

  return (
    <>
      {/* FAB */}
      <motion.button
        type="button"
        ref={fabRef}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-6 z-[60] flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-[box-shadow,scale] hover:shadow-xl hover:shadow-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.96] max-sm:right-4"
        whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
        aria-label={open ? "Close messages" : "Open messages"}
        aria-expanded={open}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="size-6" />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <MessageCircle className="size-6" />
            </motion.span>
          )}
        </AnimatePresence>

        {/* Unread badge */}
        {!open && !!unreadCount && unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </motion.button>

      {/* Panel */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label="Messages"
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-24 right-6 z-[60] flex h-[520px] w-[380px] max-w-[calc(100vw_-_2rem)] origin-bottom-right flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl shadow-black/20 max-sm:bottom-[calc(5.5rem_+_env(safe-area-inset-bottom))] max-sm:left-4 max-sm:right-4 max-sm:h-[70dvh] max-sm:w-auto"
          >
            {view === "list" && (
              <ConversationListView
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onSelectConversation={handleSelectConversation}
                showNewMessageButton={isNonAdmin}
                onNewMessage={() => setView("new-message")}
                onClose={() => setOpen(false)}
              />
            )}
            {view === "thread" && selectedPartnerId && (
              <ThreadView
                key={selectedPartnerId}
                partnerId={selectedPartnerId as Id<"userProfiles">}
                partnerName={selectedPartnerName}
                currentUserId={profile._id}
                onBack={handleBack}
                onClose={() => setOpen(false)}
              />
            )}
            {view === "new-message" && (
              <NewMessageView
                onSelect={(id, name) => {
                  handleSelectConversation(id, name);
                }}
                onBack={handleBack}
                onClose={() => setOpen(false)}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Conversation List ─── */

function ConversationListView({
  searchQuery,
  onSearchChange,
  onSelectConversation,
  showNewMessageButton,
  onNewMessage,
  onClose,
}: {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectConversation: (partnerId: string, partnerName: string) => void;
  showNewMessageButton: boolean;
  onNewMessage: () => void;
  onClose: () => void;
}) {
  const conversations = useQuery(api.messages.getConversations);

  const filtered = conversations?.filter((c) =>
    c.partnerName.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <h3 className="text-sm font-semibold">Messages</h3>
        <div className="flex items-center gap-1">
          {showNewMessageButton && (
            <button
              type="button"
              onClick={onNewMessage}
              className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              aria-label="New message"
            >
              <Plus className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="border-b border-border/60 px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            aria-label="Search conversations"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations..."
            className="min-h-10 w-full rounded-xl border border-border bg-background py-1.5 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {conversations === undefined ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : filtered && filtered.length > 0 ? (
          filtered.map((conv) => (
            <button
              key={conv.partnerId}
              type="button"
              onClick={() =>
                onSelectConversation(conv.partnerId, conv.partnerName)
              }
              className="flex w-full min-w-0 items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {conv.partnerName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex min-w-0 items-center justify-between">
                  <span className="truncate text-sm font-medium">
                    {conv.partnerName}
                  </span>
                  <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">
                    {formatTime(conv.lastTime)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {conv.lastMessage}
                </p>
              </div>
              {conv.unread > 0 && (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {conv.unread}
                </span>
              )}
            </button>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageSquare className="size-10 text-muted-foreground/30" />
            <p className="mt-3 text-xs">
              {searchQuery.trim()
                ? "No matching conversations"
                : "No conversations yet"}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Thread View ─── */

function ThreadView({
  partnerId,
  partnerName,
  currentUserId,
  onBack,
  onClose,
}: {
  partnerId: Id<"userProfiles">;
  partnerName: string;
  currentUserId: Id<"userProfiles">;
  onBack: () => void;
  onClose: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const messages = useQuery(api.messages.getDirectMessages, { partnerId });
  const sendMessage = useMutation(api.messages.sendMessage);
  const markRead = useMutation(api.messages.markMessagesRead);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: shouldReduceMotion ? "auto" : "smooth" });
  }, [messages?.length, shouldReduceMotion]);

  // Focus input when entering thread
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Mark unread messages as read
  useEffect(() => {
    if (!messages) return;
    const unread = messages
      .filter((m) => m.recipientId === currentUserId && !m.isRead)
      .map((m) => m._id);
    if (unread.length > 0) {
      markRead({ messageIds: unread });
    }
  }, [messages, currentUserId, markRead]);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await sendMessage({ recipientId: partnerId, content: text.trim() });
      setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      className="flex h-full min-w-0 flex-col"
      initial={shouldReduceMotion ? false : { x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.15, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Header */}
        <div className="flex min-w-0 items-center gap-2 border-b border-border/60 px-3 py-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {partnerName.charAt(0).toUpperCase()}
        </div>
        <span className="flex-1 truncate text-sm font-semibold">
          {partnerName}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Messages */}
        <div className="min-w-0 flex-1 space-y-2 overflow-y-auto p-3">
        {messages === undefined ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No messages yet. Start the conversation.
          </p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === currentUserId;
            return (
              <div
                key={msg._id}
                className={cn("flex", isMine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "min-w-0 max-w-[min(80%,28rem)] rounded-2xl px-3 py-1.5",
                    isMine
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted rounded-bl-md"
                  )}
                >
                  <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{msg.content}</p>
                  <p
                    className={cn(
                      "mt-0.5 text-[10px]",
                      isMine
                        ? "text-primary-foreground/60"
                        : "text-muted-foreground"
                    )}
                  >
                    {formatTime(msg._creationTime)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border/60 p-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            className="min-h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!text.trim() || sending}
            aria-label="Send message"
            className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-[background-color,scale] hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.96] disabled:opacity-50 disabled:active:scale-100"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── New Message (Admin Picker) ─── */

function NewMessageView({
  onSelect,
  onBack,
  onClose,
}: {
  onSelect: (id: string, name: string) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const admins = useQuery(api.users.getAdminUsers);

  return (
    <motion.div
      className="flex h-full flex-col"
      initial={shouldReduceMotion ? false : { x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.15, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Header */}
      <div className="flex min-w-0 items-center gap-2 border-b border-border/60 px-3 py-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">New Message</span>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Admin List */}
      <div className="min-w-0 flex-1 overflow-y-auto p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Select a contact:
        </p>
        {admins === undefined ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : admins.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No contacts available
          </p>
        ) : (
          admins.map((admin) => (
            <button
              key={admin._id}
              type="button"
              onClick={() => onSelect(admin._id, admin.displayName)}
              className="flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {admin.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 overflow-hidden">
                <p className="truncate text-sm font-medium">
                  {admin.displayName}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {admin.email}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </motion.div>
  );
}

/* ─── Helpers ─── */

function formatTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
