# Porumbar: harta proiectului și regulile

Evidența porumbeilor voiajori pentru columbofili: fișa porumbelului, pedigree pe 5 generații (tipărit A4, PDF, link public
și cod QR), arbore / rețea de rude / consangvinizare, perechi și pui, rezultate, vânzare prin copie, citirea pedigree-ului
din poză. Pentru cine și cum trebuie să arate: `PRODUCT.md`. Cum se pornește local: `README.md`.

**Acest fișier se ține la zi** la fiecare schimbare de structură, regulă sau legătură (o funcție nouă, o limbă nouă, o
schimbare la publicare). Detaliile fiecărei funcții sunt în `docs/superpowers/specs/` (un design pe funcție) și
`docs/superpowers/plans/`.

## Oamenii și mediile

- Crescători români, mulți vârstnici, mult pe telefon: text de bază 18px, butoane de cel puțin 48px, pași puțini,
  confirmare la orice schimbare sau ștergere.
- **Vânzătorul** = un singur admin, contul cu `ADMIN_EMAIL` (se face la pornire din `ADMIN_EMAIL` + `ADMIN_PASSWORD`).
  Activează abonamentele (150 lei/an, plătite în afara aplicației) și pune datele de pe fișă. Citirile pedigree-urilor
  din poze sunt incluse în abonament: 100 pe an de abonament, cel mult 20 pe zi, dar în primele 14 zile ale fiecărui
  abonament (cât ține dreptul de retragere) doar 3, `PEDIGREE_READS_FIRST_DAYS` (`src/reads.js`); vânzătorul poate da
  citiri în plus și vede în consolă, la fiecare crescător, câte a folosit și cât au costat (în dolari). Fără credit. Fără abonament contul e doar citire; datele nu se pierd.
- **Local = dezvoltare și test** (date de probă, conturi de test). **Railway = producție, cu date reale.**

## Structura

O singură aplicație: un proces Node care servește și API-ul, și interfața. Nu există servicii separate pentru UI și backend.

```
src/            serverul (Node 24, ESM, Express 5, PostgreSQL prin `pg`)
  server.js       pornirea; app.js = rutele, CSP strict ('self'), servește web/dist și /i18n
  db.js           conexiunea + migrările (o listă doar adăugată la final; SCHEMA_VERSION = lungimea ei)
  routes/         API-ul /api/*: auth, pigeons, family, journal, results, breeding, views, pedigrees, public, transfers, admin
  accounts.js     sesiuni (cookie `porumbar_session`), requireAccount / optionalAccount, publicAccount
  i18n.js         dicționarele, t(), limba cererii (vezi „Limbi”)
  http.js         HttpError(status, cheie, valori), validări (text, realDate, oneOf), rateLimit, errorHandler
  rings.js        citirea inelelor scrise în orice formă (RO-26-800546 L, 412084/15 RO, HU-2023-29-14530 H, …); inelele
                  maghiare cer numărul organizatorului (2 cifre sau litera seriei; o cifră scrisă de mână = 04); H / T
                  sau ♂ / ♀ = sexul; spaniole și „159989 019-ESP” (Serie + Año). Aceleași reguli, simplificate, în
                  web/src/app/shared/ring-input.ts (previewRing): se schimbă amândouă deodată
  catalog.js      listele: rase, culori (+ sinonime pentru citire, și maghiare), ochi, stări, criterii, jurnal, concursuri
  pedigree-format.js / pedigree-import.js / pedigree-reader.js   formatul deschis „porumbar-pedigree” v1, importul, citirea din poză (Claude)
  genealogy.js, bloodlines.js, color-genetics.js, value.js, breeding.js, results.js, subscriptions.js, mail.js
web/            interfața: Angular 22, componente standalone, semnale, zoneless; build în web/dist (îl servește Express)
  src/app/core/   api (interceptor, errorMessage), auth, catalog, i18n, confirm, share-pdf, models
  src/app/pages/  panou, porumbar, porumbel, porumbel-form, retea (arbore, evantai, linii, rețea), perechi, vanzari,
                  scaneaza, pedigree-hartie, public (/p/:token), auth (intră, cont, parole), admin (consola /vanzator)
  src/app/shared/ fișa A4 (pedigree-page, pedigree-sheet), qr-code, ring-input, pigeon-picker, lang-switch, icon …
i18n/           dicționarele de limbi, citite de server și de interfață (vezi „Limbi”)
test/           testele (node:test) pe un PostgreSQL temporar: `npm test`; un fișier: `node scripts/test.mjs test/x.test.js`
scripts/        dev-db (Postgres de dezvoltare în data/pg, port 5433), db-setup, seed-exemplu (cont demo, doar local), test
docs/           specs + plans (superpowers), design/, exemple/ (anonimizate), cercetare/ (piața din Ungaria, glosarul maghiar)
data/           ignorat de git și de Docker: Postgres local, poze private de import
```

Separarea UI / backend: interfața vorbește cu serverul doar prin `/api/*` (JSON, aceeași origine, cookie de sesiune;
cererile care schimbă date trebuie să fie JSON și de pe același site). Formatul pedigree-ului e „porumbar-pedigree” v1
(`src/pedigree-format.js`), același pentru link public, QR, vânzare și preluare.

## Limbi (i18n)

- Dicționarele: `i18n/languages.json` (lista: cod, nume, locale, `public`), `i18n/ro.json` (sursa, cu `sens` pentru
  traducători: `{ "text": "...", "sens": "..." }`), `i18n/hu.json` (aceleași chei, doar textul). Plural: obiect cu
  formele `Intl.PluralRules` (`one` / `few` / `other`), apelat cu `{ count: n }`. Valori: `{nume}`.
