# Porumbar – Planul 3: QR, pagina publică, preluare și vânzare (separare totală) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fiecare porumbel poate avea un cod QR / link public cu pedigree-ul lui; alt crescător îl poate **prelua** ca porumbel „din alt porumbar” (de ex. când îl primește împrumut ca să facă pui); la **vânzare** cumpărătorul primește porumbelul cu pedigree-ul; pedigree-ul se **tipărește** pe A4 cu QR.

**Decizie (utilizatorul, 2026-11-16): separare totală.** Un cont **nu vede nimic** din alt cont. Datele trec între crescători **doar prin copii**, doar când proprietarul pornește linkul / face vânzarea. Asta înlocuiește „un porumbel e unul singur în program” din spec §7: după vânzare, la vânzător porumbelul rămâne cu starea „Vândut” (cu tot ce știa până atunci), iar cumpărătorul are copia lui; ce se întâmplă după vânzare vânzătorul nu mai vede.

**Architecture:** Inelul e unic **în cont**, nu în tot programul (fără mesajul „e la alt crescător”, care spunea ceva despre alt cont). Pagina publică e o rută fără cont care servește formatul deschis „porumbar-pedigree v1” doar pentru linkurile pornite. Preluarea și vânzarea copiază arborele în contul celuilalt. Tipărirea e o pagină Angular pentru imprimare (A4 orizontal) cu QR generat în browser.

**Tech Stack:** ca până acum; nou: `qrcode` (generare QR în browser, SVG).

**Spec:** `docs/superpowers/specs/2026-11-16-porumbar-design.md` §7 (cu decizia de mai sus), §2 „Format deschis”, §11a.

## Global Constraints

- Tot ce cer planurile 1 și 1b (română, text 18px, butoane 48px, confirmare la orice ștergere sau modificare, fără push), plus paleta „Pământ”.
- **Niciun API cu cont nu întoarce date din alt cont.** Singura cale: `GET /api/public/:token` (doar linkuri pornite de proprietar).
- **Câmpuri publice / copiate**: inel, sex, nume, rasă, linii, culoare (cod, pene albe, text), ochi, an / dată eclozare, crescător de origine, textul pentru pedigree, părinții. **Niciodată** pe link: evaluarea, jurnalul, starea.
- Datele personale ale proprietarului pe link și pe tipar: implicit **doar numele**; telefon / adresă / email doar bifate.
- Linkul public: token aleator (16 octeți, base64url), adresa `${PUBLIC_BASE_URL}/p/<token>`; oprirea îl invalidează imediat; „link nou” face alt token.
- Branch-uri: `feat/inel-pe-cont`, `feat/qr-public`, `feat/transfer`, `feat/tiparire` (merge în `main` la finalul fiecăruia).

## Review Focus

1. **Nicio scurgere între conturi**: același inel la doi crescători nu spune nimic celuilalt; un id străin → 404 peste tot → test în Task 1.
2. **Câmpurile private** (evaluare, jurnal, stare) nu apar pe link sau în JSON → test în Task 3.
3. **Link oprit sau regenerat** → vechiul dă 404 imediat → test în Task 3.
4. **Vânzare către un cont care are deja inelul** ca „din alt porumbar” → acel rând devine porumbelul lui (cu legăturile lui), nu dublură → test în Task 5.
5. **Preluare repetată** a aceluiași pedigree → nu dublează strămoșii (refolosire după inel) → test în Task 4.

---

### Task 1: Inelul e unic în cont

**Files:** Modify `src/db.js` (migrarea 6), `src/pigeons.js`; Modify tests `test/pigeons.test.js`; Test `test/separare.test.js`

- [ ] Migrarea 6: `DROP INDEX ux_pigeons_own_ring; CREATE UNIQUE INDEX ux_pigeons_own_ring ON pigeons (account_id, ring_key) WHERE kind = 'own' AND ring_key IS NOT NULL`. `checkDuplicate` caută doar în cont; mesajul „…este deja în programul altui crescător” dispare. Testul vechi care cerea 409 între conturi devine: contul B poate avea același inel (201) și nu află nimic despre A. Test nou: A și B cu același inel, fiecare vede doar porumbelul lui; toate rutele cu id-ul lui A din contul B → 404. → FAIL → PASS → commit.

### Task 2: Ce apare pe pedigree (setări)

**Files:** Modify `src/db.js` (migrarea 7: `accounts.show_phone`, `show_address`, `show_email` BOOLEAN DEFAULT false), `src/routes/auth.js`, `web/src/app/pages/auth/cont.ts`; Test `test/auth.test.js`

- [ ] `PATCH /api/auth/me` acceptă `showPhone`, `showAddress`, `showEmail`; „Contul meu” → „Ce apare pe pedigree”, trei bife, cu confirmare. → FAIL → PASS → commit.

### Task 3: Linkul public și formatul deschis

**Files:** Create `src/routes/public.js`, `src/pedigree-format.js`; Modify `src/db.js` (migrarea 8: `pigeons.public_token TEXT UNIQUE`), `src/app.js`; Test `test/public.test.js`

