import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { LOAN_STATUS_LABELS } from "./constants";
import { getProgressStatusAfterChange, type LoanStatus } from "./loanStatus";

// Validation runs before writes; callers share the same atomic status/note/audit path.
export async function saveLoanStatusChange(
  ctx: MutationCtx,
  loan: Doc<"loans">,
  actor: Doc<"userProfiles">,
  status: LoanStatus,
  note: string | undefined,
) {
  const statusNote = note?.trim() || undefined;
  await ctx.db.patch(loan._id, {
    status, statusNote, statusUpdatedAt: Date.now(), statusUpdatedBy: actor._id,
    progressStatus: getProgressStatusAfterChange(loan, status),
  });
  await ctx.runMutation(internal.notifications.createNotification, {
    recipientId: loan.borrowerId,
    type: "loan_status_changed",
    title: "Loan Status Updated",
    body: `Your loan for ${loan.propertyAddress} has been updated to "${LOAN_STATUS_LABELS[status]}".${statusNote ? `\n\n${statusNote}` : ""}`,
    loanId: loan._id,
    sendSms: true,
  });
  await ctx.runMutation(internal.activityLog.log, {
    userId: actor._id,
    userName: actor.displayName,
    action: "loan.status",
    entityType: "loan",
    entityId: loan._id,
    details: `Changed status from "${LOAN_STATUS_LABELS[loan.status]}" to "${LOAN_STATUS_LABELS[status]}" for ${loan.propertyAddress}${statusNote ? `\nExplanation: ${statusNote}` : ""}`,
    metadata: JSON.stringify({ previousStatus: loan.status, status, ...(statusNote ? { statusNote } : {}) }),
  });
}
