# Strămoșii de la tată și de la mamă – design

Data: 2026-11-24. Ramura: `feat/stramosi-comuni` (worktree `C:\dev\porumbar-cuib`, din `main` aab52f2).
Site-ul: repo-ul separat `C:\dev\porumbar-site`, ramură proprie din `main`.

## De ce

Un crescător a cerut: „Strămoșul care apare și la tată, și la mamă să fie colorat pe pedigree și în graful rudelor.”
Strămoșul comun al tatălui și al mamei e cel care dă consangvinizarea; crescătorul vrea să-l vadă dintr-o privire.
Azi Porumbar colorează **orice** strămoș care se repetă (și unul care apare de două ori doar la tată), așa că cele două
cazuri arată la fel, iar în graful rudelor (Rețea) strămoșii comuni nu sunt deloc scoși în evidență.

## Ținte

1. Pe fiecare pedigree, strămoșul care apare **și în jumătatea tatălui, și în jumătatea mamei** se vede ca atare:
   culoare plină + semnul „T+M”.
2. Strămoșul care se repetă **doar pe o parte** rămâne marcat, mai discret: doar contur colorat (varianta A, aleasă de
   vânzător – cine împerechează în linie vrea să vadă și repetarea pe o parte).
3. În graful rudelor pornit de la un porumbel, strămoșii lui „la tată și la mamă” sunt marcați.
4. Pe site (`index.html` și `hu.html`) câteva rânduri despre asta, după ce funcția e publicată în aplicație.

## Non-ținte

- Alt calcul al consangvinizării sau alt procent.
- Marcaj în graful „Tot porumbarul” (acolo nu există un singur tată și o singură mamă).
- Marcaj pe pedigree-ul citit din poză (`pedigree-hartie`), care e doar o verificare a cititului.

## Anti-ținte

- Un „T+M” pe un strămoș care pe foaia omului apare o singură dată (a doua apariție fiind dincolo de generațiile
  arătate). De aceea regula ține de **ce se vede pe foaie**, nu de lista consangvinizării (care merge 6 generații).
- Același strămoș marcat diferit pe ecran și pe foaia tipărită cu aceleași generații.
- Marcaj doar prin culoare (foaia se tipărește și alb-negru; unii nu deosebesc culorile): semnul „T+M” e text.
- Culoarea nou-adăugată în graf să se confunde cu culorile notei (cele 5 trepte + gri), ale sexului sau cu porumbelul ales.

## Căi luate în calcul

| Cale | Ce face | De ce (nu) |
|---|---|---|
| **A (aleasă)** | Regula „la tată și la mamă” e o singură funcție pură; serverul o aplică arborelui (`buildTree`), iar foaia de pedigree (care lucrează pe fișierul de pedigree, și pentru pedigree-uri primite de la alții) aplică aceeași regulă pe inele. Graful primește lista de la server. | Toate locurile arată la fel; o schimbare se face într-un loc. |
| B | Fiecare ecran își face socoteala. | Aceeași regulă de cinci ori; ușor rămâne un ecran pe dinafară. |
| C | Folosirea listei `coi.common` de lângă procent. | Merge 6 generații, mai mult decât arată foaia: „T+M” pe un strămoș văzut o singură dată. |

Notă: foaia tipărită / PDF / pedigree-ul public (`shared/pedigree-sheet.ts`) nu folosește `buildTree`, ci fișierul de
pedigree (PedigreeV1, cu inele), și își calculează singură repetările după inel. Regula trebuie deci să existe în două
locuri (server, pe id-uri; foaie, pe inele) – o funcție mică în fiecare, cu aceleași cazuri de test.

## Regula

Pe un pedigree cu rădăcina R (porumbelul), un strămoș X este **„la tată și la mamă”** dacă, între generațiile
arătate, X apare cel puțin o dată în jumătatea tatălui (tatăl inclusiv) **și** cel puțin o dată în jumătatea mamei
(mama inclusiv). Exemplu: la o împerechere tată × fiică, tatăl lui R este și tatăl mamei: e „la tată și la mamă”.

