# Tratamente pe tot porumbarul, cu amintiri — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crescătorul trece o cură / un vaccin o dată pentru un grup de porumbei, îl vede în jurnalul fiecăruia și pe Panou, și primește amintiri pe telefon (Web Push) sau, ca plasă de siguranță, cel mult un email pe seară.

**Architecture:** Tratamentul e o entitate proprie (`treatments` + `treatment_pigeons`), care scrie intrări legate în `journal_entries`. O funcție pură (`src/treatment-schedule.js`) calculează momentele amintirilor în ora României; un rulant pe oră (`src/treatment-reminders.js`) fixează listele, continuă lanțul repetărilor, trimite push (pachetul `web-push`, chei VAPID proprii) și rezumatul de seară pe email, cu deduplicare în baza de date. Interfața: pagina Tratamente, banda de pe Panou, secțiunea Amintiri din Cont și un service worker mic.

**Tech Stack:** Node 24 ESM, Express 5, PostgreSQL (`pg`, placeholder `?`), `web-push` (npm), Angular 22 standalone / signals / zoneless, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-21-tratamente-design.md` (citește-l întreg; „Reguli detaliate” 1–11 sunt obligatorii).

## Global Constraints

- PostgreSQL și local; migrările doar adăugate la finalul `MIGRATIONS` din `src/db.js`; o migrare rulată nu se schimbă. Migrarea acestei ramuri e **a 22-a** (dacă plata intră prima în `main`, la unire se renumerotează după 25). Testele folosesc `SCHEMA_VERSION`, nu numere scrise de mână.
- Orice text nou văzut de crescător: în `i18n/ro.json` (cu `sens`) **și** `i18n/hu.json`, în același commit; `test/i18n.test.js` și `test/texte-ramase.test.js` trebuie să treacă. Fișierele JSON rămân LF (CRLF strică testele).
- Erorile se aruncă cu chei (`badRequest('eroare.x')`), câmpurile sunt chei (`text(v, 'camp.x')`).
- Interfața: text de bază 18px, butoane ≥ 48px, contrast mare, iconițe SVG proprii în `web/src/app/shared/icon.ts`, `<app-date>` pentru date (nu `<input type="date">`), confirmare la ștergere.
- CSP rămâne `'self'`; nimic de pe CDN; niciun serviciu străin de notificări.
- Separare totală între conturi: un tratament leagă doar porumbei **proprii** (`kind = 'own'`) ai contului.
- Ora amintirilor: `Europe/Bucharest` pentru toate conturile; seara **19:00**, dimineața **07:00**; fereastra de recuperare **3 ore**; „cu 3 zile înainte” pentru repetări.
- Email: cel mult **unul pe zi** pe cont, la 19:00, doar pentru conturile fără dispozitiv abonat (sau cu toate trimiterile serii eșuate); coadă implicit **10 emailuri / minut** (`REMINDER_EMAILS_PER_MINUTE`); în producție fără `SMTP_URL` nu se trimite și nu se scrie conținutul în jurnalul serverului.
- Cheile `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` doar în `.env` / Railway, niciodată în repo sau chat. Fără ele: fără push, restul merge.
- Fără merge în `main`, push al lui `main` sau publicare pe Railway fără acordul vânzătorului.

## Review Focus

1. **Trecerea la ora de vară / iarnă** (ultima duminică din martie / octombrie): 19:00 și 07:00 trebuie să fie ora României și în acele zile, iar o verificare pe oră nu trebuie să sară sau să dubleze un moment → test în Task 3.
2. **Două servere pornite în același timp** (publicare Railway peste cea veche): aceeași notificare / același email nu pleacă de două ori → test în Task 5 (două rulări concurente ale `runTreatmentReminders` cu același `now`).
3. **Porumbel schimbat de stare între salvare și început** (devine vândut, sau un tânăr nou intră în grup): lista fixată în ziua de început trebuie să reflecte starea de atunci → test în Task 2.
4. **Abonament push expirat / telefon schimbat** (răspuns 404/410 de la serviciul de push): abonamentul se șterge, iar dacă era singurul, seara pleacă emailul → test în Task 5.
5. **Cont doar-citire** (abonament Porumbar expirat): nu poate crea / modifica tratamente (402/403 ca restul scrierilor), dar poate porni amintirile și le primește pe cele existente → test în Task 2 și Task 4.

---

### Task 1: Datele (migrarea 22) și listele

**Files:**
- Modify: `src/db.js` (migrarea 22 la finalul `MIGRATIONS`)
- Modify: `src/catalog.js` (listele noi + `publicCatalog`)
- Modify: `i18n/ro.json`, `i18n/hu.json`
- Test: `test/tratamente-date.test.js`

**Interfaces:**
- Produces (tabele, exact aceste nume de coloane):
  - `treatments(id BIGINT identity PK, account_id → accounts ON DELETE CASCADE, name TEXT NOT NULL, kind TEXT CHECK IN ('tratament','vaccin'), method TEXT NOT NULL, start_date DATE NOT NULL, days INT NOT NULL CHECK 1..60, note TEXT, target TEXT CHECK IN ('toti','concurenti','reproducatori','tineret','alesi'), repeat_kind TEXT NULL CHECK IN ('zile','an'), repeat_days INT NULL, parent_id → treatments ON DELETE SET NULL, frozen_at TIMESTAMPTZ NULL, cancelled_on DATE NULL, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)`; index `(account_id, start_date)`.
  - `treatment_pigeons(treatment_id → treatments CASCADE, pigeon_id → pigeons CASCADE, PK(treatment_id, pigeon_id))` — pentru `alesi` = alegerea omului; pentru grupuri = lista fixată (goală până la `frozen_at`).
  - `journal_entries.treatment_id BIGINT NULL → treatments ON DELETE CASCADE`.
  - `push_subscriptions(id, account_id → accounts CASCADE, endpoint TEXT UNIQUE, p256dh TEXT, auth TEXT, user_agent TEXT, created_at, last_ok_at NULL)`.
  - `treatment_notices(treatment_id → treatments CASCADE, kind TEXT CHECK IN ('inainte','ultima_zi','repetare'), on_date DATE, sent_at TIMESTAMPTZ, PK(treatment_id, kind, on_date))`.
  - `email_digests(account_id → accounts CASCADE, on_date DATE, sent_at TIMESTAMPTZ, PK(account_id, on_date))`.
  - `accounts.reminder_email BOOLEAN NOT NULL DEFAULT true`.
- Produces (catalog): `TREATMENT_METHODS` (`apa, hrana, pastila, injectie, picaturi`), `TREATMENT_TARGETS` (`toti, concurenti, reproducatori, tineret, alesi`), `TREATMENT_SUGGESTIONS` (boli / vaccinuri uzuale, cod + etichetă: de ex. `tricomonaza`, `coccidioza`, `ornitoza` (respiratorii), `viermi`, `salmoneloza`, `paramixo` (vaccin), `variola` (vaccin), `adenovirus`, `paraziti_externi`; fără nume comerciale de medicamente), expuse în `publicCatalog` ca `treatmentMethods`, `treatmentTargets`, `treatmentSuggestions` (traduse cu `tr(lang, 'tratament_mod' | 'tratament_cui' | 'tratament_sugestie', …)`, ca `journalTypes`).

- [ ] **Step 1: Test eșuat** — `test/tratamente-date.test.js`: după `bootTestDb()`, `SCHEMA_VERSION` = numărul migrărilor și tabelele / coloanele de mai sus există (`information_schema.columns`); `GET /api/catalog` (fără cont) are `treatmentMethods` cu 5 coduri, `treatmentTargets` cu 5 coduri, `treatmentSuggestions` nevid; cu un cont `hu` etichetele vin în maghiară (diferite de cele românești).
- [ ] **Step 2:** `node scripts/test.mjs test/tratamente-date.test.js` → FAIL (tabelele lipsesc).
- [ ] **Step 3:** Migrarea 22 (comentariu `// 22: tratamentele pe grupuri, abonamentele push, amintirile trimise.`), listele în `catalog.js`, cheile `catalog.tratament_mod.*`, `catalog.tratament_cui.*`, `catalog.tratament_sugestie.*` în ro + hu (în maghiară cu termenii din `docs/cercetare/termeni-maghiari.md` unde există).
- [ ] **Step 4:** testul trece; `npm test` → toate trec.
- [ ] **Step 5:** commit „Tratamente: tabelele (migrarea 22) și listele”.

