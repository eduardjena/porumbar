# Adu porumbeii din Excel – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A breeder brings their whole loft into Porumbar from an Excel/CSV table (pasted or picked as a file), with guessed columns, an exact preview, automatic parent links and a 7-day undo of the last import.

**Architecture:** The file is read in the browser (SheetJS, lazy-loaded only by the import page) into `string[][]`; a pure TS module guesses the columns; the client sends only the mapped cells. The server (`src/table-import.js`) runs one engine for both preview (transaction rolled back with a sentinel) and save, reusing the pedigree-import rules (reuse by ring key, fill only empty fields, conflicts never change data). Each saved import is logged (`excel_imports`, `excel_import_items`) for the undo.

**Tech Stack:** Node 24 ESM, Express 5, PostgreSQL (`pg`, `?` placeholders via `src/db.js`), Angular 22 standalone/signals/zoneless, SheetJS CE from `cdn.sheetjs.com`.

**Spec:** `docs/superpowers/specs/2026-11-23-import-excel-design.md` (Romanian; rule numbers below refer to its „Reguli detaliate”).

## Global Constraints

- Postgres only; tests run on the temporary Postgres of `npm test` (`node scripts/test.mjs`). Run the full suite once, in the foreground, never two at once.
- Migrations are append-only in `src/db.js`; this plan adds migration **23** (main has 22). `SCHEMA_VERSION` is the list length.
- SheetJS CE installed in `web/` from the official tarball, exact version, ≥ 0.20.3: `npm --prefix web i --save-exact https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (use the newest 0.20.x listed on https://cdn.sheetjs.com if newer). Never the npm-registry `xlsx@0.18.5`. Bundled (CSP `'self'`), loaded only via dynamic `import()` from the import page.
- Limits (spec rule 9): ≤ 3,000 rows and ≤ 20 columns per import; file ≤ 10 MB (checked in the browser); JSON body for `/api/import/excel*` ≤ 2 MB; preview ≤ 30 per minute per account; saving holds `lockAccount`.
- Undo (rule 10): only the **last Excel import** of the account, only within **7 days**; content-based check, never `updated_at`.
- Read-only accounts: 402 on preview, save and undo (comes free from `requireAccount` for non-GET requests; tests must assert it).
- Every new user-visible text in `i18n/ro.json` (with `sens`) and `i18n/hu.json`; `test/i18n.test.js` and `test/texte-ramase.test.js` must pass. LF line endings.
- UI: base text 18px, buttons ≥ 48px, high contrast, own SVG icons, no horizontal scroll at 320px.
- Only invented test data; no real breeder's file in the repo.
- Commit messages in Romanian, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push or merge.

## Review Focus

1. A table whose parents appear **after** their children (or a child listed as its own grandparent): links must still form, and a cycle must become a reported conflict, not a 400 that kills the whole import (Task 4 test `părinți după copii și ciclu`).
2. 3,000 rows with parents on a phone connection: preview must answer in reasonable time; the engine must not reload the whole account graph per row (Task 4 test `3000 de rânduri`, budget ≤ 20 s locally).
3. Excel cells that are numbers or dates (ring `117345` as number, Excel date serial `45292`, `24` as year): must arrive as the text the person sees, not `117345.0` or `45292` (Task 3 test `celule numerice și date`).
4. A Romanian CSV saved by old Excel in Windows-1250 (`Mălai`, `Ştefan` with cedilla): no `�` in names (Task 3 test `csv windows-1250`).
5. Undo after the person used a pigeon (journal entry, pair, treatment, results) or changed its name by hand: that pigeon must stay, and the message counts it (Task 5 test `anularea păstrează porumbeii folosiți`).

---

### Task 1: Cell values (server, pure)

**Files:**
- Create: `src/table-values.js`
- Test: `test/import-valori.test.js`

**Interfaces:**
- Produces (all pure, no DB):
  - `readSex(text: string): 'M'|'F'|null` — spec rule 3 word list (M/F, mascul/femelă, masc/fem, H/T, hím/tojó, cock/hen, doffer/duivin, Täuber/Täubin, mâle/femelle, ♂/♀), case- and diacritics-insensitive (`fold` from `src/catalog.js`).
  - `readCode(text: string, list, dictKeys): string|null` for eye color / breed / status: matches catalog `code` or its RO/HU name (names via `tr`/`t` dictionaries of `src/i18n.js`, the same keys the UI uses for that list), folded.
  - `readBreed(text): string` — empty → `'voiajor'`; unknown → `'alta'`.
  - `readLines(text): string[]` — split on `,` `;` `/`, trimmed, empty dropped, max 10 (extra dropped).
  - `readDate(text): string|null` — `YYYY-MM-DD` from `YYYY-MM-DD`, `DD.MM.YYYY`, `DD/MM/YYYY`, `D.M.YYYY`; a lone year or invalid date → null.
  - `ringWithCountry(text: string, country: string|null): string` — if `parseRing(text)` is ok or `needsClub`, return `text`; else if `country` and `parseRing(`${country} ${text}`)` is ok, return that; else `text`.
  - `cut(text, max): string|null` — trim, empty → null, slice to `max`.

- [ ] **Step 1: Write the failing tests** — one `test()` per function above, with these exact cases:
  `readSex('Mascul')==='M'`, `readSex('tojó')==='F'`, `readSex('duivin')==='F'`, `readSex('♂')==='M'`, `readSex('x')===null`;
  `readBreed('')==='voiajor'`, `readBreed('Voiajor')==='voiajor'`, `readBreed('ceva ciudat')==='alta'`;
  status `'vândut'`→`'vandut'`, `'MORT'`→`'mort'`, `'nimic'`→`null`;
  `readLines('Janssen; Van Loon / Delbar')` deep-equals `['Janssen','Van Loon','Delbar']`, 12 items → length 10;
  `readDate('05.04.2024')==='2024-04-05'`, `readDate('2024')===null`, `readDate('31.02.2024')===null`;
  `ringWithCountry('24-0117345','RO')` parses to RO 2024 117345; `ringWithCountry('BE 19 6080187','RO')==='BE 19 6080187'`; `ringWithCountry('HU-24-12345','HU')==='HU-24-12345'` (needsClub left alone).
- [ ] **Step 2:** Run `node scripts/test.mjs test/import-valori.test.js` — Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `src/table-values.js` (no imports besides `./catalog.js`, `./rings.js`, `./i18n.js`).
- [ ] **Step 4:** Run the same command — Expected: all pass.
- [ ] **Step 5:** Commit `Import Excel: citirea valorilor din celule (sex, rasă, stare, linii, dată, țara inelului)`.

### Task 2: Column guessing and pasted text (web, pure)

**Files:**
- Create: `web/src/app/shared/tabel-coloane.ts` (no imports at all, like `shared/clasament.ts`)
- Test: `test/import-coloane.test.js` (imports the `.ts` directly, as `test/clasament.test.js` does)

**Interfaces:**
- Produces:
  - `type Field = 'inel'|'inel_tara'|'inel_an'|'inel_club'|'inel_numar'|'nume'|'sex'|'culoare'|'ochi'|'rasa'|'linii'|'eclozare'|'crescator'|'stare'|'tata'|'mama'|'observatii'|'ignor'`
  - `parsePasted(text: string): string[][]` — splits lines (`\r\n`/`\n`), delimiter = the one among tab, `;`, `,` that appears most consistently across the first 20 non-empty lines (tab wins ties); honours `"…"` quoting with `""` escapes; drops fully empty trailing rows; pads rows to the widest.
  - `looksLikeHeader(rows: string[][]): boolean` — true when the first row has ≥ 1 cell matching a header word and no cell that `looksLikeRing`.
  - `guessColumns(rows: string[][], hasHeader: boolean): Field[]` — one Field per column; header dictionary from spec rule 2 (RO/HU/EN/NL/DE/FR, diacritics-folded, also `nr inel`, `ring nr`, `ringnummer`, `gyűrűszám`, `apa`/`anya`, `vader`/`moeder`, `sire`/`dam`, `father`/`mother`, `vater`/`mutter`, `père`/`mère`, `name`/`naam`/`név`, `farbe`/`kleur`/`couleur`/`colour`/`color`/`szín`, `geslacht`/`geschlecht`/`ivar`/`sexe`, `born`/`hatched`/`geboren`/`kelt`, `breeder`/`kweker`/`züchter`/`tenyésztő`, `status`/`stare`/`állapot`, `notes`/`opmerking`/`megjegyzés`/`observatii`); content rules when no header match: ≥ 60% of non-empty cells look like rings → first such column `inel`, next `tata`, next `mama`; ≥ 80% sex words → `sex`; ≥ 60% dates → `eclozare`; else `ignor`. Each Field except `ignor` assigned at most once (first wins).
  - `looksLikeRing(cell: string): boolean` — cheap shape test (contains ≥ 5 digits and only letters/digits/space/`-`/`/`/`.`), no import of `rings.js`.
  - `canContinue(fields: Field[]): boolean` — true iff `inel` or `inel_numar` is present.
  - `buildRows(rows: string[][], fields: Field[], hasHeader: boolean): ImportRow[]` with `type ImportRow = { line: number; ring: string; name?: string; sex?: string; color?: string; eyeColor?: string; breed?: string; lines?: string; hatchedOn?: string; breeder?: string; status?: string; father?: string; mother?: string; notes?: string }` — `line` = 1-based row number as in Excel (header counts); ring from `inel`, or from parts joined with `-` in order țara-an-club-număr skipping empty parts; rows where every mapped cell is empty are dropped; at most 20 columns are read.

- [ ] **Step 1: Write the failing tests:**
  - `lipit din Excel (tab)`: `parsePasted('Inel\tNume\nRO-24-0117345\tFulger\n')` → `[['Inel','Nume'],['RO-24-0117345','Fulger']]`.
  - `csv cu ; și ghilimele`: `'a;"b;c";"d ""e"""'` → `[['a','b;c','d "e"']]`.
  - `titluri în olandeză`: header `['Ringnummer','Naam','Geslacht','Kleur','Vader','Moeder']` → `['inel','nume','sex','culoare','tata','mama']`.
  - `titluri în maghiară`: `['Gyűrűszám','Név','Ivar','Szín','Apa','Anya']` → same fields.
  - `fără titlu, după conținut`: 5 rows `['RO-24-0117345','M','BE-19-6080187','NL-20-1234567']` → `['inel','sex','tata','mama']`, and `looksLikeHeader` false.
  - `inelul în bucăți`: fields `['inel_tara','inel_an','inel_numar']`, row `['RO','24','0117345']` → `ring === 'RO-24-0117345'`; row `['','24','0117345']` → `ring === '24-0117345'`.
  - `numărul rândului`: with header, second data row has `line === 3`.
  - `canContinue`: `['nume','sex']` false, `['inel_numar']` true.
- [ ] **Step 2:** `node scripts/test.mjs test/import-coloane.test.js` — Expected: FAIL.
- [ ] **Step 3:** Implement `web/src/app/shared/tabel-coloane.ts`.
- [ ] **Step 4:** Same command — Expected: pass.
- [ ] **Step 5:** Commit `Import Excel: ghicirea coloanelor și tabelul lipit`.

### Task 3: Reading the file (web, SheetJS)

**Files:**
- Modify: `web/package.json`, `web/package-lock.json` (SheetJS, exact version per Global Constraints)
- Create: `web/src/app/shared/tabel-fisier.ts`
- Test: `test/import-fisier.test.js`

**Interfaces:**
- Consumes: SheetJS (`import * as XLSX from 'xlsx'`), only from this file.
- Produces:
  - `const MAX_FILE_BYTES = 10 * 1024 * 1024`
  - `readWorkbook(data: ArrayBuffer, fileName: string): { name: string; rows: string[][] }[]` — every sheet as displayed text (`sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: false })`, dates via `cellDates` + `dateNF: 'dd.mm.yyyy'` so they come out as `05.04.2024`); trailing empty rows/columns trimmed; `.csv`/`.txt`: decode bytes as UTF-8, and if the text contains `�` decode again as `windows-1250` (`TextDecoder`), then `parsePasted` from Task 2.
  - `firstSheetWithData(sheets): number` — index of the first sheet with ≥ 2 non-empty rows (else 0).
  - Throws `Error('fisier_mare')` when `data.byteLength > MAX_FILE_BYTES`, `Error('fisier_necitit')` when SheetJS throws.

- [ ] **Step 1:** Install SheetJS as in Global Constraints; confirm `web/package.json` shows the `https://cdn.sheetjs.com/...tgz` URL.
- [ ] **Step 2: Write the failing tests** (build workbooks in the test with SheetJS `utils.aoa_to_sheet` + `write({ type: 'array', bookType })`):
  - `xlsx cu două foi`: sheet 1 empty, sheet 2 with header + 2 rows → `firstSheetWithData === 1`, rows as strings.
  - `xls vechi`: `bookType: 'biff8'` round-trips the same rows.
  - `celule numerice și date`: cell number `117345` → `'117345'`; a JS `Date(2024,3,5)` cell → `'05.04.2024'`.
  - `csv windows-1250`: bytes of `'Nume;Inel\nMălai;RO-24-1\nŞtefan;RO-24-2\n'` encoded in windows-1250 (build the buffer by hand from the code points) → names `Mălai`, `Ştefan` with no `�`.
  - `fișier prea mare`: an `ArrayBuffer` of `MAX_FILE_BYTES + 1` → throws `fisier_mare`.
