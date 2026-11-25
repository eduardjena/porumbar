# Toate fișele deodată – planul de implementare

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Butonul „Tipărește fișele (N)” pe Panou (Grilă) și în Listă deschide pagina de tipar existentă cu fișele tuturor porumbeilor afișați, câte una pe A4, plus „Pune cod QR pe toate” cu confirmare.

**Architecture:** Serverul primește două rute noi pentru mai multe fișe deodată (`GET /api/sheets`, `POST /api/sheets/public`) în `src/routes/public.js`, refolosind `pedigreeV1` și regula linkului public. Pagina de tipar `pages/porumbel/tiparire.ts` lucrează fie cu un porumbel (`/porumbei/:id/tiparire`, neschimbat), fie cu mai mulți (`/porumbei/tiparire?ids=…`). Butonul stă în antetul cadrului comun (`porumbar-cadru.ts`) și ia id-urile din `PorumbarState.groups()`.

**Tech Stack:** Node 24 ESM, Express 5, PostgreSQL (`pg`), Angular standalone / signals / zoneless; teste `node scripts/test.mjs <fișiere>`.

**Spec:** `docs/superpowers/specs/2026-11-24-fise-toate-design.md`

## Global Constraints

- PostgreSQL, Node 24 ESM, Express 5, Angular standalone / signals / zoneless. Fără migrare de bază de date.
- Orice text nou vizibil, în `i18n/ro.json` (cu `sens` unde nu e evident) și în `i18n/hu.json`; pluralele ca obiect `{ one, few, other }` cu `{count}` (ca `"{count} porumbel"` de la începutul `ro.json`).
- Text de bază 18px, butoane ≥ 48px, contrast mare, iconițe SVG proprii (`app-icon`), fără emoji; fără derulare laterală la 320px.
- Fișa tipărită: aceeași componentă (`shared/pedigree-page.ts`), A4, o pagină pe porumbel; pagina de tipar a unui singur porumbel nu se schimbă la vedere și la tipar.
- Limita: **200** de fișe deodată (`MAX_SHEETS = 200`).
- Codul QR (linkul public) nu se pornește niciodată fără confirmare.
- Date de test doar inventate. Fișierele scrise cu terminații LF (pe Windows, Python doar cu `newline='\n'`; altfel pică `test/texte-ramase.test.js`).

## Review Focus

- Un porumbel din `?ids=` șters între timp (sau al altui cont): pagina arată fișele rămase, numărul corect, fără eroare.
- `/porumbei/tiparire` nu e prins de ruta `porumbei/:id` (ar încerca porumbelul cu id „tiparire”); `/porumbei/5/tiparire` merge ca înainte.
- La tipar: exact N pagini, fără pagină goală între fișe sau la sfârșit, nicio fișă ruptă.
- Schimbarea limbii fișei schimbă toate fișele, nu doar prima.
- Contul „doar citire”: tiparul merge, „Pune cod QR pe toate” arată fraza obișnuită de activare (402), nu o eroare tehnică.

---

### Task 1: Rutele de pe server pentru mai multe fișe

**Files:**
- Modify: `src/routes/public.js` (în `publicRouter()`, lângă `/pigeons/:id/pedigree`)
- Modify: `i18n/ro.json`, `i18n/hu.json` (cheia de eroare)
- Test: `test/fise-toate.test.js` (nou; după modelul `test/public.test.js`)

**Interfaces:**
- Produces:
  - `GET /api/sheets?ids=3,1,7` → `200 { sheets: Array<{ id: number, pedigree: PedigreeV1, url: string | null }> }` – doar porumbeii contului (orice `kind`, ca `/pigeons/:id/pedigree`), în ordinea din `ids`, fără dubluri; id-urile străine / inexistente / nevalide lipsesc din răspuns. `pedigree` = `pedigreeV1(accountId, id, { forPrint: true })`; `url` ca `GET /pigeons/:id/public`.
  - `POST /api/sheets/public` cu `{ ids: number[] }` → `200 { sheets: Array<{ id: number, url: string }> }` – pornește linkul pentru porumbeii **proprii** (`kind = 'own'`) ai contului care nu-l au, păstrează linkul celor care îl au (același `COALESCE` atomic ca `POST /pigeons/:id/public`); ceilalți lipsesc din răspuns.
  - Ambele: `ids` gol sau fără niciun id valid → 400; mai mult de 200 de id-uri → 400 cu cheia `eroare.prea_multe_fise` (`"Cel mult {max} fișe deodată."`, `max` = 200).

- [ ] **Step 1: Scrie testele care pică**

`test/fise-toate.test.js`, cu `startTestApp`, `newAccount`, `apiCaller` ca în `public.test.js`; conturile `a` (activ) și `b`, câțiva porumbei proprii ai lui `a` creați prin `POST /api/pigeons` (`{ kind: 'own', ring: 'RO-26-…' }`, inele inventate) și unul al lui `b`.