### Task 2: Tratamentele pe server (API, grupuri, jurnal, repetări)

**Files:**
- Create: `src/treatments.js`, `src/routes/treatments.js`
- Modify: `src/app.js` (montat `app.use('/api', treatmentsRouter())` înainte de 404), `src/routes/journal.js` (intrarea legată: `treatmentId` în răspuns, DELETE → 409)
- Modify: `i18n/ro.json`, `i18n/hu.json`
- Test: `test/tratamente.test.js`

**Interfaces:**
- Consumes: tabelele și listele din Task 1.
- Produces (`src/treatments.js`):
  - `groupPigeonIds(accountId: number, target: string): Promise<number[]>` — porumbei proprii; `toti` = fără stare `vandut|pierdut|mort`; `concurenti|reproducatori|tineret` = starea `concurent|reproducator|tanar`.
  - `recipientIds(t: TreatmentRow): Promise<number[]>` — `alesi` → `treatment_pigeons`; grup înghețat → `treatment_pigeons`; grup neînghețat → `groupPigeonIds` (numărul „de acum”).
  - `freezeTreatment(t: TreatmentRow, lang: string): Promise<void>` — pentru grup scrie `treatment_pigeons` din `groupPigeonIds`; pune `frozen_at`; apoi `syncJournal`; dacă are repetare și nu are încă un copil, `createNextOccurrence`.
  - `syncJournal(t: TreatmentRow, lang: string): Promise<void>` — exact o intrare `journal_entries` pe porumbel din `recipientIds`, `entry_date = start_date`, `type = kind`, `text = journalText(t, lang)`; șterge intrările porumbeilor scoși.
  - `journalText(t, lang): string` — cheia `tratament.jurnal_text`: ro `„{nume} ({mod}, {perioada})”` + `„ — {nota}”` dacă are notă + `„ (oprit pe {zi})”` dacă e anulat; perioada `21.11.2026 – 25.11.2026` (ro) / `2026. 11. 21. – 2026. 11. 25.` (hu), o singură dată la `days = 1`. Numele: eticheta sugestiei dacă `name` e un cod de sugestie, altfel textul omului.
  - `nextStart(t): string | null` — `zile` → `start_date + repeat_days`; `an` → aceeași zi și lună anul următor (29.02 → 28.02); fără repetare → `null`.
  - `createNextOccurrence(t): Promise<number>` — copie cu `start_date = nextStart(t)`, `parent_id = t.id`, aceeași țintă (la `alesi`, aceiași porumbei), neînghețat.
  - `endDate(t): string` — `start_date + days - 1`.
