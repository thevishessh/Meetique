# Chandigarh University, Unnao Campus — Staff Meeting System Guide

यह guide बताती है कि **CU Unnao Meetings** में कौन-सी चीज़ कहाँ से हो रही है: कौन किस page पर क्या करता है, कौन-सी file वो काम करती है, data कहाँ save होता है, और कोई चीज़ बदलनी हो तो कहाँ बदलें।

**यह internal system है:** बाहर के लोग (public) booking नहीं कर सकते। सिर्फ university staff अपने login से officers के साथ meeting book करते हैं। **Designated officers** (Director, Registrar) किसी को भी तुरंत meeting के लिए बुला सकते हैं।

---

## 1. एक नज़र में

| चीज़ | Value |
|---|---|
| App का नाम | CU Unnao Meetings |
| Address (local) | `http://localhost:3001` → सीधे login page |
| Booking page | `/o/cu-unnao` (सिर्फ login के बाद) |
| Token format | `CUU-2026-000001`, … (हर साल 1 से फिर शुरू) |
| Timezone | Asia/Kolkata (IST) |
| Public booking / "Find my booking" | बंद (`PUBLIC_BOOKING=false`) |
| दूसरे organizations का registration | बंद (`ALLOW_ORG_SIGNUP=false`) |

---

## 2. Roles: कौन क्या कर सकता है

| Role | कौन | Login के बाद | क्या कर सकते हैं |
|---|---|---|---|
| **STAFF** | Faculty, employees | `/me` (My meetings) | Officer के साथ meeting book करना, अपनी booking cancel करना, बुलाए जाने पर **Acknowledge / On my way** दबाना |
| **OFFICER** | Registrar, Director, Exam Cell आदि | `/officer` (My queue) | अपनी queue, meeting start/complete, अपनी availability; दूसरे officers के साथ meeting book करना भी |
| **OFFICER + designated** | अभी: **Director, Registrar** | `/officer` + **Call immediate meeting** | ऊपर का सब कुछ + **किसी को भी तुरंत meeting के लिए बुलाना** |
| **RECEPTIONIST** | Front office, main gate | `/reception` | QR scan करके check-in, waiting, walk-in |
| **ADMIN** | Campus IT | `/admin` | सब कुछ: staff accounts, CSV import, officers, designated rights, holidays, reports |

### Login accounts (शुरुआती password: `CUUnnao@2026`)

हर व्यक्ति पहली बार login करके ऊपर अपने नाम पर click करे → **My account** → password बदले।

| Email | Role |
|---|---|
| `admin@cuunnao.test` | Admin |
| `frontoffice@cuunnao.test`, `reception@cuunnao.test` | Receptionist |
| `director@cuunnao.test` | Officer, **designated** (Campus Director) |
| `registrar@cuunnao.test` | Officer, **designated** (Registrar) |
| `admissions@`, `exams@`, `accounts@`, `placements@`, `hostel@`, `dsw@` + `cuunnao.test` | Officers |
| `faculty.cse@`, `faculty.mgmt@`, `library@` + `cuunnao.test` | **Sample** staff (testing के लिए): असली staff import करने के बाद deactivate कर दें |

> `@cuunnao.test` placeholder है। असली emails के साथ नए accounts बनाएँ (CSV import)।

---

## 3. Flow 1: Staff meeting book करता है (normal booking)

