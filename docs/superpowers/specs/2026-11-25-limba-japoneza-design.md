# Limba japoneză – design

**Data:** 25.11.2026
**Glosar:** `docs/cercetare/termeni-japonezi.md`

## Intenție și de ce

Avem clienți reali în Japonia. Vrem japoneza ca limbă oficială întreagă, exact ca româna și maghiara: tot ce vede crescătorul — meniuri, fișe, mesaje, pedigree tipărit, pagina publică — în caractere japoneze corecte, scrise cu cuvintele pe care le folosesc columbofilii japonezi, nu cu traduceri de dicționar.

Mașinăria de limbi există deja și e live (maghiara). Japoneza se adaugă pe aceeași infrastructură (`i18n/<limba>.json`, `src/i18n.js`, serviciul `I18n` din interfață, butonul de limbă). Deci riscul tehnic e mic; efortul e traducerea celor **1.513 texte** și fontul.

## Scop (goals)

1. **`i18n/ja.json`** cu toate cele 1.513 chei din `ro.json`, traduse după glosar și după registrul japonez (`です・ます` în fraze, etichete scurte de substantiv pe butoane).
2. **Fontul japonez** (Noto Sans JP) găzduit la noi, se încarcă **doar** când limba e japoneză; literele japoneze se afișează corect (fără pătrățele goale), lângă latinul pe Atkinson Hyperlegible.
3. **Formatarea** (date, numere, contor de porumbei) corectă pentru `ja-JP`, prin `Intl`/locale — vine aproape gratis (ex. `2026/11/25`, `3羽`).
4. **Japoneza „în probă”** (nepublică) până când clientul japonez confirmă lista scurtă din glosar §8; abia apoi devine publică.
5. **Vânzătorul poate pune `ja`** unui crescător din consolă (ca la maghiară, cu „(în probă)” lângă).
6. Culorile se arată ca **cod englezesc + nume katakana** (B → ブルー), pentru că asta citesc crescătorii pe pedigree.
7. **Datele japoneze** (scopul „tot"): recunoașterea inelelor japoneze și citirea pedigree-urilor scrise în japoneză (poze/Excel) — vezi secțiunea „Datele japoneze".

## Non-scop (non-goals)

- **Prețurile în yeni și plata** — stau pe partea de plată (Paddle, branch `feat/plata-paddle`, nemerge-uit). `formatMoney` nu e folosit nicăieri azi; când vine Paddle, devine locale-aware (fără zecimale la yeni, `円`). Nu atingem bani în acest branch.
- **Consola vânzătorului** (`/vanzator`) rămâne în română, ca azi; primește doar opțiunea `ja` la câmpul „Limba”.
- Vreun sistem de traducere automată / API extern.

> Vânzătorul a ales **scopul întreg** („tot"): pe lângă interfață, intră și recunoașterea inelelor japoneze și citirea pedigree-urilor scrise în japoneză (vezi „Datele japoneze" mai jos).

> **Notă despre termenii nesiguri (ochi, „galben", solzat-închis…):** testul de consistență cere ca **fiecare** cheie din `ro.json` să existe în `ja.json`, nenulă. Deci nicio cheie nu „rămâne pe română" — fiecare primește **cea mai bună variantă japoneză** (ex. `黄` pentru galben, katakana pentru ochi), iar cele nesigure intră pe lista de confirmat din glosar §8. Nu punem text românesc în `ja.json`.

## Anti-scop (ce ar face asta un eșec chiar dacă „merge”)

- Să facem japoneza publică **neconfirmată** de un columbofil japonez.
- Pătrățele goale (tofu) în loc de litere japoneze.
- Traduceri literale care sună „robotic” sau greșit pentru un columbofil (ex. culori traduse din dicționar în loc de codurile/katakana reale).
- Un font de la CDN (încalcă regula CSP `'self'`) sau o dependență nouă în afara tiparului `@fontsource`.

## Constrângeri

- Branch nou (`feat/limba-japoneza`); un commit la fiecare task; **fără merge/push/deploy fără întrebarea vânzătorului**.
- Bază de date PostgreSQL; nicio migrare nouă necesară (coloana `accounts.lang` există deja).
- `ro.json` rămâne **identic** cu azi (testele de mesaje românești nu se schimbă).
- Testul de consistență cere: fiecare cheie din `ro.json` există în `ja.json`, cu aceleași forme `{...}`, nicio valoare goală. Deci fiecare cheie intră în `ja.json` în același commit în care ar fi nevoie.
- CSP rămâne `'self'`; singura dependență nouă e un pachet `@fontsource` (fișiere împachetate la build, ca Atkinson azi).
- Text de bază 18px, butoane ≥ 48px (butonul de limbă inclus).
- Japoneza are **o singură formă de plural** în `Intl.PluralRules` (`other`) — cheile cu plural au nevoie doar de forma `other`.

## Abordări luate în calcul

**1. Reutilizăm mașinăria dovedită de la maghiară. ✅ ALEASĂ.**
Adăugăm `ja` în `languages.json` (`public: false`), creăm `ja.json`, adăugăm fontul, mutăm opțiunea în consolă. Identică cu o funcție deja livrată și live; risc minim; testele existente (consistență, texte-rămase) ne păzesc.

**2. Pipeline de traducere automată la runtime.** ❌ Respinsă: ar cere o dependență/CDN (încalcă CSP și tiparul „fără dependențe în widget”), costă la fiecare afișare și dă calitate mai slabă decât o traducere atentă verificată de client.

**3. Așteptăm un traducător uman profesionist înainte să construim.** ❌ Respinsă: mai lent, fără câștig de calitate la final — putem face un draft atent după glosar **acum**, iar clientul japonez confirmă lista scurtă înainte de public. Același rezultat, dar munca merge înainte.

**Fontul — sub-abordări:**
- **(a) `@fontsource/noto-sans-jp` feliat (greutățile 400 și 700), `unicode-range`. ✅ ALEASĂ.** Browserul descarcă doar feliile de care are nevoie; paginile fără japoneză nu descarcă nimic. Self-host, `font-src 'self'`, exact tiparul de azi.
- (b) Noto Sans JP variabil (un fișier ~1–2 MB, descărcat mereu dacă e referit). ❌ Respinsă: greu, fără câștig.
- (c) Doar fontul de sistem (Hiragino/Yu Gothic/Meiryo), zero octeți. ❌ Respinsă ca font principal (inconsistent de la un dispozitiv la altul), dar **rămâne în coada font-stack** ca plasă de siguranță.

## Cum se face (deciziile luate)

**`languages.json`:** adaugă `{ "code": "ja", "name": "日本語", "locale": "ja-JP", "public": false }`.

**`i18n/ja.json`:** toate cele 1.513 chei, traduse din `ro.json` folosind:
- `hu.json` ca model structural (aceleași chei, același loc) și glosarul japonez pentru termeni;
- registru: `です・ます` în fraze/mesaje (`保存しました。`), substantiv scurt pe butoane (保存 / 追加 / 削除 / キャンセル…), confirmări care numesc acțiunea (削除する / キャンセル), fără keigo greu, fără „あなた”;
- culori: cod + katakana (vezi glosar §3); termenii [propus] se pun ca cea mai bună variantă și intră în lista de confirmat;
- plural: doar forma `other`;
- punctuație full-width (、。！？), ghilimele 「」.

**Fontul (interfață):**
- `web/src/styles.css`: `@import '@fontsource/noto-sans-jp/japanese-400.css';` și `/japanese-700.css` (sau pachetul feliat echivalent), plus `@fontsource/noto-sans-jp` în `package.json` din `web/`.
- font-stack: `--font: 'Atkinson Hyperlegible Next Variable', 'Noto Sans JP', system-ui, sans-serif;` (latinul rămâne pe Atkinson, japoneza cade pe Noto; fontul de sistem e plasa de siguranță).
- reguli când `html[lang="ja"]`: `line-height` ~1.7–1.8, `line-break: strict`, `overflow-wrap: anywhere` (numere de inel/emailuri lungi), fără italice. `document.documentElement.lang` e deja pus de `useLang`.

**Formatarea:** nicio schimbare de cod — `formatDay/Date/Number` folosesc deja `localeOf()`; `ja-JP` dă formele corecte. Contorul de porumbei (羽) intră prin texte, nu prin cod. (Opțional, la alegerea constructorului: forma `2026年11月25日` în loc de `2026/11/25` — nu e obligatorie.)

**Consola vânzătorului:** câmpul „Limba” primește `ja` cu „(în probă)” (nepublică), ca `hu`. Fără alte schimbări în consolă (rămâne în română).

**Poarta de calitate (lansare):** `ja` rămâne `public: false` până clientul confirmă lista din glosar §8 (câteva culori, „galben”, culoarea ochilor, etichete tată/mamă/an, forma distanței „maraton”). Trecerea la `public: true` e un commit separat, de o linie, făcut **după** confirmare și cu acordul vânzătorului.

## Ce rămâne la constructor

- Traducerea efectivă, ecran cu ecran, urmând exact ordinea și fișierele din planul maghiar (`docs/superpowers/plans/2026-11-18-limbi-straine.md`), dar pentru `ja` în loc de `hu`: fundația (languages.json + ja.json de bază + font), apoi grupurile de ecrane. Testele `texte-ramase` și de consistență ghidează ce e gata.
- Alegerea exactă a cuvintelor pentru cheile unde glosarul dă [propus] — se pune cea mai bună variantă și se adaugă la lista de confirmat.
- Decizia minoră a formatului de dată (`2026/11/25` implicit vs `2026年11月日`).

## Decizii din reviewul constructorului (deciziile mele)

Un reviewer a citit designul; iată ce s-a lămurit, ca să nu se blocheze constructorul:

1. **Locurile cu `hu` scris în cod primesc și `ja`:** `src/table-values.js` (`readCode`, lista `['ro','hu']` → adaugă `'ja'`, ca importul Excel să prindă și numele japoneze); `src/pedigree-reader.js` (`NOTE_LANG` → adaugă `ja`, ca nota din citirea pozei să fie în japoneză); `test/i18n.test.js` (lista limbilor și mesajul „româna și maghiara" se actualizează cu `ja` nepublică); `web/.../import-excel.ts` (țara la `ja` — vezi întrebarea deschisă despre inele).
2. **Termenii nesiguri:** cea mai bună variantă japoneză pentru fiecare, niciodată română (vezi nota de la Non-scop). Lista de confirmat = glosar §8.
3. **Plural:** testul de consistență compară doar `{...}` (locurile de înlocuit) și cere forme nenule; **nu** compară mulțimea `one/few/other`. Deci cheile cu plural în `ja` au nevoie doar de forma `other` (obiect `{ "other": "…" }` sau șir simplu cu aceleași `{...}`). Fără schimbare de test pentru plural.
4. **Font — nu există service-worker/precache**, deci `@import`-ul feliat cu `unicode-range` e curat: paginile fără japoneză descarcă zero felii; `dist` crește cu fișierele statice (servite la cerere), acceptabil. `--mono` (IBM Plex Mono) rămâne neatins — ID-urile/inelele sunt ASCII, nu trec niciodată prin japoneză. Greutățile 500/600 pot fi lăsate pe snapping-ul browserului; constructorul adaugă 500 doar dacă arată prost.
5. **PDF-ul și fișa tipărită:** PDF-ul se face din DOM pe canvas (`html-to-image` + `jsPDF`). Deci, pentru japoneză, **fontul trebuie să fie încărcat înainte de rasterizare** (`await document.fonts.ready` sau încărcarea explicită a feliilor). În plus, fișa poate fi în altă limbă decât ecranul (`tIn`), așa că rădăcina componentei de fișă/pedigree primește explicit `lang="ja"` ca să prindă regulile `html[lang="ja"]` și fontul.
6. **„În probă" la nivel de cod:** `public:false` scoate `ja` din detectarea automată (`requestLang`/`guestLang`) și din butonul public de limbă. Dar un cont căruia **vânzătorul** i-a pus `accounts.lang = 'ja'` **vede** japoneza și poate comuta între limbile publice + limba lui (ca la maghiară, planul hu Task 6). Așa poate clientul japonez să vadă și să confirme traducerea **înainte** de public.
7. **Verificare vizuală (per grup de ecrane, la 360px, în `ja`):** butonul de limbă `日本語`, cardurile din Panou, celulele arborelui/pedigree, contoarele `羽`, formularul de adăugare. Mirror la pașii „în browser" din planul hu.
8. **Banii:** `formatMoney` nu are niciun apel azi, deci niciun preț nu se vede — nu apare `$` niciunui utilizator japonez. Yenii rămân integral pe Paddle.

## Datele japoneze (în scop — pașii 2 și 3)

Vânzătorul a cerut „tot", deci pe lângă interfață intră și:

**A. Recunoașterea inelelor japoneze.** Din cercetare: prefix `JAPAN`/`JPN` (JRPA) și `NIPPON` (cealaltă asociație), format `yy-nnnn` (primele două cifre = anul). Se adaugă reguli JP la parsarea inelelor (lângă regulile RO/HU de azi) și `JP` ca țară pentru conturile `ja` la import (`import-excel.ts`). Construit din cercetare; **verificat cu numere de inel reale de la client**.

**B. Citirea pedigree-urilor scrise în japoneză** (poze + Excel în kanji):
- Citirea din poză (`src/pedigree-reader.js`): promptul spune că fișa poate fi în japoneză; nota se scrie în japoneză (`NOTE_LANG.ja`); potrivirea culorilor/stărilor din numele citit prinde și japoneza (`readCode` cu `ja`, vezi decizia 1).
- Import Excel: antetele și numele de culori japoneze se potrivesc (prin `readCode`+`ja`); datele japoneze se citesc.
- Construit din cercetare + glosar; **verificat cu o poză și un Excel de pedigree japonez reale de la client**.

**Poarta de calitate (ca la traducere):** părțile A și B se construiesc acum, dar nu se declară „merg" până nu sunt probate pe **mostre reale**. De cerut vânzătorului: câteva numere de inel japoneze + o poză și/sau un Excel de pedigree japonez.

**Ordine:** 1) interfața (grosul), 2) inelele japoneze, 3) citirea documentelor japoneze. Interfața poate fi gata și „în probă" înainte ca A și B să fie verificate.

## Plan

Planul detaliat (task-uri) se scrie cu `superpowers:writing-plans` după aprobarea acestui design.