**Doar cel mai apropiat** (ales de vânzător): strămoșii unui strămoș comun apar și ei de ambele părți, dar nu primesc
„T+M” prin el – altfel o împerechere frate × soră ar colora jumătate de foaie. Socoteala merge de la generația cea mai
apropiată spre cea mai depărtată: odată ce Y e „la tată și la mamă”, casetele de deasupra lui Y (strămoșii lui Y, în
acele locuri) nu mai contează pentru „T+M”. Un strămoș X primește „T+M” doar dacă apare în ambele jumătăți **în casete
care nu stau deasupra unui „T+M” mai apropiat**. Strămoșii lui Y care se repetă păstrează conturul discret de „se
repetă”. (Seamănă cu lista de lângă procentul de consangvinizare, dar nu e aceeași: lista merge pe drumuri, așa că
poate arăta și un strămoș de deasupra unui „T+M” care ajunge pe cealaltă parte și pe un drum independent, nu doar prin
el – vezi cazul `mai_aproape_si_independent` din `test/fixtures/stramosi-comuni.json`. Foaia rămâne la regula de mai
sus.)

Un strămoș care apare de mai multe ori, dar nu e „T+M”, e **„repetat”** (contur discret): fie se repetă doar pe o
parte, fie stă deasupra unui „T+M” mai apropiat.

Identitatea: în aplicație, după id-ul porumbelului (ca acum); pe foaie, după inel (fără inel nu se compară).

Cazuri (deciziile mele, după verificarea designului):
- Cu un singur părinte cunoscut, nimic nu e „la tată și la mamă”. Ciclurile vechi din date (tăiate de `buildTree`)
  înseamnă doar o casetă lipsă.
- Pe foaie, inelele se compară **normalizate** (fără spații, cratime, bare, litere mici/mari – ca la căutare), atât
  pentru repetări cât și pentru „T+M”: „RO 123456” și „RO-123456” sunt același porumbel. Câteva foi vechi pot primi
  astfel culori noi, corecte.
- Foaia își face socoteala la afișare: pedigree-urile publice deja trimise prin cod QR arată marcajul nou fără nicio
  schimbare a fișierului de pedigree.
- Rețea → Arbore (evantai, carduri) folosește același `GET /pigeons/:id/tree` (`buildTree`), deci citește câmpul nou.
- Graful: `common` se calculează pe toți strămoșii parcurși în cele `up` generații (implicit 5, cât are și cel mai
  mare pedigree), nu pe limita „Tot porumbarul”. Pe un arbore cu mai puține generații, graful poate marca un strămoș
  pe care foaia nu-l arată de două ori – acceptat: fiecare arată ce are desenat.
- „T+M” în maghiară: forma propusă se livrează și se trece pe lista de citire nativă, ca celelalte texte.

## Cum arată

### Arborele de pe fișa porumbelului (`pages/porumbel/arbore.ts`)

- „La tată și la mamă”: fundalul pastel de azi (culoarea grupului) + chenar de 2px în aceeași nuanță, închisă + un semn
  mic „T+M” (text și chenar închise, fără fundal) în rândul inelului.
- „Repetat”: fără fundal, doar chenar de 2px în nuanța închisă a grupului (paleta închisă are contrast ≥ 3:1 pe alb și
  pe fundalul paginii; pastelul ar fi avut ~1,3:1).
- Legenda de sub arbore: fiecare grup cu inelul, „apare de N ori” și, la cei de pe ambele părți, „ · [T+M] la tată și
  la mamă” (același semn ca în casete); aceștia primii.

### Foaia de pedigree (tipar, PDF, pedigree-ul public prin cod QR – `shared/pedigree-sheet.ts`)

