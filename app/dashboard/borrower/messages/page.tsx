"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/dashboard/page-header";
import { MessageThread } from "@/components/dashboard/message-thread";
import { ConversationList } from "@/components/dashboard/conversation-list";
import { MessageSquare, Plus } from "lucide-react";
import { useState } from "react";
import { PageSkeleton } from "@/components/dashboard/skeleton";

export default function BorrowerMessagesPage() {
  const profile = useQuery(api.users.getMe);
  const conversations = useQuery(api.messages.getConversations);
  const admins = useQuery(api.users.getAdminUsers);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [showNewMessage, setShowNewMessage] = useState(false);

  const messages = useQuery(
    api.messages.getDirectMessages,
    selectedPartnerId
      ? { partnerId: selectedPartnerId as Id<"userProfiles"> }
      : "skip"
  );

  if (profile === undefined || conversations === undefined) {
    return <PageSkeleton />;
  }

  if (!profile) return null;

  const selectedPartner = conversations?.find(
    (c) => c.partnerId === selectedPartnerId
  );
  const selectedPartnerName =
    selectedPartner?.partnerName ??
    admins?.find((a) => a._id === selectedPartnerId)?.displayName ??
    "Unknown";

  const handleNewMessage = (adminId: string) => {
    setSelectedPartnerId(adminId);
    setShowNewMessage(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Messages" description="Chat with your lender" />

      <div className="flex h-[calc(100vh-220px)] overflow-hidden rounded-xl border border-border bg-card">
        {/* Left - Conversations */}
        <div className="w-72 shrink-0 border-r border-border overflow-y-auto hidden sm:block">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-medium">Conversations</span>
            <button
              onClick={() => setShowNewMessage(!showNewMessage)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Plus className="size-4" />
            </button>
          </div>

          {showNewMessage && admins && (
            <div className="border-b border-border p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Start new conversation:
              </p>
              {admins.map((admin) => (
                <button
                  key={admin._id}
                  onClick={() => handleNewMessage(admin._id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {admin.displayName.charAt(0)}
                  </div>
                  {admin.displayName}
                </button>
              ))}
            </div>
          )}

          <ConversationList
            conversations={conversations ?? []}
            selectedId={selectedPartnerId ?? undefined}
            onSelect={setSelectedPartnerId}
          />
        </div>

        {/* Mobile conversation selector */}
        <div className="sm:hidden w-full">
          {!selectedPartnerId ? (
            <div className="h-full overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="text-sm font-medium">Conversations</span>
                <button
                  onClick={() => setShowNewMessage(!showNewMessage)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Plus className="size-4" />
                </button>
              </div>
              {showNewMessage && admins && (
                <div className="border-b border-border p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Start new conversation:
                  </p>
                  {admins.map((admin) => (
                    <button
                      key={admin._id}
                      onClick={() => handleNewMessage(admin._id)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {admin.displayName.charAt(0)}
                      </div>
                      {admin.displayName}
                    </button>
                  ))}
                </div>
              )}
              <ConversationList
                conversations={conversations ?? []}
                selectedId={undefined}
                onSelect={setSelectedPartnerId}
              />
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <button
                onClick={() => setSelectedPartnerId(null)}
                className="border-b border-border px-4 py-2 text-left text-sm text-primary hover:bg-muted"
              >
                &larr; Back to conversations
              </button>
              <div className="flex-1">
                <MessageThread
                  messages={messages ?? []}
                  currentUserId={profile._id}
                  partnerId={selectedPartnerId as Id<"userProfiles">}
                  partnerName={selectedPartnerName}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right - Thread (desktop) */}
        <div className="hidden sm:flex flex-1 flex-col">
          {selectedPartnerId ? (
            <MessageThread
              messages={messages ?? []}
              currentUserId={profile._id}
              partnerId={selectedPartnerId as Id<"userProfiles">}
              partnerName={selectedPartnerName}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="mx-auto size-12 text-muted-foreground/30" />
                <p className="mt-4 text-sm">
                  Select a conversation or start a new one
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
