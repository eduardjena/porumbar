# Limbi străine (maghiara) – plan de lucru

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toate textele pe care le vede crescătorul ies dintr-un dicționar pe limbă (`i18n/ro.json`, `i18n/hu.json`), iar maghiara se poate da conturilor alese de vânzător.

**Architecture:** Dicționarele stau în `i18n/` la rădăcină, citite de server (`src/i18n.js`) și de interfață (`ro.json` inclus în pachet, celelalte aduse de la `GET /i18n/<limba>.json`). Serverul traduce erorile, catalogul și mailurile în limba cererii (contul, altfel `Accept-Language` dacă limba e publică, altfel română). Interfața are un serviciu `I18n` cu semnal, un pipe `t` și formatare de date/numere după limbă.

**Tech Stack:** Node 24 ESM, Express 5, PostgreSQL (`pg`), Angular 22 standalone/signals/zoneless, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-18-limbi-straine-design.md` (glosar: `docs/cercetare/termeni-maghiari.md`)

## Global Constraints

- Branch `feat/limbi-straine`; un commit la fiecare task; fără merge/push/deploy fără întrebarea vânzătorului.
- Baza de date PostgreSQL; migrări doar adăugate la sfârșitul listei din `src/db.js` (următoarea: 18).
- Textele românești rămân **identice** cu cele de azi (testele existente care verifică mesaje românești nu se schimbă).
- Fiecare cheie nouă intră în același commit în `ro.json` **și** `hu.json` (testul de consistență din Task 1 o cere).
- Traducerea maghiară urmează glosarul: `SZÁRMAZÁSI LAP`, hím / tojó (H / T), `kék kovácsolt`, `sötét kovácsolt`, `vörös`, `fakó`, `deres`, `tarka`, `ezüst`…; rövidtáv / középtáv / hosszútáv / maraton cu limitele românești în km.
- Lista limbilor: `ro` (Română, `ro-RO`, publică), `hu` (Magyar, `hu-HU`, **nepublică**).
- Consola vânzătorului (`/vanzator`, `consola.ts`, `identity-fields.ts`) rămâne în română; primește doar câmpul „Limba”.
- CSP rămâne `'self'`; fără dependențe noi.
- Text de bază 18px, butoane ≥ 48px (butonul RO / HU inclus).

## Review Focus

1. Un crescător cu cont `hu` greșește un inel: mesajul vine în maghiară (nu în română, nu cheia) → test în Task 3.
2. Telefon în maghiară, fără cont, cât timp `hu` e nepublică: totul în română (`Accept-Language: hu` ignorat) → test în Task 2.
3. Crescătorul `hu` trece în română și încearcă iar maghiara: refuzat, cu mesaj; vânzătorul i-o poate pune iar → test în Task 2.
4. Linkuri publice și preluări făcute înainte (pedigree v1 fără `colorCode`): culoarea apare ca text, preluarea merge → test în Task 5.
5. Cheie lipsă în `hu.json` la runtime (fișier editat de mână): se vede textul românesc, nu cheia sau gol → test în Task 1.

---

### Task 1: Dicționarele și `t()` pe server

**Files:**
- Create: `i18n/languages.json`, `i18n/ro.json`, `i18n/hu.json`, `src/i18n.js`, `test/i18n.test.js`
- Modify: `src/app.js` (ruta `GET /i18n/:lang.json`), `Dockerfile` (copiază `i18n/` în ambele etape: `COPY i18n/ /app/i18n/` în etapa web, `COPY i18n ./i18n` în etapa server)

**Interfaces:**
- Produces:
  - `i18n/languages.json`: `[{ "code": "ro", "name": "Română", "locale": "ro-RO", "public": true }, { "code": "hu", "name": "Magyar", "locale": "hu-HU", "public": false }]`
  - Format `ro.json`: cheie → `"text"` sau `{ "text": "...", "sens": "..." }`; plural: `{ "one": "...", "few": "...", "other": "..." }` (opțional cu `"sens"`). Format `hu.json`: cheie → `"text"` sau obiect plural fără `sens`.
  - `src/i18n.js`: `LANGS` (lista din languages.json), `isLang(code): boolean`, `isPublicLang(code): boolean`, `localeOf(lang): string`, `t(lang: string, key: string, vars?: object): string` (plural când `vars.count` e număr, ales cu `Intl.PluralRules(localeOf(lang))`; `{nume}` înlocuit din `vars`; cheie lipsă în limbă → română; cheie lipsă și în română → cheia însăși), `flatDictionary(lang): Record<string, string | object>` (fără `sens`).
  - `GET /i18n/:lang.json` → `flatDictionary(lang)`, 404 pentru limbă necunoscută, `Cache-Control: no-cache`.

- [ ] **Step 1: Write the failing tests** (`test/i18n.test.js`, chei de probă puse în ambele fișiere sub grupa `test.`)
  - `t('ro', 'test.salut', { nume: 'Ion' })` === `'Bună, Ion!'`; `t('hu', 'test.salut', { nume: 'Ion' })` === `'Szia, Ion!'`
  - `t('ro', 'test.porumbei', { count: 1 })` === `'1 porumbel'`; `{count: 2}` → `'2 porumbei'`; `{count: 20}` → `'20 de porumbei'`; `t('hu', 'test.porumbei', { count: 20 })` === `'20 galamb'`
  - cheie doar în ro (scrisă în test în dicționarul încărcat, prin `__setForTest(lang, key, value)` exportat doar pentru teste) → `t('hu', k)` întoarce textul românesc; cheie inexistentă → cheia.
  - consistență: pentru fiecare limbă din `LANGS`, mulțimea cheilor = cea din `ro.json`; pentru fiecare cheie, mulțimea `{...}` din fiecare formă e aceeași ca în română; nicio valoare goală.
  - `GET /i18n/hu.json` → 200, `data['test.salut'] === 'Szia, {nume}!'`; `GET /i18n/ro.json` → valorile fără `sens`; `GET /i18n/xx.json` → 404.
- [ ] **Step 2:** `node scripts/test.mjs test/i18n.test.js` → FAIL (modulul lipsește).
- [ ] **Step 3:** Implementează `src/i18n.js` (citește fișierele o dată, la import, cu `readFileSync` relativ la `import.meta.url`), ruta din `src/app.js` (înainte de fallback-ul spre `index.html`), Dockerfile.
- [ ] **Step 4:** Același test → PASS; `npm test` → tot verde.
- [ ] **Step 5:** Commit „Limbi: dicționarele ro/hu și t() pe server”.

### Task 2: Limba contului și limba cererii

**Files:**
- Modify: `src/db.js` (migrarea 18), `src/accounts.js` (`publicAccount`, `requireAccount`), `src/routes/auth.js` (`/register`, `PATCH /me`), `src/routes/admin.js` (`identityOf`, `IDENTITY_SQL`, `row()`), `src/app.js` (middleware de limbă), `test/helpers/accounts.js`
- Test: `test/limba.test.js`

**Interfaces:**
- Consumes: `isLang`, `isPublicLang` (Task 1).
- Produces:
  - Migrarea 18: `ALTER TABLE accounts ADD COLUMN lang TEXT NOT NULL DEFAULT 'ro';` (fără CHECK în SQL: lista de limbi stă în cod).
  - `publicAccount(a).lang`; `row().lang` în consolă.
  - `req.lang`: setat de un middleware pus înaintea rutelor (`Accept-Language`: primul cod de 2 litere care e limbă publică; altfel `'ro'`), suprascris de `requireAccount` cu `account.lang`.
  - `POST /register` acceptă `lang` opțional: doar limbă publică, altfel 400. `PATCH /me` acceptă `lang`: permis dacă e publică sau e egală cu limba actuală a contului; altfel 403 (mesaj: limba o pune vânzătorul). Adminul poate pune orice limbă cunoscută.
  - Admin: `POST /accounts` și `PATCH /accounts/:id/identity` acceptă `lang` (orice limbă cunoscută, 400 altfel); lipsă la identity → rămâne cea de acum.
  - `test/helpers/accounts.js`: `setLang(call, adminCookie, accountId, lang)`.

- [ ] **Step 1: Write the failing tests** (`test/limba.test.js`)
  - cont nou → `me.lang === 'ro'`.
  - adminul pune `hu` prin identity → `me.lang === 'hu'`; `row().lang === 'hu'` în `GET /api/admin/accounts/:id`.
  - crescătorul `hu` face `PATCH /me {lang:'ro'}` → 200; apoi `{lang:'hu'}` → 403.
  - crescător `ro` face `PATCH /me {lang:'hu'}` → 403; `{lang:'xx'}` → 400.
  - `/register` cu `lang:'hu'` → 400 (nepublică); fără `lang` → `ro`.
  - fără cont, `Accept-Language: hu-HU,hu;q=0.9` la `POST /api/auth/login` cu date greșite → mesajul românesc de azi (hu nepublică).
- [ ] **Step 2:** `node scripts/test.mjs test/limba.test.js` → FAIL.
- [ ] **Step 3:** Implementează (migrarea, coloana în SELECT-ul din `requireAccount`, câmpurile de mai sus).
- [ ] **Step 4:** PASS; `npm test` verde.
- [ ] **Step 5:** Commit „Limbi: limba contului, aleasă de vânzător; limba cererii”.

### Task 3: Mesajele serverului în limba cererii, plus paza împotriva textelor uitate

**Files:**
- Modify: `src/http.js` (`HttpError`, `badRequest`, `text`, `oneOf`, `rateLimit`, `errorHandler`), toate fișierele din `src/` care aruncă `HttpError`/`badRequest` sau trimit text omului (`src/routes/*.js`, `src/accounts.js`, `src/subscriptions.js`, `src/pigeons.js`, `src/breeding.js`, `src/results.js`, `src/pedigree-import.js`, `src/genealogy.js`, `src/bloodlines.js`, `src/value.js`, `src/color-genetics.js`, `src/mail.js` + mailurile din `src/routes/auth.js` și `src/routes/admin.js`), `i18n/ro.json`, `i18n/hu.json`
- Create: `test/texte-ramase.test.js`
- Test: `test/limba.test.js` (adaugă), restul testelor existente neschimbate

**Interfaces:**
- Consumes: `t`, `req.lang`.
- Produces:
  - `new HttpError(status, key, vars?, code?)`; `badRequest(key, vars?)`; `err.key`, `err.vars`; `errorHandler` răspunde `{ error: t(req.lang ?? 'ro', err.key, err.vars) }` (codul `code` rămâne cum e).
  - `text(value, fieldKey, opts)` și `oneOf(value, allowed, fieldKey)`: `fieldKey` e o cheie (`camp.nume`), tradusă în mesaj.
  - Mesajele fixe din `errorHandler`/`rateLimit` devin chei `eroare.*`.
  - Textele care se salvează în baza de date (de ex. „Preluat de la X pe data”) se scriu în limba cererii din momentul creării.
  - Mailul de parolă nouă și cel de cont făcut de vânzător: în limba contului. Mailul către vânzător („Cont nou în Porumbar”) rămâne în română.
  - `test/texte-ramase.test.js`: caută în `src/**/*.js` și `web/src/app/**/*.ts` rânduri cu `[ăâîșțĂÂÎȘȚ]` după ce scoate comentariile (rândurile care încep cu `//`, `*`, `/*` și partea `\s//.*$`). Două liste în test: `EXCEPTII` (fișier → motiv; de pornire: `src/db.js` – SQL și comentarii; `src/catalog.js` – sinonimele de citire; `src/pedigree-reader.js` – promptul; `src/boot.js` și `src/config.js` – jurnalul serverului; `web/src/app/pages/admin/consola.ts`, `web/src/app/pages/admin/identity-fields.ts` – consola rămâne în română) și `DE_MUTAT` (toate fișierele din `web/src/app` care au azi text; fiecare task de interfață le scoate pe ale lui). Testul eșuează pentru orice fișier cu text care nu e în niciuna dintre liste și pentru orice fișier din `DE_MUTAT` care nu mai are text (lista trebuie micșorată).

