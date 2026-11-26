# Pigeonrama (Porumbar): harta proiectului și regulile

Evidența porumbeilor voiajori pentru columbofili: fișa porumbelului, pedigree pe 5 generații (tipărit A4, PDF, link public
și cod QR), arbore / rețea de rude / consangvinizare, perechi și pui, rezultate, vânzare prin copie, citirea pedigree-ului
din poză. Pentru cine și cum trebuie să arate: `PRODUCT.md`. Cum se pornește local: `README.md`.

**Acest fișier se ține la zi** la fiecare schimbare de structură, regulă sau legătură (o funcție nouă, o limbă nouă, o
schimbare la publicare). Detaliile fiecărei funcții sunt în `docs/superpowers/specs/` (un design pe funcție) și
`docs/superpowers/plans/`.

## Numele și sigla

- **Numele afișat: „Pigeonrama”** (din 2026-11-26), peste tot unde îl vede omul: titlul paginii, antetul, manifestul,
  notificările, emailurile, PDF-ul și fișa tipărită, textele din `i18n`. **Numele nu se traduce și nu se schimbă**
  (fără terminații): în maghiară „a Pigeonrama alkalmazásban / alkalmazáshoz / alkalmazást”, „Pigeonrama-fiók”; în
  japoneză „Pigeonramaの…”. Cuvântul obișnuit „porumbar” (efectivul, adăpostul) se traduce: „dúc”, „鳩舎”.
