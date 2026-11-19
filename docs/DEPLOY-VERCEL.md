# CU Meetings: Vercel + Neon पर free hosting

इसमें लगभग 45 मिनट लगते हैं। Accounts बनाना और sign-in आपको खुद करना है।

> Vercel का free (Hobby) plan non-commercial इस्तेमाल के लिए है: demo और testing ठीक है। University के असली इस्तेमाल के लिए Vercel Pro या अपना server लें।

---

## 1. Code को GitHub पर डालें (private repo)

1. github.com पर नया **Private** repository बनाएँ (README मत जोड़ें)।
2. Project folder में:
   ```bash
   git remote add origin https://github.com/<your-name>/cu-meetings.git
   git push -u origin main
   ```

> पुराने commits में पुराने test passwords हैं। Repo **private** रखें। Neon पर नया password बनेगा, इसलिए वे वहाँ काम नहीं करेंगे।

---

## 2. Neon database बनाएँ

1. neon.tech पर sign up → **New project**।
2. Region: **AWS Asia Pacific (Mumbai)** या **Singapore** (India के पास, तेज़)।
3. Postgres version 17 चुनें → Create।
4. **Connect** बटन से दो connection strings copy करें:
   - **Pooled** (host में `-pooler` होता है) → यह `DATABASE_URL` बनेगा
   - **Direct** (बिना `-pooler`) → यह `DIRECT_URL` बनेगा

   दोनों के आखिर में `?sslmode=require` होना चाहिए।

---

## 3. नए secrets बनाएँ

Project folder में:
```bash
node scripts/gen-secrets.mjs
```
यह `AUTH_SECRET`, `CRON_SECRET`, VAPID keys और एक नया `CLIENT_INITIAL_PASSWORD` print करता है। इन्हें कहीं सुरक्षित रख लें; ये किसी को न दें और commit न करें।

---

## 4. Database में tables और शुरुआती data डालें (अपने laptop से)

PowerShell में (अपनी Neon values भरकर):
```powershell
$env:DATABASE_URL="<Neon pooled URL>"
$env:DIRECT_URL="<Neon direct URL>"
$env:SEED_PROFILE="cu-unnao"
$env:CLIENT_INITIAL_PASSWORD="<step 3 वाला password>"
npx prisma migrate deploy
npm run db:seed
```
Seed के बाद accounts की list terminal में दिखती है। फिर PowerShell window बंद कर दें (ये values उसी window तक रहती हैं)।

---

## 5. Vercel पर deploy करें

1. vercel.com पर GitHub से sign up → **Add New → Project** → अपना repo **Import** करें।
2. Framework: Next.js (अपने आप आ जाता है)। Build command बदलने की ज़रूरत नहीं: project का `vercel-build` script अपने आप चलता है (migrations + build)।
3. **Environment Variables** में ये सब डालें:

| Name | Value |
|---|---|
| `DATABASE_URL` | Neon pooled URL |
| `DIRECT_URL` | Neon direct URL |
| `AUTH_SECRET` | step 3 से |
| `CRON_SECRET` | step 3 से |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | step 3 से |
| `VAPID_PRIVATE_KEY` | step 3 से |
| `VAPID_SUBJECT` | `mailto:<आपका email>` |
| `APP_URL` | अभी `https://example.com` (step 6 में बदलेंगे) |
| `PUBLIC_BOOKING` | `false` |
| `CLIENT_ORG_SLUG` | `cu-unnao` |
| `ALLOW_ORG_SIGNUP` | `false` |
| `NEXT_PUBLIC_APP_NAME` | `CU Meetings` |
| `NEXT_PUBLIC_APP_TAGLINE` | `Staff meeting booking & immediate meetings.` |
| `DISABLE_JOBS` | `true` |
| `TRUST_PROXY` | `true` |
| `DEV_SHOW_RESET_LINK` | `false` |

4. **Deploy** दबाएँ। 2 से 4 मिनट में link मिलेगा, जैसे `https://cu-meetings.vercel.app`।

---

## 6. सही link डालें

1. Vercel → Project → **Settings → Environment Variables** → `APP_URL` को अपने असली link पर बदलें (जैसे `https://cu-meetings.vercel.app`, आखिर में `/` नहीं)।
2. **Deployments** → सबसे ऊपर वाले पर **⋯ → Redeploy**।

QR codes और emails में यही link जाता है।

---

## 7. Reminders और auto No Show (free cron)

Vercel पर app हमेशा चालू नहीं रहता, इसलिए हर मिनट एक बाहरी service इसे जगाती है।

1. cron-job.org पर free account बनाएँ → **Create cronjob**।
2. URL: `https://<आपका link>/api/cron/tick`
3. Schedule: **Every minute**
4. **Advanced** में:
   - Request method: **POST**
   - Headers: `x-cron-secret` = step 3 वाला `CRON_SECRET`
5. Save → **Test run**: जवाब में `{"reminders":0,"noShows":0,"expired":0}` जैसा आना चाहिए।

---

## 8. जाँचें

1. अपना link खोलें → seed वाले admin account और नए password से login करें → अपना password बनाएँ।
2. My account → **Turn on phone alerts** → Send test alert (HTTPS पर अब phone पर भी चलेगा)।
3. VC account से एक immediate meeting बुलाएँ और दूसरे phone पर alert देखें।

---

## जानने वाली बातें

- **Forgot password:** email के बिना नहीं चलेगा। Resend.com पर free account बनाकर `RESEND_API_KEY` और `EMAIL_FROM` Vercel में डालें। तब तक admin **Reset password** से काम चलाएँ।
- **Login की रोक:** Vercel कई copies में चलता है, इसलिए "network से 100 गलत कोशिश" वाली रोक हर copy की अलग गिनती रखती है। Account का 5 गलत password पर lock होना (database में) पूरी तरह काम करता है।
- **Neon free plan:** थोड़ी देर इस्तेमाल न हो तो database सो जाता है; पहली request 1 से 2 सेकंड धीमी होती है।
- **कोड बदलने पर:** `git push` करते ही Vercel अपने आप नया version deploy करता है, और नए migrations भी अपने आप लग जाते हैं।
