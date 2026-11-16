# Porumbar – Planul 1c: vederile Arborelui (Carduri, Evantai, Liniile de sânge) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pagina Arbore are cinci vederi — **Carduri moderne**, **Evantai**, **Liniile de sânge** (noi, după machetele aprobate în `docs/design/arbore-variante.html`, variantele 1, 2 și 4), **Rețea** (cea de acum) și **3D** — iar fiecare crescător alege vederea cu care se deschide Arborele.

**Architecture:** Un comutator de vederi în pagina Arbore (`?vedere=carduri|evantai|sange|retea`, 3D rămâne `/arbore/3d`); vederea implicită e o setare a contului (`accounts.tree_view`). Carduri și Evantai folosesc rutele existente (`/tree`, `/coi`, `/family`); Liniile de sânge au o rută nouă care calculează cât sânge aduce fiecare linie (fondator) pe fiecare drum. Desenele sunt HTML/CSS + SVG (fără bibliotecă nouă).

**Tech Stack:** ca până acum.

**Spec / design:** `docs/design/arbore-variante.html` (variantele 1, 2, 4), alese de utilizator pe 2026-11-16; paleta „Pământ”.

## Global Constraints

- Tot ce cer planurile 1 / 1b (română, text 18px, butoane 48px, confirmare la orice modificare, separare între conturi).
- **Fără chenare punctate**: „din alt porumbar” = etichetă scrisă; strămoș repetat = insignă „×N” colorată (aceeași culoare la fiecare apariție).
- Pe telefon fiecare vedere are adaptarea din machete (Carduri: o generație pe ecran, glisare; Evantai: 3 generații, atingi o felie ca să pornești de la ea; Linii: bara de sus + lista, panglicile derulează lateral).
- Dublu clic / dublă atingere pe un porumbel → fișa (cu `?din=arbore…`, ca firimiturile să întoarcă aici).

## Review Focus

1. **Pedigree incomplet** (părinți lipsă, strămoși fără inel): toate vederile desenează golurile fără să se strice; la Linii, partea necunoscută apare ca „Necunoscut”, iar procentele dau 100 % → test în Task 1.
2. **Același strămoș pe mai multe drumuri** (consangvinizare): procentele lui se adună pe toate drumurile (De 746: 12,5 % + 6,25 % + 6,25 % = 25 %) → test în Task 1.
3. **Fondator fără linie completată** → linia lui = crescătorul de origine, altfel „Fără linie” → test în Task 1.
4. **Vederea implicită invalidă / lipsă** → „carduri” → test în Task 2.
5. **Cicluri vechi în date** → nicio vedere nu se blochează → test în Task 1.

---

### Task 1: Liniile de sânge (calculul)

**Files:** Create `src/bloodlines.js`; Modify `src/routes/family.js`; Test `test/bloodlines.test.js`

**Interfaces:**
- `bloodlines(rootId, rowsById, maxGen = 8) -> { lines: { name: string, percent: number, founders: number[] }[], paths: { founderId: number|null, line: string, share: number, via: number[] }[] }` — fiecare drum de la rădăcină în sus până la un **fondator** (porumbel fără părinți cunoscuți sau la `maxGen`) aduce `0.5^adâncime`; un părinte lipsă dă un drum spre `founderId: null`, linia „Necunoscut”. Linia fondatorului: primul element din `lines`, altfel `breeder_text`, altfel „Fără linie”. Drumurile nu trec de două ori prin același porumbel (cicluri). `via` = id-urile de la fondator la rădăcină.
- `GET /api/pigeons/:id/bloodlines` → rezultatul de mai sus + `pigeons: Record<id, PigeonSummary>` pentru toți din `via`.

- [ ] Teste: părinți cu linii diferite → 50 / 50; un părinte lipsă → 50 % „Necunoscut”; strămoș comun pe 3 drumuri (adâncimi 3, 4, 4) → 12,5 + 6,25 + 6,25 = 25 %; fondator fără linie dar cu crescător → numele crescătorului; ciclu în date → răspunde; suma procentelor = 100. Alt cont → 404. → FAIL → PASS → commit.

### Task 2: Vederea implicită (setare)

**Files:** Modify `src/db.js` (migrare: `accounts.tree_view TEXT NOT NULL DEFAULT 'carduri'`), `src/accounts.js`, `src/routes/auth.js`; Test `test/auth.test.js`

