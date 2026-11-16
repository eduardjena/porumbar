# Porumbar – Planul 3: QR, pagina publică, preluare și vânzare — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fiecare porumbel are un cod QR / link public cu pedigree-ul complet; alt crescător îl poate **prelua** (de ex. când îl primește împrumut ca să facă pui) ca porumbel „din alt porumbar”, legat de original; la **vânzare** porumbelul trece pe numele cumpărătorului, iar crescătorul lui vede mai departe puii și pedigree-ul; pedigree-ul se **tipărește** pe A4 cu QR.

**Architecture:** Un porumbel e un singur rând (spec 7). Vizibilitatea între conturi se calculează cu un CTE recursiv: un cont vede, doar de citit și doar câmpurile publice, strămoșii și urmașii porumbeilor lui (și porumbeii care au fost ai lui). Pagina publică e o rută fără cont care servește formatul deschis „porumbar-pedigree v1”. Tipărirea e o pagină Angular pentru imprimare (A4 orizontal) cu QR generat în browser.

**Tech Stack:** ca până acum; nou: `qrcode` (generare QR în browser, SVG).

**Spec:** `docs/superpowers/specs/2026-11-16-porumbar-design.md` §7 (și §2 „Format deschis”, §11a).

## Global Constraints

- Tot ce cer planurile 1 și 1b (română, text 18px, butoane 48px, conturi separate, confirmare la orice ștergere sau modificare, fără push).
- **Câmpuri publice** ale unui porumbel al altui cont: inel, sex, nume, rasă, linii, culoare (cod, pene albe, text), ochi, an / dată eclozare, crescător de origine (`breeder_text`), textul pentru pedigree, părinții. **Niciodată**: evaluarea, jurnalul, starea, notele private.
- Datele personale ale proprietarului pe pagina publică și pe tipar: implicit **doar numele**; telefonul / adresa / emailul doar dacă le bifează (setări în cont).
- Linkul public: token aleator de 22 de caractere (base64url, 16 octeți), adresa `${PUBLIC_BASE_URL}/p/<token>`; oprirea linkului îl invalidează imediat; „link nou” face alt token.
- Branch-uri: `feat/vizibilitate`, `feat/qr-public`, `feat/transfer`, `feat/tiparire` (fiecare merge în `main` la finalul lui).

## Review Focus

1. **Porumbeii fără legătură ai altui cont** rămân invizibili (404), chiar după vânzări și preluări → test în Task 1.
2. **Câmpurile private** (evaluare, jurnal, stare) ale altui cont nu apar nicăieri: fișă, arbore, rețea, pagina publică, JSON → teste în Task 1 și Task 3.
3. **Link public oprit sau regenerat** → vechiul link dă 404 imediat → test în Task 3.
4. **Transfer către un cont care are deja inelul** ca „din alt porumbar” → contopire (copiii lui trec pe porumbelul adevărat), nu dublură și nu eroare → test în Task 5.
5. **Preluare repetată** a aceluiași pedigree → nu dublează strămoșii (refolosire după inel) → test în Task 4.

---

### Task 1: Vizibilitatea între conturi

**Files:** Create `src/visibility.js`; Modify `src/db.js` (migrarea 6), `src/pigeons.js`; Test `test/visibility.test.js`

**Interfaces:**
- Migrarea 6: `CREATE TABLE pigeon_owners (pigeon_id BIGINT NOT NULL REFERENCES pigeons(id) ON DELETE CASCADE, account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, from_at TIMESTAMPTZ NOT NULL, to_at TIMESTAMPTZ, PRIMARY KEY (pigeon_id, account_id, from_at))`; `ALTER TABLE pigeons ADD COLUMN source_pigeon_id BIGINT REFERENCES pigeons(id) ON DELETE SET NULL, ADD COLUMN source_note TEXT`.
- `visibleIds(accountId) -> Set<number>`: porumbeii contului ∪ strămoșii lor (oricât de departe, prin `father_id`/`mother_id`, peste conturi) ∪ urmașii lor (peste conturi) ∪ porumbeii din `pigeon_owners` ai contului. CTE recursiv `UNION` (fără dubluri → fără bucle).
- `readPigeon(accountId, id) -> { pigeon: Pigeon | PublicPigeon, own: boolean }`: proprii → fișa completă; vizibili ai altora → `PublicPigeon` (doar câmpurile publice + `ownerName`); altfel 404.
- `loadNodes(accountId)` folosește `visibleIds` (arbore, consangvinizare, rude, rețea văd și strămoșii / urmașii din alte conturi).
- `GET /api/pigeons/:id` folosește `readPigeon` (răspuns cu `own`); `PATCH`, `DELETE`, `PUT parents`, jurnalul rămân **doar pe proprii** (404 altfel).