```js
test('fișele vin în ordinea cerută, fără dubluri, fără porumbeii altora', async () => {
  const r = await call(`/api/sheets?ids=${p3},${p1},${p3},${pB},999999,abc`, { cookie: a });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.sheets.map((s) => s.id), [p3, p1]);
  assert.equal(r.data.sheets[0].pedigree.format, 'porumbar-pedigree');
  const one = await call(`/api/pigeons/${p3}/pedigree`, { cookie: a });
  assert.deepEqual(r.data.sheets[0].pedigree.root, one.data.root);
  assert.equal(r.data.sheets[0].url, null);
});
test('fișele: gol sau peste 200 → 400', async () => {
  assert.equal((await call('/api/sheets?ids=', { cookie: a })).status, 400);
  const many = Array.from({ length: 201 }, (_, i) => i + 1).join(',');
  const r = await call(`/api/sheets?ids=${many}`, { cookie: a });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /200/);
});
test('cod QR pe toate: pornește lipsă, păstrează existent, sare peste ale altora', async () => {
  const before = (await call(`/api/pigeons/${p1}/public`, { method: 'POST', cookie: a })).data.url;
  const r = await call('/api/sheets/public', { method: 'POST', cookie: a, body: { ids: [p1, p2, pB] } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.sheets.map((s) => s.id), [p1, p2]);
  assert.equal(r.data.sheets[0].url, before);
  assert.match(r.data.sheets[1].url, /\/p\/[A-Za-z0-9_-]{20,}$/);
  assert.equal((await call(`/api/pigeons/${pB}/public`, { cookie: b })).data.url, null);
});
test('doar citire: fișele se văd, codul QR nu se pornește (402)', async () => {
  const c = await newAccount(call, 'Nou', { active: false });
  const g = await call(`/api/sheets?ids=${p1}`, { cookie: c }); // GET merge; p1 e al lui a, deci lista e goală
  assert.equal(g.status, 200);
  assert.deepEqual(g.data.sheets, []);
  assert.equal((await call('/api/sheets/public', { method: 'POST', cookie: c, body: { ids: [p1] } })).status, 402);
});
```

- [ ] **Step 2: Rulează testele, trebuie să pice**

Run: `node scripts/test.mjs test/fise-toate.test.js`
Expected: FAIL (404 pe `/api/sheets`)

- [ ] **Step 3: Scrie rutele în `src/routes/public.js`**

Un ajutor local `parseSheetIds(raw: unknown): number[]` (acceptă text cu virgule sau listă; doar întregi pozitivi; fără dubluri; ordinea păstrată; aruncă `badRequest` la gol și `badRequest('eroare.prea_multe_fise', { max: 200 })` peste 200 – folosește forma de parametri pe care `badRequest` o are deja în proiect). Rândurile le ia cu o singură interogare `SELECT … FROM pigeons WHERE account_id = ? AND id = ANY(?)` (sau forma de listă folosită deja în `src/db.js`), apoi `pedigreeV1` pe rând, în ordinea cerută. `POST`: același `UPDATE … SET public_token = COALESCE(public_token, ?) … RETURNING` ca ruta de un porumbel, câte unul, doar pentru `kind = 'own'`.

- [ ] **Step 4: Adaugă `eroare.prea_multe_fise` în `ro.json` și `hu.json`** (hu: `"Egyszerre legfeljebb {max} lap."`)

- [ ] **Step 5: Rulează testele, trebuie să treacă**

Run: `node scripts/test.mjs test/fise-toate.test.js test/public.test.js test/i18n.test.js test/texte-ramase.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/routes/public.js i18n/ro.json i18n/hu.json test/fise-toate.test.js
git commit -m "Fișele mai multor porumbei deodată: GET /api/sheets și POST /api/sheets/public (cel mult 200)"
```

### Task 2: Alegerea porumbeilor (funcții pure)

**Files:**
- Create: `web/src/app/shared/fise-toate.ts`
- Test: `test/fise-toate-web.test.js` (importă direct fișierul `.ts`, ca `test/tm-incape.test.js`)

**Interfaces:**
- Produces (din `web/src/app/shared/fise-toate.ts`):
  - `export const MAX_SHEETS = 200;`
  - `export function parseIds(q: string | null | undefined): number[]` – din `?ids=`: întregi pozitivi, fără dubluri, ordinea păstrată, cel mult `MAX_SHEETS`.
  - `export function idsOfGroups(groups: { items: { id: number }[] }[]): number[]` – id-urile în ordinea de pe ecran (grupă după grupă), fără dubluri.

- [ ] **Step 1: Scrie testul care pică**

