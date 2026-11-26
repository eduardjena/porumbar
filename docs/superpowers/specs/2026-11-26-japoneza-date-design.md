# Japoneza, partea a doua: inelele, pedigree-urile și ora Japoniei

Data: 2026-11-26. Continuă [2026-11-25-limba-japoneza-design.md](2026-11-25-limba-japoneza-design.md) (secțiunea „Datele japoneze”, părțile A și B). Aprobat de vânzător în conversație („Da”).

## De ce

Vânzătorul are clienți japonezi și vrea să le vândă versiunea japoneză (mai scump, ~50 €). Interfața e gata și publicată, dar ascunsă (`ja`, `public:false`). Ca un crescător japonez să poată lucra cu adevărat, aplicația trebuie să-i înțeleagă inelele așa cum le scrie, să-i citească pedigree-urile (Excel și poză) și să-i trimită amintirile la ora lui.

Nu avem mostre reale de la clienți. Vânzătorul a ales: „Fă cu ce ai”. Construim din cercetare (docs/cercetare/reports/Formatele inelelor de porumbei.md, docs/cercetare/termeni-japonezi.md) și verificăm mai târziu pe mostrele pe care le va cere în grupurile japoneze.

## Scopuri

1. **Inelele fără prefix** la conturile japoneze: `25-AB-01234`, `25AB01234`, `2025 AB 01234`, `25-ET-1234` se recunosc ca inele JPN, în formular, la importul Excel și la citirea pozei.
2. **Importul Excel japonez:** titlurile de coloane japoneze, datele japoneze, sexul scris în japoneză; literele simple de culoare nu mai sunt luate drept culori românești la conturile japoneze.
3. **Citirea pozei:** cititorul știe că fișa poate fi japoneză; ce citește trece prin aceleași reguli (inel, culoare, dată, sex).
4. **Ora țării contului:** amintirile, „azi” din calendarul cuibului și „azi” din tratamente se socotesc după ora țării contului, aleasă după limbă: `ro` → `Europe/Bucharest`, `hu` → `Europe/Budapest`, `ja` → `Asia/Tokyo`. (Aprobat explicit, inclusiv că maghiarii primesc ora Ungariei — o oră mai devreme decât azi.)
5. **Mărunțișurile din cod amânate** data trecută (lista mai jos).
6. **Un mesaj în japoneză pentru grupuri**, prin care vânzătorul cere câteva inele și un pedigree (nu e cod; se scrie separat, în docs/).

## Ce nu facem (non-scopuri)

- Nu facem japoneza publică (`public:true`) — abia după probă pe mostre reale și acordul vânzătorului.
- Nu facem prețuri în yeni / prețuri pe țări — vin cu plata prin Paddle (branch separat, nefinalizat).
- Nu schimbăm formulările japoneze amânate „pentru client” (termeni de confirmat de un crescător japonez).
- Nu adăugăm engleza.
- Nu schimbăm ziua abonamentului (`src/subscriptions.js`, data de expirare rămâne după ora României — regulă comercială a vânzătorului, nu a crescătorului).

## Anti-scopuri (ar fi eșec chiar dacă „merge”)

- Orice schimbare de comportament pentru conturile `ro`, în afară de lucrurile aprobate. Pentru `hu`, singura schimbare de comportament permisă e ora Ungariei.
- Un inel românesc sau maghiar citit drept japonez (de exemplu un inel RO fără țară, scris de un român, devenit JPN).
- Textul scris de om pierdut: aplicația păstrează mereu ce a scris omul ca sursă de adevăr.
- Japoneza „declarată gata” fără probă pe mostre reale.

## Constrângeri

- Node 24 ESM, Express 5, PostgreSQL (și la teste, instalat local; niciodată SQLite sau o bază emulată). Angular standalone/signals/zoneless în `web/`.
- Orice text nou pe care îl vede crescătorul intră în `ro.json`, `hu.json` și `ja.json`, în același commit; prefixele noi intră în `GROUPS` din `test/ja.test.js`.
- Branch `feat/japoneza-date`; merge în `main` / push (push pe `main` = publicare pe Railway) doar cu „da”-ul vânzătorului.
- Date de test inventate; nicio dată reală a crescătorilor în repo (repo public).
- Fără migrare de bază de date dacă se poate (ora vine din limba contului, care există deja).

## Abordări

1. **Completăm piesele existente** (aleasă). Aceleași funcții servesc deja româna și maghiara: `parseRing` / `ringWithCountry`, `readDate`, `readCode`, `TITLURI` / `SEX_CUVINTE`, instrucțiunile cititorului de poze, `treatment-schedule.js`. Le dăm și cazurile japoneze. Un singur loc de reparat când vin mostrele.
2. Un cititor separat „doar pentru japonezi” (import și inele separate) — respins: dublează codul și se strică separat.
3. Totul prin cititorul de poze (AI) — respins: Excel-ul rămâne neacoperit, iar regulile deterministe sunt cele care se pot testa.
4. Așteptăm mostrele — respins de vânzător („Fă cu ce ai”).

