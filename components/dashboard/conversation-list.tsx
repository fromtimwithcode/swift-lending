"use client";

import { cn } from "@/lib/utils";

interface Conversation {
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  lastMessage: string;
  lastTime: number;
  unread: number;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (partnerId: string) => void;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: ConversationListProps) {
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  if (conversations.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No conversations yet
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {conversations.map((conv) => (
        <button
          key={conv.partnerId}
          onClick={() => onSelect(conv.partnerId)}
          className={cn(
            "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
            selectedId === conv.partnerId && "bg-muted"
          )}
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {conv.partnerName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium truncate">
                {conv.partnerName}
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
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
      ))}
    </div>
  );
}
