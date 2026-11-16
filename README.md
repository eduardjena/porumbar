# Porumbar

Evidența porumbeilor pentru columbofili: fișa porumbelului, rasa și liniile, părinții aleși după inel (cu istoricul lor),
rudele, arborele genealogic și consangvinizarea. Design: `docs/superpowers/specs/2026-11-16-porumbar-design.md`.

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