- [ ] **Step 1: Write the failing tests**
  - `test/texte-ramase.test.js` cu `DE_MUTAT` = doar fișierele `web/` și `EXCEPTII` de mai sus → FAIL pentru fișierele `src/` care au încă text.
  - în `test/limba.test.js`: contul `hu` creează un porumbel cu inelul `'xyz'` → `400` și `error` egal cu `t('hu', <cheia mesajului de inel invalid>)` (nu românesc); contul `ro` → mesajul românesc de azi, neschimbat.
  - `PATCH /me` cu `name` de la un cont `hu` → 403 cu textul maghiar.
- [ ] **Step 2:** `node scripts/test.mjs test/texte-ramase.test.js test/limba.test.js` → FAIL.
- [ ] **Step 3:** Mută mesajele în dicționar (ro identic cu azi, hu după glosar), fișier cu fișier.
- [ ] **Step 4:** Testele de mai sus → PASS; `npm test` → tot verde, inclusiv testele vechi cu mesaje românești.
- [ ] **Step 5:** Commit „Limbi: mesajele serverului și mailurile în limba omului; paza pentru textele uitate”.

### Task 4: Catalogul, culorile maghiare și pedigree-ul cu cod de culoare

**Files:**
- Modify: `src/catalog.js` (etichete din dicționar, `publicCatalog(lang)`, sinonime maghiare), `src/app.js` (`/api/catalog` cu `req.lang`), `src/pedigree-format.js` (`colorCode`), `src/pedigree-import.js` (`toImportNode` preferă `colorCode`), `src/pedigree-reader.js` (nota în limba contului; promptul spune că fișele pot fi în maghiară), `i18n/*.json`
- Test: `test/catalog.test.js`, `test/public.test.js` (adaugă)

