# CU Unnao Meetings

**Staff meeting booking, immediate meetings, and QR token check-in for Chandigarh University, Unnao Campus.**

Built on **Meetique**, a multi-officer appointment, QR token and queue system. This repo is configured as an **internal system**: only signed-in university staff can book meetings with officers, and designated officers (e.g. the Campus Director and Registrar) can call anyone in for an immediate meeting.

> 📘 A full guide in Hindi covers who logs in where, which file does what, what to change where, and how to go live: **[docs/CU-UNNAO-GUIDE.md](docs/CU-UNNAO-GUIDE.md)**

---

## Quick start

Requires **Node 20+** and **Docker Desktop** (for PostgreSQL).

```bash
npm install
npm run db:up        # PostgreSQL 17 in Docker, port 5433 (container: meetique-v2-db)
npm run db:deploy    # apply database migrations
npm run db:seed      # create the CU Unnao setup (skipped if it already exists)
npm run dev          # http://localhost:3001
```

If `.env` is missing, copy `.env.example` to `.env` and set `AUTH_SECRET` (any random string of 32+ characters).

The app runs on **port 3001**, so it doesn't clash with other projects that use 3000.

---

## How to log in

Open **http://localhost:3001** to reach the sign-in page.

**Password for every seeded account:** `CUUnnao@2026` (set by `CLIENT_INITIAL_PASSWORD` in `.env`). New and imported accounts must set their own password at first sign-in. Anyone can change theirs later under **My account** (click your name, top right). Lost passwords: **Forgot password?** on the sign-in page (needs email configured).

| Role | Email | Lands on |
|---|---|---|
| Admin (Campus IT) | `admin@cuunnao.test` | `/admin` |
| Officer: Campus Director, **can call immediate meetings**, **approves bookings** | `director@cuunnao.test` | `/officer` |
| Officer: Registrar, **can call immediate meetings** | `registrar@cuunnao.test` | `/officer` |
| Officers | `admissions@` · `exams@` · `accounts@` · `placements@` · `hostel@` · `dsw@` + `cuunnao.test` | `/officer` |
| Receptionist | `frontoffice@cuunnao.test`, `reception@cuunnao.test` | `/reception` |
| Staff (**sample**, for testing) | `faculty.cse@`, `faculty.mgmt@`, `library@` + `cuunnao.test` | `/me` |

> The `@cuunnao.test` emails, desk names and L Codes (`L9xxx`) are **placeholders**. Import the real staff list with **Admin → Staff → Bulk import (CSV)**, then deactivate the sample accounts.

---

## What it does

### Roles

| Role | Can do |
|---|---|
| **STAFF** | Book a meeting with an officer, see **My meetings**, cancel own bookings, respond to immediate-meeting calls |
| **OFFICER** | Live queue, start / complete meetings, set own availability, and book meetings with other officers |
| **OFFICER (designated)** | Everything above, plus **Call immediate meeting** with anyone |
| **RECEPTIONIST** | Scan QR tokens, check in, mark people waiting, register walk-ins |
| **ADMIN** | Staff accounts and CSV import, officers and designated rights, departments, holidays, reports, settings |

