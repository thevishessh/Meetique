# Meetique — Multi-Officer Appointment, QR Token & Queue System

*Smart Scheduling. Instant Tokens. Organized Meetings.*

Any organization (university, hospital, office, government department, or individual professional) can publish its officers' availability, take online bookings, issue QR tokens, and run the reception queue.

## Quick start

Requires Node 20+ and Docker Desktop.

```bash
npm install
npm run db:up          # Postgres 17 in Docker on port 5433 (container: meetique-v2-db)
npm run db:deploy      # apply migrations (incl. double-booking constraint)
npm run db:seed        # demo organization "ABC University"
npm run dev            # http://localhost:3000
```

Copy `.env.example` to `.env` first if `.env` is missing, and set `AUTH_SECRET`.

### Demo logins (password `Demo@1234`)

| Role | Email |
|---|---|
| Organization admin | admin@abc.test |
| Officer – Registrar | registrar@abc.test |
| Officer – HR Manager | hr@abc.test |
| Officer – Controller of Exams (2 per slot) | exam@abc.test |
| Receptionist / token operator | reception@abc.test |

Public booking portal: http://localhost:3000/o/abc-university

### Useful scripts

| Command | What it does |
|---|---|
| `npm run test:concurrency` | Fires 20 simultaneous bookings at one slot and checks exactly 1 wins; checks a capacity-2 slot; checks a raw SQL insert is blocked by Postgres |
| `npm run db:reset` | Drop, re-migrate and re-seed the database |
| `npm run typecheck` | TypeScript check |

## How the blueprint maps to the code

| Blueprint | Where |
|---|---|
| Roles: Admin, Officer, Visitor, Receptionist | `Role` enum in `prisma/schema.prisma`; visitors need no account |
| Tables (organizations … notifications) | `prisma/schema.prisma` (+ `token_counters` for sequences) |
| UTC storage + org timezone | All `timestamptz`; `organizations.timezone`; `src/lib/time.ts` |
| Slot engine (hours, breaks, duration, buffer, capacity, max/day, advance limit, min notice, same-day, holidays, overrides) | `src/lib/slots.ts` |
| Atomic booking + token generation | `src/lib/booking.ts` → `bookAppointment()` |
| No double booking (DB level) | officer row lock (`SELECT … FOR UPDATE`) + exclusion constraint `appointments_no_overlap` in `prisma/migrations/*_init/migration.sql` |
| Token format `ORG-YEAR-SEQUENCE` | `src/lib/tokens.ts`, per-org/year counter (atomic upsert) |
| QR with no personal data | QR holds `/t/<random secret>` only; visitor manage link uses a *separate* secret |
| Status flow Booked → Checked-in → Waiting → In Progress → Completed / Cancelled / No Show | `src/lib/status.ts` (transitions + per-role permissions), audit trail in `appointment_logs` |
| Cancel releases slot | Constraint only covers active statuses; token is revoked |
| Email notifications | `src/lib/notify.ts` (Resend). Without `RESEND_API_KEY`, attempts are logged as `SKIPPED` |
| Reports + Excel export | `/admin/reports`, `GET /api/reports?format=csv` |

### API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/login`, `/api/auth/logout` | Staff sign in / out (JWT cookie) |
| POST | `/api/organizations` | Register organization + first admin |
| PATCH | `/api/organizations/current` | Org settings |
| GET/POST | `/api/officers` | List (public with `?org=slug`) / create officer |
| PATCH/DELETE | `/api/officers/:id` | Update profile + slot rules / deactivate |
| GET/POST | `/api/departments`, PATCH/DELETE `/api/departments/:id` | Departments |
| POST | `/api/staff`, PATCH `/api/staff/:id` | Admins & receptionists, password reset |
| GET/POST | `/api/availability` | Weekly hours + booking rules |
| POST/DELETE | `/api/availability/blocks[/:id]` | Holidays, leave, breaks, special hours |
| GET | `/api/slots?officerId=&date=` | Generated slots for a day |
| POST | `/api/appointments` | Book (public) or walk-in (`walkIn: true`, staff) |
| GET | `/api/appointments` | Staff list (`date`, `officerId`, `status`) |
| GET/PATCH | `/api/appointments/:id` | View / reschedule (visitor passes `code`) |
| POST | `/api/appointments/:id/cancel` | Cancel (visitor `code` or staff session) |
| PATCH | `/api/appointments/:id/status` | Status change |
| GET | `/api/tokens/:token` | Verify QR secret / token number |
| POST | `/api/check-in` | QR / token check-in |
| POST | `/api/lookup` | Visitor "find my booking" (token + mobile) |
| GET | `/api/reports` | JSON or CSV report |

## Pages

- `/` landing · `/register` new organization · `/login` staff
- `/o/<slug>` visitor portal → officer → slot → details → `/a/<code>` token slip (print / reschedule / cancel)
- `/o/<slug>/find` find booking by token + mobile
- `/t/<secret>` QR target: public validity check; same-org staff see details + check-in
- `/admin` overview, appointments, officers (+ availability), departments, staff, reports, settings
- `/officer` live queue, appointments by date, availability
- `/reception` camera QR scanner (jsQR) + manual token entry, walk-ins, live queue

## Not built yet (next phases)

- SMS / WhatsApp notifications (the `notifications.channel` enum is ready)
- Google / Outlook calendar sync
- PDF export of reports (CSV opens in Excel)
- Auth.js / social login (currently a small JWT-cookie session in `src/lib/auth.ts`)
- Platform-level super admin across organizations