- **„Porumbar” rămâne numele tehnic**: pachetul, repo-ul, baza de date, cookie-ul `porumbar_session`, variabilele de
  mediu, serviciul Railway, formatul „porumbar-pedigree” v1, fișierele și clasele (`porumbar.ts`). Adresa
  publică e www.pigeonrama.com (pe fișa tipărită și în PDF); emailul de contact e contact@pigeonrama.com. Situl e
  găzduit pe DirectAdmin (domains/pigeonrama.com/public_html, Let's Encrypt, https și www forțate). Emailurile aplicației
  pleacă prin serverul găzduirii: `SMTP_HOST=mail.pigeonrama.com`, `SMTP_PORT=465`, `SMTP_USER=contact@pigeonrama.com`,
  `SMTP_PASS` (o pune omul pe Railway, exact cum e; `SMTP_URL` într-un rând merge și el); expeditorul e `SMTP_USER`
  dacă nu e `MAIL_FROM`. SPF și DKIM le pune găzduirea. Cuvântul obișnuit „porumbar” (adăpostul) rămâne în texte.
- **Sigla** (copiată din modelul primit, `docs/design/sigla/model.png`): cercul roșu `#D92132`, porumbelul
  albastru-închis `#263343` cu dunga aripii crem `#F7F8F3`; textul „PIGEONRAMA” în același albastru. Vectorial,
  urmărit din model (cercul potrivit exact, porumbelul, dunga și literele urmărite pe contur):
  `python docs/design/sigla/urmareste.py docs/design/sigla/model.png sigla.json`, apoi
  `python docs/design/sigla/scrie-svg.py sigla.json .` scrie `web/public/icon.svg` (fără fundal: tab, antet, fișă),
  `web/public/icon-maskable.svg` (fundal crem, iconița de pe telefon) și `docs/design/sigla/pigeonrama*.svg` (sigla
  întreagă, cu fundal și transparentă). PNG-urile (telefoanele nu arată SVG în notificări și pe ecranul iPhone-ului):
  `node docs/design/sigla/fa-png.mjs` (cu Edge) scrie `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` și
  `badge-96.png` (silueta albă din `docs/design/sigla/badge.svg`, pentru bara telefonului).
- **Culorile** aplicației și ale site-ului sunt ale siglei (din 2026-11-26, în locul paletei „Pământ”): fundal crem `#f7f8f3`,
  text `#263343`, acțiuni roșu `#d92132` (apăsat `#a8141f`), gri-uri reci; în `web/src/styles.css` (`:root`) și
  `porumbar-site/public/site.css`. Verdele rămâne doar pentru valoarea porumbeilor, culorile liniilor de sânge rămân.

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
  zones.js        zona orară a contului după limbă (`zone` din languages.json); modul pur, folosit și de interfață
  i18n.js         dicționarele, t(), limba cererii (vezi „Limbi”)
  http.js         HttpError(status, cheie, valori), validări (text, realDate, oneOf), rateLimit, errorHandler
  rings.js        citirea inelelor din toată lumea (modul pur, fără importuri; tipurile în rings.d.ts). Două trepte:
                  regulile vechi (RO-26-800546 L, 412084/15 RO, HU-2023-29-14530 H, DV-08778-24-271, AUS 18-301-1405,
                  „159989 019-ESP” …): aceleași chei și afișări ca înainte (cheile sunt în baza de date;
                  test/rings-compat.test.js), cu o excepție: anul pe 2 cifre egal cu anul curent + 1 e acum 20AA (înainte
                  19AA); apoi parserul pe bucăți, cu emitenții din docs/cercetare/reports/Formatele inelelor de porumbei.md:
                  club (DV, AT, DK, PL, CZ, SK, SI, LT), literă de serie (GB, NEHU, NWHU, SU, WHU, IHU S/N = regiunea,
                  JP, PHA), provincia CN, cod de club liber în orice ordine (AU = SUA, IF, CU = Canada, NPA, ZA, ZW, MX,
                  NZ, KR, VN, TH, Golful), emitenți simpli (BE, NL, FR, PT, IT, CH, LU, HR, BG, TW + CTRPA…, NIPPON,
                  HKPA, asociațiile australiene, AUST …). AUS = Austria; PL-DE = Derby; V / W după DV = sexul; H după un
                  inel englezesc / american / australian = hen, la ceilalți = hím; anul pe 2 cifre ≤ anul curent + 1 →
                  20AA. Partea din mijloc stă în `club`; DK se afișează cu anul primul (ca înainte), LT cu clubul primul.
                  Numărul cu lățime fixă la familiile noi își păstrează la afișare zerourile (CN-26-15-0443185), cheia nu.
                  Japonia se afișează ca pe inel, cu spațiu după emitent: JPN 25-AB-01234 (cheia JP|…), NIPPON 2009-123456
                  (anul întreg, cheia NIPPON|…); orice afișare se citește înapoi la aceeași cheie.
                  Peste 120 de caractere nu se citește; formele late și caracterele invizibile se curăță înainte.
                  Limită cunoscută: inelele poloneze vechi cu district (PL-01-96-123456) se citesc cu anul primul (anul
                  2001, clubul 96): afișarea e cea scrisă, cheia e consecventă, doar `ring_year` e greșit.
                  Maghiarul fără organizator se refuză (și cu „tojó” / HUNGARY). Un inel nerecunoscut rămâne `ok: false`,
                  dar un porumbel PROPRIU se salvează așa, cu cheia de rezervă `?|` + textul curățat, fără sex
                  (storedRingKey; dubluri, căutare, rezultate); fără nicio literă / cifră („??”) se refuză; strămoșii
                  nerecunoscuți n-au cheie (nu se leagă singuri). Telefonul folosește aceleași reguli:
                  web/src/app/shared/ring-preview.ts importă src/rings.js, iar core/today.ts src/zones.js (Dockerfile le copiază la build-ul interfeței)
                  (`previewRing(text, lang)`). La conturile `ja`, inelul japonez scris fără „JPN” (25-AB-01234: an +
                  două litere + număr) primește „JPN ” în față (`japaneseRingText`), doar pe ce scrie / aduce omul
                  (formular, căutarea părintelui, pui inelați, serii, clasament lipit, Excel înaintea țării coloanei,
                  poză); un inel doar din cifre rămâne cum e scris; vânzarea și „Preia” păstrează `ring_raw`.
  ring-backfill.js la pornire (boot.js, după migrări; NU e o migrare numerotată): strămoșii salvați înainte cu un inel
                  necitit atunci, dar recunoscut acum, primesc cheia; idempotent, sare peste ce ar dubla alt porumbel
  catalog.js      listele: rase, culori (+ sinonime pentru citire, și maghiare), ochi, stări, criterii, jurnal, concursuri
  pedigree-format.js / pedigree-import.js / pedigree-reader.js   formatul deschis „porumbar-pedigree” v1, importul, citirea din poză (Claude)
  table-import.js, table-values.js, routes/imports.js   „Adu porumbeii din Excel” (`/api/import/excel`: preview, salvare,
                  last, undo): rândurile tabelului devin porumbei proprii; previzualizarea rulează același cod într-o
                  tranzacție anulată (rezumat exact), salvarea ține contul blocat (`lockAccount`). Evidența pentru anulare
                  în `excel_imports` + `excel_import_items` (migrarea **23**), ștearsă după 7 zile (pruneImports, la 6 ore,
                  pornit din server.js) sau odată cu contul
  treatments.js   tratamentele pe tot porumbarul: fișa (grup, porumbei, repetare), grupurile, jurnalul legat (intrarea din
                  jurnal scrisă de un tratament nu se șterge separat), repetările (doar în viitor), blocare pe rând
  treatment-schedule.js  momentele amintirilor în ora României (modul pur)
  treatment-reminders.js rulantul pe oră (pornit din server.js): fixează momentele, trimite push (rezumatul de seară pe
                  email e OPRIT din 2026-11-26, limita găzduirii; `REMINDER_EMAILS=1` îl pornește din nou); deduplicare în `treatment_notices` / `email_digests`;
                  `REMINDER_EMAILS_PER_MINUTE` limitează emailurile. Trimite și amintirile cuibului, în aceeași
                  notificare și același email cu tratamentele
  nest-reminders.js  amintirile cuibului (sursa pentru rulant): momentele sosite ale pontelor deschise (doar conturile
                  cu abonament activ), rezervate în `nest_notices` (o dată pe pontă și moment), rândurile emailului de seară
  nest-schedule.js  calendarul cuibului (modul pur): momentele rămase ale unei ponte și când se amintesc (vezi
                  „Calendarul cuibului” mai jos); breeding.js `openClutches` / `calendar` + ruta `GET /api/breeding/calendar`
  push.js, routes/push.js  notificările pe telefon (`/api/auth/push`): abonarea, trimiterea prin `web-push` (versiune
                  fixată 4.0.0), doar către gazdele de push cunoscute; fără chei VAPID nu pleacă nimic pe telefon
  routes/treatments.js  API-ul `/api/treatments`
  genealogy.js, bloodlines.js, color-genetics.js, value.js, breeding.js, results.js, subscriptions.js, mail.js
  results.js      concursurile: aceleași cifre ca foaia Columba (penalizarea și FCI cu 4 zecimale, FCI cu plafon 5.000
                  fără Maraton / Extrem, premiat = primii 20%, ziua sosirii 1–7, clasamentul club / filială / zonă /
                  național); cercetarea: docs/cercetare/reports/Concursuri columbofile în Porumbar.md (branch docs)
web/            interfața: Angular 22, componente standalone, semnale, zoneless; build în web/dist (îl servește Express)
  src/app/core/   api (interceptor, errorMessage), auth, catalog, i18n, confirm, share-pdf, models
  src/app/app.ts  meniul mare (sus pe calculator, jos pe telefon) și, sub el, banda de submeniuri (macheta A, 2026-11-19):
                  Panou → Grilă / Listă / Rezultate concurs / Importă pedigree / Adu porumbeii din Excel / Scanează / Tratamente; fișa porumbelului → filele
                  ei (?fila=) / Vezi în arbore; Arbore → vederile (?vedere=); Perechi → Perechile sezonului /
                  Pereche nouă / Inelele mele, Vânzări → Cumpărați / Vânduți, Cont → Abonament / Datele de pe
                  fișă / Ce apare pe fișă / Codul de crescător / Limba / Ieșire și ștergere (toate ?sec=). Fiecare submeniu
                  are adresa lui. Banda pornește sub butonul părinte din meniul mare; dacă nu încape, butoanele se fac mai
                  mici și rândul se trage spre stânga (alignBand). Meniul mare stă la mijlocul spațiului dintre siglă și
                  margine; evidențierea e doar din font (îngroșat, mai mare, negru); fără „Înapoi” și fără „Ieși” în bare.
  src/app/pages/  panou, porumbar, porumbel, porumbel-form, retea (arbore, evantai, linii, rețea), perechi, vanzari,
                  (Arbore → Carduri: pe lățimea sitului, porumbelul în stânga și strămoșii spre dreapta, fișa celui ales
                  sub arbore; Importă pedigree: linii de descendență albastre spre tată, roz spre mamă, ca în Carduri)
                  (Grilă /panou, Listă /porumbar, Importă pedigree /porumbei/pedigree, Rezultate concurs /concursuri și Scanează
                  /scaneaza stau într-un cadru comun,
                  panou/porumbar-cadru.ts: antetul, butoanele și bara de filtre nu se redesenează la schimbare; datele și
                  filtrele în panou/porumbar-state.ts. Rezultate concurs are 2 submeniuri: Listare rezultate
                  /concursuri/lista, tabelul din rezultate/rezultate-toate.ts, și Rezultat nou /concursuri/nou,
                  concurs/concurs-rezultate.ts: toți porumbeii la un concurs, de mână sau lipind clasamentul)
                  import-excel (/porumbei/excel, în cadrul Panoului: pasul 1 fișier sau tabel lipit, pasul 2 câte un card
                  pe coloană, pasul 3 rezumatul de la server, apoi „Gata” și banda „Anulează importul”),
                  scaneaza, pedigree-hartie, public (/p/:token), auth (intră, cont, parole), admin (consola /vanzator),
                  concurs, rezultate (vezi mai sus), tratamente (/tratamente: În curs · Urmează · Gata, fișa nou / modifică
                  în tratament-form.ts, detaliul cu porumbeii; banda „În curs / Urmează” de pe Panou e
                  panou/tratamente-banda.ts; intrarea din jurnal scrisă de un tratament n-are „Șterge”, trimite la el),
                  banda „Cuiburile” (panou/cuiburi-banda.ts, sub banda tratamentelor, doar pe Grilă: butoane de o
                  atingere pe pontă, prin `PATCH /api/clutches/:id`; „Inelează” duce la `/perechi/:id?inelare=<ponta>`,
                  care pe perechi/pereche.ts derulează ponta și deschide inelarea cu inelul propus). Fișa porumbelului se editează pe loc, pe secțiuni
                  (porumbel/fisa-editabila.ts, butonul „Schimbă”); câmpurile, lista „Ce se schimbă” și corpul trimis la
                  server sunt comune cu „Porumbel nou” (porumbel-form/pigeon-draft.ts). Filele Rezultate și Rezultat nou
                  ale porumbelului folosesc aceleași componente ca Rezultate concurs (tabelul cu `pigeonId`, editorul
                  porumbel/rezultat-editor.ts, ecranul de introducere cu `focusPigeon`)
  web/public/sw.js  service worker-ul (primește push-ul și deschide aplicația); core/push.ts + core/push-key.ts: abonarea
                  la push (se refăce dacă cheia serverului s-a schimbat). Cont → Amintiri (?sec=amintiri): notificări pe
                  telefon și email. Banda „În curs / Urmează” de pe Panou apare doar pe Grilă
  src/app/shared/ fișa A4 (pedigree-page, pedigree-sheet), qr-code, ring-input, pigeon-picker, lang-switch, icon …
                  date-field.ts (<app-date>): câmpul de dată peste tot, NU <input type="date"> (calendarul browserului
                  vine în limba telefonului, adesea engleză); RO zz.ll.aaaa, HU éééé. hh. nn., valoarea AAAA-LL-ZZ
                  clasament.ts: citește clasamentul Columba lipit DOAR în telefon; la server pleacă numai rândurile omului
                  (după codul de crescător din Cont sau după inelele lui). Fără importuri, testat cu Node
                  (test/clasament.test.js). Nu se descarcă nimic de pe columba.ro și nu se citește din poză (decizia
                  vânzătorului, 2026-11-19)
                  tabel-coloane.ts: „Adu porumbeii din Excel”, tabelul lipit și ghicirea coloanelor (titlu în RO / HU / EN /
                  NL / DE / FR, apoi conținut); fără importuri, testat cu Node (test/import-coloane.test.js).
                  tabel-fisier.ts: SINGURUL loc care importă SheetJS (`xlsx`); se încarcă doar cu `await import()` din
                  pagina de import, când omul alege un fișier (după build, `main-*.js` nu trebuie să conțină „SheetJS”)
i18n/           dicționarele de limbi, citite de server și de interfață (vezi „Limbi”)
test/           testele (node:test) pe un PostgreSQL temporar: `npm test`; un fișier: `node scripts/test.mjs test/x.test.js`
scripts/        dev-db (Postgres de dezvoltare în data/pg, port 5433), db-setup, seed-exemplu (cont demo, doar local), test
docs/           specs + plans (superpowers), design/, exemple/ (anonimizate), cercetare/ (piața din Ungaria, glosarul maghiar)
data/           ignorat de git și de Docker: Postgres local, poze private de import
```

Separarea UI / backend: interfața vorbește cu serverul doar prin `/api/*` (JSON, aceeași origine, cookie de sesiune;
cererile care schimbă date trebuie să fie JSON și de pe același site). Formatul pedigree-ului e „porumbar-pedigree” v1
(`src/pedigree-format.js`), același pentru link public, QR, vânzare și preluare.

Tiparul fișei: o singură pagină de tipar, `pages/porumbel/tiparire.ts` – un porumbel (`/porumbei/:id/tiparire`) sau
mai mulți (`/porumbei/tiparire?ids=…`, butonul „Tipărește fișele (N)” de pe Panou / Listă, cel mult 200, câte o fișă pe
A4; serverul: `GET /api/sheets`, `POST /api/sheets/public` în `src/routes/public.js`). PDF-ul îl face browserul
(„Salvează ca PDF”); „Trimite” (`core/share-pdf.ts`) rămâne pentru un singur porumbel.

## Limbi (i18n)

- Dicționarele: `i18n/languages.json` (lista: cod, nume, locale, `public`), `i18n/ro.json` (sursa, cu `sens` pentru
  traducători: `{ "text": "...", "sens": "..." }`), `i18n/hu.json` și `i18n/ja.json` (aceleași chei, doar textul). Plural: obiect cu
  formele `Intl.PluralRules` (`one` / `few` / `other`), apelat cu `{ count: n }`. Valori: `{nume}`.
- Serverul: `t(lang, cheie, valori)`; în cereri `tr(cheie)` (limba cererii prin AsyncLocalStorage); erorile se aruncă cu
  chei (`badRequest('eroare.x', { ... })`), iar numele câmpurilor sunt și ele chei (`text(v, 'camp.nume')`).
  Limba cererii: a contului; fără cont `Accept-Language`, doar dacă limba e publică; altfel română.
- Interfața (`web/src/app/core/i18n.ts`): pipe-ul `t` în șabloane, `t()` / `tIn(lang, …)` în cod; `ro.json` e în pachet,
  celelalte se aduc de la `GET /i18n/<limba>.json`. Datele și numerele: `formatDay`, `formatDate`, `formatNumber`,
  `formatMoney` (nu `toLocale*('ro-RO')`).
- Semnele și spațiile lipite între bucăți traduse („.”, „, ”, „ (”, „„…””, „ – ”) trec prin `glue`: în șabloane `{{ '. ' | glue }}`,
  în cod `glue(', ')` (`glueIn` pe limba foii), pe server `glue(lang, ', ')`. Harta e `semne` din `languages.json` (doar japoneza o
  are: 。、：（）「」〜, fără spații); ro/hu rămân cum sunt scrise. „ · ” nu se schimbă. Paza: `test/lipici.test.js`.
  O propoziție din mai multe bucăți într-o cutie `.notice` / `.warning` / `.error` (flex) stă în `<span class="flow">`.
- **Regulă:** orice text nou pe care îl vede crescătorul intră în `ro.json`, `hu.json` **și** `ja.json`, în același commit.
  Un prefix nou de chei intră și în `GROUPS` din `test/ja.test.js` (o valoare japoneză scrisă doar cu litere latine sau semne:
  în `ALLOW_NONJA`, cu motivul). Testul `test/i18n.test.js` cere aceleași chei în toate limbile; `test/texte-ramase.test.js`
  pică dacă rămâne text cu diacritice românești în cod (excepții: comentarii, consola vânzătorului, rânduri marcate `// i18n: ro`).
- Consola vânzătorului (`/vanzator`, `src/routes/admin.js`) rămâne în română. Mailul către vânzător e în română; mailurile
  către crescător sunt în limba contului.
- **Toate limbile sunt publice și oficiale** (regula vânzătorului, 2026-11-26, și pentru limbile viitoare): româna,
  maghiara și japoneza; omul și-o alege la înregistrare
  sau în Cont, iar fără cont vine după limba telefonului. Vânzătorul poate pune limba oricui (Crescător nou / Date pe
  fișă). Mecanismul pentru o limbă nepublică (`public: false`: o dă doar vânzătorul) rămâne în cod, dar nu se folosește;
  test/limba.test.js face maghiara și japoneza „în probă” doar ca să-l verifice. Fișa tipărită și PDF-ul pot ieși și în altă limbă (alegerea de pe pagina de tipărire).
  Fără cont, limba se alege din steagul rotund din colțul din dreapta sus (`shared/lang-switch.ts`, ca pe sit; pe
  paginile de intrare e în colț prin `.auth-page app-lang-switch` din styles.css). Sub siglă, pe Intră și Cont nou, e
  `web/public/wordmark.svg` (literele din siglă, scrise de `docs/design/sigla/scrie-svg.py`).
- Japoneza (`ja`) e **publică** din 2026-11-26 (a fost „în probă” din 2026-11-25; vânzătorul a hotărât să o deschidă
  înainte de verificarea unui columbofil japonez a listei din `docs/cercetare/termeni-japonezi.md` §8, care rămâne de făcut). Fontul ei (Noto Sans JP, feliat cu unicode-range) e într-un CSS separat,
  `web/src/japoneza.css` → `/japoneza.css` (angular.json, `inject: false`), adus de `core/font-ja.ts` doar când se folosește
  japoneza; stiva de fonturi se schimbă doar sub `[lang="ja"]` (styles.css; foaia de pedigree are `lang` propriu). În PDF,
  `core/sheet-fonts.ts` așteaptă literele foii și încorporează doar feliile de pe ea (test/font-japonez.test.js).
- Semnul strămoșului de la tată și de la mamă e cheia `arbore.tm` (ro „T+M”, hu „apa+anya”, ja „父母”); `fisa.tm` și
  `retea.legenda_tm` încep cu el (test/ja.test.js). Nu se scrie „T+M” în cod.
- Ce e gata pentru Japonia (2026-11-26): inelele (regula completă, la `rings.js` mai sus: „JPN ” doar la `ja`, doar pe ce
  aduce omul); Excelul japonez (titluri de coloană, date cu ere, cuvinte pentru sex, ；／ ca separatori; codurile de culoare
  dintr-o literă NU se citesc la `ja`, nu se ghicesc) și citirea pozei (promptul știe fișele japoneze); numele japoneze ale
  culorilor (`matchColor`, din ja.json; test/culori-japoneze.test.js); țara implicită la import = JP; ora contului (mai jos).
  Ce rămâne: verificarea pe mostre reale de la columbofili japonezi (inele, o fișă de pedigree ca poză / Excel; mesajul în
  `docs/cercetare/mesaj-grupuri-japonia.md`, lista în `termeni-japonezi.md` §8), de făcut în continuare (`ja` e totuși publică); prețurile în yeni vin odată cu Paddle. Ramurile neîmbinate (feat/plata-paddle etc.) au nevoie de
  textele lor în `ja.json` la rebase.
- Ora contului: fiecare limbă din `languages.json` are `zone` (ro București, hu Budapesta, ja Tokyo); `src/zones.js`
  (modul pur, și serverul, și interfața) dă `zoneOf(lang)`, `todayIn`, `atLocal`. Amintirile, tratamentele și calendarul
  cuibului merg pe ora zonei contului; în browser „azi” vine din `web/src/app/core/today.ts`. Pe ora României rămân data
  abonamentului, mesajele către vânzător și consola vânzătorului. O limbă nouă primește și `zone` (altfel cade pe București).
- Termenii maghiari ai crescătorilor (culori, H / T pentru sex, „SZÁRMAZÁSI LAP”): `docs/cercetare/termeni-maghiari.md`.
- O limbă nouă: un fișier `i18n/<cod>.json` cu toate cheile + un rând în `languages.json` (cu `zone` și `public: true`: orice limbă nouă e publică și oficială de la început).

## Situl de prezentare

Situl (www.pigeonrama.com, o pagină) e **alt proiect**, în `C:\dev\porumbar-site` (repo privat `eduardjena/porumbar-site`):
`public/` e ce se urcă, butoanele duc în aplicație printr-o singură constantă `APP_URL`. Nu se pune niciodată în acest repo.
Când se schimbă adresa aplicației (domeniu propriu), se schimbă `APP_URL` acolo și `PUBLIC_BASE_URL` pe Railway.

## Publicarea (Railway)

- Proiectul Railway „porumbar” (Soopra Projects, UE): serviciul `porumbar` (Dockerfile: construiește interfața, apoi
  pornește serverul) + `Postgres`. Adresa: **https://app.pigeonrama.com** (din 2026-11-26, domeniu propriu pe Railway: CNAME `app` → `lrz7xqum.up.railway.app` și TXT `_railway-verify.app` în DNS-ul DirectAdmin; `PUBLIC_BASE_URL` arată spre ea). Adresa veche https://porumbar-production.up.railway.app merge în continuare (codurile QR deja tipărite) și nu se șterge.
- Înainte de publicarea „inelelor din toată lumea” (regula anului: `27` scris pe 2 cifre era 1927, acum 2027) se
  verifică în producție: `SELECT count(*) FROM pigeons WHERE ring_year = 1927;` și
  `SELECT count(*) FROM ring_series WHERE year = 1927;`. Dacă nu dau 0, rândurile acelea se lămuresc cu vânzătorul.
- **Push pe `main` publică singur:** serviciul e legat de GitHub (`eduardjena/porumbar`, branch `main`) și pornește o
  publicare în mai puțin de un minut (văzut pe 2026-11-26). Deci „urc main pe GitHub” = „public pe Railway”: se întreabă
  o singură dată, ca publicare. Urmărești `railway deployment list --service porumbar` (publicarea arată commit-ul);
  verifici că `main-*.js` de pe site e același cu cel din build-ul local și că `/api/health` răspunde 200.
- Publicare fără push (rar, de exemplu din nou aceeași versiune): `git archive main | tar -x -C <folder temporar>`, apoi
  `railway up <folder> --path-as-root --service porumbar --detach`.
- Variabilele secrete (`ADMIN_PASSWORD`, `ANTHROPIC_API_KEY`, SMTP) le pune vânzătorul în Railway, niciodată prin chat.
- Tratamentele cu amintiri (feat/tratamente): variabile noi `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
  (`mailto:adresa`) și `REMINDER_EMAILS_PER_MINUTE` (implicit 10). Cheile VAPID de producție sunt pe Railway din
  2026-11-26 (făcute local și puse direct cu `railway variables`, fără să apară în chat; `VAPID_SUBJECT=mailto:contact@pigeonrama.com`); dacă se schimbă, fiecare
  telefon trebuie să se aboneze din nou. Fără chei nu există push pe telefon (Panoul merge). **Amintirile nu merg pe
  email** (decizia vânzătorului, 2026-11-26): doar în aplicație (banda de pe Panou), în browser și pe telefon; bifa din
  Cont apare doar cu `REMINDER_EMAILS=1`. Emailurile rămase: parola nouă, invitațiile și anunțul de expirare a abonamentului. Migrarea acestei funcții e **22**; dacă feat/plata-paddle (22–25) intră înainte în `main`, se renumerotează
  la merge. **Condiție de lansare:** probă pe un Android real și pe un iPhone real (aplicația adăugată pe ecranul
  principal) înainte de publicare.
- Citirea din poze: cheia în `ANTHROPIC_API_KEY` (cheie API de pe console.anthropic.com, plătită separat de abonamentul
  Claude; cheia trebuie făcută într-un spațiu de lucru anume, de ex. „Default”, nu pentru toate). Modelul:
  `PEDIGREE_MODEL` (implicit `claude-sonnet-5-5`, ~2,5–3 cenți pe citire; Haiku a fost încercat și greșea cam o dată din
  6, vezi `docs/superpowers/specs/2026-11-18-citire-ieftina-design.md`); plafon pe an pe crescător: `PEDIGREE_BUDGET_USD`
  (implicit 3 $). Prețurile modelelor sunt în `src/pedigree-reader.js`; `PEDIGREE_PRICE_INPUT` / `PEDIGREE_PRICE_OUTPUT`
  le înlocuiesc pe ale modelului ales.
  Altă firmă decât Anthropic = schimbare de cod, doar în `src/pedigree-reader.js` (funcția `claudeModel`).

## Calendarul cuibului

Design: `docs/superpowers/specs/2026-11-23-calendar-cuib-design.md`. Migrarea **24**: `clutches.candled_on`,
`clutches.calendar_closed_on`, `clutches.updated_at` și tabelul `nest_notices` (momentele trimise). Dacă
feat/plata-paddle intră după, migrările ei se renumerotează după cele din `main`.

- O pontă e urmărită cât primul ou e din ultimele 45 de zile și omul n-a apăsat „Nu mai urmări”
  (`calendar_closed_on`; pe fișa perechii „Urmărește din nou”). Ponta la doică apare la cuibul doicii.
- Momentele (constante în `src/nest-schedule.js`, zilele în ora României): al doilea ou de la +2 („Doar un ou?” de la +4);
  mirarea în ziua a 5-a după al doilea ou (după primul, la un singur ou), de verificat cu un crescător; ieșirea puilor
  zilele 17–19 de la primul ou; inelarea zilele 6–8 de la ieșire (ziua 8 = ultima, cu roșu; după ea, „întârziată”).
- Butoanele benzii scriu câmpurile existente: „N-au ieșit” = ouăle rămase trecute ca limpezi (`infertile`), „Nu inelez”
  = `hatched` cât puii inelați; contul „doar citire” vede banda cu butoanele oprite (serverul dă 402).
- **O singură notificare**: amintirile cuibului intră în aceeași notificare cu tratamentele (seara la 19:00 ce începe
  mâine, dimineața la 07:00 ultima zi de inelare) și în același email de seară (unul pe cont și zi, `email_digests`);
  fiecare moment se trimite o singură dată (`nest_notices`). Conturile „doar citire” nu primesc amintiri de cuib.

## Regulile vânzătorului (de respectat mereu)

- Fiecare funcție pe branch-ul ei. **Înainte de orice merge în `main`, push al lui `main` sau publicare pe Railway:
  întrebi.** Push-ul lui `main` e o publicare (vezi „Publicarea”). O aprobare ține doar pentru acea publicare.
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
- **Importul din Excel** (spec `docs/superpowers/specs/2026-11-23-import-excel-design.md`): fișierul se citește în
  browser și nu pleacă nicăieri; la server ajung doar celulele coloanelor alese, iar tabelul nu se păstrează. SheetJS
  (ediția comunitară) se instalează doar din tarball-ul oficial `cdn.sheetjs.com`, versiune fixă (acum 0.20.3; NU
  0.18.5 din registrul npm, are probleme de securitate), e inclus în build și nu se încarcă de pe CDN la rulare.
  Limite: cel mult 3.000 de rânduri și 20 de coloane pe import, fișierul cel mult 10 MB (verificat în browser), cererea
  JSON cel mult 2 MB, previzualizarea de cel mult 30 de ori pe minut pe cont. Nimic nu se dublează și nimic scris nu se
  schimbă: la porumbeii existenți se completează doar câmpurile goale, o legătură diferită apare la „nepotriviri”.
  **Anularea**: doar ultimul import din Excel al contului, doar 7 zile; un porumbel adus se șterge doar dacă e
  neschimbat și nefolosit (judecat după conținut, nu după `updated_at`), câmpurile completate se golesc doar dacă au
  încă valoarea pusă de import; ce a scris omul rămâne. Contul „doar citire” primește 402 la previzualizare, salvare și
  anulare.
