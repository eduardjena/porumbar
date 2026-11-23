# Calendarul cuibului – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A „Cuiburile” band on Panou shows, across all open clutches, what to do today and in the next days (second egg, candling, hatching, ringing), lets the breeder record it with one tap, and adds those moments to the existing evening/morning reminders — still one push and one email per evening.

**Architecture:** Nest moments are computed on the fly from `clutches` by a pure module (`src/nest-schedule.js`); a calendar endpoint groups them for the band; the existing reminder runner (`src/treatment-reminders.js`) is generalised so treatments and nests contribute lines to the same per-account push and the same evening email. Only two new clutch columns (`candled_on`, `calendar_closed_on`) and one notice table.

**Tech Stack:** Node 24 ESM, Express 5, PostgreSQL (`pg`, `?` placeholders via `src/db.js`), Angular 22 standalone/signals/zoneless.

**Spec:** `docs/superpowers/specs/2026-11-23-calendar-cuib-design.md` (Romanian).

## Global Constraints

- Postgres only; tests on the temporary Postgres of `node scripts/test.mjs`; run the full suite once, in the foreground, never two at once.
- Migrations append-only in `src/db.js`; this plan adds migration **24** (main has 23).
- Days and hours in Europe/Bucharest, using `bucharestNow` / `atBucharest` from `src/treatment-schedule.js`; reminders: evening **19:00**, morning **07:00**, catch-up window **3 h**, a moment counts only if it falls at/after the clutch's last change (same rule as treatments).
- Moment rules (spec „Momentele unei ponte”): open clutch = first egg within the last **45** days, not `calendar_closed_on`; second egg expected from `egg1_on + 2`, „Doar un ou?” from `egg1_on + 4`; candling on day **5** after the second egg (after the first for a one-egg clutch) — one constant; hatching days **17–19** from the first egg (`HATCH_DAYS`), overdue after day 19; ringing days **6–8** after hatching (`RING_DAYS`), day 8 = „ultima zi”, overdue after.
- Exactly **one** evening push and **one** evening email per account per day for treatments + nests together; the 07:00 push carries the last ringing day together with the treatments' „ultima zi”. Evening lists include „mâine e ultima zi de inelare”.
- Read-only accounts: see the band, buttons disabled with the usual activation sentence (402 on write); they get **no** nest reminders (treatment reminders unchanged).
- Email rule unchanged: `reminder_email` on, only when no device got the evening push; no SMTP_URL in production → nothing sent; the email's last line says where to turn it off (Cont → Amintiri).
- Band buttons use the same routes/validations as the pair page (`PATCH /api/clutches/:id`, `POST /api/clutches/:id/young`).
- Every new user-visible text in `i18n/ro.json` (with `sens`) and `i18n/hu.json`; `test/i18n.test.js` and `test/texte-ramase.test.js` pass. LF line endings.
- UI: base text 18px, buttons ≥ 48px, high contrast, own SVG icons, no horizontal scroll at 320px.
- Only invented test data. Commit messages in Romanian ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push or merge.

## Review Focus

1. A clutch moved to a foster pair (doică): moments must show at the foster's nest with both pairs named, and recording from the band must still edit the original clutch (Task 2 test `doica`).
2. Year change: a pair with `season` 2026 whose eggs hatch in January 2027 must still be in the band (Task 1 test `45 de zile peste anul nou`).
3. A record made before the reminder hour (e.g. second egg entered at 18:00) must stop that evening's reminder for it (Task 3 test `trecut înainte de oră`).
4. An account with both a treatment and a nest moment tomorrow, with and without a phone: exactly one push, exactly one email, both listing both (Task 3 test `un singur mesaj`).
5. Ringing overdue: the band keeps it (marked „întârziat”) until ringed, „Nu inelez” or „Nu mai urmări”; reminders don't repeat it (Task 1 + Task 3 tests `inelare întârziată`).

---

### Task 1: Nest moments (pure)

**Files:**
- Create: `src/nest-schedule.js`
- Test: `test/cuib-program.test.js`

