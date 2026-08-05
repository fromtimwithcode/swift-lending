# Production rollout runbook

This release widens the data model, preserves the previous Settings API, and
adds auditable migrations. It does not narrow the schema. Existing loan terms,
charge amounts, and payment records remain unchanged.

## Before deployment

1. Review and commit the complete release diff from a clean worktree.
2. Create a production backup in the Convex dashboard and retain the current
   web deployment for a frontend rollback.
3. Confirm the production Convex environment includes `CONVEX_SITE_URL`,
   `RESEND_API_KEY`, `BORROWER_DATA_ENCRYPTION_KEY`, `SITE_URL`, and, when SMS
   reminders are enabled, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and
   `TWILIO_FROM_PHONE`. Keep all values in the deployment environment, never in
   Git.
4. Confirm the web host uses the production `NEXT_PUBLIC_CONVEX_URL` and
   `NEXT_PUBLIC_CONVEX_SITE_URL`, and has `GOOGLE_MAPS_API_KEY`. Do not build the
   production site with development Convex URLs.
5. Run the complete local gate:

   ```bash
   CI=true pnpm install --frozen-lockfile
   pnpm test
   pnpm lint
   pnpm exec tsc --noEmit
   pnpm audit
   pnpm build
   ```

6. Confirm the Convex CLI names the intended production deployment before
   approving either command below:

   ```bash
   pnpm exec convex deploy --dry-run
   pnpm exec convex deploy --message "App configuration compatibility rollout"
   ```

Deploy Convex first. The new backend serves both the previous Settings client
and the new versioned client. Deploy the web application only after the Convex
deployment succeeds.

## Seed the versioned configuration

Preview the exact production singleton, then insert it:

```bash
pnpm exec convex run migrations:seedAppConfiguration '{"dryRun":true}' --prod
pnpm exec convex run migrations:seedAppConfiguration '{}' --prod
```

The mutation is idempotent and never replaces an existing configuration.

## Backfill immutable loan-policy snapshots

Preview each batch first. If `isDone` is false, repeat the dry-run command with
the returned `continueCursor`. Then start the resumable write:

```bash
pnpm exec convex run migrations:backfillLoanConfigurationSnapshots '{"dryRun":true}' --prod
pnpm exec convex run migrations:backfillLoanConfigurationSnapshots '{}' --prod
pnpm exec convex run migrations:auditLoanConfigurationSnapshots '{}' --prod
```

The write adds only missing `paymentDueDay`, `pointsPercentage`,
`loanTermMonths`, and `configurationVersion` snapshots. It does not recalculate
saved rates, points earned, maturity dates, charges, or payments. The audit is
complete when every page has an empty `incompleteLoanIds` list.

## Reconcile combined interest-payment statuses

The current UI records monthly interest and same-due-date draw proration as one
payment. This repair marks a remaining scheduled charge paid only when eligible
payments for that due date cover the complete, non-waived combined group.

Audit, preview, apply, and audit again:

```bash
pnpm exec convex run migrations:auditCombinedInterestChargeStatuses '{}' --prod
pnpm exec convex run migrations:reconcileCombinedInterestChargeStatuses '{"dryRun":true}' --prod
pnpm exec convex run migrations:reconcileCombinedInterestChargeStatuses '{}' --prod
pnpm exec convex run migrations:auditCombinedInterestChargeStatuses '{}' --prod
```

For a paginated dry run or audit, pass the returned cursor as
`{"dryRun":true,"cursor":"..."}` or `{"cursor":"..."}`. The applied migration
self-schedules later batches and is idempotent. Completion means every audit
page has an empty `incompleteGroups` list. Save all command output with the
release record.

Do not run the older broad interest-charge backfills as part of this release;
they are unrelated to this targeted reconciliation.

## Verify and observe

- Confirm an unauthenticated request to `/api/places?input=123%20Main` returns
  `401`, and that `/dashboard/admin` redirects to `/login`.
- Confirm the deployed responses include `Content-Security-Policy`,
  `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, and
  `Permissions-Policy`, with no `X-Powered-By` header.
- Confirm both the previous and current Settings clients can read the default
  rate. Publish a no-op preview, then a low-risk approved change if desired.
- Confirm configuration history and the activity log record the same version.
- Confirm the affected loan shows one payment and both combined interest
  charges as paid, with payment amount and link unchanged.
- Check existing loan principal, monthly payment, maturity, and posted payment
  history against the pre-deployment record.
- For comparable-rule changes, wait for the rebuild job to reach `completed`.
- Monitor Convex errors, Vercel errors, login, admin Settings, loan detail, and
  payment entry during the observation window.

## Rollback

A frontend-only rollback is safe: keep the widened Convex backend deployed and
restore the previous web deployment. The backend preserves the previous
Settings query fields and `updateDefaultInterestRate` mutation, while every
configuration publish also updates the legacy `appSettings` record.

Do **not** deploy the pre-release Convex schema after new configuration records
or snapshot fields exist. If backend behavior needs correction, deploy a
fix-forward bundle that retains the widened schema and compatibility API. Do
not delete configuration history or policy snapshots. If reconciliation output
does not match the reviewed dry run, stop before applying it; after application,
use the retained backup and the saved audit output to plan an explicit repair.
