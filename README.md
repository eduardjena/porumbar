# Porumbar

Evidența porumbeilor pentru columbofili: fișa porumbelului, rasa și liniile, părinții aleși după inel (cu istoricul lor),
rudele, arborele genealogic și consangvinizarea. Design: `docs/superpowers/specs/2026-11-16-porumbar-design.md`.

Harta proiectului (structura, limbile, publicarea, regulile): `CLAUDE.md`.

## Pornire locală

Ai nevoie de Node.js 24+ și PostgreSQL instalat pe calculator (doar programele; serviciul nu e obligatoriu).

```bash
npm install
npm --prefix web install
npm run dev:db        # PostgreSQL de dezvoltare în data/pg, port 5433; scrie DATABASE_URL în .env
npm run build         # construiește interfața (web/dist)
npm start             # http://localhost:3100
```

Alternativ, cu serviciul PostgreSQL instalat: `npm run db:setup` (îți cere parola contului `postgres`).

În timpul lucrului: `npm run dev` (serverul, repornește la schimbări) și `npm run dev:web` (interfața pe
http://localhost:4300, cu cererile `/api` trimise spre 3100).

Date de exemplu: `npm run seed:exemplu` pune pedigree-ul din `docs/exemple/` într-un cont de exemplu (datele contului sunt
scrise în `scripts/seed-exemplu.mjs`).

## Notificări pe telefon (chei VAPID, local)

Amintirile de la tratamente pot veni ca notificări pe telefon. Pentru a le încerca local, fă o pereche de chei de probă:

```bash
npx web-push generate-vapid-keys
```

Pune cele două chei doar în `.env` (nu în cod, nu în chat), împreună cu `VAPID_SUBJECT=mailto:adresa@exemplu.ro`.
Fără ele aplicația merge normal, doar că nu trimite notificări pe telefon. Cheile de producție sunt altele și se pun în Railway.

## Teste

```bash
npm test
```

Pornește un PostgreSQL temporar (din programele instalate) și îl șterge la final.

## Ce face Planul 1

- conturi (email + parolă, parolă uitată prin email, ștergerea contului);
- fișa porumbelului: inel recunoscut în orice formă (`RO-26-800546 L`, `412084/15 RO`, `6008107/08 BELG M`…), sex, nume,
  rasă, linii, culoare din listă, ochi, stare, evaluare 1–5 + calități / de dorit / defecte, text pentru pedigree;
- strămoși externi (și fără inel), jurnal cu dată, poze (micșorate pe telefon înainte de trimitere);
- părinții aleși după inel, cu istoricul lor și consangvinizarea puilor perechii; rude; arbore cu strămoșii repetați colorați.

## Ce fac Planurile 1b, 1c și 3

- **Panou și Arbore**: porumbeii după valoare; Arborele în Carduri, Evantai, Linii de sânge sau Rețea, cu „Alege alt
  porumbel”; pe telefon generațiile se glisează. (Vederea 3D a existat și a fost scoasă: frumoasă, dar fără folos.)
- **Importă pedigree** (`/porumbei/pedigree`): 31 de căsuțe ca pe foaie; inelele știute se recunosc și părinții lor se
  completează singuri; **citirea din poză sau PDF** cu Claude (doar cu `ANTHROPIC_API_KEY`; 100 de citiri pe an de
  abonament, `PEDIGREE_READS_PER_YEAR`, cel mult 20 pe zi, `PEDIGREE_READS_PER_DAY`, doar 3 în primele 14 zile de abonament,
  `PEDIGREE_READS_FIRST_DAYS`; poza nu se păstrează). Citirea
  merge pe Claude Sonnet 5.5 (`PEDIGREE_MODEL`, ~2,5–3 cenți pe citire); costul are un plafon pe an pe crescător
  (`PEDIGREE_BUDGET_USD`, implicit 3 $).
- **Adu porumbeii din Excel** (`/porumbei/excel`): fișier .xlsx / .xls / .csv sau tabel lipit, coloanele ghicite,
  rezumat exact înainte de salvare, arborele legat după tată și mamă; ultimul import se poate anula 7 zile.
- **Separare totală între conturi**: același inel poate exista în mai multe conturi și nimeni nu vede nimic din alt cont.
  Datele trec doar prin copii:
  - **link public / cod QR** pe fiecare porumbel (fila „QR”): pedigree-ul pe 5 generații fără cont, în formatul deschis
    `porumbar-pedigree` v1; cine are cont îl **preia** în porumbarul lui (strămoșii existenți nu se dublează);
  - **vânzarea**: emailul cumpărătorului, care o primește în „Vânzări”; la vânzător porumbelul rămâne „Vândut”;
  - **pedigree tipărit** pe A4 vertical, cu QR-ul; ce apare pe el (telefon, adresă, email) se alege în „Contul meu”.
- `PUBLIC_BASE_URL` trebuie să fie domeniul final înainte de a tipări coduri QR (codul conține adresa).

## Limbi

Textele vin din `i18n/<limba>.json` (româna și maghiara; maghiara e „în probă” până o verifică un crescător maghiar și o
pune doar vânzătorul, din consolă). Orice text nou intră în toate dicționarele; detalii în `CLAUDE.md`.

## Consola vânzătorului și abonamentele

- Un singur admin: contul se face la pornirea serverului din `ADMIN_EMAIL` + `ADMIN_PASSWORD` (formularul de cont nou
  refuză acest email, ca nimeni să nu-l ia înaintea ta). Are în meniu „Vânzător”. Parola din setări e doar pentru prima
  intrare; o schimbi apoi cu „Am uitat parola”.
- Un cont nou e **doar citire** până îl activezi: vede și tipărește, dar nu adaugă și nu schimbă nimic. La fel după expirare;
  datele nu se pierd niciodată.
- În consolă: toți crescătorii (fără porumbeii lor), filtre (Neactivați, Activi, Expiră curând, Expirați), căutare;
  **Activează / Prelungește** (un an de la data aleasă, după ce ai primit banii), **Adaugă credit** pentru citirea pozelor
  (în dolari; fiecare citire scade costul ei real), **link de parolă nouă** (24 h; parola o alege doar omul), istoricul.
- Pe Railway / Render pune și `TRUST_PROXY=1`, altfel limitele de încercări se aplică tuturor utilizatorilor deodată.
- Cu 30 de zile înainte de expirare pleacă un email de memento (o dată), iar contul apare la „Expiră curând”.
  Emailurile pleacă doar cu `SMTP_URL`; `SELLER_CONTACT` spune crescătorilor cum te contactează pentru plată.
- La fiecare cont nou făcut din formular pleacă un mail la `ADMIN_EMAIL` (nume, email, link spre consolă), ca să-l
  contactezi și să-i activezi abonamentul. Dacă mailul nu pleacă, contul se face oricum.
