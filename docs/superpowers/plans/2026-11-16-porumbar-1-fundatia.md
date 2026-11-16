# Porumbar – Planul 1: fundația și porumbarul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un program web în care un crescător își face cont, își introduce porumbeii (fișă completă, rasă, linii, culoare, evaluare, jurnal, poze), le alege părinții după inel văzând istoricul lor, vede rudele, arborele genealogic și consangvinizarea.

**Architecture:** Server Node/Express cu PostgreSQL (migrări versionate într-un singur `src/db.js`), API JSON sub `/api`, sesiune în cookie HttpOnly. Logica pură (inele, culori, genealogie / consangvinizare) stă în module fără bază de date, testate separat. Interfața e Angular (standalone, signals, zoneless) în `web/`, construită și servită de Express.

**Tech Stack:** Node.js ≥ 24 (ESM), Express 5, `pg`, `bcryptjs`, `nodemailer`; teste cu `node:test` pe un PostgreSQL temporar; Angular 22 în `web/`.

**Spec:** `docs/superpowers/specs/2026-11-16-porumbar-design.md` (secțiunile 3, 5, 5a – doar alegerea părinților, 6, 9 – fără rezultate, 10, 11a). Fișiere-exemplu: `docs/exemple/`.

Acesta e primul din 4 planuri ale Etapei 1: **1 fundația și porumbarul** (acesta) → 2 reproducția (perechi, cuiburi, inelarea puilor) → 3 pedigree PDF + QR + pagina publică + transfer → 4 import (poză / PDF / Excel) + export.

## Global Constraints

- Node.js `>=24`, `"type": "module"`; Express 5; PostgreSQL instalat local (pe acest calculator: `C:\Program Files\PostgreSQL\18`). **Fără SQLite sau baze emulate.**
- Toată interfața și mesajele de eroare în **română, cu diacritice**.
- Utilizatori neobișnuiți cu tehnologia: text de bază **min. 18px**, butoane și câmpuri **min. 48px înălțime**, puțini pași, fără jargon.
- Datele fiecărui cont sunt strict separate: un id al altui cont în URL → **404** (nu 403).
- Inelul se păstrează mereu și în forma originală (`raw`), pe lângă cea normalizată.
- Git: repo nou în `C:\dev\porumbar`, branch `main`; tot planul se face pe branch-ul `feat/fundatia`, merge în `main` la final. **Fără push** fără acordul utilizatorului (nu există încă remote).
- Serverul nu accesează niciodată columba.ro (spec, secțiunea 2).
- Postgres pentru teste: `npm test` pornește un cluster temporar (ca la Triaj); fiecare fișier de teste are baza lui.

## Review Focus

1. **Același inel scris în forme diferite** de același crescător (`RO-25-0276971`, `276971/25 RO`, `RO 25 276971`) trebuie să găsească același porumbel și să fie refuzat ca dublură → test în Task 6.
2. **Mai mulți strămoși fără inel** („000 M Govaerts”, „0000/07 Vânăt”) în același cont nu se lovesc de unicitatea inelului → test în Task 6.
3. **Cicluri în arbore**: porumbelul pus ca propriul părinte sau ca părinte al strămoșului său → 400, nu buclă infinită → test în Task 7; tree/COI pe date cu cicluri vechi nu se blochează → test în Task 8.
4. **Id-ul altui cont** la citire, modificare, părinți, jurnal, poze → 404 → teste în Task 6 și Task 9.
5. **Strămoși care se repetă** (consangvinizare reală, ca `1954746/04 NL F` care apare de 3 ori pe pedigree-ul foto) sunt marcați în arbore și intră corect în coeficient → test în Task 8.

---

### Task 1: Proiectul, baza de date și testele

