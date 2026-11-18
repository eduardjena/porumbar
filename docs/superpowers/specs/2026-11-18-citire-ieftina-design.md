# Citirea din poze, ieftină (cel mult 3 $ pe an pe crescător)

Data: 2026-11-18 · Branch: `feat/citire-ieftina`

## De ce
Din cei ~30 $ ai abonamentului, citirile din poze să coste cel mult 3 $ pe an pe crescător (azi, pe Opus, ~0,10–0,17 $ pe
citire → până la ~30 $ la 200 de citiri). Vânzătorul a cerut-o; ideile lui (Haiku / Sonnet, fără „gândire”, JSON fără
câmpuri goale, prompt caching) au fost cântărite.

## Ce se face
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

## Neverificat încă
Fără cheie API nu s-a făcut nicio citire reală. Înainte să conteze, un test pe 10–20 de fișe reale (tipar și scris de
mână): Haiku fără gândire vs Sonnet, căsuță cu căsuță, cu costul real.