**Interfaces:**
- Produces:
  - `const OPEN_DAYS = 45`, `const CANDLE_DAY = 5`, `const SECOND_EGG = [2, 4]` (expected from +2, „Doar un ou?” from +4).
  - `type ClutchLike = { id, egg1On: string, egg2On: string|null, eggs: number, candledOn: string|null, infertile: number, broken: number, hatchedOn: string|null, hatched: number|null, young: number, calendarClosedOn: string|null }` (dates `YYYY-MM-DD`; `young` = count of ringed chicks).
  - `isOpen(c: ClutchLike, today: string): boolean`.
  - `nestMoments(c: ClutchLike, today: string): Moment[]` where `Moment = { kind: 'ou2'|'mirare'|'eclozare'|'inelare', from: string, to: string|null, state: 'viitor'|'azi'|'intarziat', last?: boolean, question?: boolean }` — only moments still to do: `ou2` while egg2 missing and `eggs` = 2 (`question: true` from +4); `mirare` while `candledOn` null and not hatched; `eclozare` while not hatched and remaining eggs > 0 (`state: 'intarziat'` after day 19); `inelare` while hatched and `young < hatched` (`last: true` on day 8, `intarziat` after). `state` relative to `today`; moments more than 3 days in the future are not returned.
  - `reminderMoments(c: ClutchLike): { kind: 'ou2'|'mirare'|'eclozare'|'inelare'|'inelare_ultima_maine'|'inelare_ultima', onDate: string, at: Date }[]` — 19:00 the day before the first day of `ou2`, `mirare`, `eclozare`, `inelare`; 19:00 the day before day 8 (`inelare_ultima_maine`); 07:00 on day 8 (`inelare_ultima`). Returns `[]` for a closed clutch.

- [ ] **Step 1: Write the failing tests** (fixed `today`, invented dates):
  - `ou2`: egg1 2026-05-01, egg2 null → on 05-03 `{kind:'ou2', state:'azi'}`; on 05-05 `question: true`; with `eggs: 1` → no `ou2`.
  - `mirare`: egg2 05-03 → `mirare` from 05-08; one-egg clutch egg1 05-01 → from 05-06; `candledOn` set → gone.
  - `eclozare`: egg1 05-01 → from 05-18 to 05-20; on 05-21 `state: 'intarziat'`; all eggs infertile → no eclozare.
  - `inelare`: hatched 05-19, hatched 2, young 0 → from 05-25 to 05-27, on 05-27 `last: true`; on 05-28 `intarziat`; young 2 → gone.
  - `45 de zile peste anul nou`: egg1 2026-12-20, today 2027-01-08 → open, eclozare state `azi`; egg1 45+ days ago → `isOpen` false; `calendarClosedOn` set → false and `reminderMoments` = `[]`.
  - `reminderMoments`: egg1 05-01 → `eclozare` onDate 05-17 at 19:00 Bucharest (`atBucharest('2026-05-17', 19)`); hatched 05-19 → `inelare_ultima_maine` 05-26 19:00 and `inelare_ultima` 05-27 07:00.
- [ ] **Step 2:** `node scripts/test.mjs test/cuib-program.test.js` — Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `src/nest-schedule.js` (imports only `atBucharest` from `./treatment-schedule.js` and `HATCH_DAYS`/`RING_DAYS` from `./breeding.js` — export them there if not exported).
- [ ] **Step 4:** Same command — Expected: pass.
- [ ] **Step 5:** Commit `Calendarul cuibului: momentele pontei (modul pur)`.

### Task 2: Migration 24, clutch fields, calendar endpoint

**Files:**
- Modify: `src/db.js` (migration 24), `src/breeding.js`, `src/routes/breeding.js`, `i18n/ro.json`, `i18n/hu.json`
- Test: `test/cuib-calendar.test.js`