- [ ] `account.treeView`; `PATCH /api/auth/me { treeView }` acceptă `carduri | evantai | sange | retea | 3d`, altfel 400. → FAIL → PASS → commit.

### Task 3: Comutatorul de vederi

**Files:** Create `web/src/app/pages/retea/arbore.ts` (pagina Arbore: alegerea porumbelului, comutatorul, vederea aleasă); Modify `web/src/app/app.routes.ts`, `web/src/app/pages/retea/retea.ts` (devine vederea „Rețea” din comutator), „Contul meu” (vederea implicită)

- [ ] Comutator segmentat cu iconițe: Carduri · Evantai · Linii de sânge · Rețea · 3D. Fără `?vedere`, se deschide vederea implicită a contului. Lângă comutator: „Fă-o vederea mea de pornire” (cu confirmare). Căutarea porumbelului (inel sau nume) e comună tuturor vederilor. Build + verificare. Commit.

### Task 4: Vederea „Carduri moderne”

**Files:** Create `web/src/app/pages/retea/vedere-carduri.ts`

- [ ] După macheta 1: coloane pe generații cu nume și număr (Răstrăbunici 16 · Străbunici 8 · Bunici 4 · Părinți 2 · Porumbelul), carduri cu avatar M/F, inel mare, nume, text scurt, an, nota (doar la ai tăi), eticheta „alt porumbar”, insigna „×N” la repetări; la părinți și bunici, rolul scris („Tatăl”, „Mama tatălui”); legături curbe SVG din geometria fixă a coloanelor; porumbelul ales cu halou pastel; panoul din dreapta: detalii, strămoși comuni (cu „×N” și drumurile lor evidențiate), consangvinizarea, bara „Sângele lui …” (Task 1), puii lui. Pe telefon: o generație pe ecran, glisare. Verificare în browser (1440 și 375). Commit.

### Task 5: Vederea „Evantai”

**Files:** Create `web/src/app/pages/retea/vedere-evantai.ts`

- [ ] După macheta 2: semicerc SVG, rădăcina în centru, tatăl în stânga, mama în dreapta; 4 inele (părinți → răstrăbunici); felia colorată după notă (gri = alt porumbar), dungă M/F, contur colorat la repetări; text drept în inelele interioare, de-a lungul razei în cele exterioare; atingerea unei felii o alege (panou), dublu clic → fișa, „Pornește de aici”; puii dedesubt, ordonați după notă. Pe telefon: 3 inele. Verificare. Commit.

### Task 6: Vederea „Liniile de sânge”

**Files:** Create `web/src/app/pages/retea/vedere-sange.ts`

- [ ] După macheta 4: bara de sus cu procentele fiecărei linii (culori distincte, citibile), lista liniilor; dedesubt panglici (Sankey) de la fondatori (stânga) la rădăcină (dreapta), fiecare porumbel o singură dată (coloana = cea mai mică adâncime), grosimea = cota drumului, culoarea = linia; atingerea unei linii (în bară sau listă) lasă doar panglicile ei și scrie explicația („Den Haan, 25 %: vine prin De 746 pe 3 drumuri…”). Seed-ul de exemplu completează liniile fondatorilor. Verificare. Commit.

### Task 7: Încheierea

- [ ] `npm test`, build, recenzie finală, merge în `main`, README. Fără push.

### Task 8: 3D — etaje pe generații și orbite (cerut de utilizator, 2026-11-16)

**Files:** Modify `web/src/app/pages/retea/retea-3d.ts`

- [ ] **Etaje după generație** (în locul anului): înălțimea = generația față de porumbelul de la care pornești (puii +1, porumbelul 0, părinții −1, bunicii −2…; un strămoș pe mai multe drumuri stă la generația cea mai apropiată). Fiecare etaj e un plan subțire, semitransparent, cu numele scris pe margine: „Puii”, „Porumbelul”, „Părinții”, „Bunicii”, „Străbunicii”, „Răstrăbunicii”. Fără porumbel ales („Tot porumbarul”), etajele rămân după an (nu există o generație de referință).
- [ ] **Orbite** (la buton „Orbite”): porumbelul în centru, generațiile pe orbite concentrice (inel subțire desenat pentru fiecare), puii pe o orbită separată deasupra; comutatorul „Etaje / Orbite”.
- [ ] Verificare în browser (selecție, TATĂL / MAMA, ecran întreg). Commit.