**Interfaces:**
- Consumes: `t`, `req.lang`.
- Produces:
  - Chei `catalog.rasa.<code>`, `catalog.culoare.<code>`, `catalog.ochi.<code>`, `catalog.stare.<code>`, `catalog.evaluare.<code>`, `catalog.jurnal.<code>`, `catalog.concurs.<code>`; `publicCatalog(lang)` le folosește; etichetele românești rămân cele de azi.
  - `COLORS[].synonyms` primește termenii și abrevierile maghiare din glosar, scrise fără accente (cum le compară `fold()`): albastru: `kek`; solzat: `kek kovacsolt`, `k kov`, `kk`, `kek kockas`; solzat-inchis: `sotet kovacsolt`, `skt`; rosu: `voros`, `fako`, `vorosfako`; rosu-brocat: `voros kovacsolt`, `vk`; tarcat: `deres`; baltat: `tarka`; argintiu: `ezust`, `kekfako`; negru: `fekete`; alb: `feher`; galbui: `sarga`. Termenii pe care glosarul îi marchează „presupunere” nu se adaugă; nici abrevierile de o literă.
  - Pedigree v1: fiecare nod are, pe lângă `color` (text, în română ca azi), `colorCode` (opțional). Afișarea folosește `colorCode` dacă există.

