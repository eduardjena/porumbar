# Japoneza, partea a doua — plan de implementare

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conturile japoneze își văd inelele, pedigree-urile (Excel, poză) și amintirile așa cum le scriu și le trăiesc japonezii, fără nicio schimbare nevoită la `ro` (iar la `hu` doar ora Ungariei).

**Architecture:** Completăm piesele existente, comune tuturor limbilor: zona orară vine din `i18n/languages.json` (câmpul nou `zone`) printr-un modul pur `src/zones.js`, importat și de server și de interfață (ca `src/rings.js`); inelele japoneze fără prefix primesc `JPN ` la salvare, doar pe forma japoneză și doar la contul `ja`; cititoarele de tabel (`table-values.js`, `catalog.js`, `tabel-coloane.ts`) și instrucțiunile cititorului de poze primesc cazurile japoneze.

**Tech Stack:** Node 24 ESM, Express 5, PostgreSQL (`pg`), Angular standalone/signals/zoneless, `node --test` (`npm test` = `scripts/test.mjs`, pornește un Postgres temporar).

**Spec:** `docs/superpowers/specs/2026-11-26-japoneza-date-design.md`

## Global Constraints

- PostgreSQL și la teste (instalat local, Postgres temporar din `scripts/lib/temp-postgres.mjs`); niciodată SQLite sau o bază emulată. Fără migrare de bază de date.
- Orice text nou pe care îl vede crescătorul intră în `i18n/ro.json`, `i18n/hu.json` **și** `i18n/ja.json`, în același commit; un prefix nou de chei intră în `GROUPS` din `test/ja.test.js`.
- Zonele: `ro` → `Europe/Bucharest`, `hu` → `Europe/Budapest`, `ja` → `Asia/Tokyo`; limbă necunoscută → `Europe/Bucharest`.
- Rămân pe ora României: data abonamentului (`src/subscriptions.js`), mesajele către vânzător (`src/routes/auth.js`), consola vânzătorului (`web/src/app/pages/admin/`).
- Prefixul `JPN ` se pune doar pe forma japoneză (an pe 2 sau 4 cifre + **două litere** + număr: `25-AB-01234`, `25AB01234`, `2025 AB 01234`, `25-ET-1234`), doar la contul `ja`, doar pe ce scrie sau aduce omul însuși (formular, părinți, perechi, import Excel, citire poză). Transfer, „Preia”, vânzare: `ring_raw` neschimbat. `parseRing` nu se schimbă pentru inelele fără prefix.
- Nicio schimbare de comportament pentru `ro`, în afara datei „azi” din browser (care azi iese cu o zi în urmă între 00:00 și 03:00 — reparație aprobată).
- Textul scris de om e sursa de adevăr; nu se pierde.
- Date de test inventate. Branch `feat/japoneza-date`; fără merge / push (push pe `main` = publicare pe Railway).
- Teste: fiecare task rulează `node --test <fișierele lui>`; suita completă `npm test` (~4 minute) la sfârșitul task-urilor 2, 4, 5 și 8. `node --test test/ja.test.js` rămâne verde.

## Review Focus

1. Un cont `ro` care scrie `25-AB-01234` (sau orice inel fără țară) îl salvează exact ca azi — fără `JPN`. (Test în Task 4.)
2. Un cont `ja` care scrie un inel doar din cifre (`26-800546`, `412084/15`) îl salvează exact cum l-a scris. (Test în Task 4.)
3. Ora de vară: o amintire de seară (19:00) la un cont `hu` pleacă la 17:00 UTC vara și la 18:00 UTC iarna; la `ja` mereu 10:00 UTC; la `ro` exact ca azi. (Test în Task 1.)
4. La un cont `ja`, la 08:00 ora Tokyo din 2026-11-27 (UTC încă 26), „azi” e 2026-11-27 și pe server, și în browser. (Teste în Task 1 și Task 3.)
5. Datele din Excel: `25/11/2025` se citește ca azi, `2025/11/25` ca an/lună/zi, `令和元年5月1日` = 2019-05-01, o dată inexistentă (`2025/2/30`) → null. (Test în Task 5.)

---

### Task 1: Zona contului — modulul pur

