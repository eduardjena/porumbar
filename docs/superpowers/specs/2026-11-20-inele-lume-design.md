# Inelele din toată lumea: design (scurt)

Data: 2026-11-20 · Branch: `feat/inele-lume` (worktree `C:\dev\porumbar-inele`) · Cercetarea:
`docs/cercetare/reports/Formatele inelelor de porumbei.md` (+ notele din `docs/cercetare/research_notes/…`).

## De ce
Crescătorul cumpără sau primește porumbei din toată lumea. Azi `src/rings.js` recunoaște ~25 de coduri, dar nu
inelele britanice cu literă de serie, cele poloneze / cehe / slovene cu club, cele chinezești cu provincie,
japoneze, americane (AU/IF cu cod de club), sud-africane (ZA), australiene (asociația de stat), din Golf etc.
Un porumbel **propriu** cu un inel nerecunoscut nu poate fi salvat deloc („Inelul nu poate fi citit”).

## Ce vrea vânzătorul
Aplicația să recunoască inelele din toată lumea (cât se poate, după raport), iar ce tot nu recunoaște să nu-l
blocheze pe om: inelul se păstrează exact cum l-a scris, cu rugămintea „verifică-l”.

## Decizii
1. **Un parser pe bucăți (tokeni), nu pe poziții fixe**, cu tabelul de alias-uri din raport (codurile de țară /
   emitent și variantele lor → un cod canonic). Formatele marcate în raport O (oficial) și E (exemple reale) se
   recunosc; cele N doar dacă se potrivesc cu tiparul generic fără ambiguitate.
2. **Compatibilitate totală cu datele existente:** pentru toate inelele recunoscute azi, `parseRing` →
   `ringKey` și `formatRing` dau **exact** aceeași cheie și aceeași afișare ca acum (cheile sunt în baza de date:
   `ring_key`, `ring_country`, `ring_year`, `ring_club`, `ring_number`). Fără migrare de date. Partea din mijloc
   nouă (litera de serie GB/IHU/JPN, provincia CHN, codul de club AU/IF/ZA, filiala PL, asociația australiană)
   intră în `club`; emitentul care nu e țară (AU, IF, CU, NEHU, IHU, VRPU, CTRPA…) e codul canonic de „țară”.
3. **Coliziuni** (după raport): `AU` = SUA (American Racing Pigeon Union), nu Australia; `CU` = Canada; `PL-DE-…` =
   inel polonez de Derby (nu Germania); `V`/`W` după un număr DV = sexul; `S`/`N` după anul IHU = regiunea.
   **`AUS` rămâne Austria** (decizia constructorului: aplicațiile românești, de ex. myloft, scriu Austria „AUS”;
   Australia scrie „AUST” sau codul asociației). `SA`: Africa de Sud doar în forma veche cu cod de uniune
   (`SA 2004 THU 17193`); altfel nu se ghicește.
4. **Plasă de siguranță:** un inel nerecunoscut (nici fără inel „000”, nici maghiar fără organizator) se poate
   salva și la un porumbel propriu. Se păstrează textul (`ring_raw`), iar cheia de comparare e textul normalizat
   (litere mari, fără spații / cratime / puncte / slash), cu un prefix care nu se poate confunda cu o cheie
   recunoscută (de ex. `?|…`), ca dublurile să fie găsite și așa. Câmpul de inel arată, în loc de eroare, un
   avertisment blând: „Nu recunosc formatul; îl păstrez cum l-ai scris. Verifică-l.” (ro + hu). Inelele maghiare
   fără organizator rămân refuzate ca acum (numerele se repetă între asociații).
5. **O singură sursă de reguli** pentru server și pentru previzualizarea din telefon (`web/src/app/shared/
   ring-input.ts` → `previewRing`), dacă se poate (un modul comun importat de ambele). Dacă nu, un test rulează
   tabelul de exemple prin amândouă și cere același rezultat.
6. **Teste:** un tabel mare de exemple reale din raport (intrare → afișare normalizată, cheie, țară, an, club,
   număr, sex), plus toate testele de inele de azi neschimbate, plus testul de compatibilitate (exemplele vechi dau
   aceleași chei).
7. **Anul pe 2 cifre:** ≤ anul curent + 1 → 20AA, altfel 19AA (inelele de sezon din Taiwan au anul următor).

## Ce nu facem
- Nu schimbăm cheile inelelor existente și nu migrăm date.
- Nu întrebăm omul „ce țară e?” printr-un dialog nou; avertismentul blând e suficient.
- Nu atingem plata (alt branch).

## Lăsat constructorului
Forma exactă a afișării pentru familiile noi (ex. `GB-22-T-12345` sau `GB22T12345`), cu condiția să fie
consecventă și să păstreze zerourile semnificative; organizarea tabelului de alias-uri; numele cheilor de text.
