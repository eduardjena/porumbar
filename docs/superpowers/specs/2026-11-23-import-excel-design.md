# Adu porumbeii din Excel – design

Data: 2026-11-23. Ramura: `feat/import-excel` (worktree `C:\dev\porumbar-import`, din `main`).

## De ce

Ca să treacă la Porumbar, un crescător cu 100–300 de porumbei ar trebui să-i scrie din nou de mână. Asta îl oprește
să schimbe programul. Mulți își țin porumbeii în Excel, iar alte programe (Compustam, MyLoft, Pigeon Planner, Columba
XT) pot scoate un tabel. Dacă tabelul intră în Porumbar în câteva minute, mutarea devine ușoară. Importul din Excel e
primul pas. Importuri speciale pentru fișierele unui program anume vin doar după ce avem un fișier real de la un
crescător.

## Ținte

1. Crescătorul își aduce **singur** porumbarul. Pe calculator lipește tabelul copiat din Excel. Pe telefon alege
   fișierul (.xlsx, .xls, .csv) primit pe email sau WhatsApp.
2. Porumbar **ghicește coloanele** (după titlu și după conținut), iar omul vede primele rânduri și corectează.
3. **Rezumat exact înainte de salvare**: câți noi, câți există deja, câți părinți devin strămoși, ce rânduri au
   probleme. Cifrele sunt cele care se vor întâmpla, nu o estimare.
4. **Arborele se leagă singur** după inelele tatălui și mamei.
5. **Nimic nu se dublează și nimic nu se schimbă pe ascuns** (regulile importului de pedigree).
6. **Anulare** a ultimului import, 7 zile.

## Non-ținte

- Fișierele proprii ale Compustam / MyLoft (bază de date, backup): doar după un fișier real.
- Rezultate de concurs, jurnal, poze, perechi din Excel.
- Export din Porumbar spre Excel.
- Import făcut de vânzător în contul unui crescător (vânzătorul nu vede datele conturilor).

## Anti-ținte (ar fi un eșec chiar dacă merge)

- Dubluri de porumbei sau un părinte schimbat fără să știe omul.
- Fișierul omului trimis întreg pe server sau păstrat undeva.
- Restul aplicației mai lentă din cauza importului.
- Un vârstnic care nu înțelege ce se întâmplă: pași puțini, text mare, butoane ≥ 48px.

## Căi luate în calcul

| Cale | Ce face | Plus | Minus |
|---|---|---|---|
| **A (aleasă)** | Fișierul e citit în browser (SheetJS, încărcat doar pe pagina de import); la server pleacă doar rândurile. Serverul face rezumatul „încercând” importul într-o tranzacție pe care o anulează, apoi salvează la confirmare. | Fișierul nu pleacă de pe telefon; serverul nu deschide fișiere din afară; rezumat exact. | Pagina de import încarcă o dată câteva sute de KB în plus. |
| B | Fișierul se urcă pe server și e citit acolo. | Un singur loc de citire. | Fișierul întreg pe datele mobile; serverul deschide fișiere de la oricine (fișiere făcute să-l blocheze). |
| C | Doar tabel lipit și .csv. | Cel mai simplu. | Pe telefon omul nu are de unde lipi un tabel. Exclus: vânzătorul vrea și varianta de pe telefon. |

Vânzătorul a ales A.

## Cum arată (aprobat de vânzător)

1. **Intrarea:** pe Panou, lângă „Importă pedigree”, un buton „Adu porumbeii din Excel” (ruta `/porumbei/excel`).
2. **Pasul 1 – tabelul:** „Alege fișierul (.xlsx, .xls, .csv)” sau o casetă „lipește aici tabelul copiat din Excel”.
   Un fișier cu mai multe foi: se alege foaia (implicit prima care are date).
3. **Pasul 2 – coloanele:** pentru fiecare coloană, titlul ei, un exemplu din primele rânduri și o listă „ce este”
   cu valoarea ghicită. Pe telefon, câte un card pe coloană, unul sub altul. Bifă „Primul rând e titlu” (ghicită).
   Antetul se caută în primele 5 rânduri nevide (primul cu cel puțin 2 titluri cunoscute și niciun inel); rândurile
   de deasupra lui (titlul tabelului) nu pleacă la server, iar bifa spune atunci „Rândul N e titlu”.
4. **Pasul 3 – rezumatul:** de ex. „142 de porumbei noi · 5 există deja (completez doar ce lipsește) · 38 de părinți
   care nu sunt în tabel → îi trec ca strămoși · 3 rânduri cu inel necitit · 2 nepotriviri (nu schimb nimic la ele)”,
   cu lista rândurilor cu probleme (numărul rândului din Excel și motivul). Buton mare „Adaugă porumbeii”.
