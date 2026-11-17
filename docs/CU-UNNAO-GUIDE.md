# Chandigarh University, Unnao Campus — Staff Meeting System Guide

यह guide बताती है कि **CU Unnao Meetings** में कौन-सी चीज़ कहाँ से हो रही है: कौन किस page पर क्या करता है, कौन-सी file वो काम करती है, data कहाँ save होता है, और कोई चीज़ बदलनी हो तो कहाँ बदलें।

**यह internal system है:** बाहर के लोग booking नहीं कर सकते। University staff अपने login से officers के साथ meeting book करते हैं। **Designated officers** (Director, Registrar) एक या कई लोगों को **तुरंत meeting** के लिए बुला सकते हैं, और उन्हें screen और **phone** दोनों पर alert जाता है।

---

## 1. एक नज़र में

| चीज़ | Value |
|---|---|
| App का नाम | CU Unnao Meetings |
| Address (local) | `http://localhost:3001` → login page |
| Token format | `CUU-2026-000001`, … |
| Timezone | Asia/Kolkata (IST) |
| Public booking | बंद (`PUBLIC_BOOKING=false`) |
| L Code | हर account के लिए **compulsory** |
| Phone alerts | Web Push (Android Chrome, desktop; iPhone पर Home Screen app से) |

---

## 2. Login

**Password:** seed से बने सब accounts का शुरुआती password `CUUnnao@2026` है।

| Email | Role | L Code (placeholder) |
|---|---|---|
| `admin@cuunnao.test` | Admin | L9001 |
| `frontoffice@cuunnao.test`, `reception@cuunnao.test` | Receptionist | L9002, L9003 |
| `director@cuunnao.test` | Officer: **designated + approves bookings** | L9108 |
| `registrar@cuunnao.test` | Officer: **designated** | L9102 |
| `admissions@` `exams@` `accounts@` `placements@` `hostel@` `dsw@` + `cuunnao.test` | Officers | L9101, L9103–L9107 |
| `faculty.cse@`, `faculty.mgmt@`, `library@` + `cuunnao.test` | Staff (**sample**) | L9201–L9203 |

### Login की security (नई)
| Rule | कहाँ |
|---|---|
| **नया account / admin ने password reset किया** → पहली login पर **खुद का password बनाना ज़रूरी** (`/change-password`); तब तक app का कोई page या API नहीं खुलता | `users.must_change_password`, `requirePageUser` / `requireApiUser` in `src/lib/auth.ts`, page `src/app/change-password/page.tsx` |
| Password कम से कम 8 अक्षर, एक letter और एक number | `strongPassword` in `src/lib/validation.ts` |
| **5 गलत password → account 15 मिनट के लिए lock** | `src/app/api/auth/login/route.ts` (`failed_login_count`, `locked_until`) |
| एक network/IP से 100 गलत कोशिशें (15 मिनट में) → उस network से login रुकता है। *सिर्फ गलत कोशिशें गिनी जाती हैं, क्योंकि पूरा campus अक्सर एक ही IP से चलता है* | `src/lib/rate-limit.ts` + login route |
| **Forgot password:** email पर एक link (30 मिनट, एक बार चलेगा) | `/forgot-password` → `POST /api/auth/forgot` → email → `/reset-password/<token>` → `POST /api/auth/reset` |
| Admin "Reset password" करे → account unlock + अगली login पर नया password ज़रूरी | `src/app/api/staff/[id]/route.ts` |

> Forgot-password के लिए email ज़रूरी है (`RESEND_API_KEY`)। Development में email न हो, तो link screen पर दिखता है (सिर्फ testing के लिए; live server पर नहीं)।

> इस update से **पहले** बने accounts (ऊपर वाले seed accounts) पर पहली login में password बदलना ज़रूरी नहीं है। नए बने और CSV से import हुए accounts पर ज़रूरी है।

---

## 3. Roles

