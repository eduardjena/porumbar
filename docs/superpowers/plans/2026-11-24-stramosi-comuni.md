# Strămoșii de la tată și de la mamă (T+M) – plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cel mai apropiat strămoș care apare și în jumătatea tatălui, și în jumătatea mamei se vede ca „T+M” pe arbore, pe foaia de pedigree, în vederile Arbore din Rețea și în graful rudelor; repetările celelalte rămân cu contur discret; o frază pe site.

**Architecture:** Regula e o funcție pură pe poziții numerotate ca un heap (rădăcina 1, tatăl lui `i` = `2i`, mama = `2i+1`), cu aceleași cazuri de test pe server (`src/genealogy.js`, pe id-uri, aplicată în `buildTree`) și în web (`web/src/app/shared/stramosi-comuni.ts`, pe inele normalizate, pentru foaia de pedigree). Ecranele doar desenează câmpul `both`; graful primește `common` de la `/api/network`.

**Tech Stack:** Node 24 ESM, Express 5, PostgreSQL (`pg`), Angular standalone/signals/zoneless, Cytoscape, `node --test` (testele importă și `.ts` pure din `web/src`).

**Spec:** `docs/superpowers/specs/2026-11-24-stramosi-comuni-design.md`

## Global Constraints

- Regula: X e „T+M” dacă apare în jumătatea tatălui (tatăl inclusiv) și în jumătatea mamei (mama inclusiv), **doar cel mai apropiat**; strămoșii unui „T+M” nu devin „T+M” prin el. Rădăcina nu se numără.
- Cu un singur părinte cunoscut, nimic nu e „T+M”.
- Pe foaie, inelele se compară normalizate (fără spații, cratime, bare; litere mari), pentru repetări și pentru „T+M”; fără inel nu se compară.
- `repeat` (grupul și culoarea) rămâne ca acum; câmpul nou e `both: boolean`.
- Orice text nou vizibil: în `i18n/ro.json` (cu `sens`) și în `i18n/hu.json`. „T+M” nu e niciodată singurul semn doar prin culoare.
- Text de bază 18px, contrast mare, fără emoji, fără derulare laterală la 320px; foaia A4 rămâne pe o pagină.
- Fără migrare de bază de date. Date de test doar inventate.

## Review Focus

- Pedigree cu un singur părinte: nicio casetă „T+M” (testat în Task 1 și Task 2).
- Frate × soră: doar bunicii „T+M”, străbunicii rămân doar „repetat” (Task 1, Task 2).
- Același inel scris „RO 26 123”, „ro-26-123”, „RO26/123” pe foaie: un singur grup (Task 2).
- Casete fără inel pe foaie: nu formează grup și nu sunt „T+M” (Task 2).
- `/api/network` fără `rootId`: `common` = `[]` (Task 5).

---

## Regula (algoritmul, comun ambelor implementări)

Intrare: o listă de poziții heap `i ≥ 2` cu o cheie (id sau inel normalizat), fără chei goale.
1. `half(i)` = jumătatea: urcând `i → floor(i/2)` până la 2 sau 3 (2 = tată, 3 = mamă).
2. `C` = cheile care apar în ambele jumătăți.
3. O poziție `p` e **acoperită** dacă vreo poziție strict între `p` și rădăcină (`floor(p/2)`, `floor(p/4)`, … până la 2 sau 3, inclusiv) are o cheie din `C`.
4. Cheia `K` e **„T+M”** dacă are cel puțin o poziție neacoperită în jumătatea tatălui **și** una neacoperită în jumătatea mamei.
5. Toate casetele cheii `K` primesc `both = true` (și cele acoperite).

Fixtura comună: `test/fixtures/stramosi-comuni.json` – listă de cazuri `{ "nume", "pozitii": { "<i>": "<cheie>" }, "tm": ["<chei>"] }`:
- `frati_buni`: `{2:"F",3:"M",4:"A",5:"B",6:"A",7:"B",8:"P",9:"Q",12:"P",13:"Q"}` → `tm: ["A","B"]`
- `tata_fiica`: `{2:"T",3:"F",6:"T",7:"X"}` → `["T"]`
- `doar_pe_o_parte`: `{2:"F",3:"M",4:"A",5:"B",8:"Z",10:"Z"}` → `[]`
- `un_parinte`: `{2:"F",4:"A",5:"A"}` → `[]`
- `veri`: `{2:"F",3:"M",4:"G",6:"H",8:"A",9:"B",12:"A",13:"B"}` → `["A","B"]`
- `mai_aproape_si_independent`: `{2:"F",3:"M",4:"Y",6:"Y",8:"X",12:"X",7:"X"}` → `["Y"]` (X are pe partea mamei o casetă neacoperită, 7, dar pe partea tatălui doar 8, acoperită de Y)