| Step | क्या होता है | Page | Code file | Data |
|---|---|---|---|---|
| 1 | Staff login करता है | `/login` | `src/app/login/*`, `src/app/api/auth/login/route.ts`, `src/lib/auth.ts` | `users` |
| 2 | **Book a meeting** → department → officer | `/o/cu-unnao` | `src/app/o/[slug]/page.tsx` (login न हो तो `layout.tsx` login पर भेज देता है) | — |
| 3 | Date और free slot चुनता है | `/o/cu-unnao/<officer>` | `src/components/slot-picker.tsx` → `GET /api/slots` → `src/lib/slots.ts` | Slots on-the-fly बनते हैं |
| 4 | सिर्फ **Agenda** लिखता है; नाम, email, employee ID उसके account से अपने आप आते हैं | (same) | `booking-wizard.tsx` ("Booking as …") | — |
| 5 | **Confirm** | `POST /api/appointments` | `src/app/api/appointments/route.ts` (internal mode → `attendeeUserId = आप`) → `bookAppointment()` in `src/lib/booking.ts` | `appointments`, `tokens`, `visitors` (staff से linked), `appointment_logs` |
| 6 | Token + QR slip | `/a/<code>` | `src/app/a/[code]/page.tsx` | — |
| 7 | **My meetings** में दिखती है; cancel कर सकता है | `/me` | `src/app/me/page.tsx` | status → Cancelled, slot खाली |
| 8 | Officer के office पहुँचकर QR दिखाता है (reception/PA check-in) | `/reception` | `src/app/reception/scanner.tsx` → `POST /api/check-in` | status → Checked-in |
| 9 | Officer **Start meeting → Complete** | `/officer` | `src/app/officer/page.tsx` → `changeStatus()` | In Progress → Completed |

---

## 4. Flow 2: Designated officer किसी को तुरंत बुलाता है (Immediate meeting)

| Step | क्या होता है | Page | Code file |
|---|---|---|---|
| 1 | Director/Registrar menu में **Call immediate meeting** खोलते हैं (सिर्फ designated officers को दिखता है) | `/officer/summon` | `src/app/officer/summon/page.tsx`, `summon-form.tsx` |
| 2 | किसी को भी search करते हैं: नाम, designation, department या employee ID से (staff, officers, reception, सब) | (same) | list उसी page पर server से आती है |
| 3 | **Right now** या **At a set time** (7 दिन तक), duration, purpose → **Call meeting now** | `POST /api/summons` | `src/app/api/summons/route.ts` → `summonMeeting()` in `src/lib/booking.ts` |
| 4 | Meeting बनती है: **slot, working hours, notice, capacity के rules लागू नहीं** होते। Officer की queue में पहले से meeting हो तो भी बन जाती है (warning दिखती है) | — | `summonMeeting()`: officer lock + अगली खाली "seat", ताकि database का double-booking constraint फिर भी काम करे |
| 5 | बुलाए गए व्यक्ति की **हर screen पर लाल URGENT banner** आता है, आवाज़ (beep) के साथ, और browser notification (अगर allow किया हो)। हर 15 seconds में check होता है | सभी staff pages | `src/components/urgent-alert.tsx` (`AppShell` में लगा है) → `GET /api/me/urgent` |
| 6 | व्यक्ति **Acknowledge** या **On my way** दबाता है | — | `POST /api/appointments/:id/respond` → `respondToMeeting()` |
| 7 | Director को **"Meetings you called"** list और queue में live दिखता है: Not yet acknowledged / Acknowledged / On the way | `/officer/summon`, `/officer` | `ResponseBadge` in `src/components/appointment-table.tsx` |
| 8 | Director **Start → Complete** करता है; banner अपने आप हट जाता है | `/officer` | `changeStatus()` |

**Rules:**
- बुलाया गया व्यक्ति immediate meeting को **cancel या reschedule नहीं** कर सकता (सिर्फ officer/admin कर सकते हैं)।
- कोई खुद को नहीं बुला सकता; बीता हुआ समय नहीं चुना जा सकता।
- हर call `appointment_logs` में दर्ज होती है: किसने, कब, किसको बुलाया।
- Reports और CSV में ऐसी meetings **"Immediate (called by …)"** के रूप में दिखती हैं।

---

## 5. Core logic: कौन-सी file क्या decide करती है

