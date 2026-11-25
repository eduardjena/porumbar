# Limba japoneză (interfața) – plan de lucru

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tot ce vede crescătorul apare în japoneză corectă (`i18n/ja.json`, 1513 chei) cu font japonez găzduit la noi; japoneza stă „în probă" (nepublică) până o confirmă clientul.

**Architecture:** Infrastructura de limbi există deja și e live (`src/i18n.js`, serviciul `I18n` din interfață, pipe-ul `t`, catalogul tradus, butonul de limbă). Deci nu se restructurează cod: se umple dicționarul `ja.json`, se adaugă fontul Noto Sans JP (prin `@fontsource`, ca Atkinson azi), se extind cu `ja` cele câteva locuri cu `hu` scris în cod, iar `ja` se activează în `languages.json` abia la final, când dicționarul e complet. Un test nou (`test/ja.test.js`) validează traducerea pe grupuri, ca să rămână verde pe parcurs.

**Tech Stack:** Node 24 ESM, Express 5, PostgreSQL (`pg`), Angular standalone/signals/zoneless, `node:test`, `@fontsource/noto-sans-jp`.

**Spec:** `docs/superpowers/specs/2026-11-25-limba-japoneza-design.md` (glosar: `docs/cercetare/termeni-japonezi.md`). Precedent: `docs/superpowers/plans/2026-11-18-limbi-straine.md` (maghiara).

**Scop:** doar **interfața**. Recunoașterea inelelor japoneze și citirea pedigree-urilor scrise în japoneză (părțile A și B din design) își primesc planul lor separat, după ce vin mostre reale de la client.

## Global Constraints

- Branch `feat/limba-japoneza`; un commit la fiecare task; **fără merge/push/deploy fără întrebarea vânzătorului**.
- Bază de date PostgreSQL; **nicio migrare nouă** (coloana `accounts.lang` există).
- `ro.json` rămâne **identic** cu azi; `hu.json` neschimbat.
- `ja.json` are **structura ca `hu.json`** (doar text, fără `sens`). Fiecare valoare e **nenulă** și e **în japoneză** (conține kana/kanji), afară de cheile din allowlist-ul de coduri/simboluri. **Niciun text românesc** în `ja.json`.
- Plural: japoneza are nevoie doar de forma `other` (testul de consistență compară doar locurile `{...}`, nu mulțimea `one/few/other`).
- Traducerea urmează glosarul `docs/cercetare/termeni-japonezi.md`: `レース鳩`, `血統書`, `脚環`, `オス`/`メス` (♂/♀), culori ca **cod + katakana** (B → ブルー), registru `です・ます` în fraze și substantiv scurt pe butoane (保存/追加/削除/キャンセル…), punctuație full-width (、。！？), ghilimele 「」. Termenii [propus] din glosar primesc cea mai bună variantă și intră pe lista de confirmat.
- CSP rămâne `'self'`; singura dependență nouă: `@fontsource/noto-sans-jp` (fișiere împachetate la build).
- `ja` în `languages.json`: `{ "code": "ja", "name": "日本語", "locale": "ja-JP", "public": false }` — adăugat **doar în ultimul task**.
- Text de bază 18px, butoane ≥ 48px.

## Review Focus

1. Cheie netradusă rămasă în `ja.json` (valoare latină/română) la un cont `ja` → text non-japonez pe ecran → gardul CJK din `test/ja.test.js` (Task 1) o prinde.
2. Litere japoneze fără font = pătrățele (tofu) → fontul se încarcă și `html[lang=ja]` e pus → verificare în browser, Task 9.
3. Fișa tipărită / PDF-ul în japoneză: fontul nu e gata la rasterizare → `await document.fonts.ready` + `lang="ja"` pe rădăcina fișei → Task 9.
4. Import Excel cu nume de culori japoneze: `readCode` nu le prinde → `ja` în lista din `table-values.js` → test în Task 1.
5. Telefon în japoneză, fără cont, cât timp `ja` e nepublică: totul în română (`Accept-Language: ja` ignorat) → test în Task 9.

---

