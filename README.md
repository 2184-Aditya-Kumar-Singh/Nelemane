# Nelemane

Nelemane (ನೆಲೆಮನೆ) is a PG management and discovery platform for Bengaluru. The product name is defined once in `src/config/app.ts`.

## Local setup

1. Install Node.js 20.9 or newer.
2. Copy `.env.example` to `.env.local` and fill in local credentials.
3. Install dependencies with `pnpm install` or `npm install`.
4. Create the first Super Admin with `pnpm seed` (or `npm run seed`).
5. Run `pnpm dev` or `npm run dev`, then open `http://localhost:3000`.

The development upload provider writes files to `.local-storage` and serves only public files or short-lived signed private files through the development media route. Development notification providers write a `NotificationLog` record and print messages to the terminal. These fallbacks refuse to start in production.

In development, password reset links are printed by the development email provider and recorded in `NotificationLog`; the app does not send those messages to an external email service. In production, email delivery uses Resend when configured and otherwise uses SMTP. Password reset tokens are stored only as SHA-256 hashes and expire after 30 minutes.

The Super Admin seed reads `ADMIN_EMAIL` and `ADMIN_INITIAL_PASSWORD` from `.env.local`. It creates the account only when that email is unused and never resets an existing account's password. The new account must change its password at first sign-in.

## Authentication

Open `/login` to sign in. A seeded Super Admin must change the temporary password before continuing. `/forgot-password` sends a single-use reset link; in development, copy the link from the terminal output. Signed-in users can change their password from `/dashboard`. Sessions use Auth.js encrypted JWTs in HTTP-only cookies; privileged server routes must use the database-backed helpers in `src/server/auth/authorization.ts` and derive PG scope from the active session.

## Environment

Every environment variable is documented in `.env.example`. MongoDB, Auth.js, cron, encryption and Super Admin values are required. Cloudinary and Resend/SMTP settings enable production storage and email; MSG91 settings enable transactional SMS. In production, missing storage or email credentials cause configuration validation to fail rather than enabling development fallbacks.

## Decisions

- The app uses `src/` and the Next.js App Router, with the `@/*` alias mapped to `src/*`.
- Tailwind CSS v4 uses its CSS-first configuration, and `components.json` is ready for shadcn/ui components.
- `APP_NAME` is a single application constant. Compatibility `NEXTAUTH_*` variables are retained alongside `AUTH_SECRET` for the selected Auth.js setup.
- Development uploads use local disk; private media links expire within 60 seconds. Production provider adapters are wired in the feature phases that use them.
- Passwords use bcrypt with cost 12, and reset tokens use a one-way SHA-256 digest with a 30-minute expiry.
- pnpm allows the `esbuild` postinstall script because the TypeScript seed runner uses `tsx`.