- [ ] Teste: A vinde (direct în bază: `account_id` → B, rând în `pigeon_owners`) un pui; A vede puiul (public, fără evaluare / jurnal / stare); B vede tatăl din contul A (public) în arbore; C (fără legătură) primește 404 pe toate; A nu poate edita puiul (404); consangvinizarea lui B ține cont de strămoșii din A. → FAIL → implementare → PASS → commit `feat: vizibilitate între conturi (strămoși, urmași, foști proprietari)`.

### Task 2: Setările pentru datele de pe pedigree

**Files:** Modify `src/db.js` (migrarea 7: `accounts` + `show_phone`, `show_address`, `show_email` BOOLEAN DEFAULT false), `src/routes/auth.js`, `web/src/app/pages/auth/cont.ts`; Test `test/auth.test.js`

- [ ] `PATCH /api/auth/me` acceptă `showPhone`, `showAddress`, `showEmail`; `account` le întoarce. În „Contul meu”: secțiunea „Ce apare pe pedigree” cu trei bife, cu confirmare la salvare. Test → FAIL → PASS → commit.

### Task 3: Linkul public și formatul deschis

**Files:** Create `src/routes/public.js`, `src/pedigree-format.js`; Modify `src/db.js` (migrarea 8: `pigeons.public_token TEXT UNIQUE`), `src/app.js`; Test `test/public.test.js`

**Interfaces:**
- `POST /api/pigeons/:id/public` → `{ url }` (pornește linkul; doar proprii); `DELETE /api/pigeons/:id/public` → 204 (oprește); `POST /api/pigeons/:id/public/new` → `{ url }` (token nou).
- `GET /api/public/:token` (fără cont) → `pedigreeV1(rootId, generations = 5)`: `{ format: 'porumbar-pedigree', version: 1, generatedAt, owner: { name, phone?, address?, email? }, root: Node }`, `Node = { ring, ringRaw, sex, name, breed, lines, color, colorPa, colorText, eyeColor, year, hatchedOn, breeder, pedigreeText, father: Node|null, mother: Node|null }` (doar câmpuri publice).
- `GET /p/:token` servește interfața (ruta Angular `p/:token`, fără cont).

- [ ] Teste: link pornit → JSON cu 5 generații pe pedigree-ul foto, fără `evaluation`/`status`/jurnal; telefonul apare doar cu `showPhone`; oprit → 404; token nou → vechiul 404; alt cont nu poate porni linkul (404). → FAIL → PASS → commit.

### Task 4: „Preia în porumbarul meu” (împrumut pentru pui)

**Files:** Modify `src/routes/public.js`; Test `test/public.test.js`

**Interfaces:** `POST /api/public/:token/import` (cu cont) → `{ pigeonId }`: creează în contul celui care preia porumbelul și strămoșii lui ca „din alt porumbar” (`kind = 'external'`, `source_pigeon_id` = originalul, `source_note` = `preluat de la <nume> pe <dată>`), refolosind după inel ce există deja în cont; propriul porumbel al celui care preia nu se atinge. Fără cont → 401.

- [ ] Teste: preluare → arbore complet în contul nou; a doua preluare → același id, niciun rând nou; un strămoș deja în cont (același inel) e refolosit. → FAIL → PASS → commit.

### Task 5: Vânzarea (transferul de proprietate)

**Files:** Create `src/routes/transfers.js`; Modify `src/db.js` (migrarea 9: `transfers (id, pigeon_id, from_account, to_email, to_account, include_private BOOLEAN, status TEXT CHECK (status IN ('pending','accepted','cancelled')), created_at, decided_at)`), `src/app.js`; Test `test/transfers.test.js`