```js
test('parseIds', () => {
  assert.deepEqual(parseIds('3,1,3,x,-2,0, 7'), [3, 1, 7]);
  assert.deepEqual(parseIds(''), []);
  assert.deepEqual(parseIds(undefined), []);
  assert.equal(parseIds(Array.from({ length: 250 }, (_, i) => i + 1).join(',')).length, 200);
});
test('idsOfGroups', () => {
  assert.deepEqual(idsOfGroups([{ items: [{ id: 5 }, { id: 2 }] }, { items: [{ id: 9 }, { id: 5 }] }]), [5, 2, 9]);
  assert.deepEqual(idsOfGroups([]), []);
});
```

- [ ] **Step 2: Rulează, trebuie să pice** – `node scripts/test.mjs test/fise-toate-web.test.js` → FAIL (fișier lipsă)
- [ ] **Step 3: Scrie funcțiile** (fără importuri Angular, ca testul să le poată încărca)
- [ ] **Step 4: Rulează, trebuie să treacă** – aceeași comandă → PASS
- [ ] **Step 5: Commit** – `git add web/src/app/shared/fise-toate.ts test/fise-toate-web.test.js && git commit -m "Fișele toate: alegerea id-urilor (parseIds, idsOfGroups)"`

### Task 3: Pagina de tipar cu mai multe fișe

**Files:**
- Modify: `web/src/app/pages/porumbel/tiparire.ts`
- Modify: `web/src/app/app.routes.ts` (ruta nouă **înainte** de `porumbei/:id`)
- Modify: `i18n/ro.json`, `i18n/hu.json`

**Interfaces:**
- Consumes: `GET /api/sheets`, `POST /api/sheets/public` (Task 1); `parseIds`, `MAX_SHEETS` (Task 2).
- Produces: ruta `/porumbei/tiparire?ids=<id,id,…>&inapoi=<panou|porumbar>` (componenta `Tiparire`, același `title('titlu.tiparire')`, `authGuard`).

Comportament:
- `id` devine opțional (`input<string>()`); `ids` și `inapoi` vin din query (legarea de input-uri e deja pornită). Fără `id` → modul „mai multe”.
- Un porumbel: totul exact ca azi (aceleași cereri, „Pune QR”, „Trimite”, „Înapoi la porumbel”).
- Mai multe: o cerere `GET /sheets?ids=` (id-urile din `parseIds`); cât se încarcă `tiparire.se_pregatesc` (plural, `{count}` = câte id-uri); apoi câte un `<app-pedigree-page [data] [url] [lang]>` pentru fiecare fișă, cu aceeași limbă `lang()` pentru toate. Fără „Trimite” și fără „Pune QR” de un porumbel. În bară: „Înapoi” (`tiparire.inapoi_porumbei` → `/porumbar` dacă `inapoi=porumbar`, altfel `/panou`), titlul `tiparire.fise_numar` (plural), alegerea limbii, „Tipărește / Salvează PDF”.
- Dacă sunt fișe fără `url`: rândul `tiparire.fara_qr` (plural) + butonul `tiparire.pune_qr_toate`; la apăsare `ConfirmService.ask` cu `title: t('partajare.porniti_titlu')`, `lines: [t('tiparire.porniti_rand'), t('tiparire.porniti_toate_rand', { count })]`, `confirmLabel: t('partajare.porniti_da')`; după da, `POST /sheets/public` cu id-urile fișelor fără cod și pune `url`-urile primite pe fișe. Eroarea (inclusiv 402) în `error()`, ca azi, prin `errorMessage`.
- `ids` gol sau niciun porumbel găsit: mesajul `tiparire.nicio_fisa` și „Înapoi”.
- Tipar: între fișe pagină nouă (de ex. `@media print { app-pedigree-page + app-pedigree-page { display: block; break-before: page; } }` în stilurile `Tiparire`); nimic schimbat în `shared/pedigree-page.ts` care să atingă fișa singură.

Texte noi (ro / hu):
- `tiparire.fise_numar`: `{one: "{count} fișă", few: "{count} fișe", other: "{count} de fișe"}` / hu `"{count} lap"` (toate formele)
- `tiparire.se_pregatesc`: `"Se pregătesc fișele ({count})…"` / `"A lapok készülnek ({count})…"`
- `tiparire.fara_qr`: `{one: "{count} fișă fără cod QR", few: "{count} fișe fără cod QR", other: "{count} de fișe fără cod QR"}` / `"{count} lap QR-kód nélkül"`
- `tiparire.pune_qr_toate`: `"Pune cod QR pe toate"` / `"QR-kód mindegyikre"`
- `tiparire.porniti_toate_rand`: `"Se pornește linkul pentru {count} porumbei."` (cu `sens`: pe pagina cu mai multe fișe, în confirmare) / `"{count} galamb linkje indul el."`
- `tiparire.inapoi_porumbei`: `"Înapoi la porumbei"` / `"Vissza a galambokhoz"`
- `tiparire.nicio_fisa`: `"Nu e nicio fișă de tipărit."` / `"Nincs nyomtatandó lap."`