| Role | क्या कर सकता है |
|---|---|
| **STAFF** | Meeting book करना (लंबाई चुनकर), My meetings, अपनी booking cancel करना, बुलाए जाने पर Acknowledge / On my way, meeting notes पढ़ना |
| **OFFICER** | Queue, approve/decline, meeting start/complete, **notes लिखना**, availability, दूसरे officers के साथ booking |
| **OFFICER (designated)** | ऊपर का सब कुछ + **एक या कई लोगों को तुरंत बुलाना** |
| **RECEPTIONIST** | QR check-in, waiting, walk-in (**L Code ज़रूरी**) |
| **ADMIN** | Staff accounts / CSV import, officers, designated / approval rights, holidays, reports |

---

## 4. Flow 1: Staff meeting book करता है

| Step | क्या होता है | Code |
|---|---|---|
| 1 | Login → **Book a meeting** → department → officer | `src/app/o/[slug]/*` |
| 2 | **Meeting length** चुनता है: 15 / 30 / 45 / 60 min… (officer की limit तक)। सिर्फ वही समय दिखते हैं जहाँ पूरी meeting fit हो; lunch break के पार नहीं जाती | `src/components/slot-picker.tsx` → `GET /api/slots?duration=` → `getDaySlots()` in `src/lib/slots.ts` |
| 3 | Date + समय → Agenda। नाम/email profile से आते हैं। **L Code profile में नहीं है, तो यहाँ भरना ज़रूरी** (एक बार, profile में save हो जाता है) | `booking-wizard.tsx`, `src/app/api/appointments/route.ts` |
| 4 | Confirm → token + QR | `bookAppointment()` in `src/lib/booking.ts` |
| 5 | **Officer को alert** (bell + phone + email): "New meeting: …" | `meetingEvent("BOOKED")` in `src/lib/alerts.ts` |
| 6 | Officer **approval** वाला हो (जैसे Director) → status **Awaiting approval**, slot hold रहता है, QR नहीं बनता। Officer **Approve / Decline** → staff को alert | `requiresApproval`, statuses `PENDING` / `DECLINED` in `src/lib/status.ts` |
| 7 | **15 मिनट पहले reminder** → staff + officer | `src/lib/jobs.ts` |
| 8 | Check-in → Start → Complete → **officer notes लिखता है** → staff को My meetings में दिखते हैं | `src/components/notes-editor.tsx`, `PUT /api/appointments/:id/notes` |
| 9 | किसी ने check-in नहीं किया → meeting खत्म होने के **30 मिनट बाद अपने आप No Show**। Approval नहीं मिली और समय निकल गया → अपने आप **Declined** | `src/lib/jobs.ts` |

**Cancel / reschedule:** दूसरे पक्ष को अपने आप alert जाता है (staff cancel करे तो officer को, officer cancel करे तो staff को)।

---

## 5. Flow 2: Immediate meeting (एक या कई लोग)

| Step | क्या होता है | Code |
|---|---|---|
| 1 | Designated officer → **Call immediate meeting** | `/officer/summon` |
| 2 | **एक या कई लोग** चुनें (नाम / designation / department / **L Code** से search) | `summon-form.tsx` |
| 3 | Right now या set time, duration, purpose | — |
| 4 | **Busy warning:** चुने गए लोगों में से जो उस समय पहले से किसी meeting में हैं (या officer है और उसकी queue में कोई है), उनका नाम और meeting पीले box में दिखता है। फिर भी call कर सकते हैं | `GET /api/summons/conflicts` → `findConflicts()` in `src/lib/booking.ts` |
| 5 | **Call** → हर व्यक्ति की अलग meeting बनती है, एक साझा `group_id` के साथ | `POST /api/summons` → `summonMeeting()` |
| 6 | हर व्यक्ति को: **phone पर push** (स्क्रीन पर तब तक रहता है जब तक tap न करें, vibration के साथ), app में **लाल URGENT banner** (beep), **bell**, और email (अगर set है) | `meetingEvent("SUMMONED")` → `alertUser()` → `sendPush()` in `src/lib/push.ts` |
| 7 | व्यक्ति **Acknowledge / On my way** दबाता है → officer को live दिखता है | `POST /api/appointments/:id/respond` |
| 8 | Officer start → complete → notes | — |

