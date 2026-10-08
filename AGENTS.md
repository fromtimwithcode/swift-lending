# Agent Notes

## Commands
- Use `pnpm` in this repo; `pnpm-lock.yaml` is the only lockfile.
- Dev server: `pnpm dev`. Production check/build: `pnpm build`. Lint: `pnpm lint`.
- Unit/backend tests: `pnpm test` (Vitest + convex-test, edge-runtime). Focused TypeScript check: `pnpm exec tsc --noEmit`.
- Browser regression tests: run `pnpm build` once to generate the real application font, then `pnpm test:ui`. Install browsers with `pnpm exec playwright install chromium firefox webkit` if needed. The Vite harness loads the actual loan pages with isolated Convex/navigation adapters; it does not test deployed auth or delivery providers. Vitest excludes `tests/ui/**`.
- Convex local/codegen workflow is via the Convex CLI, typically `pnpm exec convex dev`; run one-off Convex functions with `pnpm exec convex run module:function`.

## Framework Gotchas
- This is Next.js `16.3.0`, not older Next.js. Before editing Next-specific APIs, read the relevant docs under `node_modules/next/dist/docs/` and heed deprecations.
- Tailwind is v4/CSS-first: there is no `tailwind.config.*`; theme tokens and utilities live in `app/globals.css` with `@import "tailwindcss"` and `@theme inline`.
- shadcn config is `components.json` with `style: "base-luma"`, `rsc: true`, aliases like `@/components`, and `iconLibrary: "hugeicons"`.

## App Structure
- App Router entrypoints are under `app/`; root providers are wired in `app/layout.tsx` and `app/ConvexClientProvider.tsx`.
- Dashboard routes are mostly client components using Convex hooks. `app/dashboard/layout.tsx` handles auth gating, pending/deactivated account states, sidebar/topbar, and profile claiming.
- `/dashboard` redirects by `userProfiles.role`: `admin` and `developer` go to `/dashboard/admin`, `borrower` to `/dashboard/borrower`, `investor` to `/dashboard/investor`.
- Shared UI lives in `components/`, reusable helpers in `lib/`, and hooks in `hooks/`. Path alias `@/*` maps to the repo root.

## Convex
- Before editing anything under `convex/`, read `convex/_generated/ai/guidelines.md`; it contains repo-installed Convex rules that override generic Convex assumptions.
- Schema is centralized in `convex/schema.ts` and includes Convex Auth tables via `authTables` plus app tables such as `userProfiles`, `loans`, `drawRequests`, `documents`, `messages`, `investments`, `notifications`, and `activityLog`.
- Convex Auth is configured in `convex/auth.ts`, `convex/auth.config.ts`, and `convex/http.ts`; auth routes are added by `auth.addHttpRoutes(http)`.
- Authorization helpers are in `convex/lib/auth.ts`. `developer` is admin-like: `requireAdmin()` accepts both `admin` and `developer`.
- User profiles are admin-created first, then claimed after login by matching email from the Convex Auth `users` table; do not rely on email claims in the JWT.
- Existing migration pattern is an `internalMutation` in `convex/migrations.ts` with batching and self-scheduling; example run command is `pnpm exec convex run migrations:backfillPaymentType`.

## Environment
- Required runtime envs are inferred from code: `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_SITE_URL`, `RESEND_API_KEY`, `GOOGLE_MAPS_API_KEY`, and the base64-encoded 32-byte `BORROWER_DATA_ENCRYPTION_KEY` configured per Convex deployment.
- Optional notification/site envs used by Convex email code: `LOAN_ALERT_EMAILS` and `SITE_URL`.
- `.env.local` exists; do not print or commit secrets from it.

## Loan Status Workflow
- Shared transition and explanation rules live in `convex/lib/loanStatus.ts`; use them in both UI and backend. Any status except `closed` can move to any other status; `closed` and returned loans are final.
- Status changes to `additional_info_needed` or `denied` require a trimmed, nonblank borrower-visible explanation (maximum 2,000 characters). Other transitions accept optional notes.
- `loans.statusNote` belongs only to the current status. `saveLoanStatusChange` in `convex/admin.ts` updates it atomically with status, author/time, borrower notifications, and a per-loan `loan.status` activity entry. Clear it on later changes without a note, including `recordLoanReturned`; never overwrite general `loans.notes`.
- Single and bulk callers send the status seen when opening the dialog. Reject stale changes; same-status retries do not overwrite notes or send duplicate alerts. Bulk results distinguish `changed: false` from actual changes, retain failed selections, and provide per-loan reasons.
- Expected status errors use `new ConvexError({ publicMessage })` so `lib/errors.ts` can safely show the explanation. Unrecognized string errors are intentionally hidden by that formatter.
- `LoanStatusDialog` uses Base UI for focus trapping, Escape, and scroll locking. Preserve explicit focus on initiating buttons for Safari; return focus to the status section if saving removes the trigger. Keep the dialog footer visible at short viewport heights. The root Toaster uses z-index 55, below status dialogs at 60; preserve that ordering to avoid toast interception in landscape Firefox.
- Existing loans and initial admin-created statuses may have no status explanation; the new fields are optional and need no backfill. See `docs/loan-status-workflow.md` and `docs/loan-status-review.md`.

## Payment Reminders and Charges
- Reminders come from `getReminderData` in `convex/loanPayments.ts`: open charge groups (same-day `monthly_interest` + `draw_proration` combine) and, for due dates with no monthly-interest charge, an estimated `monthly_payment` reminder.
- Deleting requires a trimmed reason (`getDeleteReasonError` in `convex/lib/paymentReminders.ts`). Charge-backed deletes waive the open charges and store `loanCharges.waiver`; estimated reminders get a `paymentReminderDismissals` row. Both are restorable from the loan page and logged to the Activity Log.
- A waived charge forgives only its unpaid balance. Payoff (`convex/lib/payoffCalculations.ts`) pools same-day interest payments the same way reminders do; keep the two consistent.
- Combined interest charge statuses are reconciled by `syncInterestChargeStatusesForDueDate` in `convex/lib/interestChargeStatus.ts`; call it after changing which charges in a due-date group are open.

## Investor Payments
- Investor payment schedules are calculated on read by `summarizeInvestment` in `convex/lib/investmentSchedule.ts`; nothing stores a next payment date. Interest is paid monthly (amount × rate ÷ 12) on the first payment date's day of the month, and the first payment is prorated when it is not one month after inception.
- `investorPayouts` is the payment ledger. Payouts plus `investments.priorPaymentsReceived` cover the oldest scheduled payment first, the same pooling idea as loan reminders.
- Investment dates are calendar days stored as UTC-midnight timestamps. Format and parse them only with the `investmentSchedule` helpers (`formatCalendarDay`, `parseIsoCalendarDay`, `toIsoCalendarDay`); `toLocaleDateString()` shows the previous day in US timezones.
- `getInvestmentTerms` in `convex/lib/investorPortfolio.ts` also reads documents written before `migrations:backfillInvestmentPaymentSchedules`. Remove that fallback and the optional legacy fields once the migration has run in production.
