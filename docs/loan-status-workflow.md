# Loan status explanations

Admins and developers select an available next status on the loan detail page, enter an explanation in the dialog, and select **Save status**. The selected status is a proposal until it is saved. Cancel or Escape discards the draft. Clicking the backdrop does not discard entered text.

| New status | Explanation |
| --- | --- |
| Info Needed | Required: what information or documents the borrower must provide |
| Denied | Required: reason for denial |
| Other allowed statuses | Optional borrower note |

Explanations are trimmed and limited to 2,000 characters. The dialog explicitly states that the text is visible to the borrower and included in status notifications. It is not an internal note.

## Approval and feedback

Any status other than Closed can move to any other status. For example, an Approved loan can still move to Sent to Title, Info Needed, or back to Under Review. Closed or returned loans cannot be reopened through these controls. The current status appears separately from the available actions.

The borrower timeline shows Submitted → Under Review → Approved → Funded → Sent to Title → Closed. When a loan moves to Info Needed or Denied, `loans.progressStatus` keeps the step it had reached, so a funded loan that needs information still shows Funded. Loans moved to Info Needed before this field existed show Under Review.

Saving disables further submission and dismissal until the request resolves. Failures retain the draft and show a safe message. When another administrator changes the status while a dialog is open, the request is rejected and the administrator is asked to close the dialog and review the updated loan. Repeating a request for an already-current status makes no changes and produces no additional notifications.

The latest explanation appears on both admin and borrower loan pages. A later status change replaces it, or clears it if the next status has no explanation. Recording returned funds also clears it. Every actual status change saves a per-loan activity entry with the old/new status, explanation, author, and creation time. Previous explanations remain in that activity history; expand the status-change entry in Activity Log to read the full text. General loan notes are separate.

## Bulk updates

Select loans, choose **Change Status**, then choose the new status and enter the shared explanation in the same dialog. The explanation applies to each loan that is actually updated. Each loan is checked independently against its status when the dialog opened.

The result distinguishes updated loans, loans already in that status, and failures. Failed loans remain selected, with their property addresses and individual failure reasons shown on the loan list. Successful loans are deselected. Bulk changes use the same validation, persistence, borrower notification, and per-loan audit logic as individual changes; the team receives one summary for the loans actually changed.

## Implementation and rollout

- Rules: `convex/lib/loanStatus.ts`.
- Writes: `updateLoanStatus`, `bulkUpdateLoanStatus`, and private `saveLoanStatusChange` in `convex/admin.ts`.
- Optional loan fields: `statusNote`, `statusUpdatedAt`, `statusUpdatedBy`.
- UI: `loan-status-controls.tsx`, `loan-status-dialog.tsx`, and `loan-status-note.tsx`.
- Validation errors use structured `ConvexError({ publicMessage })`; ordinary internal/transport errors remain hidden by `lib/errors.ts`.

No backfill is needed. Existing loans and initial admin-created statuses can lack explanations. The requirement applies when changing an existing loan's status. Historical explanations that were never recorded cannot be reconstructed.

Deploy the updated Convex schema/functions before the new frontend, as the new frontend sends `note` and snapshot arguments. Deploy both in the same release: an old frontend cannot supply required explanations for Info Needed or Denied. Existing notification settings still govern delivery; SMS uses the existing 1,500-character message cap, while the full explanation remains in the portal and email.

## Regression checks

`convex/loanStatus.test.ts` covers approval transitions, required/oversized notes, persistence and clearing, audit history, notification scheduling, repeat saves, stale dialogs, role restrictions, returned loans, and mixed bulk results. `tests/ui/loan-status.spec.ts` exercises the actual pages against an isolated test adapter across browser engines and responsive sizes. This intentionally complements, rather than replaces, the backend tests.

Run `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`, and `pnpm test:ui`. Browser setup requires the Playwright browsers and the Next-generated font from a successful build. Production authentication, physical-device keyboards, and actual email/SMS delivery require a deployed smoke check; no such messages are sent by this test suite.
