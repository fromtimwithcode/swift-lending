# Swift Capital Lending

Next.js 16.3 App Router frontend with Convex data and authentication. Use `pnpm`; keep `pnpm-lock.yaml` as the only lockfile.

## Development

```sh
pnpm install
pnpm dev
```

Runtime configuration is described in [AGENTS.md](AGENTS.md). Keep deployment credentials and `.env.local` out of version control.

## Validation

```sh
pnpm test
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

For the loan-status browser regression suite:

```sh
pnpm exec playwright install chromium firefox webkit
pnpm build
pnpm test:ui
```

The browser harness renders the actual admin loan detail, borrower loan detail, admin loan list, and activity log pages with the application CSS and generated font. Convex calls and navigation use isolated test adapters, so browser tests do not modify a deployment or send notifications. Backend persistence, authorization, and notification scheduling are tested separately with `convex-test`.

Screenshots and failure traces are written to ignored `test-results/`. `pnpm test:ui --project=chromium` runs a single browser. The full suite checks Chromium, Firefox, and WebKit.

## Workflow references

- [Loan status behavior and rollout](docs/loan-status-workflow.md)
- [Loan status interface review](docs/loan-status-review.md)
- [Application configuration rollout](docs/app-configuration-rollout.md)
- [Agent and repository notes](AGENTS.md)
