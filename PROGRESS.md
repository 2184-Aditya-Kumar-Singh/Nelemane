# Build progress

## Phase 1 — Foundation

Status: complete.

- [x] App Router, TypeScript strict mode, Tailwind CSS v4 and shadcn/ui configuration.
- [x] Shared application name, theme tokens and initial branded home screen.
- [x] Zod environment schema and complete commented `.env.example`.
- [x] Cached Mongoose connection and indexed `NotificationLog` model.
- [x] Email, SMS and storage provider interfaces with development fallbacks guarded from production.
- [x] Install dependencies and pass `typecheck`, `lint` and `build`.
- [x] Commit the completed phase.

### Verification

- `pnpm run typecheck` — passed.
- `pnpm run lint` — passed.
- `pnpm run build` — passed with no warnings.

## Phase 2 — Auth and RBAC

Status: complete.

- [x] Added indexed `User`, `AuditLog` and TTL-backed login rate-limit models.
- [x] Added Auth.js Credentials sign-in with bcrypt cost 12 and an encrypted JWT session cookie.
- [x] Added Next.js 16 `proxy.ts` role gates and fresh database-backed authorization helpers for API routes and server actions.
- [x] Added forced first-login password changes, authenticated password changes, and single-use email reset links with 30-minute expiry.
- [x] Added atomic per-email/IP login limiting (5 attempts per 15 minutes), password-reset request limiting, same-origin checks, and auth audit events.
- [x] Added development email logging plus production Resend/SMTP delivery, with `NotificationLog` records.
- [x] Added an idempotent Super Admin seed command that reads the configured email and temporary password and does not reset existing accounts.
- [x] Added sign-in, password recovery, password change and authenticated account pages.
- [x] Updated setup documentation and completed the required checks.
- [x] Commit the completed phase.

### Verification

- `pnpm run typecheck` — passed.
- `pnpm run lint` — passed.
- `pnpm run build` — passed with no warnings.

The workspace explicitly allows the `esbuild` postinstall script required by the TypeScript seed runner. The seed command is ready; it was not run against the configured database during this phase.

## Phase 3 — Admin

Status: complete.

- [x] Added the PG and AdminReport models, including indexed subscription expiry, soft deletion, and report status fields.
- [x] Added a four-step Super Admin PG registration flow with browser draft saving that excludes bank account numbers.
- [x] Added image upload handling with admin- and purpose-bound temporary upload references, Cloudinary support when configured, and local storage fallback for development.
- [x] Creates the PG and owner account in one MongoDB transaction, encrypts bank account numbers with AES-256-GCM, sends temporary owner credentials, and requires a first-login password change.
- [x] Added the admin dashboard, PG search and filters, PG details/edit, subscription suspend/reactivate, typed soft deletion, owner notifications, and the 30-day record/image purge.
- [x] Added admin report resolution and filtered audit log views.
- [x] Configured SMTP/Resend and MSG91 providers to use local credentials when configured, with safe development fallbacks when absent.
- [x] Passed typecheck, lint and production build; committed the completed phase.

### Verification

- `pnpm run typecheck` — passed.
- `pnpm run lint` — passed.
- `pnpm run build` — passed using a temporary `build/` output directory because Windows denies cleanup of the existing `.next` directory. The Next.js config was restored afterward.

Next: Phase 4 — PG owner details and room management.
