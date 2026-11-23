# Calendarul cuibului – design

Data: 2026-11-23. Ramura: `feat/calendar-cuib` (worktree `C:\dev\porumbar-cuib`, din `main` 4a6dafa).

## De ce

În sezon, un crescător are 15–30 de perechi la cuib. Porumbar știe deja, pe fiecare pontă, când se așteaptă eclozarea
(17–19 zile de la primul ou) și când se inelează puii (zilele 6–8 de la eclozare), dar le arată doar pe fișa fiecărei
perechi. Ca să afle ce are de făcut azi, omul ar trebui să deschidă toate perechile. Inelarea e momentul care nu iartă:
după ziua 8–9 inelul nu mai intră pe picior și puiul rămâne fără inel. Aplicațiile concurente care au un asemenea
calendar sunt lăudate des pentru el.

## Ținte

1. **Banda „Cuiburile” pe Panou**: ce e de făcut azi și în zilele următoare, peste toate perechile, cu tot ce a rămas
   nefăcut (de ex. eclozare trecută netrecută).
2. **Omul trece din bandă ce s-a întâmplat**, dintr-o apăsare, fără să deschidă fișa perechii (al doilea ou, doar un ou,
   mirarea, eclozarea); inelarea îl duce direct în pasul de inelare, cu inelul următor propus.
3. **Amintiri** pe telefon și pe email, **combinate cu cele ale tratamentelor**: o singură notificare seara și **un singur
   email seara** pentru tot ce e de făcut a doua zi (vânzătorul: „Nu vreau 2 emailuri”).
4. Nimic nu se pierde: un moment nefăcut rămâne în bandă până e trecut.

## Non-ținte

- Un calendar pe luni, cu pătrățele.
- Amintiri pentru perechi (împerechere, despărțire) sau pentru altceva decât ponte.
- Un buton separat de pornire a amintirilor pentru cuiburi.

## Anti-ținte

- Al doilea email sau a doua notificare seara.
- Banda arătând altceva decât fișa perechii (date diferite după o corectură).
- Un buton din bandă care scrie altceva decât ar scrie fișa perechii, sau care șterge ce a scris omul.
- Pași mulți sau text mic pentru un om vârstnic cu telefonul lângă cuib.

## Căi luate în calcul

| Cale | Ce face | De ce (nu) |
|---|---|---|
| **A (aleasă)** | Momentele se **calculează pe loc** din datele pontelor (`clutches`); amintirile de seară strâng întâi tot (tratamente + cuiburi) și trimit o notificare și un email. | Calendarul nu poate arăta altceva decât fișa; o corectură se vede imediat. |
| B | Calendarul salvat ca listă separată de evenimente. | Trebuie ținut la zi la fiecare schimbare; poate ajunge să contrazică fișa. |
| C | Amintiri separate pentru cuiburi. | Al doilea email / a doua notificare; vânzătorul nu vrea. |

## Momentele unei ponte (zilele socotite în ora României)

O pontă e „deschisă” cât timp are ceva de făcut, **primul ei ou e din ultimele 45 de zile** (ouă → eclozare 19 zile →
inelare încă 8, cu rezervă; regula nu ține de anul sezonului, ca perechile împerecheate în decembrie să nu dispară pe
1 ianuarie) și omul n-a închis-o din bandă (vezi „Nu mai urmări”) – decizia constructorului; perechea poate fi și una „doică” (`foster_pair_id`): atunci momentele
apar la cuibul doicii (ouăle sunt la ea), cu ambele perechi în text.

1. **Al doilea ou** – doar dacă `egg2_on` e gol și `eggs` = 2 (implicit). Apare din ziua `egg1_on + 2`. Dacă în ziua
   `egg1_on + 4` tot nu e trecut, textul devine „Doar un ou?”. Butoane: **„A venit azi”** (scrie `egg2_on` = azi; data se
   poate schimba pe fișă) și **„Doar unul”** (scrie `eggs` = 1). Dispare când e trecut unul dintre ele.
2. **Mirarea** (verificarea ouălor la lumină) – în ziua a 5-a după al doilea ou (sau după primul, la o pontă de un ou);
   rămâne până e trecută sau până la eclozare. Butoane: **„Toate bune”** și **„Limpezi: N”** (alege 1…numărul de ouă);
   ambele scriu ziua mirării (coloană nouă `candled_on`) și, la „Limpezi”, `infertile` = N. Ziua a 5-a e din cunoștințe
   generale; **de verificat cu un crescător** (o constantă, ușor de schimbat). Dacă toate ouăle sunt limpezi, ponta nu
   mai are eclozare.
3. **Eclozarea** – zilele 17–19 de la primul ou (regula de azi, `HATCH_DAYS`); după ziua 19, dacă nu e trecută: „Au ieșit
   puii?”. Buton: **„Au ieșit: N”** (alege 1…ouăle rămase) care scrie `hatched_on` = azi și `hatched` = N; data se poate
   schimba pe fișă. Și **„N-au ieșit”** (scrie toate ouăle rămase ca limpezi / pierdute – constructorul alege câmpul
   potrivit din cele existente, fără câmp nou dacă se poate).