- [ ] **Step 1: Write the failing tests**
  - `matchColor('kék kovácsolt').code === 'solzat'`; `'sötét kovácsolt'` → `'solzat-inchis'`; `'vörös kovácsolt'` → `'rosu-brocat'`; `'deres'` → `'tarcat'`; `'tarka'` → `'baltat'`; `'Kk'` → `'solzat'`; testele vechi de culori rămân verzi.
  - `GET /api/catalog` cu contul `hu`: culoarea `solzat` are eticheta `'Kék kovácsolt'`; fără cont → `'Solzat'`.
  - `GET /api/pigeons/:id/pedigree` → nodul rădăcină are `colorCode` când porumbelul are culoare din listă.
  - preluare dintr-un v1 fără `colorCode` (fixture vechi, `PEDIGREE_FOTO`) → merge, culoarea recunoscută din text ca azi.
- [ ] **Step 2:** `node scripts/test.mjs test/catalog.test.js test/public.test.js` → FAIL.
- [ ] **Step 3:** Implementează.
- [ ] **Step 4:** PASS; `npm test` verde.
- [ ] **Step 5:** Commit „Limbi: catalogul tradus, culorile maghiare la citire, codul culorii pe pedigree”.

### Task 5: Fundația în interfață

**Files:**
- Create: `web/src/app/core/i18n.ts` (serviciul `I18n`, pipe-ul `TPipe` cu numele `t`), `web/src/app/shared/lang-switch.ts`
- Modify: `web/src/app/app.config.ts` (încarcă limba înainte de prima afișare), `web/src/app/core/api.ts` (interceptorul pune `Accept-Language`; `errorMessage` cu chei), `web/src/app/core/auth.ts` (după login/logout schimbă limba după cont), `web/src/app/core/catalog.ts` (`sexLabel`, `percent` prin `I18n`; catalogul se reîncarcă la schimbarea limbii), `web/tsconfig.app.json` (`resolveJsonModule: true`), `web/proxy.conf.json` (`/i18n` → server)