### Task 1: Regula pe server, în `buildTree`

**Files:**
- Create: `test/fixtures/stramosi-comuni.json` (cazurile de mai sus)
- Modify: `src/genealogy.js` (lângă `buildTree`)
- Test: `test/genealogy.test.js`

**Interfaces:**
- Produces: `export function tmKeys(positions: Map<number, any>): Set<any>` (algoritmul de mai sus); `buildTree(...)` pune pe fiecare nod `both: boolean` (în plus față de `repeat`); `export function commonOf(tree): number[]` – id-urile cu `both`, ordonate după prima apariție (folosit de Task 5).

- [ ] **Step 1: Teste care pică**
  - `tmKeys` pe fiecare caz din fixtură (`new Map(Object.entries(pozitii).map(([i,k]) => [Number(i), k]))`) → `[...rez].sort()` egal cu `tm.sort()`.
  - `buildTree(7, g([1],[2],[3,1,2],[4,1,2],[5],[6],[7,3,4]), 3)`: `t.father.father.both === true`, `t.mother.mother.both === true`, `t.father.both === false`, `t.both === false`.
  - `buildTree(4, g([1],[2],[3,1,2],[4,1,3]), 3)` (tată × fiică): `t.father.both === true`, `t.mother.father.both === true`.
  - Un părinte: `buildTree(3, g([1],[3,1,null]), 3)` → niciun nod cu `both`.
  - `commonOf` pe arborele frați buni → `[1, 2]`.
- [ ] **Step 2:** `node scripts/test.mjs test/genealogy.test.js` → FAIL (`tmKeys` nedefinit).
- [ ] **Step 3:** Implementează `tmKeys` și `commonOf`; în `buildTree`, după `mark`, construiește pozițiile heap din arbore (rădăcina 1), cheamă `tmKeys` și setează `both` pe noduri (`false` implicit).
- [ ] **Step 4:** Același test → PASS; `npm test` întreg → fără regresii.
- [ ] **Step 5:** Commit `Regula T+M pe server: buildTree marchează cel mai apropiat strămoș de la tată și de la mamă (both)`.

### Task 2: Foaia de pedigree (tipar, PDF, pedigree public)

**Files:**
- Create: `web/src/app/shared/stramosi-comuni.ts` (fără importuri Angular)
- Modify: `web/src/app/shared/pedigree-sheet.ts:140-170` și stilurile ei; `i18n/ro.json`, `i18n/hu.json`
- Test: `test/stramosi-comuni.test.js`

**Interfaces:**
- Produces: `export function ringCompareKey(ring: string | null | undefined): string | null` (NFKC, majuscule, fără spații, `-`, `/`, `.`; gol → `null`); `export function tmKeys(positions: Map<number, string>): Set<string>` (același algoritm). Cheile i18n `arbore.tm` = „T+M” (hu „apa+anya”), `arbore.tm_lung` = „la tată și la mamă” (hu „apai és anyai ágon is”).

- [ ] **Step 1: Teste care pică:** `tmKeys` pe toată fixtura; `ringCompareKey('RO 26 123')`, `('ro-26-123')`, `('RO26/123')` egale; `ringCompareKey('  ')` și `(null)` → `null`.
- [ ] **Step 2:** `node scripts/test.mjs test/stramosi-comuni.test.js` → FAIL.
- [ ] **Step 3:** Implementează helper-ul. În `boxes()`: grupurile de repetare folosesc `ringCompareKey` în loc de inelul brut; `Box` primește `both: boolean`. Desen: `both` → chenar 3px + dungă `inset 6px` în culoarea grupului + eticheta „T+M” (`title` = `arbore.tm_lung`) în colțul casetei, fără să acopere inelul; repetat fără `both` → chenar 1,5px colorat, fără dungă. Culorile rămân tipăribile.
- [ ] **Step 4:** Testul → PASS; `npm run build --prefix web` fără erori; în browser, `/porumbei/:id/tiparire` pe un porumbel cu frați buni: foaia rămâne pe o pagină A4 (previzualizare tipar), „T+M” pe bunici, la 320px fără derulare laterală.
- [ ] **Step 5:** Commit.

### Task 3: Arborele de pe fișa porumbelului

**Files:**
- Modify: `web/src/app/core/models.ts` (`TreeNode.both: boolean`), `web/src/app/pages/porumbel/arbore.ts`, `i18n/ro.json`, `i18n/hu.json`

