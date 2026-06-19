"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/dashboard/page-header";
import { MessageThread } from "@/components/dashboard/message-thread";
import { ConversationList } from "@/components/dashboard/conversation-list";
import { MessageSquare } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageSkeleton } from "@/components/dashboard/skeleton";

export default function AdminMessagesPage() {
  const profile = useQuery(api.users.getMe);
  const conversations = useQuery(api.messages.getConversations);
  const searchParams = useSearchParams();
  const preselectedPartner = searchParams.get("partnerId");
  const [selectedPartnerOverride, setSelectedPartnerOverride] = useState<string | null | undefined>();
  const selectedPartnerId = selectedPartnerOverride !== undefined ? selectedPartnerOverride : preselectedPartner;

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

      <div className="flex h-[calc(100dvh_-_12rem)] min-h-[360px] min-w-0 overflow-hidden rounded-xl border border-border bg-card sm:h-[calc(100dvh_-_220px)]">
        {/* Left - Conversations */}
        <div className="hidden w-72 shrink-0 overflow-y-auto border-r border-border sm:block">
          <div className="border-b border-border px-4 py-3">
            <span className="text-sm font-medium">Conversations</span>
          </div>
          <ConversationList
            conversations={conversations ?? []}
            selectedId={selectedPartnerId ?? undefined}
            onSelect={setSelectedPartnerOverride}
          />
        </div>

        {/* Mobile */}
        <div className="min-w-0 w-full sm:hidden">
          {!selectedPartnerId ? (
            <div className="h-full overflow-y-auto">
              <div className="border-b border-border px-4 py-3">
                <span className="text-sm font-medium">Conversations</span>
              </div>
              <ConversationList
                conversations={conversations ?? []}
                selectedId={undefined}
                onSelect={setSelectedPartnerOverride}
              />
            </div>
          ) : (
            <div className="flex h-full min-w-0 flex-col">
              <button
                onClick={() => setSelectedPartnerOverride(null)}
                className="border-b border-border px-4 py-2 text-left text-sm text-primary hover:bg-muted"
              >
                &larr; Back to conversations
              </button>
              <div className="min-h-0 min-w-0 flex-1">
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
        <div className="hidden min-w-0 flex-1 flex-col sm:flex">
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
