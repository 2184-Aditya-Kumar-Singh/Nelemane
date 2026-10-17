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

PG owners can open `/owner` for their workspace. `/owner/pg-details` manages the public profile, facilities, gallery, rent window, reminders, listing visibility and payment instructions. `/owner/rooms` manages room types, rooms and configured bed availability; tenant records update occupancy and free-bed counts. Bank account numbers are encrypted before storage; payment changes create an audit record and notify the configured platform administrator without including the account number in the message.

Use `/owner/tenants` to add a resident, inspect their details, report a problem to the platform administrator, or mark a resident as vacated. New accounts receive a temporary password by email and, when configured, SMS; first sign-in requires a password change. Profile and Aadhaar images are stored privately. Aadhaar is optional, requires consent, and can be viewed by the PG owner through an audit-logged link that expires after 60 seconds. Moving a resident out disables their account, frees the bed, keeps their record for future payment history, and optionally deletes the Aadhaar image immediately.

## Rent and payments

Owners use `/owner/rent` to review monthly charges, collection, outstanding and overdue amounts, dues grouped by room, filtered resident ledgers, CSV exports, direct cash/UPI/bank records and rent reminders. `/owner/payment-verifications` is the tenant-submission queue; the pending badge in the owner navigation and dashboard link to it. Owners approve the amount actually received or reject a submission with a reason. Approval updates the charge in a MongoDB transaction and creates a printable tenant receipt.

Tenants open `/tenant/rent` to review rent and payment history. The charge page shows the PG's private QR, UPI ID and bank instructions. The tenant pays the owner directly outside Nelemane, then registers the transaction and a private screenshot for owner verification. Nelemane does not use a payment gateway. Pending submissions can be cancelled by the tenant; rejected submissions show the owner's reason so corrected details can be registered. Screenshot access uses short-lived signed URLs and is audit-logged.

Rent charges are created idempotently for active residents for the current month. Vercel invokes `/api/cron/rent` daily at 03:30 UTC (09:00 Asia/Kolkata) using the schedule in `vercel.json`. Set the same strong `CRON_SECRET` in the deployment's environment variables. The job opens the configured rent window, marks charges overdue after the window ends, and sends deduplicated email/SMS reminders using each PG's channel settings. MSG91 production SMS requires an approved DLT sender ID and transactional flow template; configure the matching auth key, sender ID and template ID in the deployment environment. Configure APP_URL, database, encryption, Cloudinary and email variables in the Vercel project as well as in local `.env.local`; local environment files are ignored by Git.

## Menus, maintenance and resident feedback

Owners edit the repeating Monday–Sunday meal plan at `/owner/menu`; tenants see today's meals on `/tenant` and the full week at `/tenant/menu` (day boundaries use Asia/Kolkata). Tenants can create up to five maintenance requests per day with up to five private photos per ticket at `/tenant/tickets`. Owners track status and add a resolution note with proof photos in `/owner/tickets`. A repair remains open for tenant approval; the resident can approve it or reopen it with a comment. Approval email links are single-use, hashed in storage, and expire after seven days. Ticket images are served through authenticated, short-lived signed URLs.

Residents can update their phone and profile picture and edit a one-per-PG rating from `/tenant/profile`. Rating averages are stored on the PG record for discovery. Tenant and owner ticket changes, private image access, menu edits, and reviews are recorded in the audit log.

## Public PG discovery

The landing page shows featured listed homes and links to `/pgs`. The listing supports locality, rent range, gender, room sharing, facilities, minimum rating, sorting and pagination, with filters stored in the URL. `/pgs/[slug]` includes the PG photo gallery, room types and prices, house rules, map link, owner contact, rating distribution and resident reviews. Only active PGs with an active subscription and `isListed` enabled appear publicly. `/sitemap.xml` includes those public PGs, while `/robots.txt` keeps account and management routes out of crawling. Use `/contact` for listing and support messages; `/privacy` and `/terms` describe the service’s current data use and payment flow.

## Environment

Every environment variable is documented in `.env.example`. MongoDB, Auth.js, cron, encryption and Super Admin values are required. Cloudinary and Resend/SMTP settings enable production storage and email; MSG91 settings enable transactional SMS. In production, missing storage or email credentials cause configuration validation to fail rather than enabling development fallbacks.

## Decisions

- The app uses `src/` and the Next.js App Router, with the `@/*` alias mapped to `src/*`.
- Tailwind CSS v4 uses its CSS-first configuration, and `components.json` is ready for shadcn/ui components.
- `APP_NAME` is a single application constant. Compatibility `NEXTAUTH_*` variables are retained alongside `AUTH_SECRET` for the selected Auth.js setup.
- Registration drafts are kept in the current browser and omit bank account numbers. The server encrypts account numbers with AES-256-GCM before saving them. PG deletion disables associated logins and hides the PG; after 30 days, an admin can purge the record and its stored images.
- Passwords use bcrypt with cost 12, and reset tokens use a one-way SHA-256 digest with a 30-minute expiry.
- pnpm allows the `esbuild` postinstall script because the TypeScript seed runner uses `tsx`.