- [ ] **Step 3:** `node scripts/test.mjs test/import-fisier.test.js` — Expected: FAIL.
- [ ] **Step 4:** Implement `web/src/app/shared/tabel-fisier.ts`.
- [ ] **Step 5:** Same command — Expected: pass. Then `npm --prefix web run build` — Expected: success, and SheetJS is **not** in the initial `main-*.js` (it lands in a lazy chunk once Task 6 imports it dynamically; for now nothing imports the file from the app).
- [ ] **Step 6:** Commit `Import Excel: citirea fișierului (xlsx, xls, csv) cu SheetJS`.

### Task 4: Migration 23 and the import engine (preview + save)

**Files:**
- Modify: `src/db.js` (migration 23)
- Create: `src/table-import.js`, `src/routes/imports.js`
- Modify: `src/app.js` (router + 2 MB JSON limit for `/api/import/excel`), `i18n/ro.json`, `i18n/hu.json` (summary/conflict texts)
- Test: `test/import-excel.test.js`

**Interfaces:**
- Consumes: Task 1 functions; `createPigeon`, `updatePigeon`, `getPigeonRow`, `loadNodes` (`src/pigeons.js`); `parseRing`, `ringKey`, `fallbackKey`, `formatRing` (`src/rings.js`); `matchColor` (`src/catalog.js`); `tx`, `lockAccount`, `one`, `all`, `run`, `insert` (`src/db.js`); `ancestorIds` (`src/genealogy.js`).
- Migration 23:
  - `excel_imports(id BIGINT identity PK, account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL, undone_at TIMESTAMPTZ, summary JSONB NOT NULL)`, index on `(account_id, created_at DESC)`.
  - `excel_import_items(import_id BIGINT NOT NULL REFERENCES excel_imports(id) ON DELETE CASCADE, pigeon_id BIGINT NOT NULL REFERENCES pigeons(id) ON DELETE CASCADE, action TEXT NOT NULL CHECK (action IN ('created','filled','converted')), fields JSONB NOT NULL DEFAULT '{}', PRIMARY KEY (import_id, pigeon_id))` — `fields` = the column values this import wrote (for `created`: all columns it set incl. `father_id`/`mother_id`; for `filled`: only the filled columns and links; for `converted`: also `prev_kind`).
