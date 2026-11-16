# Porumbar – Planul 1b: trei feluri de a vedea porumbarul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Panoul porumbarului (cei mai valoroși primii, colorați după valoare), rețeaua de rudenie (fiecare porumbel o singură dată, liniile care se întâlnesc se văd) și anul nașterii în arbore.

**Architecture:** Valoarea e o funcție pură pe server (`src/value.js`); două rute noi (`/api/board`, `/api/network`) și anul în `PigeonSummary`. În interfață: pagina „Panou” devine pagina de start, pagina „Rețea” desenează graful cu Cytoscape.js + așezare dagre, încărcate doar pe acea pagină.

**Tech Stack:** ca Planul 1; nou în `web/`: `cytoscape`, `cytoscape-dagre`.

**Spec:** `docs/superpowers/specs/2026-11-16-porumbar-vizualizare-design.md` (+ designul principal).

## Global Constraints

- Tot ce cere Planul 1 (`docs/superpowers/plans/2026-11-16-porumbar-1-fundatia.md`, „Global Constraints”) rămâne valabil: română cu diacritice, text 18px, butoane 48px, conturi strict separate (id străin → 404), fără push.
- Branch: `feat/vizualizare`, din `main` după merge-ul Planului 1.
- Valoarea: ponderi **50% evaluare, 30% pui, 20% reproducător**; pui: `min(n, 10) / 10 · 100`; rezultatul rotunjit la întreg (`Math.round`).
- Rețeaua fără porumbel ales: cel mult **1000** de porumbei.

## Review Focus

1. **Porumbel fără nicio dată** (fără note, fără pui, nemarcat reproducător) → „fără date” (gri), nu 0 → test în Task 1.
2. **Cicluri vechi în date** la rețea → răspuns fără blocare → test în Task 2.
3. **Porumbeii altui cont** nu apar în panou sau rețea; `rootId` străin → 404 → test în Task 2.
4. **Porumbar foarte mare** (peste 1000) la rețeaua „tot porumbarul” → răspuns cu `truncated: true` și mesaj, nu telefon blocat → test în Task 2.
5. **Strămoș fără an cunoscut** (fără inel, fără dată) → `year: null`, afișat „—” → test în Task 2.

---

### Task 1: Valoarea porumbelului

**Files:**
- Create: `src/value.js`
- Test: `test/value.test.js`

**Interfaces:**
- Produces: `pigeonValue({ scores: Record<string, number>, offspringCount: number, status: string|null }) -> { score: number|null, band: 0|1|2|3|4|5, parts: { evaluare?: number, pui: number, reproducator: number } }`.
  - `evaluare` = `(media notelor − 1) / 4 · 100`, prezentă doar dacă există cel puțin o notă (altfel lipsește și ponderea ei de 0,5 nu intră; ponderile rămase se reîmpart).
  - `pui` = `min(offspringCount, 10) / 10 · 100`; `reproducator` = `status === 'reproducator' ? 100 : 0` — mereu prezente.
  - `score = null`, `band = 0` dacă nu există note, `offspringCount = 0` și nu e reproducător.
  - `band`: ≥80 → 5, ≥60 → 4, ≥40 → 3, ≥20 → 2, altfel 1.

- [ ] **Step 1: Testele care pică:**

```js
test('toate trei', () => assert.deepEqual(pigeonValue({ scores: { echilibru: 5, aripa: 3 }, offspringCount: 2, status: 'reproducator' }),
  { score: 64, band: 4, parts: { evaluare: 75, pui: 20, reproducator: 100 } }));
test('fără evaluare: ponderile se reîmpart', () => assert.equal(pigeonValue({ scores: {}, offspringCount: 5, status: 'reproducator' }).score, 70));
test('doar evaluare', () => assert.equal(pigeonValue({ scores: { echilibru: 4 }, offspringCount: 0, status: 'concurent' }).score, 38));
test('pui peste 10 = punctaj întreg', () => assert.equal(pigeonValue({ scores: {}, offspringCount: 25, status: null }).parts.pui, 100));
test('fără date (Review Focus 1)', () => assert.deepEqual(pigeonValue({ scores: {}, offspringCount: 0, status: 'tanar' }), { score: null, band: 0, parts: { pui: 0, reproducator: 0 } }));
```

