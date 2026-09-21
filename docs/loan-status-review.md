# Loan status implementation and interface review

Reviewed 2026-09-22 in **full** mode. Scope: loan status controls, explanation dialog, borrower/admin explanation display, bulk status dialog/results, and expandable status explanations in the activity log. Framework: Next.js 16.3 / React 19, Tailwind v4 theme tokens, Base UI Dialog, existing Lucide icons and Plus Jakarta Sans font.

The browser harness imports the actual pages and components with their application CSS and generated font. It replaces Convex transport and Next navigation with test adapters. The dashboard shell, deployed authentication, unrelated page controls, external notification delivery, and physical-device keyboards are outside this review. Convex mutations are separately exercised against `convex-test`.

## Coverage

| Category | Evidence inspected | Result |
| --- | --- | --- |
| Typography | Dialog labels, required/optional copy, 16px mobile input, numeric character count, multiline explanations, 250-character unbroken reference; actual Jakarta font | Clear after changes |
| Surfaces | Status panel, dialog elevation, nested input/status surfaces, persistent footer, bulk results; 320–1920px and short landscape viewport | Clear after changes |
| Animations | Hover/press at 10% Chromium animation playback, saving spinner, reduced-motion mode; no custom dialog entrance | Clear; press moved toward 0.96 without overshoot |
| Icons | Existing Lucide arrow, message and loader icons; decorative icons hidden from assistive technology, stroke weight matched to adjacent text | Clear |
| Performance | Explicit transition properties, no added `will-change`, static note rendering, shared transition rules, no added live history subscription | Clear |

## Findings and changes

### Clear states, focus, and touch targets

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| HIGH | `components/dashboard/loan-status-controls.tsx:27`; `app/dashboard/admin/loans/[id]/page.tsx` | Current, available, and unavailable statuses shared dimmed clickable badges; current status could be reselected | Current status is a separate badge; only valid next actions are buttons, with 44px targets and visible keyboard focus; closed/returned loans explain their final state | State must be explicit; controls must remain legible and easy to activate |
| HIGH | `components/dashboard/loan-status-dialog.tsx:55`; `convex/lib/loanStatus.ts` | Immediate status mutation, no explanation or in-flight guard | Confirmation form with contextual required notes, visible borrower scope, client/server validation, loading feedback, duplicate-submit guard, retained drafts on failure, and stale-status explanations | Prevent misleading saves and give actionable recovery |
| HIGH | `components/dashboard/loan-status-dialog.tsx:99`; `components/dashboard/bulk-action-bar.tsx`; both admin loan pages | No status dialog focus lifecycle; Safari does not automatically focus clicked buttons | Base UI traps focus, locks background interaction, supports Escape, and restores focus. Initiators are explicitly focused for Safari; a surviving status/list surface provides fallback after a successful change removes the trigger | Keyboard and assistive technology users must retain their place |
| MEDIUM | `app/layout.tsx`; `components/dashboard/loan-status-dialog.tsx:99` | A prior success toast could overlap the next dialog's Save button in short Firefox viewports | Toast layer is explicitly below the status modal; new dialogs remain unobstructed | Feedback must not block the next action |
| MEDIUM | `components/dashboard/loan-status-dialog.tsx:236` | First review version could scroll Cancel below the smallest viewport | Content scrolls independently while Save and Cancel remain visible; mobile footer stacks full-width controls | Actions must remain reachable on small and short screens |
| MEDIUM | `app/dashboard/admin/loans/page.tsx:209` and `:339` | Bulk status picker floated beside another floating action bar; failure toast gave counts only | One dialog holds status selection and explanation; named per-loan failures remain visible with links and failed selections retained | Reduces competing overlays and supports recovery |

### Typography, hierarchy, and readable history

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM | `components/dashboard/loan-status-dialog.tsx:112` and `:184`; `components/dashboard/loan-status-note.tsx` | No explanation input/display | Balanced heading, readable input, clear required/optional labels, stable numeric count, preserved newlines and wrapping, theme-aware focus/error colors, layered modal shadow | Clear hierarchy and robust wrapping preserve readability in both themes |
| MEDIUM | `app/dashboard/admin/activity/page.tsx:143` | Table truncated the full historical explanation | Native keyboard-accessible disclosure exposes the complete multiline explanation | Stored audit detail must also be readable |

### Motion and icon restraint

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| LOW | `components/dashboard/loan-status-controls.tsx:44`; `components/dashboard/loan-status-dialog.tsx` | Existing status interactions had only opacity/press feedback and no saving indicator | Subtle color/0.96 press feedback, reduced-motion alternatives, text plus spinner for saving, and consistent outline icons; no staged entrance | Motion supports state without repeatedly demanding attention |

## Considered but rejected

| Location | Candidate | Rejected because |
| --- | --- | --- |
| Status dialog | Staggered or spring-based modal entrance | This is a frequent administrative action; immediate presentation and restrained control feedback are clearer |
| Loan status panel | Keep every invalid future status visible as a dimmed button | This was part of the original ambiguity; valid next actions and a separate current badge are easier to interpret |
| Existing theme | Introduce a new palette or copy another company's visual style | Consistent spacing, hierarchy, interaction quality, and accessibility improve this workflow while preserving Swift's design system |

## Verification

- Backend/unit suite: `pnpm test` — 83 tests passed, including 16 new status tests.
- Browser suite: `pnpm test:ui` — 60 tests passed (20 scenarios across three browser engines). Tests cover the actual loan pages in Chromium, WebKit, and Firefox with isolated transport.
- Responsive workflow viewports: 320×568, 375×812, 390×844, 430×932, 640×900, 768×1024, 844×390, 1024×768, 1280×900, 1440×900, and 1920×1080. Borrower long-text wrapping also checked at six widths.
- States: empty/required input, typed/maximum-length text, cancellation, Escape, focus trapping/return, errors, slow saving, repeated submit, stale status, optional notes, direct approval, closed/returned state, bulk partial failure, and expanded activity history.
- Accessibility: axe WCAG A/AA checks on the status panel and dialog in both light and dark themes; keyboard interaction tests across all three engines. Reduced-motion rendering and stable action visibility checked at 320×568.
- Visual inspection: mobile/tablet/desktop dialogs, bulk dialog, borrower explanation in both themes, error/loading screenshots, final footer, closed state, and hover/press at 10% playback. Screenshots are generated in ignored `test-results/`; supplementary review captures were kept outside the repository.
- `pnpm exec tsc --noEmit` and `pnpm build` passed. `pnpm lint` passed with seven existing warnings in unrelated landing images, generated files, and auth configuration. `pnpm exec convex codegen` refreshed local bindings.
- Not verified: production authentication/navigation, physical mobile keyboards and screen-reader announcements, or delivery through email/SMS providers. Scheduled notification payloads and authorization are covered by backend tests; UI transport is intentionally isolated.

## Verdict

**Approve** for the reviewed scope. All 60 browser tests and 83 backend/unit tests passed; no actionable interface-polish findings remain. The unverified deployment/device checks above remain outside the isolated review.