**Interfaces:**
- `POST /api/pigeons/:id/transfers { email, includePrivate }` → 201 `{ transfer }` (doar proprii; un singur transfer în așteptare per porumbel; emailul trebuie să fie al unui cont, altfel 404 „Nu există un cont cu acest email.”).
- `GET /api/transfers` → `{ incoming: Transfer[], outgoing: Transfer[] }`; `POST /api/transfers/:id/accept` (doar destinatarul); `POST /api/transfers/:id/cancel` (expeditorul sau destinatarul).
- La acceptare (o tranzacție): `pigeons.account_id` → cumpărător; `pigeon_owners` închide rândul vânzătorului (`to_at`) și deschide unul al cumpărătorului; jurnalul rămâne al celui care l-a scris (intrările au `account_id`; listarea jurnalului filtrează și după cont, deci cumpărătorul nu vede notele vânzătorului, iar cu `includePrivate` intrările vânzătorului se copiază la cumpărător); evaluarea (de pe porumbel) se golește fără `includePrivate`; dacă cumpărătorul avea același inel ca „din alt porumbar”, copiii acelui rând trec pe porumbelul adevărat și rândul extern se șterge (Review Focus 4).

- [ ] Teste: vânzare acceptată → B îl editează, A îl vede doar public și îi vede puii viitori; transfer anulat → nimic schimbat; contopirea cu externul lui B; doar destinatarul acceptă (404 altfel). → FAIL → PASS → commit.

### Task 6: Căutarea părinților și în pedigree-urile publice

**Files:** Modify `src/routes/family.js`, `web/src/app/shared/pigeon-picker.ts`; Test `test/family.test.js`

- [ ] `GET /api/pigeons/lookup` adaugă `publicMatches` (porumbei ai altor conturi cu link public pornit, după `ring_key`; cardul public, fără date private). În picker: „E în programul altui crescător: Preia și alege” (folosește Task 4). Test → FAIL → PASS → commit.

### Task 7: Interfața: QR, pagina publică, vânzarea

**Files:** Create `web/src/app/pages/public/public-pedigree.ts` (ruta `p/:token`, fără cont), `web/src/app/pages/porumbel/partajare.ts` (fila nouă „QR” din fișă), `web/src/app/pages/transferuri/transferuri.ts` (ruta `transferuri`, legată din „Contul meu” cu numărul celor în așteptare); `web/package.json` + `qrcode`

- [ ] Fila „QR”: pornește / oprește linkul (cu confirmare), arată codul QR mare (SVG), „Copiază linkul”, „Trimite” (Web Share pe telefon), „Link nou” (confirmare: vechiul nu mai merge), „Tipărește pedigree-ul”. Dacă porumbelul nu e al tău: arată doar pedigree-ul public.
- [ ] „Vinde sau dă porumbelul”: email + bifa „trimite și evaluarea și jurnalul”, confirmare clară („RO-15-412084 trece pe numele … după ce acceptă”).
- [ ] Pagina publică `p/:token`: pedigree-ul (arbore orizontal, anii, strămoșii repetați colorați), datele proprietarului alese de el, butonul „Preia în porumbarul meu” (cere intrarea în cont, apoi revine).
- [ ] Verificare în browser la 375px și pe calculator; captură. Commit.

### Task 8: Pedigree-ul tipărit (A4)

**Files:** Create `web/src/app/pages/porumbel/tiparire.ts` (ruta `porumbei/:id/tiparire`)

- [ ] Pagină pentru imprimare (`@page { size: A4 landscape; margin: 10mm }`): 4 sau 5 generații (comutator), căsuțe în arbore (inel, sex, nume, culoare, an, textul pentru pedigree scurtat frumos), strămoșii repetați colorați (aceeași culoare pentru același inel), jos datele proprietarului alese de el și **QR-ul** linkului public (pornește linkul dacă e oprit, cu confirmare). Butonul „Tipărește / Salvează PDF” (`window.print()`).
- [ ] Verificare: previzualizarea de tipărire încape pe o pagină A4 la 5 generații cu pedigree-ul foto. Commit.

### Task 9: Încheierea

- [ ] `npm test` și `npm run build` → fără erori; recenzie finală a branch-urilor; merge în `main`; README „Ce face Planul 3”. Fără push.
