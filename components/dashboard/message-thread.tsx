"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  _id: Id<"messages">;
  _creationTime: number;
  senderId: Id<"userProfiles">;
  recipientId: Id<"userProfiles">;
  content: string;
  isRead: boolean;
}

interface MessageThreadProps {
  messages: Message[];
  currentUserId: Id<"userProfiles">;
  partnerId: Id<"userProfiles">;
  partnerName: string;
}

export function MessageThread({
  messages,
  currentUserId,
  partnerId,
  partnerName,
}: MessageThreadProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const sendMessage = useMutation(api.messages.sendMessage);
  const markRead = useMutation(api.messages.markMessagesRead);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Mark unread messages as read
  useEffect(() => {
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

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
      " " +
      d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* Header */}
      <div className="min-w-0 border-b border-border px-4 py-3">
        <h3 className="truncate font-semibold">{partnerName}</h3>
      </div>

      {/* Messages */}
      <div className="min-w-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            No messages yet. Start the conversation.
          </p>
        )}
        {messages.map((msg) => {
          const isMine = msg.senderId === currentUserId;
          return (
            <div
              key={msg._id}
              className={cn("flex", isMine ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "min-w-0 max-w-[min(75%,32rem)] rounded-2xl px-4 py-2",
                  isMine
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted rounded-bl-md"
                )}
              >
                <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{msg.content}</p>
                <p
                  className={cn(
                    "mt-1 text-[10px]",
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
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex min-w-0 items-center gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Type a message..."
            className="min-h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!text.trim() || sending}
            aria-label="Send message"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-[background-color,scale] hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 active:scale-[0.96] disabled:opacity-50 disabled:active:scale-100"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
