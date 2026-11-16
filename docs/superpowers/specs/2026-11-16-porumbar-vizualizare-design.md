# Porumbar – Planul 1b: trei feluri de a vedea porumbarul (design scurt)

Data: 2026-11-16. Completează designul principal (`2026-11-16-porumbar-design.md`). Cerut de utilizator: să-și vadă
porumbarul pe porumbel, ca rețea (unde liniile genealogice se suprapun) și per total, cu cei mai valoroși primii,
colorați după valoare; ușor de folosit pe telefon.

## De ce

Arborele (Planul 1) arată un strămoș comun de mai multe ori (`1954746/04 NL` de 3 ori), iar crescătorul vrea să vadă
unde se întâlnesc liniile și care sunt porumbeii lui cei mai buni dintr-o privire.

## Ce se face

1. **Un porumbel** (există): căutare după inel / nume / poreclă; fișa; arborele până la 10 generații. **Nou:** în fiecare
   căsuță a arborelui, anul nașterii (data eclozării dacă există, altfel anul din inel, de ex. „2015”).
2. **Rețeaua de rudenie** (pagină nouă, „Rețea”): fiecare porumbel apare **o singură dată**; linii de la părinți la pui;
   generațiile de la stânga (strămoși) la dreapta (urmași). Pornește de la un porumbel ales (strămoșii lui pe 5 generații
   și urmașii lui) sau tot porumbarul. Strămoșii comuni au chenar gros și numărul de urmași; atingerea unui porumbel
   luminează doar ramurile lui și arată cardul lui (cu „Deschide fișa”). Pe telefon: degete pentru mărire și mutare.
3. **Tot porumbarul** (pagina de start, „Panou”): porumbeii proprii ca **carduri ordonate după valoare**, colorați pe
   5 trepte (verde închis = cei mai valoroși … gri = fără date); filtre ca la listă; atingerea duce la fișă și arbore.
   Lista simplă rămâne ca vedere alternativă.

## Valoarea (până la rezultate) — aprobată de utilizator

Notă de la 0 la 100, calculată pe server, cu explicația afișată pe card („de ce”):
- **evaluarea la mână**: media notelor (1–5) transformată în 0–100 — pondere 50%;
- **puii din porumbar**: `min(număr pui, 10) / 10 · 100` — pondere 30%;
- **marcat „reproducător”** (starea): 100 sau 0 — pondere 20%.

Un criteriu fără date (fără nicio notă) nu intră în calcul, iar ponderile rămase se reîmpart; fără niciun criteriu →
„fără date” (gri). Strămoșii externi nu au valoare. În Etapa 2, valoarea se calculează din rezultate și din puii cu
rezultate (spec principal, „Analizorul de perechi”).

## Abordări pentru rețea

- **Aleasă: Cytoscape.js** (bibliotecă de grafuri) cu așezare pe straturi (dagre), încărcată doar pe pagina Rețea:
  are deja mărire / mutare cu degetele, atingere pe noduri, evidențiere de ramuri. Cost: ~110 kB comprimat, doar pe
  acea pagină.
- Desen propriu în SVG: fără dependențe, dar ar trebui scrise de mână așezarea fără încrucișări și gesturile pe
  telefon — mult cod pentru același rezultat.
- Arborele existent cu culori pentru repetări: nu arată un strămoș o singură dată, deci nu rezolvă cererea.

## API nou

- `GET /api/pigeons/:id/tree` adaugă `year` (din data eclozării sau inel) în `pigeons`.
- `GET /api/network?rootId=&up=5&down=3` → `{ nodes: { id, ring, name, sex, year, kind, value }[], edges: { from, to, role: 'father'|'mother' }[] }` (fără `rootId`: tot contul, max. 1000 de porumbei).
- `GET /api/board` → `{ pigeons: (PigeonSummary & { year, value: { score: number|null, parts: { evaluare?, pui?, reproducator? } }, offspringCount })[] }`, ordonate după valoare.

## Lăsat la builder

Culorile exacte ale treptelor (contrast bun pe telefon), așezarea cardurilor, textele de explicație, limitele de noduri.