4. **Inelarea** – zilele 6–8 de la eclozare (regula de azi, `RING_DAYS`), cât timp puii inelați < `hatched`. În ziua 8
   e marcată „ultima zi” (roșu); după ziua 8 rămâne, marcată „întârziată”, până e inelat sau omul apasă „Nu inelez”
   (pentru puii care au murit: constructorul alege cum se notează, de ex. scade `hatched`). Buton: **„Inelează”** →
   deschide inelarea ponte­i pe fișa perechii (`/perechi/:id`, ponta derulată și pasul de inelare deschis), cu inelul
   următor propus (`/api/ring-series/next`, ca acum).

5. **„Nu mai urmări”** (decizia constructorului) – pe orice rând din bandă, un buton mic care închide ponta pentru
   calendar fără să scrie nimic fals pe ea (coloană nouă `clutches.calendar_closed_on DATE`); e pentru pontele trecute
   doar pe jumătate și pentru puii inelați pe altă cale (importul din Excel sau „Adaugă porumbel” nu-i leagă de pontă).
   Pe fișa perechii ponta arată „închisă în calendar”, cu „Urmărește din nou”.

Butoanele din bandă folosesc aceleași rute și aceleași validări ca fișa (`PATCH /api/clutches/:id`, `POST
/api/clutches/:id/young`); schimbările de date noi sunt `candled_on` și `calendar_closed_on`.

## Banda „Cuiburile” (Panou → Grilă, lângă banda tratamentelor)

```
Cuiburile
Azi
  Cuibul 7 · Fulger × Vânta · inelează 2 pui (ultima zi!)   [Inelează]
  Cuibul 12 · al doilea ou?                         [A venit azi] [Doar unul]
  Cuibul 3 · mirare                                  [Toate bune] [Limpezi: _]
Mâine
  Cuibul 5 · ies puii (zilele 17–19)
Peste 2–3 zile
  …
```

- Perechea se numește după cuib (`pairs.nest`) dacă e scris, altfel după mascul × femelă (nume sau inel).
- Secțiunile: „Întârziate” (dacă e cazul, primele), „Azi”, „Mâine”, „Următoarele zile” (până la 3 zile înainte).
- Fără nimic de arătat, banda nu apare (ca banda tratamentelor). Pe telefon, butoanele pe rândul de sub text, mari.
- Doar pontele deschise (regula celor 45 de zile, de mai sus); perechile despărțite rămân cât timp ponta lor e deschisă.
- Contul „doar citire” vede banda, dar butoanele sunt dezactivate cu fraza de activare obișnuită (402 la scriere).

## Amintirile

- **Pornirea**: aceeași din Cont → Amintiri (telefon) și bifa „email seara” existentă; niciun buton nou.
- **Seara la 19:00**: momentele cuibului care **încep a doua zi** (al doilea ou, mirare, prima zi de eclozare, prima zi
  de inelare) și **„mâine e ultima zi de inelare”** (pentru cine primește doar email, care nu are notificarea de la
  07:00) intră în **aceeași** notificare de seară ca tratamentele, grupate („Mâine: inelare la cuibul 7, eclozare
  la cuibul 5; tratament: …”). O singură notificare pe telefon și o singură dată pe zi.
- **Dimineața la 07:00**: doar **ultima zi de inelare** (ziua 8), împreună cu „ultima zi” a tratamentelor, într-o
  singură notificare.
- **Emailul de seară**: unul singur pe cont și zi (tabelul `email_digests` existent), cu tratamentele și cuiburile, cu
  aceleași reguli ca acum (doar fără telefon / când notificarea de seară n-a ajuns; `reminder_email`; fără SMTP_URL în
  producție nu pleacă nimic).
- **Conturile „doar citire”** (probă terminată, abonament expirat) nu primesc amintiri de cuib: n-ar putea trece nimic.
  Banda o văd, cu butoanele dezactivate (decizia constructorului).
- **Emailul pentru cuiburi** urmează regula de acum: pornit implicit (`reminder_email`), doar fără telefon; ultimul rând
  al emailului spune unde se oprește (Cont → Amintiri) (decizia constructorului).
- Nimic de două ori: fiecare moment al unei ponte se ține minte la trimitere (ca `treatment_notices`), cu fereastra de
  3 ore pentru un moment ratat; un moment trecut deja de om înainte de ora amintirii nu se mai trimite.
- Un moment nu se amintește a doua oară dacă omul l-a amânat (nu există amânare); „întârziatele” stau doar în bandă.

## Constrângeri

- PostgreSQL, Node 24 ESM, Express 5, Angular standalone / signals / zoneless.
- Migrare nouă (numărul următor după `main`, acum 24): `clutches.candled_on DATE`, `clutches.calendar_closed_on DATE`, tabelul pentru momentele trimise.
  Atenție: `feat/plata-paddle` are migrări care trebuie renumerotate după cele din `main`.
- Ora României pentru zile și ore, ca la tratamente (`src/treatment-schedule.js`).
- Orice text nou vizibil, în `i18n/ro.json` (cu `sens`) și în `i18n/hu.json`.
- Text de bază 18px, butoane ≥ 48px, contrast mare, iconițe SVG proprii; fără derulare laterală la 320px.
- Date de test doar inventate.

## Lăsat constructorului

- Numele tabelului pentru momentele trimise și forma lui (unul nou sau unul comun cu tratamentele).
- Cum se notează „N-au ieșit” și „Nu inelez” cu câmpurile existente.
- Textele exacte ale notificării și emailului, în stilul celor de la tratamente.
- Ruta care întoarce banda (de ex. `GET /api/breeding/calendar`).
