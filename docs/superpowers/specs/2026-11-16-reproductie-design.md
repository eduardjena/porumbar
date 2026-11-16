# Reproducția (design scurt)

Cerut de utilizator (2026-11-16): „fă-le și pe astea dacă în aplicațiile străine există”. Aproape toate programele de
porumbar (Pigeon Loft Organizer, WingLoft, PigeonProfile, LoftMate, AviLoft, pigeon.plus) au: perechi pe sezon,
ponte / ouă, data eclozării calculată, inelarea puilor cu inelul următor propus, doici. Spec principal §5a.

## Ce face
- **Perechi** pe sezon (anul): mascul × femelă, data împerecherii (goală = pereche plănuită), cuibul / boxa, notă,
  data despărțirii. Arată consangvinizarea puilor (calculul existent `/pairs/coi`).
- **Ponte**: data primului ou (și a celui de-al doilea), câte ouă, limpezi (nefecundate), sparte, data eclozării și câți
  pui au ieșit, doica (altă pereche care clocește ouăle), notă. Programul arată eclozarea așteptată (17–19 zile de la
  primul ou) și când se inelează (6–8 zile de la eclozare).
- **Inelarea puiului**: din pontă, cu inelul propus din seriile de inele; puiul devine porumbel al crescătorului, cu
  tatăl și mama completați, data eclozării, starea „Tânăr”, sexul necunoscut până se știe.
- **Seriile de inele** ale anului (primul și ultimul inel, de ex. RO-26-800540 → RO-26-800589): la inelare se propune
  cel mai mic inel liber din serie.

## Abordări
- **A (aleasă):** perechea și ponta ca rânduri separate, puiul legat de pontă (`pigeons.clutch_id`). Ca în programele
  de mai sus; puii unei perechi se văd pe pontă, iar fișa puiului are deja părinții.
- B: doar „pui” cu părinți, fără perechi și ponte. Mai simplu, dar fără datele așteptate, ouă limpezi și doici — exact
  ce oferă celelalte programe. Respinsă.

## Reguli
- Separare totală: perechile, pontele și seriile sunt ale contului; porumbeii perechii sunt ai contului (proprii sau
  strămoși / împrumutați), masculul are sexul M, femela F.
- Aceeași pereche (același mascul și aceeași femelă) o singură dată pe sezon.
- Fără abonament: doar citire (ca restul).
- Ștergerea perechii șterge pontele ei; puii inelați rămân (cu părinții lor).