**Interfaces:**
- Consumes: `TreeNode.both` (Task 1), `arbore.tm`, `arbore.tm_lung` (Task 2).
- Produces: nimic nou; legenda folosește `arbore.tm_lung` după „apare de N ori.”.

- [ ] **Step 1:** `both` → fundalul de azi (`color(repeat)`) + eticheta „T+M” (`title` = text lung); repetat fără `both` → fără fundal, chenar 3px în `color(repeat)`.
- [ ] **Step 2:** Legenda: intrările cu `both` primele, cu „la tată și la mamă”; restul ca acum (`walk` din `load` citește și `both`).
- [ ] **Step 3:** `npm run build --prefix web`; `node scripts/test.mjs test/i18n.test.js test/texte-ramase.test.js` → PASS; în browser pe un porumbel cu frați buni (date inventate, cont local): bunicii „T+M”, străbunicii doar contur.
- [ ] **Step 4:** Commit.

### Task 4: Rețea → vederile Arbore

**Files:**
- Modify: `web/src/app/pages/retea/vedere-evantai.ts`, `web/src/app/pages/retea/vedere-carduri.ts` (amândouă folosesc `TreeNode` din `core/models.ts`, deja extins în Task 3)

**Interfaces:**
- Consumes: `TreeNode.both` (Task 3), `arbore.tm`, `arbore.tm_lung` (Task 2).

- [ ] **Step 1:** Evantai: `both` → conturul de azi la 4px + un semn „T+M” pe felie (text SVG, mărime lizibilă; la felii prea mici pentru text, doar conturul de 4px); repetat fără `both` → contur 2px.
- [ ] **Step 2:** Carduri: eticheta „×N” devine „×N · T+M” la `both`; `title` cu textul lung.
- [ ] **Step 3:** Build + testele i18n; în browser, Rețea → Arbore pe același porumbel: ambele vederi arată „T+M” la bunici.
- [ ] **Step 4:** Commit.

### Task 5: Graful rudelor

**Files:**
- Modify: `src/routes/views.js` (`GET /network`), `web/src/app/core/models.ts` (`Network.common: number[]`), `web/src/app/pages/retea/retea.ts`, `i18n/ro.json`, `i18n/hu.json`
- Test: `test/views.test.js`

**Interfaces:**
- Consumes: `buildTree`, `commonOf` (Task 1).
- Produces: `/api/network` întoarce `common: number[]` (mereu; `[]` fără `rootId`); cheia `retea.legenda_tm` = „T+M = strămoș al porumbelului, și la tată, și la mamă”.

- [ ] **Step 1: Teste care pică** (în `test/views.test.js`, cu un cont și porumbei inventați creați prin API): rădăcină din frați buni → `common` conține exact cei doi bunici; `/api/network` fără `rootId` → `common` deep-equal `[]`; rădăcină cu un singur părinte → `[]`.
- [ ] **Step 2:** `node scripts/test.mjs test/views.test.js` → FAIL.
- [ ] **Step 3:** În `/network` cu `rootId`: `buildTree(root.id, nodes, up)` pe nodurile contului (din `byId`), `common = commonOf(tree)` filtrat la `ids`.
- [ ] **Step 4:** Testul → PASS.
- [ ] **Step 5:** În `retea.ts`: nodurile din `common` primesc clasa `tm` – outline 4px într-o culoare proprie (nu culorile notei, sexului, `--accent` sau haloul `picked`) și „T+M” ca ultim rând al etichetei; sub grafic, linia `retea.legenda_tm` doar când `common` nu e gol. Build; în browser, Rețea pornit de la porumbelul cu frați buni: bunicii marcați, „Tot porumbarul” fără marcaj.
- [ ] **Step 6:** Commit.

### Task 6: Fraza de pe site

**Files:**
- Modify: `C:\dev\porumbar-site\public\index.html`, `C:\dev\porumbar-site\public\hu.html` (ramura `feat/stramosi-comuni` din `main`-ul site-ului)

- [ ] **Step 1:** În lista de funcții, lângă consangvinizare: „Strămoșul care apare și la tată, și la mamă e colorat pe pedigree și în desenul rudelor, ca să vezi dintr-o privire de unde vine consangvinizarea.” și traducerea maghiară în `hu.html`, în stilul frazelor vecine.
- [ ] **Step 2:** `node C:/dev/porumbar-site/serve.mjs` (portul 4400): ambele pagini arată fraza, fără derulare laterală la 320px.
- [ ] **Step 3:** Commit în repo-ul site-ului. **Nu** se unește, nu se trimite și nu se urcă: doar cu aprobarea vânzătorului, după publicarea aplicației.