### Task 1: Schela, fontul și locurile cu „hu" (fără activare)

Pune în loc tot ce nu e traducere, dar fără a activa `ja` (rămâne în afara `languages.json`, deci testul global de consistență nu-l verifică încă).

**Files:**
- Create: `i18n/ja.json` (doar cheile `test.*`, copiate din `hu.json`, ca fișierul să fie valid JSON nenul), `test/ja.test.js`
- Modify: `web/src/styles.css` (import font + font-stack + reguli `html[lang="ja"]`), `web/package.json` (`@fontsource/noto-sans-jp`), `src/table-values.js` (`readCode`: `['ro','hu']` → `['ro','hu','ja']`), `src/pedigree-reader.js` (`NOTE_LANG.ja = 'în japoneză'`), `test/i18n.test.js` (linia care cere `LANGS.map(l=>l.code)` deepEqual `['ro','hu']` — se lasă până la Task 9; vezi mai jos)

**Interfaces:**
- Produces:
  - `test/ja.test.js` exportă/folosește: `GROUPS` (listă de obiecte `{ nume, prefixe: string[] }` — grupurile din Task 2–8), `DONE` (listă de nume de grup gata; de pornire goală), `ALLOW_NONJA` (Set de chei a căror valoare japoneză poate fi fără kana/kanji: coduri, „OK", „QR", „ABB", „KB", URL-uri etc.). Helper `jaValue(k)` și `isJapanese(s)` (conține `[぀-ヿ㐀-鿿ｦ-ﾟ]`).
  - Pentru fiecare grup din `DONE`: fiecare cheie din `ro.json` cu acel prefix există în `ja.json`, cu aceleași `{...}`, nenulă, și (dacă nu e în `ALLOW_NONJA`) `isJapanese(valoare)`.
  - `readCode(text, list, dictKeys)` potrivește și numele japoneze.
  - CSS: `--font` devine `'Atkinson Hyperlegible Next Variable', 'Noto Sans JP', system-ui, sans-serif`; `html[lang="ja"] body { line-height: 1.75; }`, `html[lang="ja"] { line-break: strict; }`, `overflow-wrap: anywhere` pe câmpurile cu inele/emailuri; `@import '@fontsource/noto-sans-jp/japanese-400.css'` și `/japanese-700.css`.

- [ ] **Step 1:** `cd web && npm install @fontsource/noto-sans-jp`.
- [ ] **Step 2: Scrie `test/ja.test.js`** cu `GROUPS` = cele 7 grupuri (prefixele de la Task 2–8), `DONE = []`, `ALLOW_NONJA` de pornire, helperii `isJapanese`/`jaValue`, și testul care, pentru fiecare grup din `DONE`, verifică prezența + `{...}` + nenul + CJK. Cu `DONE` gol, testul trece (nu verifică nimic încă).
- [ ] **Step 3:** `node scripts/test.mjs test/ja.test.js` → PASS (gol). `cd web && npm run build` → fără erori (fontul se împachetează).
- [ ] **Step 4:** Implementează `ja.json` (doar `test.*` din `hu.json`), CSS-ul, `readCode` cu `ja`, `NOTE_LANG.ja`. Scrie în `test/table-values` (sau unde e) un caz: `readCode('ブルー', COLORS, 'catalog.culoare')` → `'albastru'` (după ce `catalog.culoare.albastru` va fi `ブルー` — pune cheia în `ja.json` în acest task doar pentru culoarea testată, ca testul să treacă; restul vine la Task 2). Dacă e mai curat, mută acest caz la Task 2 și aici verifică doar că lista acceptă `ja`.
- [ ] **Step 5:** `npm test` → tot verde (ja nu e în `LANGS`, deci consistența globală nu-l atinge). Commit „Japoneză: schela, fontul și locurile cu «hu» (fără activare)".

### Task 2: Traducere — domeniul (catalog, culori, genetică, sex, câmpuri, inel)

Grup: prefixele `catalog`, `culori`, `genetica`, `sex`, `camp`, `inel` (~217 chei). Cele mai sensibile la glosar (culorile ca **cod + katakana**).