- Produces (API, toate cu `requireAccount`; scrierile blocate automat la conturile doar-citire):
  - `GET /api/treatments?stare=in_curs|urmeaza|gata&before=<id>` → `{ treatments: Treatment[] }` (gata: ultimele 50, `before` pentru „Mai multe”).
  - `GET /api/treatments/:id` → `{ treatment: Treatment, pigeons: {id, ring, name, status}[] }`.
  - `POST /api/treatments` body `{ name, kind, method, startDate, days, note?, target, pigeonIds?, repeat: null | { kind: 'zile', days } | { kind: 'an' } }` → 201 `{ treatment }`.
  - `PATCH /api/treatments/:id` (același corp, toate câmpurile) → `{ treatment }`.
  - `POST /api/treatments/:id/cancel` → doar dacă e în curs (altfel 409 `eroare.tratament_nu_e_in_curs`).
  - `DELETE /api/treatments/:id` → 204.
  - `GET /api/treatments/count?target=…` → `{ count }` (pentru fișă, „24 de porumbei”).
  - Forma `Treatment`: `{ id, name, label, kind, method, startDate, endDate, days, note, target, repeat, cancelledOn, status: 'urmeaza'|'in_curs'|'gata'|'anulat', day: number|null /* ziua curentă la in_curs */, count, nextId: number|null }`.
  - `GET /api/pigeons/:id/journal` → intrările au și `treatmentId` (sau `null`); `DELETE /api/journal/:id` pe o intrare legată → 409 `eroare.intrare_din_tratament`.