**Interfaces:**
- Consumes: `GET /i18n/:lang.json`, `account.lang`, `i18n/languages.json`, `i18n/ro.json` (importat static: `import ro from '../../../../i18n/ro.json'`; dacă builderul refuză fișiere din afara `web/`, se copiază la build cu un pas `prebuild` – *ruling* în ledger).
- Produces:
  - `I18n`: `lang: Signal<string>`, `t(key: string, vars?: Record<string, unknown>): string`, `use(lang: string): Promise<void>`, `publicLangs(): Lang[]`, `date(d: string | Date): string`, `dateTime(d): string`, `number(n: number, digits?: number): string`, `money(n: number): string` (format de azi: `x,xx $` în ro).
  - Pipe `t`: `{{ 'panou.titlu' | t }}`, `{{ 'x' | t: { count: n } }}`; impur, ca să urmeze semnalul limbii.
  - Fără cont: limba = `localStorage['porumbar.limba']` dacă e publică, altfel prima limbă din `navigator.languages` care e publică, altfel `ro` (accesul la `localStorage` în try/catch).
  - `<app-lang-switch>`: butoane cu numele limbilor publice, apare doar dacă sunt ≥ 2 publice (deci azi nu apare); ține alegerea în `localStorage`.
  - Toate `toLocale*('ro-RO')` din `web/src/app` trec prin `I18n` (`date`, `dateTime`, `number`, `money`).

- [ ] **Step 1:** Mută `app.ts`, `core/*.ts` (fără `models.ts` dacă nu are text văzut de om) din `DE_MUTAT`; `node scripts/test.mjs test/texte-ramase.test.js` → FAIL pentru ele.
- [ ] **Step 2:** Implementează serviciul, pipe-ul, interceptorul, butonul; mută textele din aceste fișiere (ro identic, hu din glosar).
- [ ] **Step 3:** `node scripts/test.mjs test/texte-ramase.test.js` → PASS; `npm --prefix web run build` → fără erori; `npm test` verde.
- [ ] **Step 4:** În browser (preview „porumbar”): contul demo în ro arată ca înainte; după ce adminul îi pune `hu`, meniul și titlurile apar în maghiară fără reîncărcare; consola fără erori; datele în format `2026. 11. 18.`.
- [ ] **Step 5:** Commit „Limbi: fundația în interfață (I18n, pipe t, formatare după limbă)”.

### Task 6: Ecranele fără cont, Cont și shell-ul

**Files:**
- Modify: `web/src/app/pages/auth/*.ts` (intră, cont-nou, parola-uitata, parola-noua, cont), `web/src/app/app.routes.ts` (titlurile), `web/src/app/shared/{breadcrumbs,password-field,icon,view-toggle,share-button,qr-code,pigeon-chip}.ts`, `web/src/app/core/confirm.ts`, `i18n/*.json`

**Interfaces:**
- Consumes: `I18n`, `TPipe`, `<app-lang-switch>`, `PATCH /me {lang}`.
- Produces: în Cont, alegerea limbii apare doar când contul are de ales (limbile publice + limba lui); la trecerea dintr-o limbă nepublică în alta: confirmare cu textul „După ce treci în română, maghiara ți-o poate pune înapoi doar vânzătorul.” (cheie `cont.limba_avertisment`). La înregistrare se trimite `lang` = limba de pe ecran.

- [ ] **Step 1:** Scoate fișierele de mai sus din `DE_MUTAT` → testul de texte FAIL.
- [ ] **Step 2:** Mută textele; butonul de limbă pe paginile fără cont; alegerea din Cont.
- [ ] **Step 3:** Testul de texte PASS; build fără erori; `npm test` verde.
- [ ] **Step 4:** Browser: paginile fără cont arată ca azi (fără buton, hu nepublică); contul `hu` vede Cont în maghiară, trece în română, primește avertismentul, după care HU nu mai apare.
- [ ] **Step 5:** Commit „Limbi: paginile de intrare, Cont și shell-ul”.

### Task 7: Panou, Porumbarul și fișa porumbelului

**Files:**
- Modify: `web/src/app/pages/panou/*.ts`, `pages/porumbar/porumbar.ts`, `pages/porumbel/*.ts` (porumbel, rezultate, partajare, arbore, vanzare, tiparire), `pages/porumbel-form/porumbel-form.ts`, `shared/{parents-editor,pigeon-picker,ring-input}.ts`, `i18n/*.json`

**Interfaces:**
- Consumes: `I18n`, `TPipe`, catalogul tradus (Task 4).
- Produces: textele acestor ecrane în dicționar; pluralele („N porumbei”) prin `count`.

- [ ] **Step 1:** Scoate fișierele din `DE_MUTAT` → FAIL.
- [ ] **Step 2:** Mută textele.
- [ ] **Step 3:** Testul de texte PASS; build; `npm test` verde.
- [ ] **Step 4:** Browser, contul demo în `hu`: Panoul, lista, fișa unui porumbel cu toate filele, formularul de adăugare; nimic românesc rămas, nicio cheie afișată; în `ro` identic cu înainte.
- [ ] **Step 5:** Commit „Limbi: Panou, Porumbarul, fișa și formularul porumbelului”.

