# Limbi străine în Porumbar (prima: maghiara)

Data: 2026-11-18 · Branch: `feat/limbi-straine`

## De ce

Primii clienți într-o altă limbă sunt **maghiarii din România** (Ardeal): aceleași inele RO, același preț în lei,
același vânzător care le face contul. Pasul următor sunt **crescătorii din Ungaria** (vezi raportul
`docs/cercetare/reports/Aplicații columbofile în Ungaria.md`). Acum construim doar limba, dar așa încât Ungaria
(inele HU, alt preț, facturare) să se poată adăuga fără să refacem traducerea.

Dorința vânzătorului, cu cuvintele lui: un fișier cu cuvintele, frazele și sensurile; la fiecare limbă nouă doar
să-l apelezi.

## Ținte

- Toate textele pe care le vede crescătorul stau într-un **dicționar pe limbă**: `i18n/ro.json`, `i18n/hu.json`.
  O limbă nouă = un fișier nou + un rând în lista limbilor.
- Fișierul românesc ține lângă text și **sensul** (unde apare, ce înseamnă), ca să-l poată traduce cineva fără să
  deschidă aplicația.
- Se traduce tot ce vede crescătorul: ecranele, mesajele de eroare de la server, mailurile către el, catalogul
  (culori, culoarea ochilor, rase, stări, criterii de evaluare, tipuri de jurnal, categorii de concurs), fișa
  tipărită și pagina publică (`/p/...`), datele și numerele (format local).
- Limba se schimbă pe loc, fără reîncărcare de pagină.

## Ce nu facem acum (non-ținte)

- **Consola vânzătorului** (`/vanzator`) rămâne în română. Doar câmpul nou „Limba” apare în ea.
- Ungaria propriu-zisă: inele HU implicite (format `HU-AAAA-OO-NNNNN`, cu codul organizatorului din două cifre),
  preț în HUF/EUR, TVA, facturi. Vin într-un pas separat.
- Ce scrie omul (nume, note, jurnal) nu se traduce.
- Fără traducere automată în aplicație; traducerea e în fișier.

## Ce n-avem voie să stricăm (anti-ținte)

- Un crescător român nu trebuie să vadă nicio diferență: `ro.json` reproduce exact textele de azi (testele care
  verifică mesaje românești rămân neschimbate și trec).
- Pornirea aplicației nu devine vizibil mai lentă pe telefon.
- Niciun text uitat în română pe un ecran în maghiară, fără să știm: un test găsește textele rămase în cod.

## Variante cântărite

- **A. Dicționarul nostru (ales).** Câte un fișier JSON pe limbă, o funcție mică `t()` folosită și de ecrane, și de
  server. Limba se schimbă pe loc, iar o limbă nouă e doar un fișier. Cost: mutăm noi toate textele din cod în
  fișier, ecran cu ecran.
- B. Traducerea din Angular (`$localize`): câte o copie a aplicației pe limbă, fișiere XLF greu de citit, serverul
  separat, schimbarea limbii reîncarcă pagina. Respinsă: nu e „un fișier pe limbă” și complică servirea.
- C. O bibliotecă (Transloco, ngx-translate): ca A, dar cu încă o dependență. Respinsă: A e cât o pagină de cod.

Vânzătorul a ales A.

## Cum arată dicționarul

- Un singur folder `i18n/` la rădăcina proiectului, citit și de server (Node), și de interfață (la build).
- Cheile sunt grupate pe pagini/părți: `panou.titlu`, `fisa.tata`, `eroare.inel_invalid`, `culoare.albastru`.
- `ro.json`: fiecare cheie e fie un text, fie `{ "text": "...", "sens": "..." }` când sensul nu e evident.
  `hu.json` (și orice limbă viitoare): doar textele, aceleași chei.
- Valori în text: `{nume}`, `{numar}`. Pluralul (românesc: 1 porumbel / 2 porumbei / 20 de porumbei) ca obiect
  `{ "one": ..., "few": ..., "other": ... }`, ales cu `Intl.PluralRules` al limbii.
- O cheie lipsă într-o limbă se afișează în română (nu cheia goală). Testele verifică că `hu.json` are toate cheile
  din `ro.json`, cu aceleași valori `{...}`, și nimic în plus.

## Cine alege limba

- Cont nou: coloana `accounts.lang` (`'ro'` implicit; lista permisă = limbile din `i18n/`), migrarea 18.
- **Vânzătorul** o pune în consolă la „Crescător nou” și la „Date pe fișă” (lângă celelalte date ale omului).
- **Crescătorul** o poate schimba din Cont (`PATCH /me` acceptă `lang`).
- Paginile fără cont (intră, cont nou, parolă uitată, parola nouă, pagina publică): limba telefonului dacă o avem,
  altfel română; un buton mic RO / HU; alegerea se ține pe telefon. La înregistrare limba aleasă intră în cont.
- După intrare contează limba contului.

## Serverul

- `src/i18n.js`: încarcă dicționarele la pornire, `t(lang, cheie, valori)`.
- Limba cererii: a contului dacă e logat, altfel antetul `Accept-Language` trimis de interfață (limba aleasă pe
  ecran), altfel română.
- `HttpError` primește o cheie și valori în loc de textul gata scris; `errorHandler` îl traduce în limba cererii.
  La fel `text()`, `oneOf()` (numele câmpurilor devin chei) și mesajele fixe din `errorHandler` și `rateLimit`.