- Produces:
  - `importTable(accountId: number, body: { rows: ImportRow[]; defaultCountry?: string|null }, { save: boolean }): Promise<Summary>` where `Summary = { created: number; existing: number; ancestors: number; problems: { line: number; ring: string|null; kind: 'fara_inel'|'inel_necitit'|'dublura'|'conflict'|'parinte_necitit'; message: string }[]; problemCount: number; importId?: number }` (`problems` capped at 100, `problemCount` total). Preview (`save: false`) runs the same code in `tx` and throws a private sentinel to roll back, returning the summary it carried.
  - Routes in `src/routes/imports.js`: `POST /api/import/excel/preview` (rateLimit 30/min key `import:<accountId>`) → 200 Summary; `POST /api/import/excel` → 201 Summary with `importId`.
  - Validation: `rows` array, 1..3000 items else 400 `eroare.import_randuri` (`{ max: 3000 }`); each cell string ≤ 2000 chars (cut, not refused); `defaultCountry` must be a country code `rings.js` knows, else ignored.
- Engine rules (spec rules 3–8): load the account's pigeons once (ring_key → row) and the parent graph once (`loadNodes`), update both in memory as rows are created/linked; first pass places every row (rule 4–6, duplicates in table → `dublura`), second pass links parents (rule 7) so order does not matter; a cycle or wrong-sex parent or a different existing link → `conflict` problem, link not made (never a 400); a parent with unreadable ring → `parinte_necitit`; missing parents become `external` with the right sex and count in `ancestors`. Breed only on new pigeons. Color via `matchColor`; no match → `color_text` (as `fields()` in `src/pedigree-import.js`). Notes → `pedigree_text` only if empty. Hold `lockAccount` for the whole transaction.

