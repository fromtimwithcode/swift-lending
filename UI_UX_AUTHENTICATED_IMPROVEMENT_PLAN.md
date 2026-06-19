# Authenticated UI/UX Improvement Plan

## Scope

Improve the authenticated dashboard experience only. This includes routes under `app/dashboard/` and shared dashboard components under `components/dashboard/`.

## Non-Goals

- Do not change landing page UI.
- Do not change login/auth UI.
- Do not change Convex schema, queries, mutations, auth, permissions, or business workflows.
- Do not change form payloads, redirect behavior, validation rules, or data calculations.
- Do not introduce new dependencies unless explicitly approved.

## Design Brief

- Direction: polished fintech dashboard with Airbnb/CashApp-level breathing room and clarity.
- Density: comfortable by default, not compact.
- Surfaces: soft cards, subtle shadow/ring separation, consistent rounded corners.
- Typography: clear hierarchy, balanced headings, tabular numbers for financial data.
- Motion: short, purposeful transitions with reduced-motion safety.
- Accessibility: keyboard-reachable controls, visible focus rings, ARIA semantics for composite controls.

## Progress Tracker

| Phase | Status | Notes |
| --- | --- | --- |
| 1. Scope and tracker | Complete | Created this file and kept implementation authenticated-only. |
| 2. Dashboard shell polish | Complete | Updated dashboard content rail, topbar context, sidebar accessibility, mobile spacing, and account-state cards. |
| 3. Shared component polish | Complete | Updated tables, KPI cards, headers, empty states, skeletons, search, tabs, and bulk action bar. |
| 4. Dialog/popover/action polish | Complete | Improved notification/export popovers, confirm dialogs, notification feed rows, and messenger controls. |
| 5. Verification | Complete | Lint, TypeScript, and production build completed. |
| 6. Dashboard navigation speed pass | Complete | Consolidated chrome subscriptions, lazy-loaded notification list data, dynamically loaded floating messenger, and linked the sidebar logo directly to role dashboards. |
| 7. Cold navigation speed pass | Complete | Added intent-based route/query prewarming, split admin chart bundle, deferred secondary admin analytics, lazy-loaded admin chart drilldown loans, and consolidated investor dashboard data. |
| 8. Non-selectable controls | Complete | Made button, button-role, badge, bubble, and button-like link text non-selectable while preserving text selection in inputs and normal content. |
| 9. Sidebar collapse animation polish | Complete | Reworked sidebar label reveal timing, clipping, rail icon centering, expander row animation, and matched content offset easing. |
| 10. KPI and badge text-fit pass | Complete | Removed KPI label/subtitle clipping, added badge text-fit safeguards, and added a sixth admin KPI so rows stay balanced across breakpoints. |
| 11. Table badge fit correction | Complete | Kept status badges atomic and let shared tables scroll horizontally instead of crushing labels on narrow columns. |

## Implementation Checklist

- [x] Keep public landing components untouched.
- [x] Keep login/auth components untouched.
- [x] Preserve existing component APIs where possible.
- [x] Prefer small shared-component edits over page-by-page rewrites.
- [x] Use real buttons/links for interactive controls.
- [x] Add focus-visible states to dashboard controls.
- [x] Ensure icon-only controls have accessible names.
- [x] Keep touch targets at least 40x40 where practical.
- [x] Avoid `transition-all` and broad animation changes.
- [x] Avoid duplicate dashboard chrome subscriptions.
- [x] Lazy-load non-critical dashboard overlay data until opened.
- [x] Prefetch likely dashboard destinations only after user intent.
- [x] Avoid initial subscriptions for admin data used only by drilldowns.
- [x] Prevent accidental text selection inside badges, bubbles, and buttons.
- [x] Keep sidebar labels single-line and clipped during collapse/expand transitions.
- [x] Respect reduced-motion preferences for sidebar layout transitions.
- [x] Let KPI labels, values, and subtitles wrap without clipping.
- [x] Keep badge/pill text within its surface without accidental selection.
- [x] Avoid orphaned single-card rows in the admin KPI layout.
- [x] Keep status badge words intact inside data-table columns.
- [x] Validate with `pnpm lint` and `pnpm build`.

## Deferred Functional Issues

These were found during review but are intentionally out of scope because they change behavior or public-site functionality:

- Public landing CTAs and placeholder links.
- Public contact form submission behavior.
- Login return-url handling and auth error messaging.
- Founder/testimonial content updates.

## Verification Log

- `pnpm lint` completed with 0 errors. Existing warnings remain in landing/generated/Convex files outside this authenticated-area scope.
- `pnpm exec tsc --noEmit` completed successfully.
- `pnpm build` completed successfully.
- Speed pass verification: `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build` completed successfully. Lint still reports the existing unrelated warnings in landing/generated/auth files.
- Cold navigation pass verification: reviewed Convex project rules and current self-hosting docs, then `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build` completed successfully. Lint still reports the existing unrelated warnings in landing/generated/auth files.
- Non-selectable controls verification: `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build` completed successfully. Lint still reports the existing unrelated warnings in landing/generated/auth files.
- Sidebar animation verification: `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build` completed successfully. Lint still reports the existing unrelated warnings in landing/generated/auth files.
- KPI and badge text-fit verification: `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build` completed successfully. Lint still reports the existing unrelated warnings in landing/generated/auth files.
- Table badge fit correction verification: `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build` completed successfully. Lint still reports the existing unrelated warnings in landing/generated/auth files.
