## Goal

Build a backend-only Lovable Cloud project that exposes public REST API endpoints your existing Next.js Coffee Shoppe site can call, plus an admin dashboard hosted on this Lovable project at `/admin` to manage reservations, contact messages, and newsletter subscribers.

The Next.js frontend stays untouched — you'll just point your forms' `fetch` URLs at the new endpoints.

---

## What gets built

### 1. Lovable Cloud + Database

Enable Lovable Cloud and create three tables (RLS enabled, public-write blocked, admin-read via role check):

- **reservations** — id, name, email, phone, date, time, party_size, special_requests, status (pending/confirmed/cancelled, default pending), created_at
- **contact_messages** — id, name, email, message, created_at
- **newsletter_subscribers** — id, email (unique), subscribed_at

Plus a **user_roles** table + `app_role` enum + `has_role()` security-definer function (per security best practices — roles never live on profiles).

### 2. Email infrastructure

Use Lovable's built-in email system. Set up a sender domain, then create three React Email templates:

- Reservation confirmation (to customer)
- Reservation notification (to `info@coffeeshoppe.com`)
- Contact message notification (to `info@coffeeshoppe.com`)
- The plan looks great. Please also add: when admin updates a reservation status to Confirmed or Cancelled, automatically send an email to the customer informing them of the update.

All sent through the queue-based send-transactional-email route.

### 3. Public REST API endpoints (CORS: `*`)

Under `src/routes/api/public/` so they bypass auth and are callable from your Next.js site:

- `POST /api/public/reservations` — validates with Zod, inserts row, fires both emails, returns `{ ok: true }`
- `POST /api/public/contact` — validates, inserts, fires owner email
- `POST /api/public/newsletter` — validates email, inserts (ignore duplicates), returns success

Each route handles `OPTIONS` preflight and returns proper CORS headers.

### 4. Admin authentication

Email/password auth via Lovable Cloud. Seed your email (`aabdulrahman.5250@gmail.com`) into `user_roles` with role `admin` via migration so the first sign-up with that email automatically has admin access.

- `/login` — email/password sign-in page (sign-up disabled — admin-only)
- `_authenticated` layout route guards everything below it
- `_authenticated/_admin` layout adds `has_role('admin')` check; non-admins get redirected

### 5. Admin dashboard at `/admin`

Built with shadcn `Table`, `Tabs`, `Badge`, `Select`:

- **Reservations tab** — sortable table, status dropdown (Pending/Confirmed/Cancelled) updates inline
- **Messages tab** — list of contact messages with full message expansion
- **Subscribers tab** — list of newsletter emails with CSV export button
- Logout button in header

Themed in the same coffee palette (espresso/gold/cream) so it matches your brand.

---

## How you'll wire your Next.js site

After this is built, in your Next.js components change the fetch URLs to point at this Lovable project (URL provided after build). Example for reservations:

```
fetch('https://<your-lovable-project>.lovable.app/api/public/reservations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, email, phone, date, time, partySize, specialRequests })
})
```

Same pattern for `/api/public/contact` and `/api/public/newsletter`. No design changes needed.

---

## Technical details

- Stack: TanStack Start + Lovable Cloud (Supabase under the hood)
- Validation: Zod schemas on every endpoint with length caps and email format
- Rate limiting: relies on Cloud's built-in protections; can add per-IP throttling later if abuse appears
- Idempotency: newsletter uses `ON CONFLICT DO NOTHING` on email; reservations include `idempotencyKey` derived from row id when triggering email send
- Status enum stored as text with CHECK constraint: `('pending','confirmed','cancelled')`
- Admin role check uses security-definer `has_role()` to avoid recursive RLS
- Email sender domain must be configured before emails will actually deliver (DNS verification step happens in Cloud → Emails)

---

## Out of scope

- Porting your Next.js components into TanStack Start (you chose backend-only)
- Modifying any Next.js files (`globals.css`, `page.tsx`, components) — those stay exactly as-is
- Public sign-up — admin accounts are seeded only
  &nbsp;

---

## Order of implementation

1. Enable Lovable Cloud
2. Create tables + roles + seed admin migration
3. Set up email domain (you'll get a setup dialog)
4. Scaffold transactional email infra + 3 templates
5. Build 3 public API routes with CORS
6. Build login page + auth guards
7. Build admin dashboard
8. Verify endpoints with test calls and share the base URL for you to wire into Next.js