### Task 8: Rețea, perechi, vânzări, scanare, citirea din poză

**Files:**
- Modify: `web/src/app/pages/retea/*.ts`, `pages/perechi/*.ts`, `pages/vanzari/vanzari.ts`, `pages/scaneaza/scaneaza.ts`, `pages/pedigree-hartie/*.ts`, `core/incoming.ts`, `i18n/*.json`

**Interfaces:**
- Consumes: `I18n`, `TPipe`.
- Produces: textele acestor ecrane în dicționar.

- [ ] **Step 1:** Scoate fișierele din `DE_MUTAT` → FAIL.
- [ ] **Step 2:** Mută textele.
- [ ] **Step 3:** Testul de texte PASS; build; `npm test` verde.
- [ ] **Step 4:** Browser în `hu`: Rețea (toate vederile), perechi (inclusiv culorile puilor), vânzări, scanare, pedigree de pe hârtie; în `ro` identic.
- [ ] **Step 5:** Commit „Limbi: Rețea, perechi, vânzări, scanare, pedigree de pe hârtie”.

### Task 9: Fișa tipărită, PDF-ul și pagina publică

**Files:**
- Modify: `web/src/app/shared/pedigree-page.ts`, `shared/pedigree-sheet.ts`, `core/share-pdf.ts`, `pages/porumbel/tiparire.ts`, `pages/public/public-pedigree.ts`, `i18n/*.json`

**Interfaces:**
- Consumes: `I18n.t` cu limbă explicită: adaugă `I18n.tIn(lang: string, key: string, vars?): string` și `I18n.ensure(lang): Promise<void>` (aduce dicționarul fără să schimbe limba ecranului); `colorCode` (Task 4).
- Produces:
  - `PedigreePage` primește intrarea `lang` (implicit limba contului); etichetele, culoarea (din `colorCode`, altfel textul primit) și sexul în acea limbă; titlul în maghiară `SZÁRMAZÁSI LAP`.
  - Pe pagina de tipărire: alegerea „Limba fișei” cu limbile pe care contul le are voie (publice + limba lui); aceeași alegere o folosește PDF-ul de la „Trimite”.
  - Pagina publică `/p/...`: limba vizitatorului (regula de la paginile fără cont), cu `<app-lang-switch>`.

- [ ] **Step 1:** Scoate fișierele din `DE_MUTAT` → FAIL (după acest task `DE_MUTAT` e goală și se șterge din test).
- [ ] **Step 2:** Implementează.
- [ ] **Step 3:** Testul de texte PASS; build; `npm test` verde.
- [ ] **Step 4:** Browser: contul `hu` tipărește fișa în maghiară și, cu alegerea schimbată, în română; PDF-ul de la Trimite urmează alegerea; pagina publică în română (hu nepublică); fișa unui pedigree preluat înainte (fără `colorCode`) arată culoarea.
- [ ] **Step 5:** Commit „Limbi: fișa tipărită, PDF-ul și pagina publică”.

### Task 10: Limba în consola vânzătorului

**Files:**
- Modify: `web/src/app/pages/admin/identity-fields.ts` (câmpul „Limba”: toate limbile cunoscute, cu „(în probă)” lângă cele nepublice), `web/src/app/pages/admin/consola.ts` (afișare în detaliu și în listă dacă nu e `ro`), `IdentityForm`/`identityBody`

**Interfaces:**
- Consumes: `lang` la `POST /api/admin/accounts` și `PATCH /api/admin/accounts/:id/identity` (Task 2).
- Produces: vânzătorul pune limba la „Crescător nou” și la „Date pe fișă”.

- [ ] **Step 1:** Test în `test/limba.test.js`: `POST /api/admin/accounts` cu `lang:'hu'` → contul nou are `lang === 'hu'`. Dacă Task 2 l-a făcut deja verde, pasul RED de aici e verificarea în browser de la Step 4 (câmpul lipsește din consolă).
- [ ] **Step 2:** Implementează câmpul (consola rămâne în română; câmpul trece în `identityBody`).
- [ ] **Step 3:** Build; `npm test` verde.
- [ ] **Step 4:** Browser: vânzătorul pune „Magyar (în probă)” unui cont, crescătorul intră și vede maghiara; vânzătorul îl pune înapoi pe română.
- [ ] **Step 5:** Commit „Limbi: vânzătorul alege limba crescătorului din consolă”.