- [ ] **Step 1: Write the failing tests** (`startTestApp`, `newAccount`, `apiCaller` like `test/pedigree-import.test.js`):
  - `previzualizarea nu salvează nimic`: preview of 3 rows → `created === 3`; then `GET /api/pigeons` count unchanged.
  - `salvarea face ce a spus previzualizarea`: same body saved → summary equal to preview except `importId`; 3 own pigeons exist.
  - `părinți după copii și ciclu`: child row listed before its father's row → father linked; rows A(father B), B(father A) → one link made, one `conflict`, status 201.
  - `strămoși noi`: mother ring not in table → `ancestors === 1`, mother is `external`, sex `F`.
  - `există deja: doar câmpurile goale`: existing own pigeon with name `Fulger`, table says name `Altul` and color `albastru` → name stays `Fulger`, color filled, `existing === 1`.
  - `fără inel și inel necitit`: row with name only → problem `fara_inel`; row ring `??` → `inel_necitit`, skipped; HU ring without club with `defaultCountry: 'HU'` → `inel_necitit`.
  - `țara implicită`: ring `24-0117345` + `defaultCountry: 'RO'` → pigeon ring display `RO-24-0117345`.
  - `dubluri în tabel`: same ring twice → second is `dublura`, `created === 1`.
  - `limite`: 3001 rows → 400 `eroare.import_randuri`; 31st preview in a minute → 429.
  - `doar citire`: `newAccount(call, 'Y', { active: false })`, and an account whose `subscription_end` is set in the past by SQL (pattern in `test/tratamente.test.js`) → 402 on preview and on save.
  - `separare`: account B importing a ring that A owns → B gets its own pigeon; A unchanged.
  - `3000 de rânduri`: 1,500 pigeons each with father and mother rings (fathers/mothers among the rows) → save finishes in ≤ 20 s locally (`performance.now()`), `created === 3000`.
