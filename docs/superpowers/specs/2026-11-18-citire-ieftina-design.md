# Citirea din poze, ieftină (cel mult 3 $ pe an pe crescător)

Data: 2026-11-18 · Branch: `feat/citire-ieftina`

## De ce
Din cei ~30 $ ai abonamentului, citirile din poze să coste cel mult 3 $ pe an pe crescător (azi, pe Opus, ~0,10–0,17 $ pe
citire → până la ~30 $ la 200 de citiri). Vânzătorul a cerut-o; ideile lui (Haiku / Sonnet, fără „gândire”, JSON fără
câmpuri goale, prompt caching) au fost cântărite.

## Ce s-a plănuit întâi (înlocuit de „Decizia” de la final)
- **Citirea obișnuită pe Claude Haiku 5.5** (0,10 $ / 0,50 $ pe milion de jetoane), **fără „gândire”**, efort mic.
- **„Recitește cu precizie maximă”**: buton după o citire, aceeași poză pe **Claude Sonnet 5.5** (2 $ / 10 $), fără
  „gândire” (`between_tools`). Mai vizibil când programul vede inele care nu se pot citi (`unclear` în răspuns).
- **Plafon de bani pe an pe crescător**: `PEDIGREE_BUDGET_USD`, implicit 3 $; peste el citirea se oprește (mesaj ca la
  citirile epuizate, fără bani), iar butonul de precizie dispare cu 0,10 $ înainte de plafon.
- **JSON fără câmpuri goale**: în schemă doar numărul căsuței e obligatoriu.
- Costul fiecărei citiri se socotește după modelul ei (tabel de prețuri în `src/pedigree-reader.js`; un model necunoscut
  la prețul cel mai mare). Variabile: `PEDIGREE_MODEL` (implicit `claude-haiku-5-5`), `PEDIGREE_MODEL_PRECISE` (implicit
  `claude-sonnet-5-5`), `PEDIGREE_PRICE_INPUT` / `PEDIGREE_PRICE_OUTPUT` (doar pentru modelul principal).
- Recitirea se numără ca o citire din cele 200.

## Ce nu se face (deocamdată)
- Chei JSON scurtate (`r`, `n`…): economie mică la Haiku, risc de citire mai proastă.
- Prompt caching: ~0,02 cenți pe citire la Haiku; cere mutarea instrucțiunilor înaintea pozei.
- Batch (50% reducere): răspuns după minute / ore; doar dacă vine încărcarea mai multor fișe deodată.

## Primul test (2026-11-18, aproximativ)
Fără cheie API, testul s-a făcut prin Claude Code: Haiku 5.5 și Sonnet 5.5 au citit, cu aceleași instrucțiuni ca
aplicația, cele 3 fișe reale de pe calculator (2 tipărite, 1 scrisă de mână). Nu e chiar cererea din aplicație (fără
schema JSON impusă, fără setarea de „gândire”), deci e un semn, nu o măsurătoare; costul nu s-a putut măsura.
- Tipărite (46 de inele): Haiku 46/46 (fără căsuța „000 M” de neinelat), Sonnet 46/46.
- Scrisă de mână (31 de inele): la prima încercare Haiku citea „NL” drept „ML” / „MC” și amândouă puneau „AS” în
  inel. După ce instrucțiunile au cerut doar inelul în câmpul de inel și au spus că „NL” scris de mână seamănă cu „ML”:
  Haiku 28/31 corecte (lipsă: porumbelul de sub autocolant, o țară tăiată pe margine, o cifră nesigură și în referință).
- Concluzie: Haiku e de ajuns pentru citirea obișnuită; Sonnet rămâne pentru „Recitește cu precizie maximă”.
  Testul se repetă pe mai multe fișe, cu cererea adevărată, când există cheia API.

## Testul real (2026-11-19, cu cheia API)
Aceleași 3 fișe, cererea adevărată din aplicație (prin serverul local și direct la API, aceeași schemă și aceleași
instrucțiuni). Inele corecte față de referință, timp, cost pe citire:
- **Haiku 5.5 fără gândire** (cum era pe branch): 2/31, 4/15, 1/31. Citește inelele, dar le pune în căsuțe greșite și
  se oprește la jumătate. ~0,1 cenți, 5 s. Nu e folosibil.
- **Haiku 5.5 fără gândire, efort mare**: 3/31, 11/15, 2/31. La fel.
- **Haiku 5.5 cu gândire adaptivă, efort mediu** (17 rulări): de cele mai multe ori 30–31/31, 15/15, 27–29/31, dar cam
  1 din 6 rulări iese prost (se oprește la 1–8 căsuțe sau încurcă așezarea pe fișa de mână, uneori fără niciun semn).
  ~0,3–0,6 cenți, 20–39 s. Cu efort mic: la fel de nesigur. Cerându-i întâi să numere căsuțele: oprirea la jumătate
  dispare pe tipărite (8/8), dar pe fișa de mână tot încurcă de 2 ori din 4.
- **Sonnet 5.5** (`between_tools`, efort mic, 13 rulări): 31/31, 15/15, 28–30/31 de fiecare dată. ~2,4–3,2 cenți,
  10–12 s.
- Concluzie: Haiku e ieftin, dar nesigur și chiar mai lent; Sonnet e sigur. Cu Sonnet, 3 $ pe an ajung pentru ~110
  citiri.

## Decizia (2026-11-19, vânzătorul)
**Sonnet 5.5 pentru orice citire, 100 de citiri pe an incluse** (în loc de 200), plafonul rămâne 3 $ pe an pe crescător.
Butonul „Recitește cu precizie maximă” a fost scos (nu mai are rost cu un singur model). Rămâne mesajul „N inele n-au
ieșit clar: verifică-le în căsuțe înainte să salvezi”. Cine are nevoie de mai multe citiri le primește de la vânzător
(„Dă citiri în plus”). Partea de mai sus despre Haiku / „precizie maximă” e istoria deciziei.