**Interfaces:**
- `POST /api/pigeons/:id/public` → `{ url }` (pornește; doar proprii); `DELETE /api/pigeons/:id/public` → 204; `POST /api/pigeons/:id/public/new` → `{ url }`.
- `GET /api/public/:token` (fără cont) → `pedigreeV1(rootId, 5)`: `{ format: 'porumbar-pedigree', version: 1, generatedAt, owner: { name, phone?, address?, email? }, root: Node }`, `Node = { ring, ringRaw, sex, name, breed, lines, color, colorPa, colorText, eyeColor, year, hatchedOn, breeder, pedigreeText, father, mother }`.
- Ruta Angular `p/:token` (fără cont).

- [ ] Teste: link pornit → JSON pe 5 generații (pedigree-ul foto) fără evaluare / stare / jurnal; telefonul doar cu `showPhone`; oprit → 404; token nou → vechiul 404; alt cont nu poate porni linkul (404). → FAIL → PASS → commit.

### Task 4: „Preia în porumbarul meu” (împrumut pentru pui)

**Files:** Modify `src/routes/public.js`, `src/db.js` (migrarea 9: `pigeons.source_note TEXT`); Test `test/public.test.js`

- [ ] `POST /api/public/:token/import` (cu cont) → `{ pigeonId }`: copiază porumbelul și strămoșii în contul celui care preia, ca „din alt porumbar”, cu `source_note` = `preluat de la <nume> pe <dată>`, refolosind după inel ce există deja în cont (și propriii porumbei cu același inel). Fără cont → 401. Teste: preluare → arbore complet; a doua preluare → același id, niciun rând nou; strămoș deja existent refolosit. → FAIL → PASS → commit.

### Task 5: Vânzarea (prin copie)

**Files:** Create `src/routes/transfers.js`; Modify `src/db.js` (migrarea 10: `transfers (id, pigeon_id, from_account, to_account, include_private BOOLEAN, status CHECK IN ('pending','accepted','cancelled'), created_at, decided_at)`), `src/app.js`; Test `test/transfers.test.js`

**Interfaces:**
- `POST /api/pigeons/:id/transfers { email, includePrivate }` → 201 (doar proprii; un transfer în așteptare per porumbel). Dacă emailul nu are cont → 404 „Nu există un cont cu acest email.” (singura informație dată: există / nu există cont, ca la orice invitație).
- `GET /api/transfers` → `{ incoming, outgoing }` (pentru `incoming`: inelul, numele, numele vânzătorului — atât); `POST /api/transfers/:id/accept` (doar destinatarul); `POST /api/transfers/:id/cancel` (oricare dintre ei).
- La acceptare (o tranzacție): la cumpărător se creează porumbelul **propriu** (copie a câmpurilor publice + strămoșii copiați ca „din alt porumbar”, refolosiți după inel; cu `includePrivate` și evaluarea + o copie a jurnalului vânzătorului); dacă cumpărătorul avea inelul ca „din alt porumbar”, acel rând devine propriu (Review Focus 4). La vânzător: starea → „Vândut”, porumbelul rămâne cu tot ce avea (doar de citit pentru partea de vânzare: nu mai poate fi vândut din nou).

- [ ] Teste: vânzare acceptată → B are porumbelul propriu cu arborele; A îl are „Vândut”; fără `includePrivate` B nu are evaluarea / jurnalul; anulat → nimic schimbat; contopirea cu externul lui B; doar destinatarul acceptă. → FAIL → PASS → commit.

### Task 6: Interfața: QR, pagina publică, vânzarea

**Files:** Create `web/src/app/pages/public/public-pedigree.ts` (ruta `p/:token`), `web/src/app/pages/porumbel/partajare.ts` (fila „QR”), `web/src/app/pages/transferuri/transferuri.ts` (ruta `transferuri`, din „Contul meu”, cu numărul celor în așteptare); `web/package.json` + `qrcode`

- [ ] Fila „QR”: pornește / oprește linkul (confirmare), QR mare (SVG), „Copiază linkul”, „Trimite” (Web Share), „Link nou” (confirmare), „Tipărește pedigree-ul”, „Vinde porumbelul” (email + bifa „trimite și evaluarea și jurnalul”, confirmare clară).
- [ ] Pagina publică: pedigree-ul (arbore orizontal, anii, repetări colorate), datele proprietarului alese de el, „Preia în porumbarul meu” (cere intrarea în cont, apoi revine).
- [ ] Verificare în browser la 375px și pe calculator; captură. Commit.

### Task 7: Pedigree-ul tipărit (A4)

**Files:** Create `web/src/app/pages/porumbel/tiparire.ts` (ruta `porumbei/:id/tiparire`)

- [ ] `@page { size: A4 landscape; margin: 10mm }`; 4 sau 5 generații; căsuțe în arbore (inel, sex, nume, culoare, an, textul pentru pedigree scurtat); repetări colorate; jos datele proprietarului alese și QR-ul linkului (îl pornește cu confirmare); „Tipărește / Salvează PDF”. Verificare: 5 generații din pedigree-ul foto încap pe o pagină A4. Commit.

### Task 8: Încheierea

- [ ] `npm test`, `npm run build` fără erori; recenzie finală; merge în `main`; README „Ce face Planul 3”; spec §7 actualizat cu decizia de separare totală. Fără push.