- [ ] **Step 2:** `node scripts/test.mjs test/import-excel.test.js` — Expected: FAIL.
- [ ] **Step 3:** Add migration 23 in `src/db.js` (append only).
- [ ] **Step 4:** Implement `src/table-import.js` and `src/routes/imports.js`; mount in `src/app.js` with `app.use('/api/import/excel', requireAccount, express.json({ limit: '2mb', inflate: false }))` before the global 1 MB parser (as done for `/api/pedigrees/read`).
- [ ] **Step 5:** Add the new texts (problem messages, `eroare.import_randuri`) to `i18n/ro.json` (with `sens`) and `i18n/hu.json`.
- [ ] **Step 6:** Same test command — Expected: pass; then the full suite once — Expected: 0 fail.
- [ ] **Step 7:** Commit `Import Excel: migrarea 23, motorul de import (previzualizare și salvare)`.

### Task 5: Undo, last import, cleanup

**Files:**
- Modify: `src/table-import.js`, `src/routes/imports.js`, `src/server.js` (start cleanup), `i18n/ro.json`, `i18n/hu.json`
- Test: `test/import-anulare.test.js`

**Interfaces:**
- Produces:
  - `lastImport(accountId): Promise<{ id: number; createdAt: string; created: number; undoUntil: string } | null>` — newest not-undone import younger than 7 days, else null.
  - `undoLastImport(accountId): Promise<{ deleted: number; kept: number; cleared: number; reverted: number }>` — 404 `eroare.import_fara_anulare` when `lastImport` is null. In one `tx` with `lockAccount`, following spec rule 10:
    - a `created` pigeon is deleted only if every column in `fields` still equals the row and **no row anywhere references it** except `father_id`/`mother_id` links recorded in the same import's items. The referencing tables are discovered at runtime from `pg_constraint` (all foreign keys to `pigeons(id)`), so future tables are covered automatically; `pigeons.father_id/mother_id` pointing at it from a pigeon not created by this import also count as use. Otherwise `kept++`.
    - `filled` columns/links reset to NULL only where the current value equals the recorded value (`cleared` counts pigeons touched).
    - `converted` pigeons go back to `external` if still `own` and their recorded fields are unchanged (`reverted`).
    - then `undone_at = now()`.
  - `pruneImports(): Promise<number>` deletes imports older than 7 days; `startImportCleanup()` runs it 30 s after boot and every 6 h (`unref()`), wired in `src/server.js` like `startTreatmentReminders`.
  - Routes: `GET /api/import/excel/last` → `{ last: … | null }`; `POST /api/import/excel/undo` → 200 result.