---

## 6. Phone alerts: कैसे काम करते हैं और कैसे चालू करें

**Technology:** Web Push (free; SMS/WhatsApp का पैसा नहीं लगता)। App एक PWA है, यानी phone पर app की तरह install हो सकता है।

| हिस्सा | File |
|---|---|
| Phone पर notification दिखाना (app बंद हो तब भी) | `public/sw.js` (service worker) |
| App की तरह install होना | `src/app/manifest.ts`, `public/icon-*.png` |
| Device register करना | `src/components/push-client.tsx` → `POST /api/push/subscribe` (table `push_subscriptions`) |
| Server से alert भेजना | `src/lib/push.ts` (`web-push`, VAPID keys `.env` में) |
| कौन-सी घटना पर किसे alert | `src/lib/alerts.ts` → `meetingEvent()` |
| Bell (in-app) | `src/components/notification-bell.tsx`, table `user_notifications` |

**Staff के लिए चालू करने का तरीका:**
- **Android (Chrome):** login → ऊपर नीला banner **"Turn on phone alerts" → Turn on → Allow**। या **My account → Phone & desktop alerts**।
- **iPhone (iOS 16.4+):** Safari में site खोलें → Share → **Add to Home Screen** → Home Screen वाले app से खोलें → Turn on।
- **Computer:** Chrome / Edge में वही बटन।
- हर device पर अलग से चालू करना होता है। **Send test alert** से जाँच सकते हैं।

> ⚠️ **Live server पर HTTPS ज़रूरी है।** Phone alerts सिर्फ HTTPS (या `localhost`) पर चलते हैं। Wi-Fi पर `http://192.168…` से phone पर नहीं चलेंगे।

---

## 7. Flexible meeting length

| Setting (Officer → Availability → Booking rules) | मतलब |
|---|---|
| **Slot length (shortest meeting)** | Booking grid, जैसे 15 min |
| **Longest meeting allowed** | Staff इतनी लंबी meeting चुन सकता है (15 के गुणज: 15/30/45/60…) |
| **Buffer after each meeting** | हर meeting के बाद इतने मिनट खाली रखे जाते हैं |
| **Bookings need my approval** | Booking पहले "Awaiting approval" में जाती है |

अभी की limits: Admissions 45, Registrar 60, Exams 60, Fee Counter 30, Placement 90, Hostel 45, DSW 60, Director 60 (approval के साथ)।

---

## 8. L Code (compulsory)

| कहाँ | Rule |
|---|---|
| Admin → Staff → Add account | L Code ज़रूरी, unique (`L12345` जैसा; छोटे अक्षर अपने आप बड़े हो जाते हैं) |
| Admin → Officers → Add officer / Profile | L Code ज़रूरी |
| **CSV import** | Column 3 = L Code। L Code न हो या गलत हो तो वो line skip होती है (कारण दिखता है) |
| Staff booking | Profile में L Code नहीं है, तो booking form पर भरना ज़रूरी |
| Reception walk-in | L Code ज़रूरी। किसी staff account से match हुआ तो visit उसी account से जुड़ जाती है |
| हर जगह दिखता है | Queue, tables, summon search, reports CSV |

Database में यह `users.employee_id` column में रहता है (validation: `lCode` in `src/lib/validation.ts`)।

---

## 9. Background job (reminders, auto No Show)

| काम | कब |
|---|---|
| 15 मिनट पहले reminder (staff + officer) | हर मिनट check |
| Meeting खत्म होने के 30 मिनट बाद तक check-in नहीं → **No Show** | ″ |
| Approval pending और समय निकल गया → **Declined** + alert | ″ |
| 60 दिन पुराने notifications साफ़ | ″ |

File: `src/lib/jobs.ts`, server start होते ही `src/instrumentation.ts` से चलता है। Serverless hosting पर cron service से `POST /api/cron/tick` (header `x-cron-secret: <CRON_SECRET>`) हर मिनट call करें। Built-in job बंद करना हो तो `DISABLE_JOBS="true"`।

---