**Files:**
- Modify: `i18n/languages.json` (câmpul `"zone"` la fiecare limbă)
- Create: `src/zones.js` (+ `src/zones.d.ts`, ca `src/rings.d.ts`, pentru importul din `web/`)
- Modify: `src/treatment-schedule.js`, `src/nest-schedule.js`
- Test: `test/zones.test.js`

**Interfaces:**
- Produces (în `src/zones.js`, fără importuri din aplicație în afară de `i18n/languages.json`):
  - `BUCHAREST = 'Europe/Bucharest'`
  - `zoneOf(lang: string | null | undefined): string`
  - `localNow(now: Date, zone: string): { date: 'YYYY-MM-DD', hour: number, minute: number }`
  - `atLocal(date: 'YYYY-MM-DD', hour: number, zone: string): Date` — momentul UTC al orei locale; o oră care nu există (salt de vară) → după decalajul de iarnă, ca `atBucharest` azi.
  - `todayIn(zone: string, now?: Date): 'YYYY-MM-DD'`
- Produces (în `src/treatment-schedule.js`): `moments(t, zone = BUCHAREST)`, `dueMoments(t, now, changedAt, zone = BUCHAREST)`; `bucharestNow` / `atBucharest` rămân, ca prescurtări pentru `localNow(…, BUCHAREST)` / `atLocal(…, BUCHAREST)`.
- Produces (în `src/nest-schedule.js`): funcțiile care azi cheamă `atBucharest` primesc un ultim parametru `zone = BUCHAREST`.

- [ ] **Step 1: Testele care pică** (`test/zones.test.js`)

```js
assert.equal(zoneOf('ro'), 'Europe/Bucharest');
assert.equal(zoneOf('hu'), 'Europe/Budapest');
assert.equal(zoneOf('ja'), 'Asia/Tokyo');
assert.equal(zoneOf('xx'), 'Europe/Bucharest');
assert.equal(zoneOf(undefined), 'Europe/Bucharest');
// Review Focus 4: Tokyo e deja pe 27 când UTC e încă pe 26
assert.equal(todayIn('Asia/Tokyo', new Date('2026-11-26T23:00:00Z')), '2026-11-27');
assert.equal(todayIn('Europe/Bucharest', new Date('2026-11-26T23:00:00Z')), '2026-11-27'); // 01:00 București
assert.equal(todayIn('Europe/Budapest', new Date('2026-11-26T23:00:00Z')), '2026-11-27'); // 00:00 Budapesta
// Review Focus 3: 19:00 local
assert.equal(atLocal('2026-11-27', 19, 'Asia/Tokyo').toISOString(), '2026-11-27T10:00:00.000Z');
assert.equal(atLocal('2026-11-27', 19, 'Europe/Budapest').toISOString(), '2026-11-27T18:00:00.000Z');
assert.equal(atLocal('2026-07-01', 19, 'Europe/Budapest').toISOString(), '2026-07-01T17:00:00.000Z');
assert.equal(atLocal('2026-07-01', 19, 'Europe/Bucharest').toISOString(), '2026-07-01T16:00:00.000Z');
assert.equal(atLocal('2026-03-29', 3, 'Europe/Bucharest').toISOString(), atBucharest('2026-03-29', 3).toISOString());
// Aceleași rezultate ca azi pentru România, pe un an întreg, la orele 7 și 19
for (let d = Date.UTC(2026, 0, 1); d < Date.UTC(2027, 0, 1); d += 86400e3) {
  const day = new Date(d).toISOString().slice(0, 10);
  for (const h of [7, 19]) assert.equal(atLocal(day, h, BUCHAREST).getTime(), atBucharestOld(day, h).getTime());
}
// moments cu zonă
assert.equal(moments({ startDate: '2026-11-28', days: 3, parentId: null }, 'Asia/Tokyo')[0].at.toISOString(), '2026-11-27T10:00:00.000Z');
```

`atBucharestOld` = o copie, în test, a funcției `atBucharest` de azi (bucla pe decalajele 3 și 2), ca martor.
Și un test că fiecare intrare din `i18n/languages.json` are `zone` valid (`new Intl.DateTimeFormat('en', { timeZone })` nu aruncă).