- [ ] **Step 1: Scrie ruta, componenta și textele**
- [ ] **Step 2: Rulează testele de texte și build-ul**

Run: `node scripts/test.mjs test/i18n.test.js test/texte-ramase.test.js` și `npm run build` în `web/` (sau comanda de build din `web/package.json`)
Expected: PASS; build fără erori

- [ ] **Step 3: Verifică în browser** (serverul local `porumbar-cuib` pe 3103, contul de exemplu cu porumbei inventați)
  - `/porumbei/<id>/tiparire` arată și se comportă ca înainte (Pune QR, Trimite, Înapoi la porumbel).
  - `/porumbei/tiparire?ids=<3 id-uri, unul străin>` → 2 fișe, titlul „2 fișe”; schimbarea limbii schimbă ambele fișe.
  - „Pune cod QR pe toate” → confirmare → codurile apar pe fișe, rândul „fără cod QR” dispare.
  - Tipar: PDF cu exact N pagini, fără pagină goală (de ex. `msedge --headless --print-to-pdf` cu cookie-ul sesiunii, sau previzualizarea de tipar; numărul de pagini citit din PDF).
  - 320px: fără derulare laterală.
  Expected: toate de mai sus adevărate.
- [ ] **Step 4: Commit** – `git commit -m "Pagina de tipar cu mai multe fișe: /porumbei/tiparire?ids=…, câte o fișă pe pagină, Pune cod QR pe toate (cu confirmare)"`

### Task 4: Butonul „Tipărește fișele (N)”

**Files:**
- Modify: `web/src/app/pages/panou/porumbar-cadru.ts`
- Modify: `i18n/ro.json`, `i18n/hu.json`

**Interfaces:**
- Consumes: `idsOfGroups`, `MAX_SHEETS` (Task 2); `PorumbarState.groups()`, `shownCount()`; ruta `/porumbei/tiparire` (Task 3).

Comportament:
- În `.head`, în dreapta titlului, doar când `tab()` e `'grila'` sau `'lista'`, `s.loaded()` și `s.all().length`: buton cu `app-icon name="tipar"` și textul `panou.tipareste_fisele` (`"Tipărește fișele ({count})"`, `count` = `s.shownCount()`), `title`/`aria-label` `panou.tipareste_fisele_aria`; dezactivat la 0; înălțime ≥ 48px.
- La apăsare: dacă `shownCount() > MAX_SHEETS`, mesajul `panou.prea_multe_fise` (rol `status`, sub antet) și nu pleacă; altfel `router.navigate(['/porumbei/tiparire'], { queryParams: { ids: idsOfGroups(s.groups()).join(','), inapoi: tab() === 'lista' ? 'porumbar' : 'panou' } })`.
- Pe telefon butonul trece sub titlu, pe toată lățimea, fără să împingă pagina peste 320px.

Texte noi (ro / hu):
- `panou.tipareste_fisele`: `"Tipărește fișele ({count})"` / `"Lapok nyomtatása ({count})"`
- `panou.tipareste_fisele_aria`: `"Tipărește fișele porumbeilor care se văd acum, câte una pe pagină"` / `"A most látható galambok lapjainak nyomtatása, oldalanként egy"`
- `panou.prea_multe_fise`: `"Sunt {count} porumbei; tipărește cel mult {max} deodată – pune un filtru (de exemplu anul)."` / `"{count} galamb van; egyszerre legfeljebb {max} nyomtatható – szűrj (például évre)."`

- [ ] **Step 1: Scrie butonul și textele**
- [ ] **Step 2: Rulează** `node scripts/test.mjs test/i18n.test.js test/texte-ramase.test.js` și build-ul web → PASS
- [ ] **Step 3: Verifică în browser**
  - Grilă și Listă: butonul arată numărul porumbeilor afișați; cu filtrul „Femele” numărul scade și pagina de tipar are doar femelele, în ordinea de pe ecran.
  - Rezultate concurs, Importă pedigree, Excel, Scanează: fără buton.
  - „Înapoi” de pe pagina de tipar duce în Listă / pe Panou, cu filtrele neschimbate.
  - Peste 200: coboară local `MAX_SHEETS` la 2 (fără commit), apasă butonul cu 3+ porumbei afișați → apare mesajul, nu pleacă; pune pragul la loc.
  - 320px și 1280px: butonul încape, fără derulare laterală. Captură de ecran.
  Expected: toate de mai sus adevărate.
- [ ] **Step 4: Rulează toată suita** – `node scripts/test.mjs` → toate trec
- [ ] **Step 5: Commit** – `git commit -m "Butonul Tipărește fișele (N) pe Panou și în Listă: porumbeii afișați, cel mult 200"`