- „Repetat”: chenar subțire în culoarea grupului + dungă în stânga, în aceeași culoare.
- „La tată și la mamă”: chenar mai gros + un al doilea inel colorat înăuntru (dublu contur, în locul dungii) + semnul
  „T+M” în rândul inelului (text și chenar închise, fără fundal; nu acoperă inelul, nu adaugă înălțime).
- Când foaia are măcar un „T+M”, se explică: „T+M = la tată și la mamă” (`fisa.tm`) – pe foaia tipărită jos, în
  coloana din dreapta, sub „Strămoșii colorați la fel…” (încape în subsolul de 18 mm), pe pagina publică sub foaie.
- Se tipărește (`print-color-adjust`), iar „T+M” se citește și alb-negru. Foaia A4 nu are voie să crească peste o pagină.

### Rețea → vederile Arbore (`vedere-evantai.ts`, `vedere-carduri.ts`)

- Evantai: „la tată și la mamă” = contur gros (de azi) + semnul „T+M” pe felie, unde încape (după lungimea textului în
  limba ecranului; altfel doar conturul); „repetat” = contur subțire. „T+M” se socotește pe generațiile desenate (pe
  telefon 3, din arborele de 4), cu aceeași regulă (`tmKeys`), ca să nu vină de la o felie nedesenată.
- Carduri: eticheta colorată „×N” rămâne la toți cei repetați; cei de pe ambele părți primesc în plus semnul „T+M” în
  rândul de jos (anul, „al tău”), ca să nu strângă inelul.

### Graful rudelor (Rețea, pornit de la un porumbel – `retea.ts`)

- `GET /api/network?rootId=…` întoarce în plus `common: number[]`: id-urile strămoșilor rădăcinii care sunt „la tată și
  la mamă” în cele `up` generații în sus din care e făcut graful.
- Nodurile din listă: un al doilea contur (outline) într-o culoare proprie „T+M”, deosebită de notă, sex, accent și
  haloul porumbelului ales, plus „T+M” ca rând în eticheta nodului.
- Sub grafic, o linie de legendă: „T+M = strămoș al porumbelului, și la tată, și la mamă” – doar când lista nu e goală.
- Fără `rootId` („Tot porumbarul”): `common` lipsește sau e gol, nimic nou pe ecran.

### Site-ul (`C:\dev\porumbar-site\public\index.html`, `hu.html`)

- O frază în lista de funcții (lângă consangvinizare), de ex.: „Strămoșul care apare și la tată, și la mamă e colorat pe
  pedigree și în desenul rudelor, ca să vezi dintr-o privire de unde vine consangvinizarea.” și traducerea maghiară.
- Pe o ramură proprie din `main`-ul site-ului; trimis / urcat doar cu aprobarea vânzătorului și **după** ce aplicația e
  publicată. Ramura `feat/plata-paddle` a site-ului primește aceeași frază la unire (sau prin cherry-pick).

## Constrângeri

- PostgreSQL, Node 24 ESM, Express 5, Angular standalone / signals / zoneless. Fără migrare de bază de date.
- Orice text nou vizibil, în `i18n/ro.json` (cu `sens`) și în `i18n/hu.json`; „T+M” e și el cheie (în maghiară o
  formă scurtă potrivită, de ex. „apa+anya”), iar formularea lungă „la tată și la mamă” e în legendă / `title`.
- Text de bază 18px, contrast mare, fără emoji; nimic nu depășește lățimea la 320px.
- Câmpul nou în arbore: pe nodurile din `buildTree`, alături de `repeat` (de ex. `both: boolean`); `repeat` rămâne ca
  acum (grupul și culoarea nu se schimbă).
- Date de test doar inventate.

## Lăsat constructorului

- Numele câmpului nou (`both` sau altul) și forma funcției comune.
- Culoarea exactă a marcajului „T+M” din graf (verificată față de culorile notei, sexului și accentului).
- Așezarea exactă a semnului „T+M” în casete și pe felia evantaiului, cât să nu acopere inelul.
- Locul exact al frazei pe site și formularea finală în maghiară (citire nativă dorită, ca la celelalte texte).