- [ ] **Step 1: Teste eșuate** în `test/tratamente.test.js` (conturi A și B, porumbei proprii cu stări diferite, ca în `test/journal.test.js`):
  - `creează pentru tot porumbarul, azi`: 3 porumbei (`concurent`, `tanar`, `vandut`) + POST cu `target: 'toti'`, `startDate: today()`, `days: 5` → 201, `count === 2`, `status === 'in_curs'`, `day === 1`; jurnalul fiecăruia dintre cei 2 are o intrare `type 'tratament'` cu `treatmentId`; cel vândut nu are.
  - `grupul se fixează la început, nu la salvare` (Review Focus 3): tratament `concurenti` care începe peste 2 zile → `count` 1; un porumbel nou `concurent` → `count` 2 (încă neînghețat, jurnal gol); `freezeTreatment` apelat (simulând ziua de început) → `treatment_pigeons` are 2 rânduri și 2 intrări în jurnal; schimbarea apoi a stării unuia în `vandut` nu-l scoate.
  - `alege eu: doar porumbei proprii, vii` — `pigeonIds` cu un porumbel al lui B → 400; cu unul `mort` → 400; cu un strămoș extern → 400.
  - `grup gol` → 400 `eroare.grup_fara_porumbei`.
  - `validări`: `days` 0 și 61 → 400; `kind` inventat → 400; `method` inventat → 400; dată greșită → 400; `note` > 1000 → 400.
  - `modifică rescrie jurnalul`: schimbarea `days` 5 → 3 rescrie textul intrărilor; schimbarea țintei după început refixează lista (adaugă / șterge intrări).
  - `repetarea`: `repeat: { kind: 'an' }` cu `startDate 2028-02-29` → copilul are `startDate 2029-02-28`; `repeat: { kind: 'zile', days: 21 }` → copilul la +21 zile față de început; există un singur copil.
  - `anulează în curs` → `cancelledOn` = azi, intrările rămân și au „oprit pe” (cheia ro), copilul planificat dispare; anularea unuia neînceput → 409.
  - `șterge` → intrările lui și copilul dispar; tratamentul de dinainte (părintele) rămâne și are `repeat: null`.
  - `jurnalul legat`: `DELETE /api/journal/:id` pe intrarea legată → 409; alt cont → 404.
  - `separare`: B nu vede, nu modifică, nu șterge tratamentul lui A (404).
  - `doar-citire` (Review Focus 5): un cont cu `newAccount(call, 'X', { active: false })` → POST 4xx ca la celelalte scrieri.
- [ ] **Step 2:** rulat → FAIL.
- [ ] **Step 3:** implementează `src/treatments.js` și `src/routes/treatments.js` (validările cu `text`, `realDate`, `oneOf` din `src/http.js`; totul într-o tranzacție `tx` pe scriere). La POST / PATCH: dacă `start_date <= azi (Bucharest)` → `freezeTreatment` imediat. Cheile noi `eroare.*`, `camp.*`, `tratament.jurnal_text*` în ro + hu.
- [ ] **Step 4:** testul trece; `npm test` → toate trec.
- [ ] **Step 5:** commit „Tratamente: API-ul, grupurile, jurnalul legat și repetările”.

### Task 3: Momentele amintirilor (funcție pură)

**Files:**
- Create: `src/treatment-schedule.js`
- Test: `test/tratamente-program.test.js`