- [ ] **Step 2:** `node --test test/zones.test.js` → FAIL (modulul lipsește).
- [ ] **Step 3:** Scrie `src/zones.js` (decalajul se află cu `Intl.DateTimeFormat(...).formatToParts`, nu cu o listă fixă de decalaje), adaugă `zone` în `languages.json`, adaugă parametrul `zone` în `treatment-schedule.js` și `nest-schedule.js` (valoare implicită București, deci apelanții de azi nu se schimbă).
- [ ] **Step 4:** `node scripts/test.mjs test/zones.test.js test/tratamente-program.test.js test/cuib-program.test.js test/ja.test.js test/i18n.test.js` → PASS.
- [ ] **Step 5:** Commit „Zona orară a contului, după limbă (ro București, hu Budapesta, ja Tokyo)”.

### Task 2: Serverul pe ora contului (azi, calendar, tratamente, amintiri)

**Files:**
- Modify: `src/treatments.js` (`todayBucharest`), `src/routes/breeding.js` (calendarul cuibului), `src/treatment-reminders.js`, `src/nest-reminders.js`, `src/breeding.js` dacă ia „azi” în alt loc
- Test: `test/tratamente-amintiri.test.js`, `test/tratamente-date.test.js`, `test/tratamente.test.js`, `test/cuib-amintiri.test.js`, `test/cuib-calendar.test.js` (cu Postgres, prin `node scripts/test.mjs <fișiere>`) + cazuri noi

**Interfaces:**
- Consumes: `zoneOf`, `todayIn`, `localNow`, `atLocal` (Task 1); `moments` / `dueMoments` / funcțiile din `nest-schedule.js` cu `zone`.
- Produces: `todayFor(lang: string): 'YYYY-MM-DD'` în `src/treatments.js` (înlocuiește `todayBucharest` peste tot unde contul e cunoscut; `todayBucharest` rămâne doar unde nu există cont).

- [ ] **Step 1: Testele care pică** (în fișierele de test existente ale amintirilor, cu conturi `ro`, `hu`, `ja`):
  - Un tratament al unui cont `ja`, început pe 2026-11-28: `runTreatmentReminders(new Date('2026-11-27T10:00:30Z'))` trimite amintirea „inainte” a contului `ja`; aceeași rulare nu trimite nimic contului `ro` cu un tratament identic; contul `ro` o primește la `2026-11-27T17:00:30Z`, exact ca azi.
  - Contul `hu` o primește la `2026-11-27T18:00:30Z`.
  - Rezumatul de seară prin email al contului `ja` pleacă în fereastra de după 19:00 ora Tokyo, nu ora României.
  - Amintirile cuibului (`nest-reminders`) la fel, pentru un cont `ja`.
  - `GET /api/breeding/calendar` pentru un cont `ja` la `2026-11-26T23:30Z` socotește „azi” = 2026-11-27 (se poate testa prin funcția pe care o cheamă ruta, cu `now` dat).
  - „Înghețarea” tratamentelor începute (`freezeStarted`) folosește „azi” al fiecărui cont.
- [ ] **Step 2:** rulează testele → FAIL.
- [ ] **Step 3:** Implementare. Rularea orară rulează pașii de azi **o dată pe zonă**: pentru fiecare zonă din `languages.json`, `today = todayIn(zone, now)`, seara = `atLocal(today, EVENING, zone)`, iar interogările se restrâng la conturile cu limbile acelei zone (limbile necunoscute merg cu București). Contul are limba în `accounts.lang`.
- [ ] **Step 4:** testele task-ului → PASS; `npm test` → verde.
- [ ] **Step 5:** Commit „Amintirile, tratamentele și calendarul cuibului pe ora țării contului”.

### Task 3: „Azi” în browser, după zona contului

**Files:**
- Create: `web/src/app/core/today.ts` — `todayIso(): string` după limba contului curent (`zoneOf(lang)` + `todayIn` din `src/zones.js`, importat ca `src/rings.js` în `ring-preview.ts`)
- Modify: `web/src/app/pages/concurs/concurs-rezultate.ts:33`, `pages/perechi/pereche.ts:15`, `pages/perechi/perechi.ts:12`, `pages/porumbel/porumbel.ts:179`, `pages/porumbel/rezultat-editor.ts:31`, `pages/tratamente/tratament-text.ts:14` (`todayIso` de acolo devine cel din `core/today.ts`, folosit de `tratament-form.ts`, `tratament.ts`, `panou/tratamente-banda.ts`), `shared/date-field.ts:17`
- Test: `test/azi-browser.test.js` (citește fișierele ca text, ca `test/lipici.test.js`)