**Files:** Modify `i18n/ja.json`, `test/ja.test.js` (adaugă `'domeniu'` în `DONE`).

**Interfaces:** Consumes `GROUPS`/`DONE`/helperii din Task 1.

- [ ] **Step 1:** Adaugă `'domeniu'` în `DONE` din `test/ja.test.js` → `node scripts/test.mjs test/ja.test.js` FAIL (cheile lipsesc din `ja.json`).
- [ ] **Step 2:** Tradu în `ja.json` toate cheile cu prefixele grupului, după glosar (culori: cod + katakana; `catalog.rasa.*`, `catalog.stare.*` etc. după §1/§4). Termenii [propus] → cea mai bună variantă.
- [ ] **Step 3:** `node scripts/test.mjs test/ja.test.js` → PASS. `npm test` → verde.
- [ ] **Step 4:** Commit „Japoneză: catalog, culori, genetică, câmpuri".

### Task 3: Traducere — shell și autentificare

Grup: `cont`, `cont_nou`, `intra`, `parola_noua`, `parola_uitata`, `parola_camp`, `meniu`, `titlu`, `actiune`, `mail`, `banda`, `trimite`, `auth`, `push` (~165). Nume grup: `'shell'`.

**Files:** Modify `i18n/ja.json`, `test/ja.test.js` (`DONE += 'shell'`).

- [ ] **Step 1:** `DONE += 'shell'` → test FAIL. **Step 2:** traduce grupul (butoane: substantiv scurt; mesaje: です・ます). **Step 3:** `node scripts/test.mjs test/ja.test.js` PASS; `npm test` verde. **Step 4:** Commit „Japoneză: shell, intrare, cont, meniu".

### Task 4: Traducere — Panou și rețea

Grup: `panou`, `retea`, `text`, `vedere`, `drum` (~175). Nume: `'panou'`.

**Files:** Modify `i18n/ja.json`, `test/ja.test.js`.

- [ ] **Step 1:** `DONE += 'panou'` → FAIL. **Step 2:** traduce. **Step 3:** test PASS; `npm test` verde. **Step 4:** Commit „Japoneză: Panou și rețea".

### Task 5: Traducere — fișa porumbelului și formularul

Grup: `porumbel`, `form`, `parinti`, `cuib`, `amintiri`, `amintire`, `data`, `cip` (~218). Nume: `'porumbel'`.

**Files:** Modify `i18n/ja.json`, `test/ja.test.js`.

- [ ] **Step 1:** `DONE += 'porumbel'` → FAIL. **Step 2:** traduce. **Step 3:** test PASS; `npm test` verde. **Step 4:** Commit „Japoneză: fișa și formularul porumbelului".

### Task 6: Traducere — perechi, arbore, rezultate, concurs

Grup: `perechi`, `arbore`, `rezultate`, `concurs` (~230). Nume: `'perechi'`.

**Files:** Modify `i18n/ja.json`, `test/ja.test.js`.

- [ ] **Step 1:** `DONE += 'perechi'` → FAIL. **Step 2:** traduce (categoriile de distanță după glosar §2). **Step 3:** test PASS; `npm test` verde. **Step 4:** Commit „Japoneză: perechi, arbore, rezultate, concurs".

### Task 7: Traducere — tratamente, vânzări, partajare, fișe tipărite, public

Grup: `tratamente`, `tratament`, `vanzari`, `vanzare`, `partajare`, `public`, `fisa`, `tiparire`, `pdf`, `hartie`, `trimite`, `toate` (~250; `trimite` dacă n-a intrat la Task 3). Nume: `'vanzari'`.

**Files:** Modify `i18n/ja.json`, `test/ja.test.js`.

- [ ] **Step 1:** `DONE += 'vanzari'` → FAIL. **Step 2:** traduce (fișa/pedigree: `血統書`). **Step 3:** test PASS; `npm test` verde. **Step 4:** Commit „Japoneză: tratamente, vânzări, partajare, fișe, public".

### Task 8: Traducere — Excel, import, scanare, cititor, erori