### Flow 1: Staff books a meeting
Sign in → **Book a meeting** → department → officer → **meeting length** (15/30/45/60… up to the officer's limit) → date and free slot → write the agenda. Name, email and employee ID come from the account. The system issues a token (`CUU-2026-000001`) and a QR slip. The meeting appears in **My meetings**, then the visitor is checked in at reception or by the officer's office, and the officer starts and completes the meeting.

### Flow 2: Designated officer calls an immediate meeting
**Call immediate meeting** → pick **one or more people** (search by name, designation, department, L Code) → **Right now** or a set time → purpose. A live **busy warning** shows anyone already in a meeting at that time. Working hours and slot rules are skipped. The person gets a **red URGENT banner on every screen**, with a beep and a browser notification, and answers **Acknowledge** / **On my way**. The officer sees the response live. The attendee cannot cancel or reschedule it.

### Also included
- **Phone alerts (Web Push, installable PWA):** immediate calls, new bookings, approvals, cancellations, reschedules and 15-minute reminders reach the phone even when the app is closed. Plus an in-app notification bell
- **Approval workflow:** officers can require approval; requests hold the slot as *Awaiting approval* until approved or declined
- **Flexible meeting length:** staff choose any length up to the officer's maximum; meetings never cross the lunch break; a buffer is kept after each meeting
- **L Code (employee code) is compulsory** for every account, CSV import, walk-in, and for booking if missing from the profile
- **Meeting notes:** the officer records decisions; the attendee sees them in My meetings
- **Background job:** 15-minute reminders, automatic *No Show* 30 minutes after an unattended meeting, automatic *Declined* for unanswered requests
- **Account security:** forced password change at first sign-in, strong-password rule, lockout after 5 wrong passwords (15 min), per-network throttle on failed attempts, email password reset
- **Slot engine:** weekly hours, lunch break, meeting length, buffer, seats per slot, daily limit, advance window, minimum notice, same-day rule, per-officer leave, special hours
- **Campus-wide holidays:** close normal booking for every officer
- **No double booking:** row lock per officer plus a PostgreSQL exclusion constraint (`npm run test:concurrency` proves it)
- **Reception desk:** camera QR scanner (works on phones over HTTPS), manual token entry, walk-ins, live queue
- **Reports:** status breakdown, officer workload, no-show rate, CSV export for Excel (employee ID, designation, meeting type)
- **Audit trail:** every status change and every immediate-meeting call is logged
- **Email notifications:** sent when `RESEND_API_KEY` is set (otherwise logged as `SKIPPED`)

---

## Configuration (`.env`)

| Setting | CU Unnao value | Meaning |
|---|---|---|
| `DATABASE_URL` | `postgresql://meetique:meetique@localhost:5433/meetique` | Database connection |
| `AUTH_SECRET` | random | Signs login cookies. Generate a new one for production |
| `APP_URL` | `http://localhost:3001` | Base URL used in QR codes and emails (`https://<domain>` in production) |
| `PUBLIC_BOOKING` | `false` | **Internal mode**: nothing is accessible without login. `true` = public visitor portal |
| `CLIENT_ORG_SLUG` | `cu-unnao` | The organization this deployment serves |
| `ALLOW_ORG_SIGNUP` | `false` | Turns off `/register` for new organizations |
| `SEED_PROFILE` | `cu-unnao` | Data created by `npm run db:seed` (`cu-unnao` or `demo`) |
| `NEXT_PUBLIC_APP_NAME` | `CU Unnao Meetings` | Name in the logo and browser tab |
| `NEXT_PUBLIC_APP_TAGLINE` | `Staff meeting booking & immediate meetings.` | Tagline |
| `CLIENT_INITIAL_PASSWORD` | `CUUnnao@2026` | First password for seeded accounts |
| `RESEND_API_KEY`, `EMAIL_FROM` | *(empty)* | Email via Resend (needed for **forgot password** and email alerts) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | generated | **Phone alerts** (Web Push). Keep the private key secret; regenerate with `npx web-push generate-vapid-keys` |
| `CRON_SECRET` | generated | Protects `POST /api/cron/tick` (for external cron on serverless hosts) |
| `DISABLE_JOBS` | `false` | `true` turns off the built-in reminder / auto no-show timer |

The client's starting data (departments, desks, hours, designated officers, holidays, sample staff) lives in **`prisma/seeds/cu-unnao.ts`**. Edit it before the first seed, or change everything later from the admin panel.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app on port 3001 |
| `npm run build` / `npm start` | Production build / serve on port 3001 |
| `npm run db:up` | Start PostgreSQL in Docker |
| `npm run db:deploy` | Apply migrations |
| `npm run db:seed` | Seed the `SEED_PROFILE` organization (skips if it exists) |
| `npm run db:reset` | ⚠️ **Deletes the whole database**, then re-migrates and re-seeds. Development only, never on a live server |
| `npm run test:concurrency` | Double-booking stress test: 20 simultaneous requests for one slot → exactly 1 succeeds; multi-seat slots fill exactly; raw SQL overlaps are rejected |
| `npm run typecheck` | TypeScript check |
| `npx prisma studio` | Browse the database tables |

---

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL 17 · Prisma 7 · jose (JWT session) + bcryptjs · qrcode + jsQR · Luxon · Zod · Resend

---

## Where things live

| Area | Files |
|---|---|
| Deployment mode and branding | `src/lib/config.ts` |
| Login, session, roles | `src/lib/auth.ts`, `src/app/api/auth/*`, `src/app/account/*` |
| Slot generation | `src/lib/slots.ts` |
| Booking, approval, group immediate meetings, busy check, notes, status changes | `src/lib/booking.ts` (`bookAppointment`, `summonMeeting`, `findConflicts`, `respondToMeeting`, `saveNotes`, `changeStatus`) |
| Alerts (bell + phone push + email) | `src/lib/alerts.ts` → `src/lib/push.ts`, `src/lib/mailer.ts`; service worker `public/sw.js`; client `src/components/push-client.tsx`, `notification-bell.tsx` |
| Reminders / auto no-show | `src/lib/jobs.ts`, started by `src/instrumentation.ts` |
| Login lockout / throttling | `src/app/api/auth/login/route.ts`, `src/lib/rate-limit.ts` |
| Status rules and per-role permissions | `src/lib/status.ts` |
| Token numbers and QR | `src/lib/tokens.ts` |
| Urgent alert banner | `src/components/urgent-alert.tsx` (inside `src/components/app-shell.tsx`) |
| Navigation per role | `src/components/app-shell.tsx` → `navFor()` |
| Reports / CSV | `src/lib/reports.ts` |
| Email | `src/lib/notify.ts` |
| Input validation | `src/lib/validation.ts` |
| Database schema and migrations | `prisma/schema.prisma`, `prisma/migrations/` (the double-booking constraint is in `*_init`) |
| Seed profiles | `prisma/seed.ts` → `prisma/seeds/cu-unnao.ts`, `prisma/seeds/demo.ts` |

### Pages

| URL | Who | What |
|---|---|---|
| `/login` | everyone | Sign in |
| `/change-password` | first sign-in | Set your own password (required) |
| `/forgot-password`, `/reset-password/<token>` | everyone | Email password reset |
| `/me` | all signed-in users | My meetings + urgent alerts |
| `/o/cu-unnao` → `/o/cu-unnao/<officer>` | signed-in users | Book a meeting |
| `/a/<code>` | attendee | Token slip with QR (print / cancel) |
| `/t/<secret>` | anyone with the QR | Token verification (full details + check-in for staff) |
| `/officer`, `/officer/appointments`, `/officer/availability` | officers | Queue, appointments, availability |
| `/officer/summon` | designated officers | Call an immediate meeting |
| `/reception` | receptionists, admins | QR scanner, check-in, walk-ins, live queue |
| `/admin/*` | admins | Overview, appointments, officers, departments, staff, holidays, reports, settings |
| `/account` | all signed-in users | Phone alerts on/off + test, change password |

### API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/login`, `/api/auth/logout` | Sign in / out |
| POST | `/api/auth/password` | Change own password |
| POST | `/api/auth/forgot`, `/api/auth/reset` | Email password reset |
| POST/DELETE | `/api/push/subscribe` · POST `/api/push/test` | Register a device for phone alerts / send a test |
| GET | `/api/notifications` · POST `/api/notifications/read` | Notification bell |
| PUT | `/api/appointments/:id/notes` | Meeting notes |
| GET | `/api/summons/conflicts` | Who is busy at a given time |
| POST | `/api/cron/tick` | Run reminders / auto no-show (needs `x-cron-secret`) |
| GET/POST | `/api/officers` · PATCH/DELETE `/api/officers/:id` | Officers (incl. `canSummon`) |
| GET/POST | `/api/departments` · PATCH/DELETE `/api/departments/:id` | Departments |
| POST | `/api/staff` · PATCH `/api/staff/:id` | Staff / receptionist / admin accounts |
| POST | `/api/staff/import` | Bulk-import staff from CSV |
| GET/POST | `/api/availability` · POST/DELETE `/api/availability/blocks[/:id]` | Weekly hours, rules, leave, special hours |
| GET/POST | `/api/holidays` · DELETE `/api/holidays/:id` | Campus-wide holidays |
| GET | `/api/slots?officerId=&date=` | Free slots for a day |
| GET/POST | `/api/appointments` | List (staff views) / book a meeting or walk-in |
| GET/PATCH | `/api/appointments/:id` | View / reschedule |
| POST | `/api/appointments/:id/cancel` | Cancel |
| PATCH | `/api/appointments/:id/status` | Approve / decline, check-in → waiting → in progress → completed, no-show |
| POST | `/api/summons` | Designated officer calls one or more people for an immediate meeting |
| GET | `/api/me/urgent` | Pending immediate meetings for the signed-in user |
| POST | `/api/appointments/:id/respond` | Attendee answers: Acknowledged / On my way |
| GET | `/api/tokens/:token` | Verify a QR token |
| POST | `/api/check-in` | QR / token check-in |
| GET | `/api/reports?from=&to=&format=csv` | Report (JSON or CSV) |
| PATCH | `/api/organizations/current` | Organization settings |

`POST /api/organizations` (new organizations) and `POST /api/lookup` ("find my booking") exist for public mode and are disabled for CU Unnao.

---

## Going live (short version)

1. Server with Node 20+ and PostgreSQL.
2. `npm install`, then create `.env` with a new `AUTH_SECRET`, the real `DATABASE_URL`, `APP_URL=https://<domain>`, and a strong `CLIENT_INITIAL_PASSWORD`.
3. `npx prisma migrate deploy`, then `npm run db:seed` (first time only).
4. Admin → **Staff → Bulk import** to add the real staff, then deactivate the sample accounts.
5. `npm run build`, then `npm start` (keep it running with pm2 or systemd).
6. **HTTPS is required.** Without it, phone alerts and the camera QR scanner won't work.
7. Every staff member: first sign-in → set password → **Turn on phone alerts**.
8. Set up daily database backups (`pg_dump`).

---

## Other mode: public demo

The same code can run as a **public** visitor-booking portal for any organization. Set `PUBLIC_BOOKING="true"`, `ALLOW_ORG_SIGNUP="true"`, `CLIENT_ORG_SLUG=""` and `SEED_PROFILE="demo"`. The demo seed creates "ABC University" with sample bookings; its logins (`admin@abc.test`, `registrar@abc.test`, `reception@abc.test`, …) use password `Demo@1234`.

---

## Not built yet

- SMS / WhatsApp alerts (phone push alerts are free and built in; SMS needs a paid provider such as MSG91)
- Google / Outlook calendar sync
- PDF export of reports (CSV opens in Excel)
- Campus logo upload
- Director's PA / delegate access to another officer's queue
- Audit-log viewer page (the log is recorded, not yet shown in the UI)