## 10. Core logic map

| काम | File / Function |
|---|---|
| Mode / branding | `src/lib/config.ts` |
| Login, session, forced password change | `src/lib/auth.ts`, `src/app/api/auth/*` |
| Slots (flexible length, buffer, lunch, holidays) | `src/lib/slots.ts` → `getDaySlots()` |
| Booking + approval | `bookAppointment()` in `src/lib/booking.ts` |
| Immediate meeting (group) + busy check | `summonMeeting()`, `findConflicts()` |
| Status बदलना (approve/decline/cancel…) | `changeStatus()` + rules in `src/lib/status.ts` |
| Notes | `saveNotes()` |
| Alerts | `src/lib/alerts.ts` (`alertUser`, `meetingEvent`) → `src/lib/push.ts`, `src/lib/mailer.ts` |
| Jobs | `src/lib/jobs.ts` |
| Double booking रोकना | officer lock + `appointments_no_overlap` constraint (PENDING भी slot hold करता है) |

---

## 11. Database tables

| Table | क्या रखता है |
|---|---|
| `users` | Role, **L Code** (`employee_id`), designation, department, **must_change_password**, **failed_login_count**, **locked_until** |
| `officer_profiles` | Slot length, **max_duration_min**, buffer, **requires_approval**, **can_summon**, … |
| `appointments` | समय, status (**PENDING**, BOOKED, …, **DECLINED**), kind (SCHEDULED/IMMEDIATE), **group_id**, attendee_response, **notes**, **reminder_sent_at** |
| `push_subscriptions` | हर user के phone/browser जिन पर alerts चालू हैं |
| `user_notifications` | Bell के notifications |
| `password_resets` | Forgot-password links (सिर्फ hash save होता है) |
| बाकी | `organizations`, `departments`, `working_hours`, `availability_blocks`, `org_holidays`, `visitors`, `tokens`, `token_counters`, `appointment_logs`, `notifications` |

---

## 12. `.env` settings

| Setting | मतलब |
|---|---|
| `DATABASE_URL`, `AUTH_SECRET`, `APP_URL` | Database, login key, public URL (live पर `https://…`) |
| `PUBLIC_BOOKING="false"`, `CLIENT_ORG_SLUG="cu-unnao"`, `ALLOW_ORG_SIGNUP="false"` | Internal single-client mode |
| `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_TAGLINE` | नाम |
| `SEED_PROFILE`, `CLIENT_INITIAL_PASSWORD` | Seed data |
| **`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`** | **Phone alerts की keys** (बन चुकी हैं; private key किसी को न दें। नई: `npx web-push generate-vapid-keys`) |
| **`CRON_SECRET`**, `DISABLE_JOBS` | External cron / job बंद करना |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email (forgot password + alerts के लिए ज़रूरी) |

---

## 13. Client से क्या लेना है

- [ ] Staff की Excel list: name, email, **L Code**, department, designation, mobile
- [ ] Officers के असली नाम, L Code, room; कौन **designated** होगा, किसे **approval** चाहिए, और हर office की **meeting की अधिकतम लंबाई**
- [ ] Timings, holiday calendar
- [ ] Domain + **HTTPS** (phone alerts के लिए ज़रूरी)
- [ ] Email sender (`noreply@<campus-domain>`) + Resend account (forgot password के लिए ज़रूरी)

---

## 14. Live steps

1. Server: Node 20+, PostgreSQL, domain + **HTTPS**।
2. `npm install` → `.env` (नया `AUTH_SECRET`, `APP_URL=https://…`, नई VAPID keys, `RESEND_API_KEY`, strong `CLIENT_INITIAL_PASSWORD`)।
3. `npx prisma migrate deploy` → `npm run db:seed` (पहली बार)।
4. Admin → Staff → **Bulk import** (L Code के साथ) → sample accounts deactivate करें।
5. `npm run build` → `npm start` (pm2/systemd)। Background job अपने आप चलता है।
6. सब staff: पहली login → password बनाएँ → **Turn on phone alerts**।
7. Daily database backup (`pg_dump`)।
