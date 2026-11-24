# Toate fișele deodată – design

Data: 2026-11-24. Ramura: `feat/fise-toate` (worktree `C:\dev\porumbar-cuib`, din `main` dd11b75).

## De ce

Vânzătorul: „să își salveze fișele toate cu un singur buton – save as PDF, dar să îi facă X fișe”. Azi fișa de pedigree se
tipărește / salvează ca PDF doar porumbel cu porumbel. La sfârșit de sezon, pentru o rezervă pe hârtie, pentru un
cumpărător sau o licitație, omul ar trebui să deschidă zeci de fișe una câte una.

Cerința lui: **să nu dubleze nimic** din ce există deja și să aibă sens lângă butoanele de acum.

## Ce există azi (toate pentru un singur porumbel)

- Pagina de tipar `/porumbei/:id/tiparire` (`pages/porumbel/tiparire.ts`): limba fișei (`sheetLang`), „Pune cod QR”,
  „Tipărește / Salvează PDF” (`window.print()`, browserul face PDF-ul). Se ajunge la ea din cardul Panoului, rândul Listei,
  fila Pedigree și fila QR.
- „Trimite” (`core/share-pdf.ts`): fișa ca PDF-imagine făcut pe telefon, dat meniului de partajare sau descărcat.
- Tipărirea pedigree-ului public (din codul QR).
- Excel: doar aducerea porumbeilor **din** Excel; nu există export spre Excel.

## Ținte

1. În bara comună a Panoului și a Listei (`porumbar-cadru.ts`, aceeași căutare și aceleași filtre), un buton
   **„Tipărește fișele (N)”**: N = porumbeii care se văd acum (după căutare și filtre), în ordinea de pe ecran.
2. Butonul deschide **aceeași pagină de tipar** (aceeași componentă, aceeași alegere de limbă, același buton „Tipărește /
   Salvează PDF”), doar că cu N fișe, câte una pe foaie A4. Rezultatul: un singur PDF cu N pagini, salvat din fereastra
   de tipărire a browserului.
3. Codul QR: fișele fără cod ies fără el. Pe pagină scrie câte sunt fără cod („12 fișe fără cod QR”) și un buton
   „Pune cod QR pe toate”, care cere întâi confirmarea (aceeași explicație ca la „Pune cod QR” de pe o fișă: oricine are
   linkul vede fișa). **Codul nu se pune niciodată fără confirmare** (ales de vânzător).

## Non-ținte

- „Trimite” pentru mai multe fișe (PDF-imagine făcut pe telefon): rămâne pentru un porumbel. Două feluri de a face același
  PDF ar fi exact dublura de evitat.
- Export Excel / CSV, arhivă ZIP cu PDF-uri separate, PDF făcut pe server.
- Alegerea porumbeilor bifând unul câte unul: alegerea se face cu filtrele și căutarea care există deja.
- Butonul pe fila Rezultate (acolo lista e de rezultate, nu de porumbei).

## Anti-ținte

- O a doua pagină de tipar, care arată altfel decât cea de azi, sau o fișă care arată altfel în teanc decât singură.
- O fișă ruptă pe două pagini, pagini goale între fișe sau la sfârșit.
- Coduri QR (linkuri publice) pornite fără ca omul să fi confirmat.
- Fișele altui cont (id-uri străine în adresă) – se ignoră.
- Pagina de tipar a unui singur porumbel schimbată în vreun fel la vedere sau la tipar.

## Căi luate în calcul

| Cale | Ce face | De ce (nu) |
|---|---|---|
| **A (aleasă)** | Pagina de tipar existentă primește una sau mai multe fișe; tiparul browserului face PDF-ul. | Un singur loc pentru tipar; PDF-ul e vectorial (clar, mic); serverul doar trimite date. |
| B | „Trimite” face un PDF-imagine cu N pagini pe telefon. | Lent și greu pe telefoane vechi (~0,5 MB pe pagină), și dublează pagina de tipar. |
| C | PDF făcut pe server. | Bibliotecă grea pe server (browser fără ecran), consum pe Railway; fără câștig pentru om. |

Costul pe Railway (calea A): serverul trimite doar datele fișelor (câțiva kB fiecare), într-o singură cerere; PDF-ul îl
face browserul omului. Fără tokenuri Claude.

## Cum arată

```
[Înapoi]   40 de fișe                    Limba fișei: [Română ▾]   [Tipărește / Salvează PDF]
           12 fișe fără cod QR   [Pune cod QR pe toate]
┌──────────── fișa 1 (A4) ────────────┐
└─────────────────────────────────────┘
┌──────────── fișa 2 (A4) ────────────┐
…
```

- Pe ecran: fișele una sub alta, ca fișa de azi. La tipar: câte o fișă pe pagină, nimic din bară.
- Cât se încarcă: „Se pregătesc 40 de fișe…”.
- „Înapoi” duce acolo de unde s-a venit (Panou sau Listă), cu filtrele neschimbate.
- Contul „doar citire”: tiparul merge (ca acum); „Pune cod QR pe toate” primește fraza de activare obișnuită (402), ca
  „Pune cod QR” de azi.

## Deciziile mele (de verificat la citire)

- **Limita: 200 de fișe deodată.** Peste, butonul arată mesajul „Sunt N porumbei; tipărește cel mult 200 deodată – pune un
  filtru (de ex. anul)”. Motiv: 200 de pagini A4 sunt deja grele pentru fereastra de tipărire a unui telefon.
- **O singură cerere** pentru toate fișele (rută nouă, de ex. `GET /api/pigeons/pedigrees?ids=…`, întoarce pentru fiecare
  pedigree-ul și linkul public), doar porumbeii contului, în ordinea cerută; tot așa o rută pentru „Pune cod QR pe toate”
  (păstrează linkurile care există deja).
- Porumbeii aleși trec în adresa paginii (`?ids=…`), ca pagina să se poată reîncărca.
- Butonul e dezactivat când N = 0.

## Constrângeri

- PostgreSQL, Node 24 ESM, Express 5, Angular standalone / signals / zoneless. Fără migrare de bază de date.
- Orice text nou vizibil, în `i18n/ro.json` (cu `sens`) și în `i18n/hu.json`.
- Text de bază 18px, butoane ≥ 48px, contrast mare, iconițe SVG proprii, fără emoji; fără derulare laterală la 320px.
- Fișa tipărită: aceeași componentă (`shared/pedigree-page.ts`), A4, o pagină pe porumbel.
- Date de test doar inventate.

## Lăsat constructorului

- Adresa exactă a paginii pentru mai multe fișe (atenție: `porumbei/:id` ar prinde „tiparire” ca id dacă ruta nu e pusă
  înainte) și cum se împarte componenta între un porumbel și mai mulți.
- Numele și forma rutelor noi de pe server.
- Locul exact al butonului în bară, pe calculator și pe telefon.
