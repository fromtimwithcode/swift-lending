# Agent Notes

## Commands
- Use `pnpm` in this repo; `pnpm-lock.yaml` is the only lockfile.
- Dev server: `pnpm dev`. Production check/build: `pnpm build`. Lint: `pnpm lint`.
- There is no test script or test runner config checked in. For a focused TypeScript check, use `pnpm exec tsc --noEmit`.
- Convex local/codegen workflow is via the Convex CLI, typically `pnpm exec convex dev`; run one-off Convex functions with `pnpm exec convex run module:function`.

## Framework Gotchas
- This is Next.js `16.2.2`, not older Next.js. Before editing Next-specific APIs, read the relevant docs under `node_modules/next/dist/docs/` and heed deprecations.
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
- Required runtime envs are inferred from code: `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_SITE_URL`, `RESEND_API_KEY`, and `GOOGLE_MAPS_API_KEY`.
- Optional notification/site envs used by Convex email code: `LOAN_ALERT_EMAILS` and `SITE_URL`.
- `.env.local` exists; do not print or commit secrets from it.