5. **După salvare:** „Gata: am adus 142 de porumbei”, cu „Vezi porumbeii” și „Anulează importul”. Banda „Anulează
   importul” rămâne pe pagina de import 7 zile.
6. Contul „doar citire” (probă terminată, abonament expirat, neconfirmat) primește 402 la previzualizare și la salvare,
   ca la orice adăugare; pagina arată fraza obișnuită de activare.

## Reguli detaliate

1. **Coloane recunoscute** (fiecare cel mult o dată): inel; *sau* inelul în bucăți: țara, anul, asociația / clubul,
   numărul (se lipesc în ordinea pe care o citește `rings.js`, de ex. „HU-24-0123-12345”, și trec prin citirea
   obișnuită a inelelor); nume; sex; culoare; culoarea ochilor; rasă; linii;
   data eclozării; crescător; stare; tată; mamă; observații; „nu iau”. Fără coloană „inel” sau „număr”, butonul de
   continuare nu e activ.
1a. **Țara lipsă** (decizia constructorului): dacă inelele dintr-o coloană nu se citesc fără țară (de ex. doar
   „12345” cu anul în altă coloană, sau „24-12345”), pasul 2 întreabă o singură dată „Inelele fără țară sunt din:”,
   cu o listă de țări; implicit România pentru contul în română și Ungaria pentru contul în maghiară. Țara aleasă se
   pune în față doar inelelor care nu se citesc altfel; cele care se citesc singure rămân neatinse. Inelele maghiare
   cer asociația (regula din `rings.js`): fără ea, rândul apare la „inel necitit” și se sare.
2. **Ghicirea după titlu**, fără diacritice și litere mici, în română, maghiară, engleză, olandeză, germană, franceză
   (de ex. inel / gyűrű / ring / ringnummer / ring nr / bague; tată / apa / vader / vater / sire / father / père;
   mamă / anya / moeder / mutter / dam / mother / mère; sex / ivar / geslacht / geschlecht / sexe; culoare / szín /
   kleur / farbe / couleur / colour). **După conținut**, când titlul nu spune nimic: inele recunoscute în ≥ 60% din
   celule → inel (prima astfel de coloană) apoi tată / mamă (următoarele, în ordine); valori de sex → sex; date →
   data eclozării. Ghicirea e un modul pur, fără importuri, testat cu Node (ca `clasament.ts`).
3. **Valori:**
   - sex: M / F, mascul / femelă, H / T, hím / tojó, cock / hen, doffer / duivin, Täuber / Täubin, mâle / femelle,
     ♂ / ♀; altceva → necunoscut;
   - culoare: `matchColor` din catalog; ce nu se potrivește rămâne text (`color_text`);
   - culoarea ochilor, rasa, starea: potrivire după codurile și numele din catalog (RO + HU); rasa necunoscută →
     `voiajor` dacă celula e goală, altfel `alta`, și se pune doar la porumbeii noi (la cei existenți rasa are mereu o
     valoare, deci nu e „câmp gol”; decizia constructorului); starea necunoscută → fără stare;
   - linii: despărțite de `,` `;` `/`, cel mult 10, ca în fișă;
   - data eclozării: dată întreagă (și datele Excel ca număr; zz.ll.aaaa, aaaa-ll-zz, aaaa.ll.zz, „aaaa. ll. zz.”, cu
     sau fără oră; cu „/” ziua întâi, afară de coloana în care doar a doua parte trece de 12); un an singur nu se pune ca dată;
   - observații: în textul de pe fișă (`pedigree_text`), doar dacă e gol;
   - celulele se taie la lungimile din fișă (nume 80, text 2000 ș.a.m.d.).
4. **Ce devine fiecare rând:** porumbel **propriu** al contului (`kind = 'own'`), cu starea din tabel dacă o are.
   Un porumbel propriu are mereu inel (regula din `pigeons.js` rămâne), deci (decizia constructorului):
   - rândurile fără inel se sar și apar în rezumat („fără inel: îl poți adăuga de mână”); cele complet goale se sar
     fără să apară;
   - un inel scris, dar necitit, se adaugă așa cum e scris doar dacă are cheie de rezervă (ca rădăcina importului de
     pedigree); altfel rândul se sare. Un inel fără nicio cifră (antetul „Inel”, rânduri de secțiune ca „MASCULI”)
     se sare mereu. Toate apar în rezumat la „inel necitit”.
5. **Același inel de două ori în tabel:** primul rând câștigă, al doilea apare în rezumat și se sare.
6. **Porumbel care există deja în cont** (după cheia inelului): se completează doar câmpurile goale; unul „din alt
   porumbar” devine propriu (ca la importul de pedigree). Ce era scris nu se schimbă.