Grup: `excel`, `import_excel`, `import`, `scan`, `cititor`, `eroare` (~262). Nume: `'excel'`. **Acum `DONE` acoperă toate prefixele din `ro.json` în afară de `test`.**

**Files:** Modify `i18n/ja.json`, `test/ja.test.js`.

- [ ] **Step 1:** `DONE += 'excel'` → FAIL. **Step 2:** traduce (mesajele de eroare în です・ます). **Step 3:** test PASS; `npm test` verde.
- [ ] **Step 4:** Verifică acoperirea: adaugă în `test/ja.test.js` un test care cere ca **reuniunea prefixelor din `GROUPS`** să fie egală cu mulțimea prefixelor din `ro.json` (afară de `test`) — ca să nu rămână grupuri neacoperite. PASS.
- [ ] **Step 5:** Commit „Japoneză: Excel, import, scanare, erori".

### Task 9: Activarea „în probă", fontul în browser, consola și verificarea

Acum `ja.json` e complet. Activează `ja` (nepublică), verifică fontul și traducerea pe ecrane, fișa/PDF-ul.

**Files:**
- Modify: `i18n/languages.json` (adaugă `ja`, `public:false`), `test/i18n.test.js` (linia `LANGS.map` → include `ja`; mesajul/comentariul), `test/limba.test.js` (adaugă cazul `ja` nepublică, vezi mai jos), `web/src/app/pages/admin/identity-fields.ts` (câmpul „Limba": `ja` cu „(în probă)", ca `hu`), componenta de fișă/pedigree tipărită (`web/src/app/shared/pedigree-page.ts` sau `pedigree-sheet.ts`: `lang` explicit pe rădăcină), `web/src/app/core/share-pdf.ts` (`await document.fonts.ready` înainte de `toCanvas`)

**Interfaces:** Consumes `languages.json`, `tIn`, `useLang`.

- [ ] **Step 1: Teste**
  - în `test/i18n.test.js`: actualizează `assert.deepEqual(LANGS.map(l=>l.code), ['ro','hu','ja'])` și textul testului.
  - în `test/limba.test.js`: cont fără `lang`, `Accept-Language: ja-JP,ja;q=0.9` la un login greșit → mesajul **românesc** (ja nepublică); adminul pune `ja` prin identity → `me.lang === 'ja'`; `POST /api/admin/accounts` cu `lang:'ja'` → contul nou are `lang === 'ja'`; `PATCH /me {lang:'ja'}` de la un cont `ro` → 403 (nepublică).
- [ ] **Step 2:** `node scripts/test.mjs test/i18n.test.js test/limba.test.js` → FAIL (ja nu e încă în `languages.json`).
- [ ] **Step 3:** Adaugă `ja` în `languages.json` (`public:false`); câmpul din consolă; `lang="ja"` pe rădăcina fișei; `await document.fonts.ready` în `share-pdf.ts`.
- [ ] **Step 4:** `npm test` → **tot verde**, inclusiv testul global de consistență care acum validează `ja.json` complet (toate cheile, `{...}`, nenule). `cd web && npm run build` → fără erori.
- [ ] **Step 5: În browser** (preview „porumbar"), cu un cont căruia adminul i-a pus `ja`:
  - Panou, listă, fișa unui porumbel cu toate filele, formular, perechi, arbore, rețea, tratamente, vânzări, scanare, import Excel, pagina publică: **tot în japoneză**, font corect (fără pătrățele), fără text românesc/chei rămase, fără revărsări la 360px (butonul `日本語`, contoarele `羽`, celulele arborelui).
  - Fișa tipărită și PDF-ul de la „Trimite": în japoneză, cu fontul corect.
  - Datele în `2026/11/25`; consola fără erori.
- [ ] **Step 6:** Commit „Japoneză: activare «în probă», font în browser, consola și verificarea".

## După acest plan

- `ja` rămâne `public:false` până clientul confirmă lista din glosar §8; trecerea la `public:true` e un commit separat, de o linie, cu acordul vânzătorului.
- Părțile A (inele japoneze) și B (citirea pedigree-urilor japoneze) își primesc planul lor, după mostre reale de la client.
