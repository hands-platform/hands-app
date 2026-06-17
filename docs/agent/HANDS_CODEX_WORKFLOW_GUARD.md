# HANDS Codex Workflow Guard

Use this guard for every HANDS task before reading broadly or editing files.

## 1. Token Control

- Do not scan the entire repo unless the user explicitly asks for a full pass.
- Start each task by identifying the smallest relevant file scope.
- Prefer 3-8 changed files per task.
- Do not read build outputs, `.next`, `dist`, `node_modules`, `coverage`, or generated files.
- Avoid repeating the same status or test commands unnecessarily.

## 2. Reasoning Mode Control

- Use quick/low reasoning for status checks, small copy edits, simple helper extraction, and narrow test fixes.
- Use normal/high reasoning for feature slices.
- Use very high reasoning only for protected business logic: auth, booking state, matching, payments, settlement, wallet, Prisma schema, realtime event contracts, permissions, and security-sensitive changes.

## 3. Scope Separation

- Do not mix Admin Web, API, Flutter, infra, and docs changes unless the task requires integration.
- Admin UI work must not casually modify API behavior.
- API business logic work must not include unrelated Admin copy or layout cleanup.
- Prisma, schema, payment, wallet, matching, and auth changes require isolated sequential work.

## 4. Verification Control

- Do not run full verification for small changes.
- Run focused tests or specs first.
- Run broader verification only after a completed feature slice or protected logic change.
- If tests are skipped, explain why.

## 5. Commit Control

- Check `git status` before editing and before committing.
- Do not stage unrelated dirty files.
- Stage only files changed for the current task.
- Never commit generated folders or build artifacts.
- Prefer small reversible commits.
- Use commit messages in this format: `type(scope): concise summary`.

## 6. HANDS Authority Rules

- NestJS owns business rules.
- PostgreSQL and Supabase are infrastructure, not business authority.
- Customer final selection is the source of truth.
- Negative wallet blocks final acceptance, service start, and payout release; it does not block marketplace visibility.
- Discovery is address-based, not transient GPS-only.
- User-facing copy should say Partner, not Provider, unless internal legacy code requires provider naming.
