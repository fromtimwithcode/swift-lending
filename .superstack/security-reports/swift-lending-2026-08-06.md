# Swift Lending production security and readiness review

Date: 2026-08-06  
Scope: the complete local release worktree, the built Next.js application, the
development Convex deployment, and read-only aggregate checks against the
production Convex deployment.

## Outcome

No verified critical or high-severity security issue remains open in the
reviewed release. Two release weaknesses found during the audit were corrected:
the Google Places proxy now requires an authenticated session, and every Next.js
response receives baseline browser security headers. The release bundle passes
the production build and Convex production deploy dry-run.

Production has not been mutated. Before release, operators must create a backup,
commit the reviewed worktree, configure the missing SMS sender if SMS is enabled,
deploy Convex first, and run the documented idempotent migrations.

## Architecture and data classification

| Area | Implementation | Security relevance |
| --- | --- | --- |
| Web | Next.js 16.3 / React 19, normally hosted on Vercel | Authenticated dashboards and a same-origin Places route |
| Backend | Convex 1.43 with Convex Auth | Authorization, lending records, jobs, storage metadata, and audit records |
| Identity | Google OAuth and email OTP through Convex Auth | Account access and role-based authorization |
| External services | Google Places, Resend, Twilio, RentCast | Server-side credentials and usage quotas |
| Sensitive data | Borrower identity, EIN, bank details, loan/payment records | EIN and bank values use AES-GCM with a deployment-held 32-byte key; access is admin-only and reveals are audited |

## Verified findings

### Resolved — unauthenticated Google Places quota use (8.1/10)

- Evidence: `GET /api/places` previously called the paid upstream API without a
  session check.
- Impact: an unauthenticated caller could consume the deployment's Google API
  quota and create avoidable cost or availability loss.
- Remediation: the route now calls `isAuthenticatedNextjs()` before validating
  input or contacting Google.
- Verification: the optimized production server returns `401` for an
  unauthenticated request.

### Resolved — missing browser hardening headers (6.8/10)

- Evidence: the current public deployment did not emit CSP, anti-framing,
  MIME-sniffing, referrer, or permissions headers and exposed `X-Powered-By`.
- Remediation: global Next.js headers now set CSP, Referrer-Policy,
  X-Content-Type-Options, X-Frame-Options, and Permissions-Policy, and disable
  the framework fingerprint header.
- Verification: the optimized local server emits all headers and no
  `X-Powered-By` header.

## Release gates and evidence

- Clean lockfile install: passed with `CI=true pnpm install --frozen-lockfile`.
- Unit and integration tests: 33 passed across 10 files.
- TypeScript: passed with no errors.
- ESLint: passed with no errors; seven non-blocking warnings remain (four are
  generated Convex directives, one is an existing auth export style warning,
  and two are landing-page image optimization warnings).
- Production Next.js build: passed for all 38 routes.
- Runtime smoke: `/` and `/login` return 200, unauthenticated admin access
  redirects to `/login`, and unauthenticated Places access returns 401.
- Dependency audit: no known vulnerabilities.
- Convex development publish: passed.
- Migration dry-runs and audits on development: passed; no incomplete records.
- Convex production deploy dry-run: passed schema and index validation, with no
  index deletion.
- Source and history secret scan: no tracked environment/key files, recognized
  private-key/token signatures, lifecycle scripts, or runtime process execution
  surface found.

## Production preflight (read only)

- 15 loans, 27 payments, 52 charges, and 4 draws inspected by aggregate query.
- 0 monthly-payment mismatches against current-principal interest math.
- 0 approved draws missing a wire date.
- 15 loans need the new immutable configuration snapshot fields backfilled.
- 1 legacy combined-payment group has monthly interest marked paid while draw
  proration remains scheduled; eligible payment funding is sufficient.
- 0 paid combined groups are underfunded.
- Production Convex is missing `TWILIO_FROM_PHONE`; configure it before enabling
  or relying on SMS reminders.

## Operational gaps and limits

- No CI workflow is checked in, so this release currently relies on the manual
  gate in the rollout runbook.
- The reviewed worktree contains many uncommitted and untracked release files;
  commit the complete reviewed set together so generated bindings, tests,
  migrations, and UI changes cannot be separated.
- No production data was written and no production web or Convex deployment was
  performed during this review.
- Authenticated browser journeys were not executed with a real production user;
  route guards, authorization helpers, and business flows are covered by source
  review, backend tests, and unauthenticated runtime smoke. Perform the short
  authenticated post-deploy checklist in the rollout runbook during the
  observation window.

## Deployment reference

Follow `docs/app-configuration-rollout.md` exactly. Stop if the production target
is unexpected, a dry-run contains destructive schema/index changes, any audit
returns an underfunded or unexpected group, or the web host is configured with a
development Convex URL.

## Confidence calibration

- Total findings: 2, both remediated during this review.
- Critical: 0.
- High: 1 (confidence 10/10).
- Medium: 1 (confidence 10/10).
- Low: 0.
- Info: 0.
- False positives filtered: 0.
- Mode: Comprehensive (2/10 gate).
