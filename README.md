# Nelemane

Nelemane (ನೆಲೆಮನೆ) is a PG management and discovery platform for Bengaluru. The product name is defined once in `src/config/app.ts`.

## Local setup

1. Install Node.js 20.9 or newer.
2. Copy `.env.example` to `.env.local` and fill in local credentials.
3. Install dependencies with `pnpm install` or `npm install`.
4. Run `pnpm dev` or `npm run dev`, then open `http://localhost:3000`.

The development upload provider writes files to `.local-storage` and serves only public files or short-lived signed private files through the development media route. Development notification providers write a `NotificationLog` record and print messages to the terminal. These fallbacks refuse to start in production.

## Environment

Every environment variable is documented in `.env.example`. MongoDB, Auth.js, cron, encryption and Super Admin values are required. Cloudinary and Resend/SMTP settings enable production storage and email; MSG91 settings enable transactional SMS. In production, missing storage or email credentials cause configuration validation to fail rather than enabling development fallbacks.

## Decisions

- The app uses `src/` and the Next.js App Router, with the `@/*` alias mapped to `src/*`.
- Tailwind CSS v4 uses its CSS-first configuration, and `components.json` is ready for shadcn/ui components.
- `APP_NAME` is a single application constant. Compatibility `NEXTAUTH_*` variables are retained alongside `AUTH_SECRET` for the selected Auth.js setup.
- Development uploads use local disk; private media links expire within 60 seconds. Production provider adapters are wired in the feature phases that use them.