- `GET /api/catalog` întoarce etichetele în limba cererii.
- Mailurile către crescător (parolă nouă, link de cont) în limba contului. Mailul către vânzător rămâne în română.
- Citirea pedigree-ului din poză: nota („ce nu s-a putut citi”) în limba contului; promptul spune că fișele pot fi
  scrise și în maghiară. Culorile primesc denumirile și abrevierile maghiare printre sinonime (`src/catalog.js`),
  ca `matchColor` să le recunoască oricare ar fi limba ecranului.

## Interfața

- Un serviciu `I18n` (signal cu limba și dicționarul) + un pipe `t` pentru șabloane și `t()` pentru cod.
- `ro.json` intră în pachetul principal (limba implicită, fără cerere în plus). Celelalte limbi se aduc ca fișier
  separat (`/i18n/hu.json`, același domeniu, merge cu CSP-ul de acum) înainte de prima afișare, doar când trebuie.
- Toate `toLocale*('ro-RO')` trec printr-un singur loc care folosește limba curentă (`hu-HU` pentru maghiară).
- Antetul `Accept-Language` se adaugă în interceptorul existent.

## Fișa tipărită și linkul public

- Fișa se tipărește implicit în limba contului; pe pagina pedigree-ului omul poate alege altă limbă (de ex. română,
  pentru un cumpărător român). Aceeași alegere se folosește și la „Tipărește”, și la PDF-ul de la „Trimite”
  (`share-pdf.ts`): `PedigreePage` primește limba ca intrare, separat de limba ecranului. *(Hotărârea mea.)*
- Se traduc etichetele fișei și valorile din liste: culoarea și sexul. Ca să se poată, formatul
  `porumbar-pedigree` v1 primește, pe lângă textul culorii de azi, câmpul opțional `colorCode` (compatibil cu
  fișele vechi: fără cod, se afișează textul așa cum e; `toImportNode` preferă codul când există). *(Hotărârea mea.)*
- Numele, inelele și notele rămân cum sunt. Rândul de rezultate (`1e-197KM-10023P-'26`, `shortLine` din
  `src/results.js`) rămâne în notația de azi în acest pas; notația pentru Ungaria se hotărăște la pasul Ungaria.
  *(Hotărârea mea.)*
- Pagina publică `/p/...` folosește limba vizitatorului (telefonul lui, cu butonul RO / HU), nu a proprietarului.

## Traducerea în maghiară

- O face Claude, folosind glosarul `docs/cercetare/termeni-maghiari.md` (termenii folosiți de crescătorii maghiari:
  culori, culoarea ochilor, sex, termeni de pedigree și concurs, cu surse, inclusiv diferențele Ardeal / Ungaria).
  Glosarul se face înainte de plan, la cererea vânzătorului („fă un search pe net să vezi ce cutume au, ce specific
  au pentru culori”), și se pune în git împreună cu designul. Unde termenii diferă, alegem ce se folosește în Ardeal
  (primii clienți), cu varianta din Ungaria printre sinonimele culorilor.
- Din glosar, ce schimbă construcția:
  - Fișa în maghiară se numește `SZÁRMAZÁSI LAP`; sexul se scrie hím / tojó, prescurtat **H / T**.
  - Culorile: termenii crescătorilor (`kék kovácsolt`, `sötét kovácsolt`, `vörös`, `fakó`, `deres`, `tarka`…), nu
    traducerea de dicționar („kockás”); abrevierile de pe pedigree-uri (`k.kov.`, `kk`, `skt.`, `Vk`…) intră la
    sinonime pentru citire.
  - Categoriile de concurs: se traduc numele (rövidtáv / középtáv / hosszútáv / maraton), dar limitele în km rămân
    cele românești din aplicație.
  - Termenii marcați în glosar „presupunere” (de ex. vânăt, vișiniu, mixt la ochi) se semnalează la verificarea
    traducerii.
- Inelele HU (format `HU-AAAA-OO-NNNNN`, serii cu literă, H/T după număr, „M” din inel care nu înseamnă mascul) nu
  intră aici: se fac pe un branch separat, imediat după limbă (hotărârea vânzătorului).
- Înainte să dăm maghiara oamenilor, `hu.json` îl verifică cineva care vorbește maghiara și ține porumbei.
- **Până la verificare, maghiara o vede doar cine o primește de la vânzător** (hotărârea vânzătorului). Lista
  limbilor are pentru fiecare limbă un semn „publică”: maghiara pornește nepublică. O limbă nepublică:
  - se poate pune din consolă (Crescător nou, Date pe fișă);
  - în Cont apare doar la cine o are deja; dacă omul trece în română, maghiara dispare din lista lui până i-o pune
    iar vânzătorul (Cont îl avertizează înainte);
  - nu apare în butonul RO / HU de pe paginile fără cont și pe pagina publică, nu se alege după limba telefonului
    și nu se poate cere la înregistrare (serverul refuză `lang` nepublic la `/register` și la `PATCH /me` pentru cine
    nu o are);
  - fișa tipărită și PDF-ul se pot face în ea doar de cine o are.
  După verificare, semnul devine „publică” (o schimbare de un rând, cu deploy).

## Paza împotriva textelor uitate

- Un test caută în `web/src` și `src` texte cu litere românești (ă, â, î, ș, ț) în afara comentariilor, a
  `i18n/` și a consolei vânzătorului. Ce rămâne voit (de ex. sinonimele culorilor, promptul de citire) stă pe o
  listă de excepții scurtă, cu motiv.

## Lăsat constructorului

- Numele exacte ale cheilor și împărțirea pe grupe.
- Ordinea în care se mută ecranele (în plan, câte un grup de ecrane pe pas, cu testele verzi după fiecare).
- Cum arată butonul RO / HU pe paginile fără cont (mic, în colț, cu text mare la apăsare).