## Cum (ce a hotărât vânzătorul și ce e lăsat constructorului)

### 1. Inelele fără prefix (conturile `ja`)

Azi: `parseRing('JPN 25AB01234')` → `JP-25-AB-01234`, dar `parseRing('25-AB-01234')` → nerecunoscut. Parsarea nu știe de cont (inelele se re-parsează peste tot din `ring_raw`, fără context: `src/pigeons.js`, `views.js`, `pedigree-format.js`, `results.js` etc.).

Hotărâre: **la salvare**, pentru un cont `ja`, dacă textul nu e inel valid dar `JPN ` + text este, se păstrează cu prefixul `JPN ` pus în față — exact tiparul `ringWithCountry` folosit deja la importul Excel (`src/table-values.js`). Astfel `ring_raw` rămâne parsabil fără context, iar restul aplicației (căutare, rețea, comparare) merge neschimbat. Textul omului rămâne, doar cu prefixul adăugat (cum face deja importul).

Locuri: formularul (validarea din `src/pigeons.js`, care trebuie să primească limba contului), importul Excel (`defaultRingCountry('ja')` dă deja `JP`; constructorul verifică dacă prefixul folosit e `JP` sau `JPN` și că `25AB01234` trece), citirea pozei / importul pedigree-ului (`src/pedigree-import.js`), părinții și perechile scrise de mână (`src/routes/family.js`, `src/breeding.js`), transferurile dacă scriu inele. Constructorul caută toate locurile unde un inel scris de om e salvat.

Previzualizarea din formular (`web/src/app/shared/ring-preview.ts`) arată la un cont `ja` același rezultat ca serverul (`JP-25-AB-01234`), nu „nerecunoscut”.

Nu se schimbă `parseRing` pentru inelele fără prefix (ar ghici JP și la români). Doar contul `ja` pune prefixul.

**Decizie (a lui Claude, după verificarea constructorului):** `JPN ` + aproape orice inel românesc fără țară (`26-800546`, `25-12345`) iese inel JP valid. De aceea prefixul se pune **doar pe forma japoneză**: an (2 sau 4 cifre) + **două litere de serie** + număr (`25-AB-01234`, `25AB01234`, `2025 AB 01234`, `25-ET-1234`). Un inel doar cu cifre rămâne cum e scris. Și se pune **doar pe ce scrie sau aduce omul însuși**: formularul (porumbelul, părinții, perechile), importul Excel și citirea pozei. Datele copiate de la alt cont (transfer, „Preia” din link public / QR, vânzare) își păstrează `ring_raw` neschimbat.

**Porumbeii salvați înainte:** fără migrare și fără rescriere în fundal. Un porumbel japonez salvat înainte cu inelul nerecunoscut primește prefixul abia când omul îl editează și îl salvează (validarea îl pune). Japoneza e pe Railway doar de pe 2026-11-26 și o dă doar vânzătorul, deci nu se așteaptă date japoneze vechi (de confirmat cu vânzătorul).

Lăsat constructorului: dacă `日本` / `日鳩` sau alte prefixe în kanji apar pe inele — cercetarea nu le-a găsit; **nu** se adaugă până nu le vedem pe mostre.

### 2. Importul Excel japonez

- **Titluri de coloane** (`web/src/app/shared/tabel-coloane.ts`, `TITLURI`, lista pe limbi): se adaugă japoneza. Termenii din glosar: inel 脚環 / 足環 / 足輪 / 脚環番号 / リング / リング番号; sex 性別 / 雌雄; culoare 羽色 / 色; tată 父 / 父鳩; mamă 母 / 母鳩; data nașterii 生年月日 / 孵化日 / 生年; crescător 作出者; nume 名前 / 鳩名; țara 国. Constructorul ia lista completă din glosar (docs/cercetare/termeni-japonezi.md) și din ce câmpuri are deja `TITLURI`. Atenție: `fold()` scoate diacriticele și păstrează literele (`\p{L}`), deci kanji/kana trec; trebuie verificat că lățimea plină (NFKC) e normalizată.
- **Datele** (`readDate` în `src/table-values.js`): `2025/11/25`, `2025/1/5`, `2025年11月25日`, `2025年11月` (doar lună → ca azi pentru „un an singur”: null, sau ce face azi funcția pentru date incomplete), era japoneză `令和7年11月25日` (令和 1 = 2019), `平成` (1 = 1989), `R7.11.25` / `H30.5.1`. Cifrele late (`２０２５`) se normalizează. `2025/11/25` (an în față) nu e ambiguu cu `ZZ/LL/AAAA`.
- **Sexul** (`SEX_CUVINTE` și citirea sexului): オス, メス, 雄, 雌, ♂, ♀ (dacă nu există deja).
- **Culorile**: la conturile `ja`, literele simple (B, S, G, …) nu mai sunt luate drept coduri de culori românești; rămân text (culoare necunoscută, textul păstrat). Numele japoneze se recunosc deja. Constructorul găsește unde se aplică codurile scurte (`readCode` / `matchColor`) și cum ajunge limba contului acolo.
- **Țara implicită** `JP` există deja pentru conturile `ja`.