**Interfaces:**
- Consumes: Task 1.
- Migration 24: `ALTER TABLE clutches ADD COLUMN candled_on DATE, ADD COLUMN calendar_closed_on DATE`; `CREATE TABLE nest_notices (clutch_id BIGINT NOT NULL REFERENCES clutches(id) ON DELETE CASCADE, kind TEXT NOT NULL, on_date DATE NOT NULL, sent_at TIMESTAMPTZ NOT NULL, PRIMARY KEY (clutch_id, kind, on_date))`; and `clutches.updated_at TIMESTAMPTZ NOT NULL` (existing rows = `created_at`; set to now on create and on every clutch update) — `clutches` has no change timestamp today, and the reminder rule „counts only after the last change” needs it.
- Band shortcuts write existing fields (controller decision): „N-au ieșit” = `PATCH { infertile: eggs − broken − (hatched ?? 0) }` (all remaining eggs counted as not hatched, so eclozare disappears); „Nu inelez” = `PATCH { hatched: young }` (only works when hatched > young; validation unchanged).
- `parseClutch` / `toClutch` accept and return `candledOn` and `calendarClosedOn` (dates; `candledOn` ≥ `egg1On`; `calendarClosedOn` any date or null).
- Produces `GET /api/breeding/calendar` → `{ today: string, items: CalendarItem[] }`, `CalendarItem = { clutchId, pairId, label: string, fosterLabel: string|null, kind, from, to, state, last?, question?, eggs, eggsLeft, hatched, young }`, sorted: `intarziat` first, then by `from`, then label. `label` = `pairs.nest` („Cuibul 7” formatted by the client) when set, else „mascul × femelă” (name or ring). A clutch with `foster_pair_id` is listed at the foster's nest (`label` = foster pair, `fosterLabel` = own pair). Only the account's clutches; GET works for read-only accounts.

- [ ] **Step 1: Write the failing tests** (`startTestApp`, `newAccount`, `apiCaller`; build pairs/clutches via the existing breeding routes):
  - `banda`: clutch egg1 = today − 2, egg2 null → item `ou2`, `state: 'azi'`; PATCH `egg2On` today → item gone.
  - `mirare`: PATCH `candledOn` today with `infertile: 1` → `mirare` gone, eclozare `eggsLeft` 1.
  - `închisă`: PATCH `calendarClosedOn` → no items for that clutch; PATCH null → back.
  - `doica`: clutch with `fosterPairId` → item label is the foster pair, `fosterLabel` the own pair.
  - `separare`: account B sees none of A's items.
  - `doar citire`: read-only account → GET 200, PATCH 402.
  - `scurtături`: „N-au ieșit” body → eclozare gone and `infertile` = remaining eggs; „Nu inelez” body (`hatched: young`) → inelare gone.
  - `updated_at`: PATCH of a clutch moves `updated_at` forward.
- [ ] **Step 2:** `node scripts/test.mjs test/cuib-calendar.test.js` — Expected: FAIL.
- [ ] **Step 3:** Implement migration 24, fields, and the route (in `src/routes/breeding.js`, logic in `src/breeding.js`, e.g. `calendar(accountId, today)`).
- [ ] **Step 4:** Same command, then `test/reproductie.test.js` — Expected: pass.
- [ ] **Step 5:** Commit `Calendarul cuibului: migrarea 24, mirarea și „nu mai urmări” pe pontă, ruta calendarului`.

### Task 3: One reminder for treatments and nests

**Files:**
- Modify: `src/treatment-reminders.js` (generalised; keep exported names `runTreatmentReminders`, `startTreatmentReminders`, `mailErrorText`, `msUntilNextTick`), `i18n/ro.json`, `i18n/hu.json`
- Create: `src/nest-reminders.js` (nest source: due push items and evening email lines for one account set)
- Test: `test/cuib-amintiri.test.js`; existing `test/tratamente-amintiri.test.js` must still pass unchanged.

**Interfaces:**
- Consumes: Task 1 `reminderMoments`, `isOpen`; Task 2 table `nest_notices`, `clutches.updated_at`, labels (reuse the label helper from Task 2).
- Produces (in `src/nest-reminders.js`):
  - `nestDueItems(now: Date, today: string): Promise<Map<accountId, { clutchId, kind, onDate, text }[]>>` — open clutches of accounts whose subscription is active (read-only skipped), moments due by the treatment rule (`at ≤ now`, `now − at ≤ 3 h`, `at ≥ clutch.updated_at`), moments already recorded skipped (recompute with Task 1 at `now`).
  - `claimNestNotices(items): Promise<items>` — `INSERT … ON CONFLICT DO NOTHING RETURNING` on `nest_notices`.
  - `nestEveningLines(today: string, evening: Date): Promise<Map<accountId, { kind, text }[]>>` — what starts tomorrow plus `inelare_ultima_maine`, same filters.
- Runner change: per account, push lines = treatment lines ∪ nest lines, **one** `pushToAccount` call; evening email = treatment lines ∪ nest lines in **one** email (one `email_digests` claim), sent when the account has lines from either source; email template gets the closing line about Cont → Amintiri (new i18n text); URL in push: the treatment URL when only treatments, `/panou` otherwise.

