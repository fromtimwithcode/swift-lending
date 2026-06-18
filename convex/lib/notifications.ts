import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { getAdminLikeUsers } from "./auth";

type NotificationType =
  | "loan_status_changed"
  | "loan_updated"
  | "draw_reviewed"
  | "draw_submitted"
  | "application_submitted"
  | "document_uploaded"
  | "message_received"
  | "payment_recorded"
  | "payment_overdue";

type TeamAlertDetail = {
  label: string;
  value: string;
};

export async function notifyTeam(
  ctx: MutationCtx,
  args: {
    type: NotificationType;
    title: string;
    body: string;
    loanId?: Id<"loans">;
    drawRequestId?: Id<"drawRequests">;
    details?: TeamAlertDetail[];
    actionPath?: string;
    actionLabel?: string;
    dedupeKey?: string;
    sendSms?: boolean;
    sendExternalEmail?: boolean;
  }
) {
  const adminLikeUsers = await getAdminLikeUsers(ctx);
  const excludedExternalEmails = adminLikeUsers
    .filter((admin) => admin.isActive)
    .map((admin) => admin.email);
  const emailedProfileAddresses = new Set<string>();

  for (const admin of adminLikeUsers) {
    const emailKey = admin.email.trim().toLowerCase();
    const shouldSendEmail = admin.isActive && Boolean(emailKey) && !emailedProfileAddresses.has(emailKey);
    if (shouldSendEmail) {
      emailedProfileAddresses.add(emailKey);
    }

    await ctx.runMutation(internal.notifications.createNotification, {
      recipientId: admin._id,
      type: args.type,
      title: args.title,
      body: args.body,
      loanId: args.loanId,
      drawRequestId: args.drawRequestId,
      dedupeKey: args.dedupeKey ? `${args.dedupeKey}:${admin._id}` : undefined,
      sendEmail: shouldSendEmail,
      sendSms: args.sendSms,
    });
  }

  if (args.sendExternalEmail !== false) {
    await ctx.scheduler.runAfter(0, internal.email.sendTeamAlertEmail, {
      title: args.title,
      body: args.body,
      details: args.details,
      actionPath: args.actionPath,
      actionLabel: args.actionLabel,
      excludeEmails: excludedExternalEmails,
    });
  }

  return excludedExternalEmails;
}