| काम | File | Function / बात |
|---|---|---|
| Internal / public mode | `src/lib/config.ts` | `PUBLIC_BOOKING`, `CLIENT_ORG_SLUG`, `ALLOW_ORG_SIGNUP`, `APP_NAME` (सब `.env` से) |
| Free slots | `src/lib/slots.ts` | `getDaySlots()`: holiday → weekly hours → lunch → duration + buffer → leave → booked गिनती → notice/same-day/advance/daily-limit |
| Normal booking (double booking रोकना) | `src/lib/booking.ts` | `bookAppointment()`: transaction → officer row lock → slot दोबारा जाँच → seat → appointment → token → log |
| Immediate meeting | `src/lib/booking.ts` | `summonMeeting()` (सिर्फ `canSummon` वाले officer) |
| Attendee का जवाब | `src/lib/booking.ts` | `respondToMeeting()` (सिर्फ वही व्यक्ति जिसे बुलाया गया) |
| Database की आखिरी सुरक्षा | `prisma/migrations/*_init/migration.sql` | `appointments_no_overlap` exclusion constraint |
| Token number `CUU-2026-…` | `src/lib/tokens.ts`, `nextTokenNumber()` | org + साल का counter (`token_counters`) |
| QR में क्या है | `src/lib/tokens.ts` | सिर्फ random link `/t/<secret>`, कोई personal data नहीं |
| Status rules | `src/lib/status.ts` | `TRANSITIONS`, `ROLE_CAN_SET` (STAFF सिर्फ अपनी booking cancel कर सकता है) |
| Kaun-सा page किस role का | `src/app/*/layout.tsx` (`requirePageUser`) और `src/components/app-shell.tsx` (`navFor`: menu) | |
| Login / session / password | `src/lib/auth.ts`, `src/app/api/auth/*`, `src/app/account/*` | 7 दिन का secure cookie; हर request पर user active है या नहीं जाँचता है |
| Staff accounts + CSV import | `src/app/api/staff/route.ts`, `src/app/api/staff/import/route.ts`, `src/app/admin/staff/*` | |
| Holidays | `src/app/api/holidays/*`, `src/app/admin/holidays/*` | Holiday पर normal booking बंद (immediate meeting फिर भी हो सकती है) |
| Email | `src/lib/notify.ts` | `RESEND_API_KEY` हो तो booking/cancel/immediate meeting पर email |
| Reports / CSV | `src/lib/reports.ts` | Employee ID, designation, type (Booked / Walk-in / Immediate) सहित |

---

## 6. Database tables

Schema: `prisma/schema.prisma` · PostgreSQL (Docker `meetique-v2-db`, port 5433)

| Table | क्या रखता है |
|---|---|
| `organizations` | CU Unnao: नाम, slug, prefix `CUU`, timezone, address |
| `users` | सब logins: role (ADMIN / OFFICER / RECEPTIONIST / **STAFF**), **employee ID**, **designation**, **department** |
| `departments` | Departments (officers और staff दोनों के) |
| `officer_profiles` | Officer: designation, location, slot rules, **can_summon** (designated) |
| `working_hours`, `availability_blocks` | Weekly hours / leave / special hours |
| `org_holidays` | Campus holidays |
| `visitors` | Meeting में आने वाले का card: staff हो तो `user_id` से linked |
| `appointments` | हर meeting: समय, status, **kind** (SCHEDULED / IMMEDIATE), **requested_by** (किसने बनाई), **attendee_response** (Acknowledged / On my way) |
| `tokens`, `token_counters` | Token number + QR secret |
| `appointment_logs` | हर बदलाव का audit trail |
| `notifications` | Emails |

Data देखने के लिए: `npx prisma studio`

---

## 7. Admin panel

| Menu | काम |
|---|---|
| Overview `/admin` | आज की गिनती |
| Appointments | date / officer / status filter |
| Reception | admin भी reception चला सकता है |
| Officers | Officer जोड़ें; officer खोलकर profile, hours, rules, leave, और **"Designated officer: can call immediate meetings"** checkbox |
| Departments | जोड़ें / बदलें |
| **Staff** | Staff / receptionist / admin accounts (employee ID, designation, department), search, password reset, deactivate, **Bulk import (CSV)** |
| Holidays | Campus-wide holidays |
| Reports | Charts + **Export CSV (Excel)** |
| Settings | नाम, address, timezone |

### सारे staff एक साथ कैसे डालें (CSV import)
Excel में ये columns रखें और rows copy करके **Admin → Staff → Bulk import** में paste करें:

```
name,email,employeeId,department,designation,phone
Dr. A. Kumar,a.kumar@<campus-domain>,CU1001,Computer Science & Engineering,Professor,98xxxxxxxx
```
- Header line optional है। जो department नहीं है वो अपने आप बन जाता है।
- पहले से मौजूद email या employee ID वाली line skip होती है (कारण दिखता है)।
- सबको आपका दिया initial password मिलता है; पहली login पर बदलें।

---