- [ ] **Step 1: Write the failing tests** (pattern of `test/tratamente-amintiri.test.js`: fixed `now`, push sender stub via `setPushSender`, `emailDelayMs: 0`, mail capture):
  - `seara`: clutch egg1 = D, run at D+16 19:05 → one push whose body has the eclozare line; run again 19:30 → no second push.
  - `un singur mesaj`: account with a treatment starting tomorrow and a clutch whose ringing starts tomorrow → one push with both lines; same account without device → one email with both lines, no push.
  - `dimineața`: hatched H → at H+7 07:10 a push with the last-ringing line; at H+6 19:05 the evening list has „mâine e ultima zi de inelare”.
  - `trecut înainte de oră`: egg2 recorded at 18:00 on the day before → no `ou2` reminder at 19:05.
  - `doar citire`: read-only account with a due nest moment → no push, no email; its treatment reminders still go.
  - `inelare întârziată`: day 9+ → no reminder.
  - `închisă`: `calendarClosedOn` set → nothing.
- [ ] **Step 2:** `node scripts/test.mjs test/cuib-amintiri.test.js` — Expected: FAIL.
- [ ] **Step 3:** Implement `src/nest-reminders.js` and generalise the runner.
- [ ] **Step 4:** Same command and `test/tratamente-amintiri.test.js` — Expected: pass; then the full suite once — 0 fail.
- [ ] **Step 5:** Commit `Calendarul cuibului: amintirile de cuib în aceeași notificare și același email cu tratamentele`.

### Task 4: The „Cuiburile” band and the pair page

**Files:**
- Create: `web/src/app/pages/panou/cuiburi-banda.ts`
- Modify: `web/src/app/pages/panou/porumbar-cadru.ts` (band under the treatments band, Grilă only), `web/src/app/pages/perechi/pereche.ts` (query param `?inelare=<clutchId>` opens `openRing` for that clutch and scrolls to it; shows „Mirat pe …”, „Închisă în calendar” + „Urmărește din nou”), `web/src/app/core/models.ts` (`CalendarItem`, `Clutch.candledOn`, `Clutch.calendarClosedOn`), `web/src/app/shared/icon.ts` (icon `cuib` if none fits), `i18n/ro.json`, `i18n/hu.json`, `CLAUDE.md`, `README.md`
- Test: `npm --prefix web run build`; i18n tests; browser check by the controller.

**Interfaces:**
- Consumes: `GET /api/breeding/calendar` (Task 2), `PATCH /api/clutches/:id`, `/perechi/:id?inelare=<clutchId>`.
- Band (spec „Banda „Cuiburile””): sections „Întârziate”, „Azi”, „Mâine”, „Următoarele zile”; row = „Cuibul N” or pair label (+ foster), what to do, buttons: `ou2` → „A venit azi” (`egg2On` = today), „Doar unul” (`eggs` = 1); `mirare` → „Toate bune” (`candledOn` = today), „Limpezi: N” (select 1..eggs, `candledOn` + `infertile`); `eclozare` → „Au ieșit: N” (select 1..eggsLeft → `hatchedOn` = today, `hatched` = N), „N-au ieșit” (Task 2's chosen fields); `inelare` → „Inelează” (link), „Nu inelez” (Task 2's chosen fields); every row a small „Nu mai urmări” (`calendarClosedOn` = today). After each action the band reloads. Read-only: buttons disabled + activation sentence. Last ringing day in red, overdue marked. Hidden when there are no items.
- „N-au ieșit” and „Nu inelez” write the fields fixed in Task 2's Interfaces.

- [ ] **Step 1:** Implement the band, the pair-page changes, models, icon, i18n (RO with `sens`, HU).
- [ ] **Step 2:** `npm --prefix web run build` — Expected: success.
- [ ] **Step 3:** `test/i18n.test.js`, `test/texte-ramase.test.js` — Expected: pass.
- [ ] **Step 4:** Update `CLAUDE.md` (new files, migration 24, moment rules, one-message rule) and `README.md` (one line).
- [ ] **Step 5:** Full suite once — 0 fail.
- [ ] **Step 6:** Commit `Calendarul cuibului: banda „Cuiburile” pe Panou și inelarea din bandă`.
- [ ] **Step 7 (controller, browser):** demo account with invented clutches at each stage: band sections, each button, „Inelează” → ring step open with proposed ring, „Nu mai urmări”, read-only state, 375px and 320px, Hungarian labels.