- [ ] **Step 2:** `npm test test/value.test.js` → FAIL. **Step 3:** implementează. **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat: valoarea porumbelului`.

---

### Task 2: API: anul, panoul, rețeaua

**Files:**
- Create: `src/routes/views.js`
- Modify: `src/pigeons.js` (`toSummary` adaugă `year`), `src/app.js`
- Test: `test/views.test.js`

**Interfaces:**
- Consumes: `pigeonValue` (Task 1); `getPigeonRow`, `toSummary`, `loadNodes` (Planul 1).
- Produces:
  - `PigeonSummary.year: number|null` = anul din `hatched_on`, altfel `ring_year`, altfel `null` (apare peste tot unde e `toSummary`, deci și în `/tree`).
  - `GET /api/board` → `{ pigeons: (PigeonSummary & { offspringCount: number, value: Value })[] }` — doar porumbeii proprii (`kind = 'own'`) ai contului, ordonați după `value.score` descrescător (`null` la final), apoi după inel.
  - `GET /api/network?rootId=&up=5&down=3` → `{ nodes: { id, ring: string, name, sex, year, kind, score: number|null, band, offspringCount }[], edges: { from: number, to: number, role: 'father'|'mother' }[], truncated: boolean }`. Cu `rootId`: rădăcina, strămoșii pe `up` generații (1–10) și urmașii pe `down` generații (0–10), parcurși cu mulțime de vizitați (ciclurile nu blochează); muchii doar între nodurile incluse. Fără `rootId`: tot contul, primii 1000 (după an, cei mai noi întâi) și `truncated: true` dacă sunt mai mulți. `ring` = `ring.display` sau `'fără inel'`. `rootId` al altui cont → 404.

- [ ] **Step 1: Testele care pică:** (cont A cu pedigree-ul foto încărcat prin `test/helpers/load-pedigree.js` + o notă de evaluare pe rădăcină)
  - `/api/board` → doar rădăcina (proprie), cu `year: 2015`, `offspringCount: 0`, `value.score` calculat; un al doilea porumbel propriu, marcat reproducător cu 2 pui, apare primul.
  - `/api/network?rootId=<rădăcina>&up=4&down=0` → 27 de noduri în total, cu rădăcina (cele 31 de căsuțe minus repetările: `1954746/04 NL` de 3 ori, `030937/07` și `030962/07` de 2 ori), iar `NL-04-1954746` are muchii spre 3 urmași.
  - **Review Focus 5:** nodul `000 M` are `year: null`.
  - **Review Focus 2:** ciclu introdus direct în bază (`UPDATE pigeons SET father_id = <nepot> WHERE id = <bunic>`) → `/api/network` răspunde 200.
  - **Review Focus 3:** contul B: `/api/board` gol, `/api/network` fără noduri, `/api/network?rootId=<al lui A>` → 404.
  - **Review Focus 4:** cu limita coborâtă pentru test (`NETWORK_LIMIT` exportat din `src/routes/views.js`, setabil prin `process.env.NETWORK_LIMIT`) la 5 → `truncated: true`, 5 noduri.
- [ ] **Step 2:** → FAIL. **Step 3:** implementează. **Step 4:** → PASS (și `npm test` întreg).
- [ ] **Step 5:** Commit `feat: anul, panoul și rețeaua în API`.

---

### Task 3: Interfața: Panoul și anul în arbore

**Files:**
- Create: `web/src/app/pages/panou/panou.ts`
- Modify: `web/src/app/app.routes.ts` (`''` → `panou`; ruta `panou`), `web/src/app/app.ts` (meniul: Panou · Rețea · Adaugă · Contul meu; „Porumbarul meu” rămâne ca listă, legată din panou), `web/src/app/core/models.ts` (`year`, `Value`), `web/src/app/pages/porumbel/arbore.ts` (anul sub inel), `web/src/app/shared/pigeon-chip.ts` (anul, dacă există)

**Interfaces:**
- Consumes: `GET /api/board` (Task 2).
- Comportament: carduri mari (pe telefon, câte unul pe rând; pe calculator, grilă), cei mai valoroși primii; fundalul cardului după `band` (5 = verde închis cu text alb … 1 = verde foarte deschis, 0 = gri, cu eticheta „fără date”); pe card: inel, nume, sex, anul, nota mare („64”) și „de ce” pe scurt („evaluare 75 · 2 pui · reproducător”); filtre stare / sex / an; atingerea → fișa porumbelului. Gol: „Adaugă primul porumbel”. Legendă cu cele 6 trepte.

- [ ] **Step 1:** Implementează. **Step 2:** `npm run build` → fără erori.
- [ ] **Step 3: Verificare în browser** (375px, contul de exemplu din `npm run seed:exemplu`): pagina de start e Panoul; cardurile au culori diferite după valoare; un porumbel fără date e gri; atingerea deschide fișa; arborele arată „2015” sub `RO-15-412084`; pagina nu derulează pe orizontală.
- [ ] **Step 4:** Commit `feat(web): panoul porumbarului și anul în arbore`.

---

### Task 4: Interfața: Rețeaua de rudenie

**Files:**
- Create: `web/src/app/pages/retea/retea.ts`
- Modify: `web/package.json` (`cytoscape`, `cytoscape-dagre`, `@types/cytoscape`), `web/src/app/app.routes.ts` (ruta `retea`, parametru `?porumbel=<id>`), `web/src/app/pages/porumbel/porumbel.ts` (buton „Vezi în rețea”)

**Interfaces:**
- Consumes: `GET /api/network` (Task 2), `GET /api/pigeons/lookup` (Planul 1, pentru alegerea porumbelului).
- Comportament: sus, câmp „Porumbelul de la care pornești” (inel sau nume) + comutator „Tot porumbarul”; graful ocupă restul ecranului; așezare dagre de la stânga (strămoși) la dreapta (urmași); nodul: inel + anul, culoarea după `band` (ca la panou; strămoșii externi cu chenar punctat), mascul / femelă prin formă (dreptunghi / dreptunghi rotunjit) și culoarea chenarului; strămoșii cu ≥2 urmași în graf au chenar gros; atingerea unui nod: luminează strămoșii și urmașii lui, estompează restul și arată jos un card (inel, nume, an, nota, „Deschide fișa”); atingerea pe fundal anulează. Mărire / mutare cu degetele (implicit în Cytoscape). Cu `truncated`: mesajul „Arăt 1000 de porumbei; alege un porumbel ca să vezi rudele lui”. `cytoscape` și `cytoscape-dagre` se importă doar în această componentă (chunk separat).

- [ ] **Step 1:** `npm --prefix web install cytoscape cytoscape-dagre @types/cytoscape`; implementează.
- [ ] **Step 2:** `npm run build` → fără erori; chunk-ul `retea` separat de `main`.
- [ ] **Step 3: Verificare în browser** (375px, contul de exemplu): pornind de la `RO-15-412084`, `NL-04-1954746` apare **o singură dată** cu 3 linii spre urmași; atingerea lui luminează ramurile; „Deschide fișa” duce la fișa lui; „Tot porumbarul” arată ambele pedigree-uri ca două grupuri separate. Captură de ecran.
- [ ] **Step 4:** Commit `feat(web): rețeaua de rudenie`.

---

### Task 5: Încheierea

- [ ] **Step 1:** `npm test` → toate trec; `npm run build` → fără erori.
- [ ] **Step 2:** README: secțiunea „Ce face Planul 1b”.
- [ ] **Step 3:** Merge `feat/vizualizare` în `main` (`--no-ff`). Fără push.