## 8. कुछ बदलना हो तो कहाँ

| बदलना है | Admin panel में | Code/setup में |
|---|---|---|
| किसे "immediate meeting" का अधिकार | Officers → officer → **Designated officer** checkbox | `canSummon: true` in `DESKS` (`prisma/seeds/cu-unnao.ts`) |
| Staff जोड़ना / हटाना | Staff (single या CSV) / Deactivate | `SAMPLE_STAFF` (सिर्फ test के लिए) |
| Officer का नाम (desk की जगह असली नाम) | Officers → Profile | `DESKS` |
| Hours, lunch, meeting length, notice | Officers → officer (या officer खुद **Availability**) | `WEEKDAY_HOURS`, `SATURDAY_HOURS`, `DESKS` |
| Holiday | Holidays | `HOLIDAYS` |
| App का नाम | — | `.env` → `NEXT_PUBLIC_APP_NAME` |
| Public booking फिर से चालू | — | `.env` → `PUBLIC_BOOKING="true"` |
| Alert कितनी जल्दी आए (अभी 15 sec) | — | `src/components/urgent-alert.tsx` → `setInterval(load, 15_000)` |
| Immediate meeting की durations | — | `src/app/api/summons/route.ts` + `summon-form.tsx` |
| Brand color | — | `src/app/globals.css` → `--color-brand-*` |

---

## 9. `.env` settings

| Setting | Value | मतलब |
|---|---|---|
| `DATABASE_URL` | postgres://…:5433/meetique | Database |
| `AUTH_SECRET` | random | Login cookie की key: live पर नया बनाएँ |
| `APP_URL` | `http://localhost:3001` | QR/email links: live पर `https://<domain>` |
| `SEED_PROFILE` | `cu-unnao` | `npm run db:seed` कौन-सा data बनाए |
| `CLIENT_ORG_SLUG` | `cu-unnao` | यही organization |
| `PUBLIC_BOOKING` | `false` | **Internal mode**: बिना login कुछ नहीं |
| `ALLOW_ORG_SIGNUP` | `false` | `/register` बंद |
| `NEXT_PUBLIC_APP_NAME` | CU Unnao Meetings | Logo / tab का नाम |
| `CLIENT_INITIAL_PASSWORD` | `CUUnnao@2026` | Seed accounts का पहला password |
| `RESEND_API_KEY`, `EMAIL_FROM` | (खाली) | Email notifications |

---

## 10. Client से क्या-क्या लेना है

- [ ] **Staff list (Excel):** name, official email, employee ID, department, designation, mobile
- [ ] Officers की list: कौन-कौन से offices/officers के साथ meeting book हो सकती है, उनके असली नाम और room
- [ ] **Designated officers कौन होंगे** (Director, Registrar, Deans, HoDs?)
- [ ] Office timings, lunch, Saturday
- [ ] Holiday calendar 2026–27
- [ ] Domain / hosting, और email sender (`noreply@<campus-domain>`)
- [ ] Logo (optional)

---

## 11. Commands

```bash
npm run db:up            # Database (Docker) चालू
npm run dev              # App: http://localhost:3001
npm run db:seed          # SEED_PROFILE वाला data (पहले से हो तो skip)
npm run test:concurrency # Double-booking test
npx prisma studio        # Tables देखें
npm run build && npm start
```

`npm run db:reset` पूरा database मिटा देता है। इसे सिर्फ development में चलाएँ, live server पर **कभी नहीं**।

---

## 12. Live (production) steps

1. Server पर Node 20+ और PostgreSQL।
2. Code copy → `npm install`।
3. `.env`: नया `AUTH_SECRET`, असली `DATABASE_URL`, `APP_URL=https://<domain>`, ऊपर वाली settings, strong `CLIENT_INITIAL_PASSWORD`।
4. `npx prisma migrate deploy` → `npm run db:seed` (सिर्फ पहली बार)।
5. Admin login → **Staff → Bulk import** से असली staff डालें → sample staff deactivate करें।
6. `npm run build` → `npm start` (pm2/systemd)।
7. **HTTPS ज़रूरी है**: इसके बिना reception का camera scanner और browser notifications नहीं चलेंगे।
8. Database का daily backup (`pg_dump`)।