### 3. Citirea pozei

`src/pedigree-reader.js`: instrucțiunile pomenesc deja fișa maghiară; se adaugă fișa japoneză (de exemplu titlul 血統書, 父 / 母, 作出者, ♂ / ♀, inele de forma `JPN 25-AB-01234` sau `25-AB-01234`, date în era japoneză). Nota „ce nu s-a putut citi” e deja în japoneză. Ce întoarce cititorul trece prin aceleași reguli: prefixul JPN la conturile `ja` (punctul 1), data (punctul 2), culoarea și sexul. Testele cititorului folosesc răspunsuri înregistrate / falsificate, nu apeluri reale la Anthropic.

### 4. Ora țării contului

Azi `src/treatment-schedule.js` are `TZ = 'Europe/Bucharest'` (`bucharestNow`, `atBucharest`, `dueMoments`), iar „azi” se ia din București în `src/treatments.js` (`todayBucharest`), `src/routes/breeding.js` (calendarul cuibului) și `src/treatment-reminders.js`.

Hotărâre: zona vine din limba contului (`ro` → București, `hu` → Budapesta, `ja` → Tokyo; o limbă necunoscută → București). Un singur loc care dă zona după limbă; funcțiile primesc zona. Amintirile pleacă la aceleași ore locale ca azi, dar locale pentru fiecare cont. Constructorul verifică cum se calculează momentele (o oră fixă locală) și că trecerea la ora de vară e corectă pentru fiecare zonă (Japonia nu are oră de vară).

**Și în browser (decizie a lui Claude, după verificarea constructorului):** cel puțin 8 locuri din `web/` iau „azi” ca `new Date().toISOString().slice(0,10)` (data UTC: în Tokyo e încă „ieri” până la 09:00, în România până la 03:00), iar `tratament-text.ts` ia ceasul telefonului. Toate trec pe „azi” după zona contului (aceeași regulă ca serverul), printr-o singură funcție. La conturile `ro` asta repară datele puse între miezul nopții și ora 3 (azi ies cu o zi în urmă) — o reparație, nu o schimbare de comportament voită.

Rămân pe ora României: data abonamentului (`src/subscriptions.js`), mesajele către vânzător (`src/routes/auth.js`). Constructorul enumeră restul locurilor cu `Europe/Bucharest` (`transfers.js`, `public.js` — notele „Preluat de la … pe …”) și le tratează doar dacă le vede crescătorul; dacă sunt texte românești scrise în date pentru orice limbă, e o problemă separată: se notează, nu se lărgește lucrarea.

### 5. Mărunțișurile din cod amânate

Din recenzia finală a japonezei (cele de cod, nu de formulare):
- desenul rețelei (Cytoscape) nu se redesenează când sosește fontul japonez;
- trimiterea PDF-ului n-are limită de timp dacă rețeaua se blochează;
- `japoneza.css` (208 KB) nu e comprimat la servire;
- eticheta シーズン se rupe în două la 320 px;
- `qr-code.ts` are o etichetă românească pentru cititoarele de ecran (trebuie tradusă, în toate limbile);
- Excel: separatorii japonezi `；` și `／` la liste;
- cache-ul pentru eșecul `html-to-image`; testul `font-japonez` pică cu ENOENT fără `web/node_modules`; `glueIn` fără test direct.

Constructorul le face pe cele ieftine și sigure; ce se dovedește mare se notează ca amânat, cu motivul.

### 6. Mesajul pentru grupuri

Un text scurt, politicos, în japoneză (și traducerea lui în română pentru vânzător), în `docs/cercetare/mesaj-grupuri-japonia.md`: cine suntem (o aplicație de evidență a porumbeilor), ce cerem (câteva numere de inel exact cum sunt scrise pe inel și pe pedigree, o poză și/sau un Excel de pedigree, cu datele personale acoperite), de ce. Fără date personale ale vânzătorului în repo (repo public): locul pentru contact rămâne de completat.

## Verificare

- Teste pentru fiecare regulă nouă (inele, date, titluri, sex, culori, zone), cu cazurile negative: inel RO/HU fără țară la un cont `ro`/`hu` rămâne cum e azi; `2025/11/25` și `25/11/2025` ambele corecte; o amintire la `ja` pleacă la ora locală Tokyo; la `ro` exact ca azi.
- Suita completă (`npm test`) verde; `node --test test/ja.test.js` verde; build-ul interfeței trece.
- Probă în browser pe un server de probă (bază temporară): cont `ja`, formular cu `25-AB-01234`, import Excel cu titluri japoneze; cont `ro` neschimbat.
- **Poarta:** chiar trecute, regulile japoneze se declară „de probat pe mostre”, nu „gata pentru clienți”.

## Lăsat constructorului

Ordinea pașilor, numele funcțiilor, cum ajunge limba contului la validare și la import, lista completă de titluri și locuri de salvare a inelelor, ce mărunțișuri intră efectiv.