**Interfaces:**
- Produces:
  - `bucharestNow(now: Date): { date: 'YYYY-MM-DD', hour: number, minute: number }` (cu `Intl.DateTimeFormat`, `timeZone: 'Europe/Bucharest'`).
  - `atBucharest(date: 'YYYY-MM-DD', hour: number): Date` — momentul UTC al orei locale (corect și în zilele schimbării orei).
  - `moments(t: { startDate, days, repeat, cancelledOn, parentId }): { kind: 'inainte'|'ultima_zi'|'repetare', onDate: 'YYYY-MM-DD', at: Date }[]` — `inainte` = ziua dinaintea începutului la 19:00; `ultima_zi` = ultima zi la 07:00, doar la `days >= 2`; `repetare` = cu 3 zile înainte de început la 19:00, doar pentru tratamentele născute dintr-o repetare (`parentId != null`); niciunul dacă `cancelledOn`.
  - `dueMoments(t, now: Date, changedAt: Date): Moment[]` — momentele cu `at <= now`, `now - at <= 3h`, `at >= changedAt`.

- [ ] **Step 1: Teste eșuate:**
  - `inainte` pentru `startDate 2026-11-25` → `at` = `2026-11-24T17:00:00Z` (19:00 iarna = UTC+2).
  - `ultima_zi` pentru `2026-07-01`, 5 zile → `2026-07-05T04:00:00Z` (07:00 vara = UTC+3); la `days: 1` nu există.
  - `repetare` doar cu `parentId` → `2026-11-22T17:00:00Z` pentru început `2026-11-25`.
  - Ora de vară (Review Focus 1): `atBucharest('2027-03-28', 7)` = `2027-03-28T04:00:00Z`; `atBucharest('2026-10-25', 7)` = `2026-10-25T05:00:00Z`; un `dueMoments` evaluat din oră în oră pe 2027-03-27 … 03-29 pentru un tratament care începe pe 03-29 dă momentul `inainte` exact o dată.
  - Fereastra: `now` = `at + 2h59m` → e scadent; `at + 3h01m` → nu; `changedAt` după `at` → nu.
  - Anulat → `moments` gol.
- [ ] **Step 2:** FAIL. **Step 3:** implementare. **Step 4:** PASS + `npm test`.
- [ ] **Step 5:** commit „Tratamente: momentele amintirilor în ora României”.

### Task 4: Push (abonamente, trimitere, service worker)

**Files:**
- Modify: `package.json` (dependența `web-push`), `src/config.js` (`vapidPublicKey`, `vapidPrivateKey`, `vapidSubject`, `pushReady` = toate trei setate; `reminderEmailsPerMinute` implicit 10)
- Create: `src/push.js`, `src/routes/push.js`, `web/public/sw.js`
- Modify: `src/app.js` (montat la `/api/auth/push` — astfel e scutit de doar-citire; `/sw.js` servit cu `Cache-Control: no-cache` și `Service-Worker-Allowed: /`; în `DEFAULT_CSP` adăugat `"worker-src 'self'"`), `src/routes/auth.js` (`PATCH /me` acceptă `reminderEmail: boolean`; `GET /me` îl întoarce), `.env.example`
- Test: `test/push.test.js`

**Interfaces:**
- Produces (`src/push.js`):
  - `sendPush(sub: {endpoint, p256dh, auth}, payload: { title, body, url }): Promise<'ok'|'gone'|'error'>` — `'gone'` la 404/410.
  - `setPushSender(fn | null)` — doar pentru teste (înlocuiește trimiterea reală).
  - `pushToAccount(accountId, payload): Promise<{ sent: number, failed: number, devices: number }>` — trimite la toate dispozitivele contului, șterge abonamentele `'gone'`, pune `last_ok_at` la `'ok'`.