7. **Părinții:** inelul din coloana tată / mamă se caută întâi printre rândurile tabelului (orice ordine a rândurilor),
   apoi în cont; dacă nu există, se face un strămoș („din alt porumbar”) cu sexul potrivit. O legătură care există deja
   și e alta decât în tabel nu se schimbă și apare la „nepotriviri”; la fel un mascul trecut ca mamă sau o femelă ca
   tată, ori un porumbel trecut ca propriul părinte sau strămoș (ciclu). Un părinte cu inel necitit nu se leagă (ca la
   importul de pedigree) și apare în rezumat.
8. **Previzualizarea și salvarea folosesc același cod:** `POST /api/import/excel/preview` rulează importul într-o
   tranzacție pe care o anulează și întoarce rezumatul; `POST /api/import/excel` îl rulează și îl păstrează. Aceleași
   rânduri, același rezultat. Rezumatul listează cel mult 100 de rânduri cu probleme (numărul rândului din tabel).
   Un import care n-a creat, completat și n-a făcut propriu nimic nu se ține minte (nu ia anularea celui de dinainte);
   în evidență rămân doar cifrele rezumatului, nu și lista problemelor.
9. **Limite:** cel mult 3.000 de rânduri și 20 de coloane pe import; fișierul cel mult 10 MB (verificat în browser);
   cererea JSON cel mult 2 MB. Previzualizarea: cel mult 30 pe minut pe cont. Salvarea ține contul blocat (`lockAccount`)
   cât durează, ca două importuri să nu se calce.
10. **Anularea** (detaliile sunt decizia constructorului): fiecare import salvat se ține minte: ce porumbei a creat,
    cu o copie a câmpurilor puse; ce câmpuri și legături a completat la porumbei existenți, cu valoarea pusă; ce
    strămoși a făcut proprii (felul de dinainte). „Anulează importul” merge doar pentru **ultimul import din Excel**
    al contului și doar **7 zile**, oricâte alte lucruri s-ar fi făcut între timp:
    - un porumbel creat atunci se șterge doar dacă e neschimbat: câmpurile lui sunt încă cele puse de import și nimic
      nu trimite la el în afară de legăturile făcute de același import (niciun rând în tabelele care trimit la
      porumbei – jurnal, poze, rezultate, perechi, tratamente, transferuri, linkuri publice ș.a. – și niciun copil
      legat altfel). Se verifică după conținut, nu după `updated_at`. Ceilalți rămân și sunt numărați în mesaj
      („3 porumbei au rămas, pentru că i-ai folosit după import”);
    - câmpurile și legăturile completate atunci se golesc doar dacă au încă valoarea pusă de import;
    - un strămoș făcut propriu redevine „din alt porumbar”, dacă e încă propriu și neschimbat;
    - totul într-o tranzacție; după anulare, butonul dispare.
11. **Confidențialitate:** fișierul se citește în browser și nu pleacă nicăieri; la server ajung doar celulele
    coloanelor alese. Nu se păstrează tabelul, doar porumbeii și evidența pentru anulare (ștearsă după 7 zile sau la
    ștergerea contului).

## Constrângeri

- PostgreSQL, Node 24 ESM, Express 5, Angular standalone / signals / zoneless.
- Migrare nouă (tabelele pentru evidența importului): numărul următor după `main` la momentul unirii. Atenție:
  `feat/plata-paddle` are și ea migrări care trebuie renumerotate (vezi memoria proiectului).
- SheetJS (ediția comunitară) instalat din tarball-ul oficial `cdn.sheetjs.com`, versiune fixă, ≥ 0.20.2 (versiunea
  0.18.5 din registrul npm are probleme de securitate cunoscute). Inclus în build (CSP `'self'`), încărcat doar de
  pagina de import (`loadComponent` / `import()` dinamic). Nimic de pe CDN la rulare.
- Orice text nou vizibil, în `i18n/ro.json` (cu `sens`) și în `i18n/hu.json`.
- Text de bază 18px, butoane ≥ 48px, contrast mare, iconițe SVG proprii; merge la 320px fără derulare laterală.
- Date de test doar inventate; niciun fișier real al unui crescător în repo.
- Contul „doar citire”: 402 pe previzualizare, salvare și anulare.

## Lăsat constructorului

- Numele exacte ale tabelelor și coloanelor pentru evidența importului.
- Alegerea codificării la .csv (UTF-8, apoi Windows-1250 / 1252 dacă apar caractere stricate).
- Despărțitorul la textul lipit (tab, `;`, `,`), după ce apare cel mai des.
- Felul în care se arată lista de probleme pe telefon (de ex. „Arată toate”).