**Interfaces:**
- Consumes: `zoneOf`, `todayIn` (Task 1). Limba contului: din serviciul de autentificare (`auth.account()?.lang`); fără cont (pagini publice) → limba interfeței.
- Produces: `todayIso()` din `web/src/app/core/today.ts`.

- [ ] **Step 1: Testul care pică:** niciun fișier din `web/src/app` în afară de `pages/admin/` nu mai ia „azi” cu `new Date().toISOString().slice(0, 10)` sau cu ceasul telefonului (`getFullYear()/getMonth()/getDate()` pentru „azi”); toate cele 7 locuri de mai sus importă `todayIso` din `core/today`. (Calculul `todayIn` pe zone e deja testat în Task 1.)
- [ ] **Step 2:** `node --test test/azi-browser.test.js` → FAIL.
- [ ] **Step 3:** Implementare (adunările de zile din `tratament-text.ts`, `addDays`, pe UTC, rămân cum sunt).
- [ ] **Step 4:** testul → PASS; `npm run build` → exit 0.
- [ ] **Step 5:** Commit „În browser, «azi» după ora țării contului”.

### Task 4: Inelele japoneze fără prefix

**Files:**
- Modify: `src/rings.js` (+ `src/rings.d.ts`)
- Modify: `src/pigeons.js` (validarea primește limba contului), `src/routes/family.js`, `src/breeding.js` (inelele scrise de om: părinți, pui inelați, perechi), `src/pedigree-import.js` (citirea pozei), `src/table-import.js` (importul Excel), `web/src/app/shared/ring-preview.ts` (+ locurile care îl cheamă)
- Test: `test/rings-japonia.test.js` + cazuri în testele API existente ale porumbeilor / importului

**Interfaces:**
- Produces (în `src/rings.js`): `japaneseRingText(text: string): string` — dacă textul (după NFKC, majuscule, spații strânse) are forma japoneză `^(\d{2}|\d{4})[ -]?([A-Z]{2})[ -]?(\d{1,6})$` și `parseRing('JPN ' + text).ok`, întoarce `'JPN ' + text` (textul omului, nu cel normalizat); altfel întoarce textul neschimbat. Nu știe de cont: apelantul o cheamă doar la `lang === 'ja'`.
- Produces: `previewRing(text: string, lang?: string): RingPreview` — la `lang === 'ja'` previzualizează `japaneseRingText(text)`.

- [ ] **Step 1: Testele care pică**

```js
assert.equal(japaneseRingText('25-AB-01234'), 'JPN 25-AB-01234');
assert.equal(japaneseRingText('25AB01234'), 'JPN 25AB01234');
assert.equal(japaneseRingText('2025 AB 01234'), 'JPN 2025 AB 01234');
assert.equal(japaneseRingText('25-et-1234'), 'JPN 25-et-1234');
assert.equal(japaneseRingText('２５ＡＢ０１２３４'), 'JPN ２５ＡＢ０１２３４');
// Review Focus 2: doar cifre → neschimbat
for (const s of ['26-800546', '25-12345', '2025-12345', '412084/15', 'JPN 25-AB-01234', 'RO 25 1234567']) assert.equal(japaneseRingText(s), s);
assert.equal(formatRing(parseRing(japaneseRingText('25AB01234'))), 'JP-25-AB-01234');
```

Prin API (Postgres): un cont `ja` care salvează porumbelul propriu cu inelul `25-AB-01234` → `ring.display === 'JP-25-AB-01234'`, `ring.raw === 'JPN 25-AB-01234'`; același text la un cont `ro` → `ring.raw === '25-AB-01234'`, la fel ca azi (Review Focus 1); un cont `ja` cu `26-800546` → `raw` neschimbat. Același lucru pentru un părinte scris de mână și pentru importul unui pedigree citit din poză (cu răspunsul cititorului falsificat). Un transfer / „Preia” de la un cont `ro` către un cont `ja` păstrează `ring_raw` neschimbat.
Previzualizare: `previewRing('25-AB-01234', 'ja').display === 'JP-25-AB-01234'`, `previewRing('25-AB-01234', 'ro').ok === false`.