**Files:**
- Create: `package.json`, `.gitignore`, `.env.example`, `README.md`
- Create: `src/config.js`, `src/db.js`, `src/http.js`, `src/app.js`, `src/server.js`, `src/boot.js`
- Create: `scripts/lib/temp-postgres.mjs` (copiat din `C:\dev\triaj\scripts\lib\temp-postgres.mjs`), `scripts/test.mjs` (copiat din Triaj), `scripts/db-setup.mjs` (adaptat din Triaj: rol și bază `porumbar`)
- Create: `test/helpers/db.js`, `test/helpers/api.js` (adaptate din `C:\dev\triaj\test\helpers\`)
- Test: `test/health.test.js`
- Create: `.claude/launch.json` (configurații `api` pe portul 3100 și `web` pe 4300)

**Interfaces:**
- Produces:
  - `src/db.js`: `initDb(): Promise<void>`, `closeDb()`, `one(sql, ...p)`, `all(sql, ...p)`, `run(sql, ...p) -> {changes}`, `insert(sql, ...p) -> id`, `tx(fn)`, `nowIso()`; placeholders `?` ca la Triaj; `MIGRATIONS: (string|fn)[]` cu tabelul `schema_version`.
  - `src/http.js`: `HttpError`, `badRequest(msg)`, `notFound(msg?)`, `text(value, field, {max, optional})`, `oneOf(value, allowed, field)`, `intParam(value)`, `rateLimit({windowMs, max, key, failuresOnly})`, `errorHandler` (copiate din Triaj).
  - `src/config.js`: `config = { port (PORT, implicit 3100), databaseUrl (DATABASE_URL), dataDir (DATA_DIR, implicit ./data), publicBaseUrl (PUBLIC_BASE_URL, implicit http://localhost:3100), smtpUrl (SMTP_URL, opțional), mailFrom (MAIL_FROM), secureCookies (NODE_ENV==='production') }`.
  - `src/app.js`: `createApp(): express.Application`; JSON body limit 1 MB; cererile care modifică date fără `Content-Type: application/json` → 415 (excepție: încărcarea pozelor, Task 9); `GET /api/health` → `{ ok: true }`.
  - `src/boot.js`: `boot()` = `initDb()` (rulează migrările).
  - `test/helpers/db.js`: `bootTestDb()`; `test/helpers/api.js`: `apiCaller(state)`, `listen(app)`.
- Migrarea 1 creează doar `schema_version` (tabelele vin în task-urile lor, fiecare ca migrare nouă la final).

- [ ] **Step 1:** `git init -b main` în `C:\dev\porumbar`; `.gitignore` (`node_modules/`, `.env`, `data/`, `web/dist/`, `web/node_modules/`, `web/.angular/`); commit pe `main`: `docs: design, exemple și planul 1`. Apoi `git switch -c feat/fundatia`.
- [ ] **Step 2: Testul care pică** — `test/health.test.js`:

```js
test('serverul răspunde și migrările au rulat', async () => {
  const r = await call('/api/health', { auth: 'none' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { ok: true });
  const { one } = await import('../src/db.js');
  assert.ok((await one('SELECT max(version) AS v FROM schema_version')).v >= 1);
});
test('POST fără JSON e refuzat', async () => {
  const res = await fetch(`${base}/api/health`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' });
  assert.equal(res.status, 415);
});
```

- [ ] **Step 3:** `npm test` → FAIL (`createApp` lipsă).
- [ ] **Step 4:** Scrie fișierele de mai sus (dependențe: `express@^5`, `pg`, `bcryptjs`, `nodemailer`; scripturi `start`, `dev` cu `--env-file-if-exists=.env --watch`, `test`, `db:setup`).
- [ ] **Step 5:** `npm test` → PASS (2 teste).
- [ ] **Step 6:** `npm run db:setup` (cere parola `postgres` utilizatorului — dacă nu e disponibilă, sari și notează), apoi `npm run dev` și `GET http://localhost:3100/api/health` → `{"ok":true}`.
- [ ] **Step 7:** Commit `feat: proiectul, baza de date și testele`.

---

### Task 2: Inelele

**Files:**
- Create: `src/rings.js`
- Test: `test/rings.test.js`

**Interfaces:**
- Produces:
  - `parseRing(text: string, { now = new Date() } = {}) -> Ring`, unde `Ring = { ok: boolean, unringed: boolean, raw: string, country: string|null, year: number|null, number: string|null, club: string|null, sex: 'M'|'F'|null }`. `number` și `club` fără zerouri în față. `ok=false` când nu se poate interpreta (se păstrează doar `raw`).
  - `formatRing(r: Ring) -> string` — `RO-25-276971`; cu club: `DV-08778-24-271` (clubul pe 5 cifre, anul pe 2).
  - `ringKey(r: Ring) -> string|null` — `${country}|${year}|${club??''}|${number}`; `null` dacă `!ok || unringed`.
  - `ringFromColumba(matricol: string, an: string|number) -> Ring` (țara RO).
- Reguli: separatori `-`, spațiu, `/`; țara poate fi la început (`RO-26-800546`) sau la sfârșit (`412084/15 RO`); `BELG`/`B` → `BE`, `D`/`DV` → `DV` (Germania, cu club), `NL`, `RO`, `GB`, `PL`, `HU`, `BG`, `MD`; fără țară → `RO`. Sufix de sex: ` L`/` M` → `M`, ` T`/` F` → `F`, și lipit de număr (`738256/09F`). Anul pe 2 cifre: `≤ anul curent % 100` → `20xx`, altfel `19xx`. Număr doar din zerouri (`000`, `0000/07 RO`) → `unringed: true, ok: true`.

- [ ] **Step 1: Testele care pică** (`now = new Date('2026-11-16')`):

```js
const cases = [
  ['RO-26-800546 L', { country: 'RO', year: 2026, number: '800546', sex: 'M' }],
  ['RO-17-159927 T', { country: 'RO', year: 2017, number: '159927', sex: 'F' }],
  ['412084/15 RO', { country: 'RO', year: 2015, number: '412084', sex: null }],
  ['898910/09 RO M', { country: 'RO', year: 2009, number: '898910', sex: 'M' }],
  ['738256/09F', { country: 'RO', year: 2009, number: '738256', sex: 'F' }],
  ['RO 25 1326835', { country: 'RO', year: 2025, number: '1326835' }],
  ['RO-25-0276971', { country: 'RO', year: 2025, number: '276971' }],
  ['NL-11-1724956 L', { country: 'NL', year: 2011, number: '1724956', sex: 'M' }],
  ['5218055/02 NL M', { country: 'NL', year: 2002, number: '5218055', sex: 'M' }],
  ['6008107/08 BELG M', { country: 'BE', year: 2008, number: '6008107', sex: 'M' }],
  ['BE-25-2091885', { country: 'BE', year: 2025, number: '2091885' }],
  ['DV-08778-24-271', { country: 'DV', year: 2024, club: '8778', number: '271' }],
  ['DV-8778-24-262', { country: 'DV', year: 2024, club: '8778', number: '262' }],
  ['1441788/05 NL M', { country: 'NL', year: 2005, number: '1441788' }],
  ['NL-03-1395255 L', { country: 'NL', year: 2003, number: '1395255' }],
  ['123456/99 RO', { country: 'RO', year: 1999 }],
];
for (const [raw, exp] of cases) test(`inel: ${raw}`, () => {
  const r = parseRing(raw, { now });
  assert.equal(r.ok, true); assert.equal(r.raw, raw);
  for (const [k, v] of Object.entries(exp)) assert.equal(r[k], v, k);
});
test('fără inel', () => {
  for (const raw of ['000 M', '0000/07 RO M']) assert.equal(parseRing(raw, { now }).unringed, true);
  assert.equal(ringKey(parseRing('000 M', { now })), null);
});
test('neinterpretabil', () => { const r = parseRing('Govaerts pedigreu distrus', { now }); assert.equal(r.ok, false); assert.equal(ringKey(r), null); });
test('aceeași cheie pentru forme diferite', () => {
  const k = (s) => ringKey(parseRing(s, { now }));
  assert.equal(k('RO-25-0276971'), k('276971/25 RO'));
  assert.equal(k('RO 25 276971'), k('RO-25-276971'));
  assert.equal(k('DV-08778-24-271'), k('DV-8778-24-271'));
  assert.equal(ringKey(ringFromColumba('0276971', 2025)), k('RO-25-276971'));
});
test('afișare', () => {
  assert.equal(formatRing(parseRing('412084/15 RO', { now })), 'RO-15-412084');
  assert.equal(formatRing(parseRing('DV-8778-24-262', { now })), 'DV-08778-24-262');
});
```

- [ ] **Step 2:** `npm test test/rings.test.js` → FAIL.
- [ ] **Step 3:** Implementează `src/rings.js` (expresii regulate pe forma normalizată: majuscule, spații comprimate; întâi sufixul de sex, apoi țara, apoi `număr/an` sau `an-număr`).
- [ ] **Step 4:** `npm test test/rings.test.js` → PASS.
- [ ] **Step 5:** Commit `feat: inele (interpretare, cheie, afișare)`.

---

### Task 3: Liste: rase, culori, stări, criterii

**Files:**
- Create: `src/catalog.js`
- Test: `test/catalog.test.js`

**Interfaces:**
- Produces:
  - `BREEDS: {code, label}[]` — primul `{code:'voiajor', label:'Voiajor'}`, apoi câteva rase de expoziție uzuale în România (alegerea builderului) și `{code:'alta', label:'Altă rasă'}`.
  - `COLORS: {code, label, synonyms: string[]}[]` — cel puțin: `albastru` (Albastru, syn „albastra”), `albastru-brocat` (Albastru brocat, syn „brocat”, „albastru brocata”), `solzat` (Solzat, syn „solzata”), `pestrit` (Pestriț, syn „pestrit”, „pestrita”, „pestriță”), `vanat` (Vânăt, syn „vanat”, „vanata”, „vnata”, „vânătă”), `rosu` (Roșu), `galbui` (Gălbui), `alb` (Alb), `negru` (Negru), `rosu-brocat` (Roșu brocat). Restul listei: builderul.
  - `matchColor(text: string) -> { code: string|null, pa: boolean, rest: string }` — fără diacritice și majuscule; „p.a” / „pa” / „pene albe” → `pa: true`; cuvinte rămase (de ex. „Consangvină”) în `rest`; `code: null` dacă nu recunoaște culoarea.
  - `EYE_COLORS: {code,label}[]` (Galben, Portocaliu, Roșu, Perlat, Vișiniu / Taurin, Mixt).
  - `STATUSES: {code,label}[]` — `concurent`, `reproducator` (Reproducător), `tanar` (Tânăr), `vandut` (Vândut), `pierdut`, `mort`, `accidentat`.
  - `EVAL_CRITERIA: {code,label}[]` — `echilibru`, `musculatura` (Musculatură), `spate`, `aripa` (Aripă), `penaj`, `ochi`, `bazin`, `caracter`.
  - `JOURNAL_TYPES` — `nota` (Notă), `tratament`, `vaccin`, `antrenament`, `altele`.
  - `GET /api/catalog` (fără autentificare) → `{ breeds, colors, eyeColors, statuses, evalCriteria, journalTypes }` (fără `synonyms`).

- [ ] **Step 1: Testele care pică:**

```js
test('culori din pedigree-urile reale', () => {
  assert.deepEqual(pick(matchColor('Vnata')), { code: 'vanat', pa: false });
  assert.deepEqual(pick(matchColor('Pestrita')), { code: 'pestrit', pa: false });
  assert.deepEqual(pick(matchColor('Albastra p.a')), { code: 'albastru', pa: true });
  assert.deepEqual(pick(matchColor('Solzat p.a')), { code: 'solzat', pa: true });
  assert.deepEqual(pick(matchColor('Albastru brocat')), { code: 'albastru-brocat', pa: false });
  assert.equal(matchColor('Albastra p.a Consangvina').rest.toLowerCase(), 'consangvina');
  assert.equal(matchColor('xyz').code, null);
});
test('catalogul public', async () => {
  const r = await call('/api/catalog', { auth: 'none' });
  assert.equal(r.status, 200);
  assert.equal(r.data.breeds[0].code, 'voiajor');
  assert.ok(r.data.colors.every((c) => !('synonyms' in c)));
});
```
(`pick = ({code, pa}) => ({code, pa})`)

- [ ] **Step 2:** rulează → FAIL. **Step 3:** implementează. **Step 4:** rulează → PASS.
- [ ] **Step 5:** Commit `feat: liste de rase, culori, stări și criterii`.

---

### Task 4: Conturi, sesiuni, parolă uitată

**Files:**
- Create: `src/accounts.js`, `src/mail.js`, `src/routes/auth.js`
- Modify: `src/db.js` (migrarea 2), `src/app.js`
- Test: `test/auth.test.js`

**Interfaces:**
- Migrarea 2:

```sql
CREATE TABLE accounts (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL, name TEXT NOT NULL, password_hash TEXT NOT NULL,
  phone TEXT, address TEXT,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX ux_accounts_email ON accounts (lower(email));
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY, account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL, last_seen_at TIMESTAMPTZ NOT NULL, user_agent TEXT
);
CREATE TABLE password_resets (
  token_hash TEXT PRIMARY KEY, account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ
);
```

- Produces:
  - `src/mail.js`: `sendMail({ to, subject, text }): Promise<void>` — cu `config.smtpUrl` prin nodemailer; fără el scrie în consolă și adaugă în `sentMails` (array exportat, pentru teste).
  - `src/accounts.js`: `requireAccount(req, res, next)` (pune `req.account = {id, email, name}`; 401 `{error:'Trebuie să intri în cont.'}`), `createSession(res, accountId, userAgent)`, `endSession(req, res)`.
  - Cookie `porumbar_session`: token aleator 32 octeți (base64url), în bază doar `sha256`; HttpOnly, SameSite=Lax, Secure în producție, 90 de zile.
  - Rute: `POST /api/auth/register {email, password, name}` → 201 `{account}` + cookie; `POST /api/auth/login {email, password}` → 200 `{account}` + cookie / 401 `Email sau parolă greșită.`; `POST /api/auth/logout` → 204; `GET /api/auth/me` → `{account}` / 401; `PATCH /api/auth/me {name, phone, address}`; `POST /api/auth/forgot {email}` → mereu 200 `{ok:true}` (trimite email cu `${publicBaseUrl}/parola-noua/<token>` doar dacă există contul; valabil 1 oră, o folosire); `POST /api/auth/reset {token, password}` → 200 + cookie (închide celelalte sesiuni) / 400 `Linkul a expirat sau a fost folosit.`
  - Parola: minim 10 caractere (`Parola trebuie să aibă cel puțin 10 caractere.`); bcrypt cost 12. Email dublat → 409 `Există deja un cont cu acest email.` Limitare: 10 încercări greșite de login / 15 min pe IP+email.
  - `account` în răspunsuri: `{ id, email, name, phone, address }`.
  - `DELETE /api/auth/me { password }` → 204: șterge contul și tot ce ține de el (GDPR, spec 10; `ON DELETE CASCADE` + fișierele pozelor din Task 9). Parolă greșită → 401. (Ce se întâmplă cu porumbeii vânduți altora: Planul 3.)

- [ ] **Step 1: Testele care pică:** cont nou → `/me` 200; parolă scurtă → 400; email dublat (alte majuscule) → 409; login greșit → 401; logout → `/me` 401; forgot pentru email inexistent → 200 și `sentMails` gol; forgot pentru contul existent → un email cu link; reset cu tokenul → 200, a doua oară → 400; după reset, cookie-ul vechi → 401; token expirat (setat în bază `expires_at` în trecut) → 400; ștergerea contului cu parola greșită → 401, cu cea bună → 204 și login-ul nu mai merge.
- [ ] **Step 2:** rulează → FAIL. **Step 3:** implementează. **Step 4:** rulează → PASS.
- [ ] **Step 5:** Commit `feat: conturi, sesiuni și parolă uitată`.

---

### Task 5: Genealogia (logică pură)

**Files:**
- Create: `src/genealogy.js`
- Test: `test/genealogy.test.js`

**Interfaces:**
- `Nodes = Map<number, { id: number, fatherId: number|null, motherId: number|null }>`
- Produces:
  - `buildTree(rootId, nodes, generations) -> TreeNode`, `TreeNode = { id: number|null, father: TreeNode|null, mother: TreeNode|null, repeat: number|null }` — `generations` = câte niveluri sub rădăcină (pedigree 4 gen. → 3; 5 gen. → 4, ecranul permite până la 10); `repeat` = un număr de grup (1, 2, …) pentru fiecare id care apare de cel puțin două ori în arbore, altfel `null`; un id deja pe drumul curent spre rădăcină (ciclu) se oprește acolo (`father/mother = null`).
  - `wrightCoi(sireId, damId, nodes, maxGen = 6) -> { coi: number, common: { id: number, contribution: number }[] }` — consangvinizarea puilor perechii: `F = Σ (1/2)^(n1+n2+1) · (1 + F_A)` peste toți strămoșii comuni A și toate perechile de drumuri sire→A (n1 pași) și dam→A (n2 pași) care nu au alt nod comun în afară de A; `F_A = wrightCoi(A.fatherId, A.motherId)` (memoizat, 0 dacă lipsește un părinte); drumuri de cel mult `maxGen` pași; cicluri în date ignorate (niciun nod de două ori pe același drum). `common` sortat descrescător după `contribution`.
  - `coiOf(id, nodes, maxGen = 6)` = `wrightCoi(father, mother)` sau `{coi: 0, common: []}`.
  - `ancestorIds(id, nodes) -> Set<number>` (pentru verificarea ciclurilor la alegerea părinților).

- [ ] **Step 1: Testele care pică** (rotunjite la 6 zecimale):

```js
// helper: g(...[id, father, mother]) -> Nodes
test('frați buni', () => assert.equal(r(wrightCoi(3, 4, g([1], [2], [3,1,2], [4,1,2])).coi), 0.25));
test('semi-frați', () => assert.equal(r(wrightCoi(4, 5, g([1],[2],[3],[4,1,2],[5,1,3])).coi), 0.125));
test('tată × fiică', () => assert.equal(r(wrightCoi(1, 3, g([1],[2],[3,1,2])).coi), 0.25));
test('veri primari', () => assert.equal(r(wrightCoi(7, 8, g([1],[2],[3,1,2],[4,1,2],[5],[6],[7,3,5],[8,4,6])).coi), 0.0625));
test('strămoș comun el însuși consangvin', () => {
  // A=5 e pui de frați buni (F_A = 0.25); 6 și 7 sunt semi-frați prin A → 0.125 · 1.25
  assert.equal(r(wrightCoi(6, 7, g([1],[2],[3,1,2],[4,1,2],[5,3,4],[8],[9],[6,5,8],[7,5,9])).coi), 0.15625);
});
test('fără strămoși comuni', () => assert.equal(wrightCoi(1, 2, g([1],[2])).coi, 0));
test('ciclu în date nu blochează', () => assert.equal(typeof wrightCoi(1, 2, g([1,2,null],[2,1,null])).coi, 'number'));
test('arbore cu repetări', () => {
  const t = buildTree(7, g([1],[2],[3,1,2],[4,1,2],[5],[6],[7,3,4]), 3);
  assert.equal(t.father.father.repeat, t.mother.father.repeat); assert.notEqual(t.father.father.repeat, null);
  assert.equal(t.father.repeat, null);
});
```

- [ ] **Step 2:** rulează → FAIL. **Step 3:** implementează (enumerarea drumurilor cu DFS limitat la `maxGen`). **Step 4:** rulează → PASS.
- [ ] **Step 5:** Commit `feat: arbore și consangvinizare (Wright)`.

---

### Task 6: Porumbeii (fișa)

**Files:**
- Create: `src/pigeons.js`, `src/routes/pigeons.js`
- Modify: `src/db.js` (migrarea 3), `src/app.js`
- Test: `test/pigeons.test.js`

**Interfaces:**
- Consumes: `parseRing`, `ringKey`, `formatRing` (Task 2); `STATUSES`, `BREEDS`, `COLORS`, `EYE_COLORS`, `EVAL_CRITERIA` (Task 3); `requireAccount` (Task 4).
- Migrarea 3:

```sql
CREATE TABLE pigeons (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('own','external')),
  ring_raw TEXT, ring_key TEXT, ring_country TEXT, ring_year INTEGER, ring_club TEXT, ring_number TEXT,
  sex TEXT CHECK (sex IN ('M','F')),
  name TEXT, breed TEXT NOT NULL DEFAULT 'voiajor', lines TEXT[] NOT NULL DEFAULT '{}',
  color TEXT, color_pa BOOLEAN NOT NULL DEFAULT false, color_text TEXT, eye_color TEXT,
  status TEXT, hatched_on DATE, breeder_text TEXT, pedigree_text TEXT,
  father_id BIGINT REFERENCES pigeons(id) ON DELETE SET NULL DEFERRABLE,
  mother_id BIGINT REFERENCES pigeons(id) ON DELETE SET NULL DEFERRABLE,
  evaluation JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
);
-- un porumbel propriu e unul singur în tot programul (spec 7); strămoșii externi sunt unici doar în cont
CREATE UNIQUE INDEX ux_pigeons_own_ring ON pigeons (ring_key) WHERE kind = 'own' AND ring_key IS NOT NULL;
CREATE UNIQUE INDEX ux_pigeons_ext_ring ON pigeons (account_id, ring_key) WHERE kind = 'external' AND ring_key IS NOT NULL;
CREATE INDEX ix_pigeons_account ON pigeons (account_id);
CREATE INDEX ix_pigeons_parents ON pigeons (father_id, mother_id);
```

- `PigeonInput` (POST/PATCH): `{ kind: 'own'|'external', ring?: string, sex?: 'M'|'F'|null, name?, breed?, lines?: string[], color?: string(code)|null, colorPa?: boolean, colorText?: string, eyeColor?, status?, hatchedOn?: 'YYYY-MM-DD', breederText?, pedigreeText?, evaluation?: { scores?: Record<criteriu, 1..5>, calitati?: string, deDorit?: string, defecte?: string } }`. Sexul din inel (`L`/`T`, `M`/`F`) completează `sex` dacă lipsește. `lines`: max 10 etichete, fiecare max 40 de caractere, trim, fără dubluri (case-insensitive). `kind: 'own'` cu inel neinterpretabil → 400 `Inelul nu poate fi citit. Scrie-l ca în exemplu: RO-25-123456.`; `external` acceptă orice text sau lipsa inelului.
- `Pigeon` (răspuns): `{ id, kind, ring: { raw, display, country, year, club, number } | null, sex, name, breed, lines, color, colorPa, colorText, eyeColor, status, hatchedOn, breederText, pedigreeText, fatherId, motherId, evaluation, createdAt, updatedAt }`; `PigeonSummary = { id, kind, ring, sex, name, color, status }`.
- Produces:
  - `src/pigeons.js`: `getPigeon(accountId, id) -> Pigeon` (404 dacă nu e al contului), `loadNodes(accountId) -> Nodes` (toți porumbeii contului, pentru genealogie), `toSummary(row)`.
  - Rute: `GET /api/pigeons?q=&status=&sex=&year=&kind=` → `{ pigeons: PigeonSummary[] }` (`q` caută după inel — prin `ringKey` dacă se poate interpreta, altfel în `ring_raw` — și după nume, fără diacritice/majuscule); `POST /api/pigeons` → 201 `{pigeon}`; `GET /api/pigeons/:id` → `{ pigeon }`; `PATCH /api/pigeons/:id` → `{pigeon}`; `DELETE /api/pigeons/:id` → 204, sau 409 `Porumbelul are pui în program. Schimbă-i starea în loc să-l ștergi.` dacă e părintele altui rând.
  - Inel propriu deja în program: 409 `Inelul RO-25-276971 este deja în programul altui crescător.` (sau `…este deja în porumbarul tău.` dacă e al aceluiași cont). Strămoș extern cu inel deja în cont: 409 `…este deja în porumbarul tău.`

- [ ] **Step 1: Testele care pică:** creare porumbel propriu cu `ring: 'RO-26-800546 L'` → `sex: 'M'`, `ring.display: 'RO-26-800546'`; **Review Focus 1:** al doilea cu `'800546/26 RO'` → 409; **căutare** `q=0800546` găsește porumbelul; alt cont cu același inel propriu → 409 (mesajul „altui crescător”); **Review Focus 2:** două externe `'000 M'` și `'0000/07 RO M'` în același cont → 201 amândouă; externă cu text neinterpretabil → 201 cu `ring.display = raw`; **Review Focus 4:** contul B face GET/PATCH/DELETE pe porumbelul contului A → 404; `color: 'inexistent'` → 400; scor de evaluare 6 → 400; ștergere porumbel care e tată → 409.
- [ ] **Step 2:** rulează → FAIL. **Step 3:** implementează. **Step 4:** rulează → PASS.
- [ ] **Step 5:** Commit `feat: fișa porumbelului`.

---

### Task 7: Părinții după inel, rudele, arborele și consangvinizarea în API

**Files:**
- Create: `src/routes/family.js`
- Modify: `src/pigeons.js`, `src/app.js`
- Test: `test/family.test.js`

**Interfaces:**
- Consumes: `getPigeon`, `loadNodes`, `toSummary` (Task 6); `buildTree`, `wrightCoi`, `coiOf`, `ancestorIds` (Task 5); `parseRing`, `ringKey` (Task 2).
- Produces:
  - `GET /api/pigeons/lookup?ring=` → `{ ring: { ok, display, raw, unringed }, matches: HistoryCard[] }`, `HistoryCard = { pigeon: PigeonSummary & { breed, lines, hatchedOn, pedigreeText }, father: PigeonSummary|null, mother: PigeonSummary|null, offspringCount: number, offspring: PigeonSummary[] (cel mult 20, cei mai noi întâi) }`. Caută în porumbeii contului (proprii + externi) după `ringKey`; dacă inelul nu se poate interpreta, după `ring_raw` exact (fără majuscule). (Căutarea în pedigree-urile publice ale altor conturi vine în Planul 3.)
  - `PUT /api/pigeons/:id/parents { fatherId: number|null, motherId: number|null }` → `{ pigeon }`. Erori 400: `Tatăl trebuie să fie mascul.`, `Mama trebuie să fie femelă.` (dacă sexul e cunoscut), `Un porumbel nu poate fi propriul părinte.`, `Porumbelul ales e deja urmașul acestui porumbel.` (părintele ales e în descendența lui = ciclu); părinte din alt cont → 404. Un părinte fără sex primește sexul potrivit.
  - `GET /api/pigeons/:id/family` → `{ father, mother, fullSiblings, halfSiblings, offspring }` (toate `PigeonSummary[]` / `null`); `fullSiblings` = aceiași tată și mamă (ambii cunoscuți); `halfSiblings` = un singur părinte comun.
  - `GET /api/pigeons/:id/tree?generations=4` (1–10, implicit 4) → `{ tree: TreeNode, pigeons: Record<id, PigeonSummary> }`.
  - `GET /api/pigeons/:id/coi` → `{ coi, common: { pigeon: PigeonSummary, contribution }[] }`; `GET /api/pairs/coi?sireId=&damId=` → aceeași formă (consangvinizarea puilor unei perechi plănuite); ambele cu `maxGen = 6`.

- [ ] **Step 1: Testele care pică:** lookup după `'RO-26-800546'` și după `'800546/26 RO'` → același `matches[0].pigeon.id`, cu `offspringCount` corect după ce i se pun 2 pui; **Review Focus 3:** porumbelul ca propriul tată → 400; bunicul are ca tată nepotul → 400 (`…deja urmașul…`); tată femelă → 400; `family` pentru un pui din pereche cu 3 frați buni și 1 semi-frate → `fullSiblings.length === 3`, `halfSiblings.length === 1`; `tree?generations=4` pe un porumbel cu bunicul repetat pe ambele linii → aceleași `repeat` nenule; `pairs/coi` pentru frați buni → `0.25`; contul B pe `family`/`tree`/`coi`/`parents` al contului A → 404.
- [ ] **Step 2:** rulează → FAIL. **Step 3:** implementează. **Step 4:** rulează → PASS.
- [ ] **Step 5:** Commit `feat: părinții după inel, rude, arbore și consangvinizare`.

---

### Task 8: Pedigree-ul foto ca date de test (integrare)

**Files:**
- Create: `test/fixtures/pedigree-foto.js` (arborele din `docs/exemple/pedigree-foto-5-generatii.webp`, transcris: inele, sex, texte scurte; cele 31 de căsuțe, cu `000 M` și `0000/07 RO M` ca strămoși fără inel)
- Test: `test/pedigree-foto.test.js`

**Interfaces:**
- Consumes: rutele din Task 6 și Task 7.
- Fixture: `export const PEDIGREE_FOTO = { ring: '412084/15 RO', father: {...}, mother: {...} }` (noduri `{ ring, text, father?, mother? }`; partea tăiată din dreapta pozei se completează cu ce se vede și se lasă `null` unde nu se vede).

- [ ] **Step 1: Testul care pică:** încarcă fixture-ul prin API (porumbelul `412084/15 RO` propriu, restul externi, părinți prin `PUT …/parents`, refolosind strămoșul după inel când apare a doua oară) → `tree?generations=4` marchează `1954746/04 NL F` cu același `repeat` în toate cele 3 locuri și `030937/07 RO M` / `030962/07 RO F` în câte 2 locuri; **Review Focus 5:** `GET /api/pigeons/:id/coi` → `coi > 0` și `common` conține `1954746/04 NL`; cele două căsuțe fără inel rămân doi strămoși diferiți.
- [ ] **Step 2:** `npm test test/pedigree-foto.test.js` → PASS. Dacă pică, greșeala e în codul din Task 6–7: corectează-l acolo, nu testul.
- [ ] **Step 4:** Commit `test: pedigree-ul foto, cap-coadă`.

---

### Task 9: Jurnalul și pozele

**Files:**
- Create: `src/routes/journal.js`, `src/routes/photos.js`
- Modify: `src/db.js` (migrarea 4), `src/app.js`
- Test: `test/journal-photos.test.js`

**Interfaces:**
- Migrarea 4:

```sql
CREATE TABLE journal_entries (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  pigeon_id BIGINT NOT NULL REFERENCES pigeons(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL, type TEXT NOT NULL, text TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE photos (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  pigeon_id BIGINT NOT NULL REFERENCES pigeons(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('corp','aripa','ochi','altele')),
  mime TEXT NOT NULL, size INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL
);
```

- Produces:
  - `GET /api/pigeons/:id/journal` → `{ entries: { id, date, type, text }[] }` (cele mai noi întâi); `POST` `{ date, type, text (max 4000) }` → 201; `DELETE /api/journal/:entryId` → 204.
  - `POST /api/pigeons/:id/photos?kind=corp` cu corpul brut `image/jpeg|image/png|image/webp`, max 10 MB (altfel 413 / 415) → 201 `{ photo: { id, kind, url: '/api/photos/<id>' } }`; fișierul în `DATA_DIR/photos/<id>`; `GET /api/pigeons/:id/photos` → `{ photos }`; `GET /api/photos/:photoId` → imaginea (doar contul proprietar, `Cache-Control: private`); `DELETE /api/photos/:photoId` → 204 (șterge și fișierul). Ștergerea porumbelului șterge și fișierele pozelor.
  - Verificarea tipului după primii octeți (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WEBP `RIFF....WEBP`), nu doar după header.

- [ ] **Step 1: Testele care pică:** intrare de jurnal cu tip `vaccin` → apare în listă; tip necunoscut → 400; poză PNG mică → 201 și `GET` întoarce aceiași octeți; text cu `Content-Type: image/png` → 415; 11 MB → 413; **Review Focus 4:** contul B pe jurnalul / pozele contului A (listă, adăugare, citire poză, ștergere) → 404.
- [ ] **Step 2:** rulează → FAIL. **Step 3:** implementează. **Step 4:** rulează → PASS.
- [ ] **Step 5:** Commit `feat: jurnal și poze`.

---

### Task 10: Interfața: proiectul Angular, intrarea în cont

**Files:**
- Create: `web/` (Angular 22, standalone, zoneless, fără SSR, CSS), `web/proxy.conf.json` (`/api` → `http://localhost:3100`)
- Create: `web/src/app/core/api.ts` (`ApiService`: `get/post/patch/put/delete<T>(url, body?)`, mesajul de eroare din `{error}`), `web/src/app/core/auth.ts` (`AuthService`: `account = signal<Account|null>`, `load()`, `login()`, `register()`, `logout()`; `authGuard`)
- Create: paginile `intra` (login), `cont-nou`, `parola-uitata`, `parola-noua/:token`, `cont` (nume, telefon, adresă)
- Create: `web/src/styles.css` (temă deschisă, contrast mare, text 18px, butoane 48px, lățime de lucru pe telefon 360px fără scroll orizontal)
- Modify: `src/app.js` (servește `web/dist/browser`, iar orice rută necunoscută non-`/api` → `index.html`), `package.json` (`build`, `dev:web`)

**Interfaces:**
- Consumes: rutele `/api/auth/*` (Task 4), `/api/catalog` (Task 3).
- Produces: `ApiService`, `AuthService`, `authGuard`, `CatalogService` (`catalog = signal<Catalog|null>`, încărcat o dată) — folosite de Task 11–12.

- [ ] **Step 1:** Generează proiectul: `npx @angular/cli@22 new web --zoneless --style=css --routing --ssr=false --skip-git --skip-tests`.
- [ ] **Step 2:** Scrie serviciile și paginile; meniul de sus: „Porumbarul meu”, „Porumbel nou”, „Contul meu”, „Ieși”.
- [ ] **Step 3:** `npm run build` (în `web/`) → fără erori.
- [ ] **Step 4: Verificare în browser** (preview `api` + `web`): cont nou → ajungi în „Porumbarul meu” (gol, cu un buton mare „Adaugă primul porumbel”); ieși; intră cu parola greșită → mesaj în română; parola uitată → mesajul „Dacă există un cont…”, iar linkul din consola serverului deschide pagina de parolă nouă. Pe lățime de telefon (375px) nimic nu iese din ecran.
- [ ] **Step 5:** Commit `feat(web): proiectul și intrarea în cont`.

---

### Task 11: Interfața: porumbarul și fișa porumbelului

**Files:**
- Create: `web/src/app/pages/porumbar/` (lista), `web/src/app/pages/porumbel-form/` (adăugare / editare), `web/src/app/pages/porumbel/` (fișa, cu file: Fișa · Rude · Arbore · Jurnal · Poze)
- Create: `web/src/app/shared/ring-input/` (câmp de inel care arată sub el forma recunoscută: „Recunoscut: RO-26-800546, mascul” sau „Nu pot citi inelul”), `web/src/app/shared/pigeon-picker/` (alegerea părintelui după inel)

**Interfaces:**
- Consumes: `/api/pigeons*`, `/api/pigeons/lookup`, `PUT …/parents`, `/family`, `/journal`, `/photos` (Task 6, 7, 9); `CatalogService` (Task 10).
- Comportament cerut de utilizator (spec 5a): în `pigeon-picker`, crescătorul scrie inelul tatălui → apare **cardul de istoric** (fișa scurtă, părinții, câți pui are și lista lor); la fel pentru mamă; când sunt aleși amândoi, se afișează consangvinizarea puilor lor (`/api/pairs/coi`) pe înțelesul tuturor („Puii acestei perechi ar avea consangvinizare 12,5% – strămoș comun: RO-09-898910”); abia apoi „Confirmă părinții”. Dacă inelul nu e găsit: „Nu e în porumbarul tău. Îl adaugi ca strămoș?” → formular scurt (inel, sex, nume, culoare, text) care creează un strămoș extern și îl alege.
- Lista: căutare după inel sau nume, filtre stare / sex / an, câte 50 pe pagină; pe telefon, carduri în loc de tabel.
- Formularul: secțiuni Identitate · Rasă și linii · Culoare (listă + bifa „pene albe” + text liber) · Stare · Evaluare (note 1–5 cu butoane mari, plus cele trei texte) · Text pentru pedigree.
- Ce s-a scris în formular se păstrează local (`localStorage`, în try/catch) până la salvare, ca o cădere scurtă a internetului să nu piardă nimic (spec 11a); la eroare de rețea: „Nu s-a putut salva. Verifică internetul și apasă din nou Salvează.”

- [ ] **Step 1:** Implementează paginile.
- [ ] **Step 2:** `npm run build` → fără erori.
- [ ] **Step 3: Verificare în browser:** adaugă `RO-26-800546 L` (sexul se completează singur); adaugă părinții prin `pigeon-picker` scriind `RO-24-199163` (nu există → îl adaugi ca strămoș) și `RO-24-671653`; deschizi din nou picker-ul pentru alt pui cu același tată → cardul arată „1 pui”; încerci să pui un pui ca tată al tatălui său → mesajul de eroare apare lângă câmp; adaugi o intrare de jurnal și o poză de pe telefon (375px). Captură de ecran ca dovadă.
- [ ] **Step 4:** Commit `feat(web): porumbarul, fișa și alegerea părinților`.

---

### Task 12: Interfața: arborele

**Files:**
- Create: `web/src/app/pages/porumbel/arbore/` (fila Arbore)

**Interfaces:**
- Consumes: `GET /api/pigeons/:id/tree`, `GET /api/pigeons/:id/coi` (Task 7).
- Comportament: arbore orizontal (rădăcina în stânga, ca pe pedigree-urile cunoscute), 4 generații implicit, butoane „mai multe / mai puține generații” (până la 10); fiecare căsuță: inel, sex, nume, culoare; strămoșii repetați au aceeași culoare de fundal (o paletă de 6 culori deschise, cu contrast bun pentru text) și o legendă „Apare de 3 ori”; clic pe o căsuță → fișa acelui porumbel / strămoș; căsuță goală → „Adaugă părintele” (deschide `pigeon-picker`). Sus: consangvinizarea porumbelului și strămoșii comuni. Pe telefon: derulare orizontală doar în interiorul arborelui (pagina nu derulează pe orizontală).

- [ ] **Step 1:** Implementează.
- [ ] **Step 2:** `npm run build` → fără erori.
- [ ] **Step 3: Verificare în browser** pe datele din Task 8 (rulează un script de seed local — `scripts/seed-exemplu.mjs`, care refolosește `test/fixtures/pedigree-foto.js` pe baza de dezvoltare, într-un cont `exemplu@porumbar.local`): `1954746/04 NL` apare colorat la fel în 3 locuri, consangvinizarea apare sus; pe 375px arborele se derulează doar în cadrul lui. Captură de ecran.
- [ ] **Step 4:** Commit `feat(web): arborele genealogic`.

---

### Task 13: Încheierea planului

- [ ] **Step 1:** `npm test` → toate testele trec (cu numărul lor în raport).
- [ ] **Step 2:** `npm run build` și `npm start` → aplicația servită de Express pe 3100 merge cap-coadă (cont, porumbel, părinți, arbore).
- [ ] **Step 3:** `README.md`: cum se pornește (db:setup, dev, dev:web, test), ce face Planul 1.
- [ ] **Step 4:** Merge `feat/fundatia` în `main` (`git switch main && git merge --no-ff feat/fundatia`). Fără push.
