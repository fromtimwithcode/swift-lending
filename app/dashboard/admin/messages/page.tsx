"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/dashboard/page-header";
import { MessageThread } from "@/components/dashboard/message-thread";
import { ConversationList } from "@/components/dashboard/conversation-list";
import { MessageSquare } from "lucide-react";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { PageSkeleton } from "@/components/dashboard/skeleton";

export default function AdminMessagesPage() {
  const profile = useQuery(api.users.getMe);
  const conversations = useQuery(api.messages.getConversations);
  const searchParams = useSearchParams();
  const preselectedPartner = searchParams.get("partnerId");

  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(
    preselectedPartner
  );

  useEffect(() => {
    if (preselectedPartner) {
      setSelectedPartnerId(preselectedPartner);
    }
  }, [preselectedPartner]);

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
  const selectedPartnerName = selectedPartner?.partnerName ?? "Unknown";

  return (
    <div className="space-y-6">
      <PageHeader title="Messages" description="Communicate with borrowers" />

      <div className="flex h-[calc(100vh-220px)] overflow-hidden rounded-xl border border-border bg-card">
        {/* Left - Conversations */}
        <div className="w-72 shrink-0 border-r border-border overflow-y-auto hidden sm:block">
          <div className="border-b border-border px-4 py-3">
            <span className="text-sm font-medium">Conversations</span>
          </div>
          <ConversationList
            conversations={conversations ?? []}
            selectedId={selectedPartnerId ?? undefined}
            onSelect={setSelectedPartnerId}
          />
        </div>

        {/* Mobile */}
        <div className="sm:hidden w-full">
          {!selectedPartnerId ? (
            <div className="h-full overflow-y-auto">
              <div className="border-b border-border px-4 py-3">
                <span className="text-sm font-medium">Conversations</span>
              </div>
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
                <p className="mt-4 text-sm">Select a conversation</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