- [ ] **Step 2:** rulează → FAIL.
- [ ] **Step 3:** Implementare: `japaneseRingText` în `rings.js`; fiecare loc care salvează un inel scris sau adus de om, la contul `ja`, îl trece prin ea înainte de `parseRing`. Importul Excel: la contul `ja`, un inel cu forma japoneză primește `JPN ` înaintea logicii cu țara coloanei (`ringWithCountry`); un inel doar cu cifre urmează logica de azi.
- [ ] **Step 4:** testele → PASS; `npm test` → verde.
- [ ] **Step 5:** Commit „Inelele japoneze scrise fără JPN se recunosc la conturile japoneze”.

### Task 5: Excel japonez — titluri, date, sex, culori, separatori

**Files:**
- Modify: `web/src/app/shared/tabel-coloane.ts` (`TITLURI`, `SEX_CUVINTE`), `src/table-values.js` (`readDate`, `SEX_WORDS`), `src/catalog.js` (`matchColor`), `src/table-import.js` (limba contului ajunge la culori), `web/src/app/pages/porumbel-form/split-lines.ts` dacă separatorii sunt acolo
- Test: `test/excel-japonia.test.js` (pur, fără Postgres) + un caz de import prin API în `test/import-excel.test.js`

**Interfaces:**
- Produces: `matchColor(text, { lang } = {})` — la `lang === 'ja'`, formele de o singură literă (B, S, G…) nu se mai potrivesc nici când textul e doar litera; restul neschimbat. Apelanții de la import trimit limba contului.
- Produces: `readDate(text, order)` acceptă în plus: `AAAA/L/Z` (an în față), `AAAA年L月Z日`, erele `令和` (1 = 2019, `元` = 1), `平成` (1 = 1989), `昭和` (1 = 1926), prescurtările `R7.11.25`, `H30.5.1`, `S60.1.1`; cifrele late se normalizează (NFKC) întâi.

- [ ] **Step 1: Testele care pică**

```js
assert.equal(readDate('2025/11/25'), '2025-11-25');
assert.equal(readDate('2025/1/5'), '2025-01-05');
assert.equal(readDate('25/11/2025'), '2025-11-25');          // ca azi
assert.equal(readDate('2025年11月25日'), '2025-11-25');
assert.equal(readDate('２０２５年１１月２５日'), '2025-11-25');
assert.equal(readDate('令和7年11月25日'), '2025-11-25');
assert.equal(readDate('令和元年5月1日'), '2019-05-01');
assert.equal(readDate('平成30年5月1日'), '2018-05-01');
assert.equal(readDate('R7.11.25'), '2025-11-25');
assert.equal(readDate('H30.5.1'), '2018-05-01');
assert.equal(readDate('2025/2/30'), null);
assert.equal(readDate('2025年11月'), null);
for (const [w, s] of [['オス', 'M'], ['メス', 'F'], ['雄', 'M'], ['雌', 'F'], ['♂', 'M'], ['♀', 'F']]) assert.equal(readSex(w), s);
assert.equal(matchColor('B', { lang: 'ja' }).code, null);
assert.equal(matchColor('B').code, matchColorToday('B'));     // la ro/hu, ca azi
assert.equal(matchColor('ブルー', { lang: 'ja' }).code, 'albastru');
```

(`matchColorToday` = rezultatul de azi, scris ca valoare în test.) Titluri: `guessColumns` / `findHeader` recunosc un antet `['脚環番号', '性別', '羽色', '父', '母', '生年月日', '作出者', '鳩名']` ca inel, sex, culoare, tată, mamă, data nașterii, crescător, nume; lista japoneză se ia din `docs/cercetare/termeni-japonezi.md` (inel: 脚環, 足環, 足輪, 脚環番号, リング, リング番号; sex: 性別, 雌雄; culoare: 羽色, 色; tată: 父, 父鳩; mamă: 母, 母鳩; naștere: 生年月日, 孵化日, 生年; crescător: 作出者; nume: 名前, 鳩名; țară: 国). Separatorii `；` și `／` în listele din celule se citesc ca `;` și `/`. Un import prin API al unui cont `ja` cu aceste titluri și o culoare `B` salvează culoarea necunoscută, cu textul `B` păstrat.
- [ ] **Step 2:** → FAIL. **Step 3:** implementare. **Step 4:** testele → PASS; `node --test test/ja.test.js` → PASS; `npm test` → verde.
- [ ] **Step 5:** Commit „Importul Excel citește titlurile, datele, sexul și culorile scrise în japoneză”.