- Serverul: `t(lang, cheie, valori)`; în cereri `tr(cheie)` (limba cererii prin AsyncLocalStorage); erorile se aruncă cu
  chei (`badRequest('eroare.x', { ... })`), iar numele câmpurilor sunt și ele chei (`text(v, 'camp.nume')`).
  Limba cererii: a contului; fără cont `Accept-Language`, doar dacă limba e publică; altfel română.
- Interfața (`web/src/app/core/i18n.ts`): pipe-ul `t` în șabloane, `t()` / `tIn(lang, …)` în cod; `ro.json` e în pachet,
  celelalte se aduc de la `GET /i18n/<limba>.json`. Datele și numerele: `formatDay`, `formatDate`, `formatNumber`,
  `formatMoney` (nu `toLocale*('ro-RO')`).
- **Regulă:** orice text nou pe care îl vede crescătorul intră în `ro.json` **și** în `hu.json`, în același commit.
  Testul `test/i18n.test.js` cere aceleași chei în toate limbile; `test/texte-ramase.test.js` pică dacă rămâne text cu
  diacritice românești în cod (excepții: comentarii, consola vânzătorului, rânduri marcate `// i18n: ro`).
- Consola vânzătorului (`/vanzator`, `src/routes/admin.js`) rămâne în română. Mailul către vânzător e în română; mailurile
  către crescător sunt în limba contului.
- Limba contului (`accounts.lang`) o pune vânzătorul (Crescător nou / Date pe fișă). O limbă **nepublică** („în probă”,
  de ex. maghiara până o verifică un crescător maghiar) o primește doar cine i-o dă vânzătorul; omul poate trece singur
  doar spre o limbă publică. Fișa tipărită și PDF-ul pot ieși și în altă limbă (alegerea de pe pagina de tipărire).
- Termenii maghiari ai crescătorilor (culori, H / T pentru sex, „SZÁRMAZÁSI LAP”): `docs/cercetare/termeni-maghiari.md`.
- O limbă nouă: un fișier `i18n/<cod>.json` cu toate cheile + un rând în `languages.json` (cu `public: false` până e verificată).

## Situl de prezentare

Situl (www.porumbar.ro, o pagină) e **alt proiect**, în `C:\dev\porumbar-site` (repo privat `eduardjena/porumbar-site`):
`public/` e ce se urcă, butoanele duc în aplicație printr-o singură constantă `APP_URL`. Nu se pune niciodată în acest repo.
Când se schimbă adresa aplicației (domeniu propriu), se schimbă `APP_URL` acolo și `PUBLIC_BASE_URL` pe Railway.

## Publicarea (Railway)

- Proiectul Railway „porumbar” (Soopra Projects, UE): serviciul `porumbar` (Dockerfile: construiește interfața, apoi
  pornește serverul) + `Postgres`. Adresa: https://porumbar-production.up.railway.app.
- Push pe `main` **nu** publică singur. Publicarea: `git archive main | tar -x -C <folder temporar>`, apoi
  `railway up <folder> --path-as-root --service porumbar --detach`; urmărești `railway deployment list --service porumbar`;
  verifici că `main-*.js` de pe site e același cu cel din build-ul local și că `/api/health` răspunde 200.
- Variabilele secrete (`ADMIN_PASSWORD`, `ANTHROPIC_API_KEY`, SMTP) le pune vânzătorul în Railway, niciodată prin chat.
- Citirea din poze: cheia în `ANTHROPIC_API_KEY` (cheie API de pe console.anthropic.com, plătită separat de abonamentul
  Claude; cheia trebuie făcută într-un spațiu de lucru anume, de ex. „Default”, nu pentru toate). Modelul:
  `PEDIGREE_MODEL` (implicit `claude-sonnet-5-5`, ~2,5–3 cenți pe citire; Haiku a fost încercat și greșea cam o dată din
  6, vezi `docs/superpowers/specs/2026-11-18-citire-ieftina-design.md`); plafon pe an pe crescător: `PEDIGREE_BUDGET_USD`
  (implicit 3 $). Prețurile modelelor sunt în `src/pedigree-reader.js`; `PEDIGREE_PRICE_INPUT` / `PEDIGREE_PRICE_OUTPUT`
  le înlocuiesc pe ale modelului ales.
  Altă firmă decât Anthropic = schimbare de cod, doar în `src/pedigree-reader.js` (funcția `claudeModel`).

## Regulile vânzătorului (de respectat mereu)

- Fiecare funcție pe branch-ul ei. **Înainte de orice merge în `main`, push al lui `main` sau publicare pe Railway:
  întrebi.** O aprobare ține doar pentru acea publicare.
- Bază de date: PostgreSQL (și local), niciodată SQLite sau o bază emulată.
- Separare totală între conturi: nimeni nu vede datele altuia; datele trec doar prin copie (link public / QR, „Preia”,
  vânzare).
- Fără date personale reale ale crescătorilor în repo (repo-ul `eduardjena/porumbar` e public). Pozele primite pentru
  import nu ajung pe Railway sau GitHub (stau în `data/`, ignorat).
- Parola o alege doar omul; vânzătorul nu pune și nu vede parola nimănui.
- Datele demo (`npm run seed:exemplu`) doar local, niciodată pe Railway.
- Numele, numele de pe fișă, telefonul, adresa (și CNP / datele firmei) le pune doar vânzătorul; crescătorul alege doar ce
  apare pe fișă și pe link.
- Pozele porumbeilor nu se păstrează pe server; poza unui pedigree se citește și se aruncă.
- Vederea 3D a arborelui a fost scoasă la cerere: nu se readuce.
