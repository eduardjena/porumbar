# Rezultatele la concursuri – introducerea de mână (design scurt)

Cerut de utilizator (2026-11-16): „Da, manual întâi”, după ce am stabilit că nu există un format oficial unic de fișier,
dar că pe pedigree-uri rezultatele se scriu `1e-603KM-3025P-'22`, iar clasamentele columba.ro au coloane fixe
(spec principal §4 „Rezultatele concursurilor”, §8 punctul 8, exemplul `docs/exemple/clasament-columba-lipit.txt`).

## De ce
Crescătorul își trece rezultatele porumbeilor lui; ele apar pe fișă, pe pedigree (tipărit, link public, la vânzare)
și pregătesc lipirea clasamentului de pe columba.ro (etapa următoare), care va completa aceleași câmpuri.

## Abordări
- **A (aleasă): concursul separat de rezultat.** Un concurs (data + locul lansării + categoria + organizatorul) e un rând
  al contului; rezultatul leagă porumbelul de concurs. Al doilea porumbel din același concurs alege concursul din listă,
  nu retastează; clasamentul lipit mai târziu găsește concursul și nu dublează.
- B: un rând plat per rezultat, cu toate datele concursului copiate. Mai simplu azi, dar lipirea clasamentului ar dubla
  concursurile și omul ar retasta datele pentru fiecare porumbel. Respinsă.

## Câmpuri (aceleași ca la columba.ro)
- Concurs: nr. concursului (opțional), organizator (club / județ, text), categoria (Viteză, Semifond, Fond, Mare fond,
  Maraton, Pui, Altele), data, locul lansării, ora lansării (opțional), porumbei angajați (opțional, dar fără el nu se
  calculează coeficientul).
- Rezultat: locul (obligatoriu), distanța (km, cu zecimale; salvată în metri), ziua și ora sosirii (opțional),
  viteza m/min (opțional; calculată singură din ora lansării + ora sosirii în ziua 1 + distanță), coeficientul FCI
  (opțional, cum scrie în clasament), „apare pe pedigree” (implicit da).
- Calculat, nu salvat: coeficientul de penalizare = loc × 1000 / angajați (columba: loc 1 din 10.023 → 0,10) și
  rândul scurt `1e-197KM-10023P-'26`.

## Reguli
- Doar în contul omului (separare totală); orice porumbel al contului (și strămoșii, pentru rezultate cunoscute).
- Același porumbel o singură dată în același concurs.
- Fără abonament: doar citire (ca restul).
- Pe pedigree (fișa tipărită, linkul public, vânzarea / preluarea): rândurile scurte ale rezultatelor bifate, înaintea
  textului de pedigree. La preluare / cumpărare, rândurile intră în textul de pedigree al porumbelului nou.
- Nota (valoarea 0–100) nu se schimbă acum; rezultatele intră în notă într-un pas următor.