### Task 6: Citirea pozei — fișa japoneză

**Files:**
- Modify: `src/pedigree-reader.js` (`INSTRUCTIONS`, lângă fraza despre fișa maghiară), `src/pedigree-import.js` (data și sexul citite trec prin `readDate` / `readSex`, culoarea prin `matchColor(…, { lang })`, inelul prin Task 4)
- Test: `test/pedigree-read.test.js`, `test/pedigree-import.test.js` (răspunsuri falsificate, niciun apel real la Anthropic)

- [ ] **Step 1: Testele care pică:** instrucțiunile conțin `血統書`, `父`, `母`, `作出者`, `♂`, `♀` și exemplele de inel `JPN 25-AB-01234` / `25-AB-01234`; un răspuns falsificat al cititorului cu inelul `25-AB-01234`, data `令和7年4月1日`, sexul `メス`, culoarea `B`, importat într-un cont `ja` → inel `JP-25-AB-01234`, data `2025-04-01`, sex `F`, culoare necunoscută cu textul păstrat; același răspuns într-un cont `ro` → inelul cum e scris.
- [ ] **Step 2:** → FAIL. **Step 3:** implementare. **Step 4:** → PASS.
- [ ] **Step 5:** Commit „Citirea pozei recunoaște fișa japoneză”.

### Task 7: Mărunțișurile din cod amânate

**Files:** după caz: `web/src/app/shared/qr-code.ts`, partajarea PDF (`share-pdf`), desenul rețelei (Cytoscape), servirea `japoneza.css` (`src/app.js`), meniul de jos (`web/src/app/app.ts`, eticheta シーズン la 320px), cache-ul eșecului `html-to-image`, `test/font-japonez.test.js`, un test direct pentru `glueIn`.

Fiecare mărunțiș e un pas propriu, cu testul lui (test care pică întâi, unde se poate testa fără browser), în această ordine:
- [ ] eticheta pentru cititoarele de ecran a codului QR vine din i18n (cheie nouă în `ro`/`hu`/`ja`), nu româna scrisă în cod;
- [ ] trimiterea PDF-ului are o limită de timp (rețea blocată → mesaj de eroare, butonul revine); valoarea: 30 s;
- [ ] desenul rețelei se redesenează când `document.fonts` termină de încărcat fontul japonez (doar la `ja`);
- [ ] `japoneza.css` se servește comprimat (cum se servesc celelalte fișiere text, dacă există deja comprimare; dacă nu există deloc în aplicație, se notează și se sare);
- [ ] eticheta シーズン încape pe un rând la 320px (test pe CSS, ca testul meniului din `test/lipici.test.js`);
- [ ] testul fontului japonez se sare curat (skip, cu motiv) când lipsește `web/node_modules`;
- [ ] `glueIn` are test direct.
Ce se dovedește mai mare de ~30 de rânduri de cod se notează în raport ca amânat, cu motivul, și nu se face.
- [ ] Commit la fiecare mărunțiș făcut („Mărunțiș: …”).

### Task 8: Harta proiectului și încheierea

**Files:** `CLAUDE.md` (secțiunile despre limbi, inele și amintiri), `docs/cercetare/termeni-japonezi.md` (§8 — de confirmat pe mostre: forma inelelor, titlurile Excel, culorile codate)

- [ ] **Step 1:** `CLAUDE.md`: câmpul `zone` din `languages.json` și `src/zones.js`; regula `JPN ` (doar forma japoneză, doar `ja`, doar ce aduce omul); ce rămâne pe ora României; regulă nouă: o limbă nouă primește și `zone`.
- [ ] **Step 2:** `npm test` → verde; `node --test test/ja.test.js` → verde; `npm run build` → exit 0.
- [ ] **Step 3:** Commit „CLAUDE.md: zona contului și inelele japoneze”.