- [ ] **Step 1: Write the failing tests:**
  - `anularea șterge ce a adus`: import 3 rows (2 new + 1 existing filled) → undo → `deleted === 2`, existing pigeon's filled color back to null, its hand-written name untouched; `last` is null afterwards.
  - `anularea păstrează porumbeii folosiți`: after import, add a journal entry to pigeon 1, rename pigeon 2 by PATCH, make pigeon 3 part of a pair → undo → `kept === 3`, `deleted` covers the rest; message data matches.
  - `doar ultimul import`: two imports → undo affects only the second; a second undo → 404.
  - `7 zile`: set `created_at` to 8 days ago in SQL → `last` null, undo 404; `pruneImports()` removes it.
  - `strămoș făcut propriu`: existing external ancestor imported as own row → undo → back to `external`.
  - `doar citire`: read-only account → 402 on undo.
- [ ] **Step 2:** `node scripts/test.mjs test/import-anulare.test.js` — Expected: FAIL.
- [ ] **Step 3:** Implement; record items during save in Task 4's engine if not already recorded (the engine must write `excel_import_items` exactly as specified above).
- [ ] **Step 4:** Same command, then the full suite once — Expected: 0 fail.
- [ ] **Step 5:** Commit `Import Excel: anularea ultimului import (7 zile) și curățarea evidenței`.

### Task 6: The page „Adu porumbeii din Excel”

**Files:**
- Create: `web/src/app/pages/import-excel/import-excel.ts` (standalone component, signals)
- Modify: `web/src/app/app.routes.ts` (route `porumbei/excel`, `authGuard`, lazy), `web/src/app/app.ts` (Panou submenu entry after `/porumbei/pedigree`, key `panou.din_excel`), `web/src/app/pages/panou/porumbar-cadru.ts` (tab for `/porumbei/excel`), `web/src/app/shared/icon.ts` (icon `tabel`), `web/src/app/core/models.ts` (`ImportSummary`, `LastImport`), `i18n/ro.json`, `i18n/hu.json`, `CLAUDE.md` (structure + rules), `README.md` (one line in features)
- Test: browser check (controller) + `npm --prefix web run build`

**Interfaces:**
- Consumes: Task 2 (`parsePasted`, `looksLikeHeader`, `guessColumns`, `canContinue`, `buildRows`, `Field`, `ImportRow`), Task 3 (`readWorkbook`, `firstSheetWithData`, `MAX_FILE_BYTES`) via `await import('../../shared/tabel-fisier')` only when a file is picked, Task 4/5 endpoints.
- Screens (spec „Cum arată”): Step 1 file button (`accept=".xlsx,.xls,.csv,.txt"`) + paste textarea; sheet picker when > 1 sheet. Step 2 one card per column (title, first 3 example cells, `<select>` of Fields with RO/HU labels), checkbox „Primul rând e titlu”, and — only when at least one of the first 50 built `ring` values contains no letter at all (e.g. `24-0117345`, `0117345`) — the select „Inelele fără țară sunt din:” defaulting to `RO` for `lang === 'ro'`, `HU` for `lang === 'hu'`. „Mai departe” disabled unless `canContinue`. Step 3 calls preview and shows the counts as in the spec sketch, the problem list (first 10, „Arată toate”), and „Adaugă porumbeii”. Done screen: „Gata: am adus N porumbei”, „Vezi porumbeii” (→ `/porumbar`), „Anulează importul”; on page load `GET /last` shows the undo band with its date. 402 shows the usual activation sentence (as other forms do).
- Errors `fisier_mare` / `fisier_necitit` → friendly texts.

- [ ] **Step 1:** Implement the component, route, submenu, icon, models, i18n (RO with `sens`, HU).
- [ ] **Step 2:** `npm --prefix web run build` — Expected: success; SheetJS in a lazy chunk, not in `main-*.js` (check that `main-*.js` does not contain `SheetJS`).
- [ ] **Step 3:** Run `test/i18n.test.js` and `test/texte-ramase.test.js` — Expected: pass.
- [ ] **Step 4:** Update `CLAUDE.md` (new files, migration 23, SheetJS rule, limits, undo rule) and `README.md`.
- [ ] **Step 5:** Full suite once — Expected: 0 fail.
- [ ] **Step 6:** Commit `Import Excel: pagina „Adu porumbeii din Excel” (lipire sau fișier, coloane, rezumat, anulare)`.
- [ ] **Step 7 (controller, browser):** on the local server with a demo account: paste a 10-row invented table (Dutch headers), check the guessed columns, preview counts, save, see pigeons and links in the tree, undo; pick an invented `.xlsx`; check at 375px and 320px (no horizontal scroll), Hungarian UI labels.