- Produces (API, `requireAccount`):
  - `GET /api/auth/push/config` → `{ publicKey }` sau 404 când `!config.pushReady`.
  - `POST /api/auth/push` body `{ endpoint, keys: { p256dh, auth } }` → 201; upsert după `endpoint` (dacă era al altui cont, trece la acesta). Validare: `endpoint` `https://`, ≤ 1000 caractere; cel mult 10 dispozitive pe cont (al 11-lea îl înlocuiește pe cel mai vechi).
  - `DELETE /api/auth/push` body `{ endpoint }` → 204 (doar al contului).
  - `POST /api/auth/push/test` body `{ endpoint }` → trimite „Proba: amintirile merg” (cheie i18n) la acel dispozitiv → `{ result }`.
  - `GET /api/auth/me` → `reminderEmail` și `pushDevices: number`.
- Produces (`web/public/sw.js`): `push` → `showNotification(title, { body, icon: '/icon.svg', data: { url } })`; `notificationclick` → focus pe o fereastră deschisă și navigare la `data.url`, altfel `clients.openWindow(data.url)`. Fără cache offline, fără `fetch` handler.

- [ ] **Step 1: Teste eșuate** (`test/push.test.js`, cu `setPushSender` falsă care înregistrează apelurile):
  - fără chei VAPID → `/api/auth/push/config` 404; cu cheile setate în `process.env` înainte de pornire → 200 cu `publicKey`.
  - abonare 201; a doua abonare cu același `endpoint` de pe contul B → rândul trece la B; A nu-l mai are.
  - `endpoint` `http://…` → 400; al 11-lea dispozitiv îl înlocuiește pe cel mai vechi.
  - `pushToAccount` cu expeditorul fals care întoarce `'gone'` → abonamentul se șterge, `{ failed: 1, devices: 1 }` (Review Focus 4).
  - cont doar-citire poate să se aboneze (201) și să-și schimbe `reminderEmail` (Review Focus 5).
  - CSP-ul oricărui răspuns (`/api/health`) conține `worker-src 'self'`. (`Cache-Control: no-cache` pe `/sw.js` se pune în `setHeaders` al `express.static` și se verifică în browser, Task 7.)
- [ ] **Step 2:** FAIL. **Step 3:** implementare; `npm install web-push`. **Step 4:** PASS + `npm test`.
- [ ] **Step 5:** commit „Tratamente: notificările pe telefon (abonare, trimitere, service worker)”.

### Task 5: Rulantul amintirilor (push + rezumatul de seară)

**Files:**
- Create: `src/treatment-reminders.js`
- Modify: `src/server.js` (`startTreatmentReminders()` după `startReminders()`), `i18n/ro.json`, `i18n/hu.json`
- Test: `test/tratamente-amintiri.test.js`

**Interfaces:**
- Consumes: `freezeTreatment`, `createNextOccurrence`, `recipientIds` (Task 2), `moments`, `dueMoments`, `bucharestNow` (Task 3), `pushToAccount` (Task 4), `sendMail` (`src/mail.js`).
- Produces:
  - `runTreatmentReminders(now = new Date(), { emailDelayMs } = {}): Promise<{ frozen: number, pushed: number, emails: number }>`:
    1. Îngheață tratamentele cu `start_date <= azi` și `frozen_at IS NULL` (nu anulate) — și astfel continuă lanțul repetărilor (inclusiv la conturile doar-citire).
    2. Pentru fiecare moment scadent (`dueMoments`, `changedAt = updated_at`) al tratamentelor neanulate cu ≥ 1 porumbel: `INSERT … treatment_notices … ON CONFLICT DO NOTHING RETURNING` — doar rândurile chiar inserate merg mai departe.
    3. Grupare pe cont: **o notificare** cu toate (titlu + corp din chei i18n în limba contului; `url` = `/tratamente/<id>` la unul singur, altfel `/panou`) → `pushToAccount`.
    4. La verificarea în care ora României e 19 (sau în fereastra de 3 h de la 19:00): pentru conturile cu `reminder_email = true` care au ceva pentru mâine (început / ultima zi) sau peste 3 zile (repetare) **și** (`devices === 0` sau `sent === 0` la notificarea serii): `INSERT … email_digests … ON CONFLICT DO NOTHING RETURNING`, apoi emailul în coadă.
    5. Coada trimite cel mult `config.reminderEmailsPerMinute` pe minut (`emailDelayMs` pentru teste = 0). În producție fără `SMTP_URL`: nu se pun în coadă și nu se scrie conținutul.
  - `startTreatmentReminders()` — o rulare la 15 s după pornire, apoi `setInterval` pe oră, `.unref()`; erorile se scriu în consolă (`// i18n: ro`), nu opresc serverul.

