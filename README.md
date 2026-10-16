# Nelemane

Nelemane (ನೆಲೆಮನೆ) is a PG management and discovery platform for Bengaluru. The product name is defined once in `src/config/app.ts`.

## Local setup

1. Install Node.js 20.9 or newer.
2. Copy `.env.example` to `.env.local` and fill in local credentials.
3. Install dependencies with `pnpm install` or `npm install`.
4. Create the first Super Admin with `pnpm seed` (or `npm run seed`).
5. Run `pnpm dev` or `npm run dev`, then open `http://localhost:3000`.

The upload provider uses Cloudinary when its credentials are present in `.env.local`; otherwise development uploads go to `.local-storage`, where private files are only available through short-lived signed links. Email uses configured Resend or SMTP credentials in local development and production. Without email credentials, development messages are recorded in `NotificationLog` and printed to the terminal; this fallback refuses to start in production. MSG91 SMS is used when its auth key and DLT flow template ID are configured.

When no email service is configured, password reset links are printed by the development email provider and recorded in `NotificationLog`. When configured, email delivery uses Resend or SMTP in both local development and production. Password reset tokens are stored only as SHA-256 hashes and expire after 30 minutes.

The Super Admin seed reads `ADMIN_EMAIL` and `ADMIN_INITIAL_PASSWORD` from `.env.local`. It creates the account only when that email is unused and never resets an existing account's password. The new account must change its password at first sign-in.

## Authentication

Open `/login` to sign in. A seeded Super Admin must change the temporary password before continuing. `/forgot-password` sends a single-use reset link; in development, copy the link from the terminal output. Signed-in users can change their password from `/dashboard`. Sessions use Auth.js encrypted JWTs in HTTP-only cookies; privileged server routes must use the database-backed helpers in `src/server/auth/authorization.ts` and derive PG scope from the active session.

## Environment

Every environment variable is documented in `.env.example`. MongoDB, Auth.js, cron, encryption and Super Admin values are required. Cloudinary and Resend/SMTP settings enable production storage and email; MSG91 settings enable transactional SMS. In production, missing storage or email credentials cause configuration validation to fail rather than enabling development fallbacks.

## Decisions

- The app uses `src/` and the Next.js App Router, with the `@/*` alias mapped to `src/*`.
- Tailwind CSS v4 uses its CSS-first configuration, and `components.json` is ready for shadcn/ui components.
- `APP_NAME` is a single application constant. Compatibility `NEXTAUTH_*` variables are retained alongside `AUTH_SECRET` for the selected Auth.js setup.
- Registration drafts are kept in the current browser and omit bank account numbers. The server encrypts account numbers with AES-256-GCM before saving them. PG deletion disables associated logins and hides the PG; after 30 days, an admin can purge the record and its stored images.
- Passwords use bcrypt with cost 12, and reset tokens use a one-way SHA-256 digest with a 30-minute expiry.
- pnpm allows the `esbuild` postinstall script because the TypeScript seed runner uses `tsx`.