- [ ] **Step 1: Teste eșuate** (expeditor push fals; `sentMails` din `src/mail.js`; `now` fixat):
  - tratament care începe mâine, `now` = 19:05 ora României → o notificare „Mâine începe…” cu numărul de porumbei; a doua rulare cu același `now` → nimic nou.
  - două rulări **concurente** (`Promise.all`) cu același `now` → o singură notificare și un singur email (Review Focus 2).
  - două tratamente în același moment → **o** notificare cu ambele, `url` `/panou`.
  - fără dispozitive → un email la 19:05 cu ambele tratamente, în limba contului (`hu` → text maghiar); la 07:05 a doua zi („ultima zi”) → niciun email.
  - singurul dispozitiv răspunde `'gone'` → abonamentul dispare și pleacă emailul (Review Focus 4).
  - `reminder_email = false` și fără dispozitive → niciun email.
  - `NODE_ENV=production` fără `SMTP_URL` → niciun email, niciun rând în `email_digests`.
  - lanțul: un tratament cu `repeat: { kind: 'zile', days: 7 }` al cărui copil începe azi → după rulare, copilul e înghețat și are și el un copil; la un cont doar-citire la fel.
  - momentul trecut cu > 3 h (server oprit) → nu se trimite.
  - tratament salvat la 19:30 pentru mâine → la rularea de la 20:00 **nu** pleacă „Mâine începe” (momentul 19:00 e înaintea salvării; Regula 1 din spec); „ultima zi” de a doua zi pleacă normal.
- [ ] **Step 2:** FAIL. **Step 3:** implementare. **Step 4:** PASS + `npm test`.
- [ ] **Step 5:** commit „Tratamente: amintirile pe telefon și rezumatul de seară pe email”.

### Task 6: Interfața — pagina Tratamente, fișa, Panoul, meniul

**Files:**
- Create: `web/src/app/pages/tratamente/tratamente.ts` (lista: În curs · Urmează · Gata), `web/src/app/pages/tratamente/tratament-form.ts` (nou + modifică), `web/src/app/pages/tratamente/tratament.ts` (detaliu: porumbeii, Modifică / Anulează / Șterge cu confirmare)
- Modify: `web/src/app/app.routes.ts` (`tratamente`, `tratamente/nou`, `tratamente/:id`, `tratamente/:id/modifica`, cu `authGuard`), `web/src/app/app.ts` (Panou → banda: „Tratamente” după „Scanează”; regex-ul `also` al Panoului include `tratamente`), `web/src/app/shared/icon.ts` (`tratament` — picurătoare; `vaccin` — seringă), `web/src/app/core/models.ts` (`Treatment`, `JournalEntry.treatmentId`), panoul (`web/src/app/pages/panou/` — banda „În curs” + „Urmează 30 de zile”, deasupra conținutului, ascunsă când nu e nimic), `web/src/app/pages/porumbel/porumbel.ts` (intrarea legată: fără „Șterge”, cu link „Vezi tratamentul”), `i18n/ro.json`, `i18n/hu.json`

**Interfaces:**
- Consumes: API-ul din Task 2, catalogul din Task 1.
- Fișa (aprobată în spec): „Ce dai” (listă din `treatmentSuggestions` + „Altul…” cu câmp text), Tratament / Vaccin, „Cui” (5 butoane radio mari; la „Aleg eu” se folosește `shared/pigeon-picker` existent, filtrat la porumbei proprii fără `vandut|pierdut|mort`), „Cum”, „Începe” (`<app-date>`), „Câte zile” (1–60) cu „se termină pe …” calculat, „Se repetă” (nu / peste N zile / peste 1 an), „Notă”. Sub „Cui”: „{n} porumbei” din `GET /api/treatments/count`. Obligatorii doar „Ce dai”, „Cui” (cu porumbei), „Începe”.
- Banda Panoului: un rând pe tratament în curs („În curs: {nume}, ziua {zi} din {zile}”; la o zi: „azi”) și „Urmează” (cel mult 3 rânduri + „Toate tratamentele”); atingerea duce la `/tratamente/:id`.

- [ ] **Step 1:** `npm run build --prefix web` (sau comanda de build din `README.md`) → trece înainte de schimbări (bază).
- [ ] **Step 2:** implementează paginile, rutele, banda, iconițele, textele ro + hu.
- [ ] **Step 3:** build-ul trece; `npm test` (i18n + texte rămase) trece.
- [ ] **Step 4: Verificare în browser** (preview-ul local, cont demo): creează „Tricomonază, tot porumbarul, azi, 5 zile” → apare pe Panou „ziua 1 din 5”, în jurnalul unui porumbel, intrarea n-are „Șterge”; „Aleg eu” arată doar porumbeii vii proprii; la 375 px lățime nimic nu iese din ecran, butoanele ≥ 48px; în maghiară toate textele sunt traduse.
- [ ] **Step 5:** commit „Tratamente: pagina, fișa, banda de pe Panou și meniul”.

### Task 7: Interfața — Cont → Amintiri

**Files:**
- Create: `web/src/app/core/push.ts` (serviciu: `supported()`, `isIosNotInstalled()`, `subscribe()`, `unsubscribe()`, `currentEndpoint()`, înregistrarea `/sw.js`)
- Modify: `web/src/app/pages/auth/cont.ts` (secțiunea nouă `amintiri` în lista `all`, după `limba`), `web/src/app/app.ts` (submeniul Cont: „Amintiri”, iconița `alerta` sau una nouă `clopot`), `web/src/app/core/auth.ts` (`logout()` apelează întâi `push.unsubscribe()`, fără să blocheze ieșirea), `i18n/ro.json`, `i18n/hu.json`

**Interfaces:**
- Consumes: `/api/auth/push/*`, `PATCH /api/auth/me { reminderEmail }` (Task 4).
- Secțiunea: butonul mare „Primesc amintiri pe telefonul ăsta” (cere permisiunea doar la apăsare) → apoi „Trimite o probă” și „Opresc pe telefonul ăsta”; pe iPhone în Safari (nu în aplicația de pe ecran) — pașii „Partajează → Adaugă pe ecranul principal → deschide din iconiță”; browser fără suport → „Telefonul acesta nu primește notificări; primești emailul de seară”; permisiune refuzată → cum se repornește din setările telefonului; serverul fără chei (404 la config) → secțiunea arată doar opțiunea de email; bifa „Primesc amintiri pe email” (`reminderEmail`).

- [ ] **Step 1:** implementează serviciul și secțiunea.
- [ ] **Step 2:** build + `npm test` trec.
- [ ] **Step 3: Verificare în browser** cu chei VAPID de test generate local (`npx web-push generate-vapid-keys`, puse doar în `.env` local): abonare → „Trimite o probă” afișează notificarea; ieșirea din cont șterge abonamentul (`push_subscriptions` gol); cu `?sec=amintiri` banda Cont are butonul activ.
- [ ] **Step 4:** commit „Tratamente: Cont → Amintiri (notificări pe telefon și email)”.

### Task 8: Documentația

**Files:**
- Modify: `CLAUDE.md` (structura: `treatments.js`, `treatment-schedule.js`, `treatment-reminders.js`, `push.js`, `routes/treatments.js`, `routes/push.js`, `pages/tratamente`, `sw.js`; banda Panoului și submeniul Cont; variabilele VAPID și `REMINDER_EMAILS_PER_MINUTE` la Publicare), `.env.example`, `README.md` (cum se generează cheile VAPID local)

- [ ] **Step 1:** actualizează.
- [ ] **Step 2:** `npm test` → toate trec.
- [ ] **Step 3:** commit „Tratamente: documentația”.
