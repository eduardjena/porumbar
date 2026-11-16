# Porumbar – program de pedigree pentru columbofilii din România (design)

Data: 2026-11-16. Nume de lucru: **Porumbar** (numele public se alege mai târziu). Folder: `C:\dev\porumbar`.

Context: raportul de piață `C:\dev\triaj\reports\Goluri în programele de columbofilie.md` și două pedigree-uri reale primite de la utilizator (unul generat de Compuclub, unul tipărit și fotografiat).

## 1. De ce

Programele de azi (myloft.ro, Compuclub/Compustam, Pigeon Planner, aplicații mici de telefon) țin evidența și tipăresc pedigree-ul, dar:
- pedigree-ul circulă între crescători ca **hârtie, PDF sau poză**, iar cine îl primește îl tastează din nou;
- rezultatele rudelor („Tatăl lui…”, „Semisoră cu…”) și consangvinizarea sunt **scrise de mână, ca text liber**, în căsuțele pedigree-ului;
- inelele sunt scrise în zeci de feluri (`RO-26-800546`, `412084/15 RO`, `0276971` + `2025`, `6008107/08 BELG`).

Vrem un program pentru **toți columbofilii din România** (concurăm cu myloft, ~9.300 utilizatori, 37 €/an, și cu Compuclub) care câștigă prin ce le lipsește tuturor: **pedigree care se mută dintr-un cont în altul prin QR**, **import din orice** (poză, PDF, Excel, clasamente lipite), **analiza automată a rudelor și urmașilor**, **consangvinizare calculată**, **inele scrise la fel**.

Succes înseamnă: un crescător care vine de la Compuclub sau de pe hârtie își aduce porumbarul în program fără să tasteze tot, tipărește un pedigree cel puțin la fel de bun, iar cumpărătorul îl preia scanând codul QR.

## 2. Obiective, non-obiective, anti-obiective

Decizia utilizatorului: programul face **tot ce fac programele din lume și ce le lipsește**, dar **ordinea** e: întâi evidența (rasa / linia, pedigree-ul, arborele, reproducția și puii), abia apoi rezultatele. Lucrul se face pe etape; fiecare etapă e un program folosibil.

**Etapa 1 – evidența și pedigree-ul**
1. Conturi și porumbarul: fișa porumbelului (secțiunea 5), cu rasa și linia.
2. Reproducția: perechi, cuiburi, ouă, eclozări, inelarea puilor, puii fiecărei perechi (secțiunea 5a).
3. Arborele (genealogia) navigabil pe ecran, oricâte generații există în date.
4. Pedigree pe 4 sau 5 generații, tipărit în PDF A4, cu cod QR.
5. Pagina publică a pedigree-ului, „Preia în porumbarul meu” și trecerea porumbelului pe numele cumpărătorului.
6. Import de pedigree din poză / PDF (citire cu AI + ecran de verificare) și din Excel; export complet.
7. Consangvinizarea calculată (și pentru o pereche plănuită); rudele (părinți, frați, semi-frați, pui) pe fișă.

**Etapa 2 – rezultatele**
8. Import de rezultate prin lipirea clasamentului de pe columba.ro, din PDF sau din poză (scanare), **și introducere de mână** (cerut de utilizator, 2026-11-16) într-un formular cu aceleași câmpuri ca clasamentul federației: concursul (nr., organizator / județ, categorie, data, locul lansării), porumbei angajați, distanța (m), ora sosirii (zi, h, m, s), timpul, viteza (m/min), locul, coeficientul FCI — ca datele introduse de mână și cele importate să fie interschimbabile.
9. Analiza rudelor și urmașilor pe baza rezultatelor („nota de reproducător”).

**Analizorul de perechi** (cerut de utilizator, 2026-11-16; pe etape, doar metode științifice recunoscute, cu cât de sigur e rezultatul afișat mereu):
- Etapa 1 (deja în Planul 1): **consangvinizarea** puilor unei perechi plănuite (Wright), cu strămoșii comuni. Avertisment, nu interdicție: crescătorii fac intenționat împerecheri în linie.
- Etapa 2: **culorile probabile ale puilor**, după genetica mendeliană a porumbeilor (culori legate de sex, desene, diluție), din culorile părinților și, unde se știu, ale bunicilor.
- Etapa 2, după rezultate: **valoarea de reproducție estimată** (metoda BLUP / „modelul animal”, folosită în creșterea animalelor) din rezultatele porumbelui, ale rudelor și ale puilor. Recomandări de perechi („pentru pui buni la viteză: X cu Y”) doar unde datele ajung; altfel se spune clar „prea puține date”.
- Etapa 3: diversitatea genetică a porumbarului (rudenia medie), ca să nu se strângă totul pe o singură linie.

**Etapa 3 – restul a ce există în lume și ce lipsește** (ordinea se stabilește atunci): sănătate (tratamente, vaccinuri, cure, cu memento-uri), antrenamente, coșul pentru concurs, statistici, vânzări și cumpărări, porumbei pierduți / găsiți, finanțele porumbarului, genetica culorilor legată de pedigree, ADN atașat la pedigree, mai mulți oameni pe același cont, alte limbi (maghiara întâi), import din exporturile Compuclub / myloft și din ceasuri electronice, aplicații în magazine, plăți / abonamente, înțelegere cu federația.

**Anti-obiective (ar fi un eșec chiar dacă merge tehnic)**
- Citire automată (robot) de pe columba.ro sau alte site-uri: interzisă de termenii lor („copierea de informații în vederea comercializării”) și de `robots.txt` (`Disallow: /2026/`, `/clasamente/` etc.). **Serverul nostru nu accesează niciodată columba.ro.**
- Un program greu pentru oameni mai în vârstă: text mic, multe ecrane, termeni tehnici.
- Datele crescătorului închise la noi: trebuie să poată exporta tot, oricând.
- Date personale (adresă, telefon, email) afișate public fără ca omul să fi ales asta.
- AI-ul care „ghicește” și salvează fără verificare: ce nu e sigur se arată ca nesigur și îl confirmă omul.

## 3. Constrângeri

- **Limba**: română (interfața și textele). Diacritice peste tot.
- **Utilizatori**: mulți folosesc calculatorul (tipăresc), mulți telefonul; mulți nu sunt obișnuiți cu tehnologia → text mare, butoane mari, puțini pași, fără jargon.
- **Tehnic** (alegerea noastră, ca la Triaj): Node.js 24+, Express, PostgreSQL (`pg`), **Postgres instalat local** pentru dezvoltare și teste (fără SQLite sau baze emulate), frontend Angular (standalone, signals, zoneless), instalabil pe telefon (PWA). Găzduire în UE (Railway). Git: un branch pentru fiecare funcționalitate, merge în `main`; push doar cu acordul utilizatorului.
- **AI**: citirea pozelor / PDF-urilor cu Claude (cel mai nou model cu vedere, prin API), cost suportat de noi; limită de importuri pe zi per cont (valoarea o alege builderul) ca să nu explodeze costul.
- **GDPR**: clasamentele au numele altor crescători; pedigree-urile au adresa și telefonul proprietarului. Păstrăm doar ce e necesar (secțiunea 8).
- **Legal**: nu suntem avocați; înainte de lansare publică, verificare cu un avocat (baze de date – Legea 8/1996, GDPR, termenii columba.ro).

## 4. Abordări (alese în discuție)

**Platforma**
- **A – aleasă: un singur program web**, pe calculator și pe telefon, instalabil pe ecranul telefonului (PWA), QR citit cu camera. Un singur cod; calculatorul (tipărit) contează la fel ca telefonul.
- B – web + aplicații native în magazine: muncă dublă, verificarea magazinelor; se poate face mai târziu din același cod (de ex. Capacitor).
- C – doar telefon: pierde crescătorii care lucrează pe calculator și tipăresc.

**Citirea pedigree-urilor din poze / PDF**
- **Aleasă: AI cu vedere (Claude)** + ecran de verificare. Pozele reale sunt strâmbe, tăiate, cu text înghesuit în căsuțe; doar un model cu vedere le citește bine.
- OCR clasic (Tesseract etc.): se încurcă la căsuțe și coloane; respins.

**Rezultatele concursurilor**
- A – înțelegere cu federația (date automate): mai târziu; myloft e deja partenerul ei.
- B (robot pe columba.ro): **respinsă** (termeni, robots.txt, legea bazelor de date).
- **Aleasă: crescătorul aduce clasamentul**: lipește textul paginii (Ctrl+A, Ctrl+C, Ctrl+V), încarcă PDF-ul sau o poză. Programul păstrează doar ce îl privește.

## 5. Fișa porumbelului

Câmpuri predefinite (nu există un standard internațional unic pentru voiajori; folosim ce verifică crescătorii la mână + rubricile arbitrilor europeni de expoziție):

- **Rasă și linie**: rasa dintr-o listă (implicit Voiajor; și rase de expoziție / ornamentale pentru cine le crește) și **liniile / sușele** de origine ca etichete (Janssen, Van Loon, Van Heteren, Koopman…; listă care se completează din ce scriu crescătorii). Linia unui pui se propune din liniile părinților.
- **Identitate**: inel (secțiunea 6), sex (M/F), nume / poreclă („Super Velden”, „DE 927”), data eclozării, crescător de origine (text: „Van Heteren”, „Comb. Den Haan”), proprietar actual (contul).
- **Culoare**: aleasă dintr-o listă românească (Albastru, Albastru brocat, Solzat, Pestriț, Vânăt, Roșu, Gălbui, Alb, Negru… — lista finală o face builderul), cu sinonime și greșeli frecvente recunoscute la import („Vnata”→Vânăt, „Pestrita”→Pestriț, „Gut” etc.), plus „p.a” (pene albe) ca bifă. Culoarea ochiului din listă.
- **Stare**: concurent, reproducător, tânăr, vândut, pierdut, mort, accidentat.
- **Evaluare la mână**: note 1–5 pentru echilibru, musculatură, spate, aripă, penaj, ochi, bazin, caracter; trei texte: **calități**, **de dorit**, **defecte**.
- **Jurnal cu dată**: tip (notă, tratament, vaccin, antrenament, altele) + text.
- ~~Poze~~: **scoase** (decizia utilizatorului, 2026-11-16: fără spațiu pe server pentru pozele porumbeilor).
- **Părinți**: tată și mamă, fiecare fie un porumbel din cont, fie un **strămoș extern** (vezi mai jos), fie necunoscut.
- **Text pentru pedigree**: ce scrie în căsuța lui pe pedigree (titluri: „Super reproducătoare”, „Loc 1 Național 5 ani”); proprietarul alege ce note și ce rezultate apar pe pedigree și ce rămâne privat.

**Strămoș extern**: un porumbel care nu e al crescătorului, dar apare în pedigree-urile lui (bunici olandezi etc.). Are aceleași câmpuri de bază (inel, sex, nume, culoare, crescător, text, părinți), fără jurnal / evaluare. **Strămoș fără inel** e permis („000 M Govaerts, pedigreu distrus”, „0000/07 Vânăt, a fost neinelat”): inel lipsă + notă.

Același inel apare o singură dată în contul unui crescător: dacă importul aduce un strămoș care există deja (după inelul normalizat), se leagă de cel existent; diferențele de text se arată la verificare, nu se suprascriu în tăcere.

## 5a. Reproducția și puii

- **Pereche**: mascul + femelă, data împerecherii, sezonul, scopul (reproducție, concurs), nota. O pereche plănuită (încă neîmperecheată) arată consangvinizarea puilor ei.
- **Cuib / pontă**: perechea, data primului și al doilea ou, ouă nefecundate / sparte, data eclozării (programul propune data așteptată: ~17–18 zile de la ou), pui ieșiți.
- **Pui**: la eclozare sau la inelare (în jur de 6–8 zile) primește inelul (din seriile de inele ale crescătorului) și devine porumbel cu părinții deja completați; sexul se poate lăsa necunoscut până se știe. Puii dați (la alt porumbar, de ex. la doici) se notează.
- **Seriile de inele** cumpărate în fiecare an (de la federație, 50 / 100 de inele) se introduc o dată; la inelare programul propune următorul inel liber.
- **Pe fișa reproducătorului**: toți puii lui, pe perechi și sezoane; în Etapa 2, și rezultatele lor.
- **Alegerea părinților după inel** (cerut de utilizator): oriunde se aleg părinții (fișa porumbelului, perechea nouă, perechea plănuită, puiul la inelare), crescătorul scrie inelul tatălui și vede imediat **istoricul** lui: fișa, arborele, puii de până acum, rezultatele (în Etapa 2); la fel pentru mamă. Când are și tatăl și mama, vede consangvinizarea puilor lor și abia apoi confirmă care sunt părinții. Căutarea după inel merge în porumbeii și strămoșii lui și în pedigree-urile publice din program (doar ce proprietarii au făcut public). Dacă inelul nu e găsit nicăieri, îl poate adăuga ca strămoș extern pe loc.

## 6. Inele

Se păstrează **textul original** și forma **normalizată**: `țară` (ISO 2 litere) + `an` (4 cifre) + `număr` (fără zerouri în față) + `club` (doar unde există, de ex. Germania `DV-08778-24-271` → club `08778`). Afișare uniformă: `RO-25-276971`.

Exemple care trebuie recunoscute:
- `RO-26-800546 L` (Compuclub; L/T = mascul/femelă), `412084/15 RO`, `RO 25 1326835`, `412084/15 RO M`;
- columba.ro: coloanele `MATRICOL` `0276971` + `AN` `2025` → RO-25-276971 (zero din față ignorat);
- `NL-11-1724956`, `5218055/02 NL`, `6008107/08 BELG` (BELG→BE), `BE-25-2091885`, `2091850-25`, `DV-08778-24-271` / `DV-8778-24-262` (zerouri din clubul german ignorate la comparare);
- ani pe 2 cifre: `00`–(anul curent) → 20xx, restul → 19xx.

Inelele nerecunoscute se salvează ca text și se arată la verificare.

## 7. Pedigree tipărit și pagina publică

**Tipărit (PDF A4)**: 4 sau 5 generații (5 = 31 de strămoși), stilul cunoscut de crescători (căsuțe în arbore, ca la Compuclub), cu inel, sex, nume, culoare, textul ales și cele mai bune rezultate. **Strămoșii care se repetă sunt colorați automat** (aceeași culoare pentru același inel). Jos: datele crescătorului alese de el și **codul QR**. Când nu încape textul, se scurtează frumos și QR-ul duce la tot.

**Pagina publică** (QR / link): link greu de ghicit (token), vizibil fără cont, arată tot pedigree-ul (toate generațiile, toate rezultatele alese ca publice, fără limita hârtiei). Proprietarul poate **opri linkul** oricând (și face unul nou). Datele personale ale proprietarului: implicit doar numele; adresa / telefonul / emailul doar dacă le bifează.

**„Preia în porumbarul meu”** (cine are cont): copiază arborele ca date în contul lui (porumbelul ca strămoș extern sau ca porumbel propriu, după alegere), cu sursa notată („preluat de la … pe …”). Copia nu se mai schimbă când originalul se schimbă.

**Transfer de proprietate (vânzare)**: vânzătorul alege porumbelul și cumpărătorul (email sau cod de transfer); cumpărătorul acceptă; porumbelul trece în contul cumpărătorului cu fișa, pedigree-ul și rezultatele (jurnalul privat și evaluarea: vânzătorul alege dacă le trimite). Corespunde certificatului de proprietate pe hârtie folosit azi.

**Un porumbel e unul singur în program** (decizia utilizatorului): la vânzare se schimbă doar proprietarul, nu se face o copie. Crescătorul care l-a crescut (și proprietarii anteriori) văd mai departe, doar de citit, fișa publică, arborele, puii și rezultatele lui; notele private, evaluarea și jurnalul noului proprietar nu le văd. Așa analiza „cât de buni ies puii mei” include și puii vânduți. Același inel nu poate avea doi proprietari; „Preia în porumbarul meu” fără vânzare face din el un strămoș extern legat de original (nu un porumbel propriu). Dacă un cont e șters, porumbeii vânduți de el rămân la noii proprietari; datele personale ale celui șters dispar.

## 8. Importuri

**Pedigree din poză / PDF**
1. Crescătorul încarcă poza sau PDF-ul (și din camera telefonului).
2. AI-ul întoarce un arbore structurat: pentru fiecare căsuță inel, sex, nume, culoare, crescător, text, rezultate, cu **grad de siguranță** pe fiecare câmp. Trimiterile din text („Mama lui 738256/09F”) se propun ca legături.
3. **Ecran de verificare**: poza lângă arbore, câmpurile nesigure marcate, totul editabil; nimic nu se salvează înainte de „Confirm”.
4. La salvare: inele normalizate, legături cu porumbeii / strămoșii existenți, culori potrivite cu lista.

Poza sau PDF-ul încărcat se folosește doar pentru citire și **nu se păstrează** pe server (fără spațiu pentru poze, decizia utilizatorului).

**Excel**: un model de fișier descărcabil (o linie pe porumbel: inel, sex, nume, culoare, tată, mamă, …) și potrivirea coloanelor pentru fișiere proprii.

**Clasamente**
- **Lipire text de pe columba.ro**: parser determinist pentru tabelul lor (coloanele observate: `NR.CRT. | NUME PRENUME | COD | CDC | LOCALITATE | DISTANTA | MATRICOL | AN | E | X | ZI | H | M | S | T.REAL | VIT.MED. | PENALIZ. | FCI | CLS.` și antetul cu nr. concurs, organizator (județ), categorie, data, locul lansării, porumbei angajați, nr. columbofili). Exemplu de pagină: concursul 1, Vâlcea, Yablanița, 04.05.2026 (10.023 angajați, 2.005 clasați).
- **PDF / poză** de clasament (alte organizații, ex. Uniunea Columbofililor Profesioniști din România, străinătate, ani vechi): AI cu aceeași verificare.
- **Ce păstrăm**: doar rândurile cu **codul de crescător al utilizatorului** (îl introduce o dată în profil, de ex. `VL1395`; poate avea mai multe, de la ani / asociații diferite) și rândurile cu **inele care există deja în contul lui** (rude, strămoși) — pentru acestea păstrăm doar inelul și rezultatul, **fără numele altui crescător**. Restul textului lipit se aruncă.
- **Concursul** e identificat după organizator + dată + loc de lansare + categorie; lipirea aceluiași clasament de două ori nu dublează rezultatele.
- **Rezultat** salvat: concurs, loc, din câți porumbei, distanța, viteza, coeficient (dacă există), categoria, sursa (lipire / PDF / poză).

**Export**: tot contul în Excel și într-un fișier JSON documentat, oricând.

## 9. Rude, urmași, consangvinizare

Pe fișa porumbelului, calculat din datele contului:
- rezultatele lui; ale părinților; ale **fraților** (aceiași părinți) și **semi-fraților** (un părinte comun); ale **puilor** și nepoților;
- pentru reproducători: câți pui au rezultate, câți au fost „în premii”, cel mai bun rezultat al puilor, media coeficienților (formula exactă a „notei de reproducător” o alege builderul, explicată simplu pe ecran);
- **consangvinizarea** (coeficientul lui Wright) pe generațiile cunoscute, cu strămoșii comuni afișați; aceeași calculare pentru o **pereche plănuită** (alegi mascul + femelă → coeficientul puilor lor).

Textul de pe pedigree poate fi generat din aceste date („Tatăl lui: …”, „Semisoră cu: …”), iar crescătorul îl editează.

## 10. Conturi și siguranță

- Cont cu email + parolă; parolă uitată prin email (programul trimite emailuri tranzacționale; furnizorul îl alege builderul). Parola o alege doar omul.
- Un cont = un porumbar (o familie / asociere de crescători folosește același cont; mai mulți oameni pe un cont: mai târziu).
- Datele fiecărui cont sunt strict separate; pagina publică arată doar pedigree-ul ales, nimic altceva.
- Ștergerea contului șterge tot (GDPR).

## 11. Ce rămâne deschis

- **Clasamente de la alte filiale** și de la alte organizații (pentru a confirma că toate filialele Columba au același tabel și pentru formatele PDF): utilizatorul încearcă să facă rost.
- **Exporturi Compuclub / myloft**: format necunoscut; importul lor intră când avem fișiere-exemplu.
- Numele public, prețul și varianta gratuită.
- **Prima lansare = test închis cu câțiva crescători** (decizia utilizatorului); verificarea cu un avocat (GDPR, acordul cu furnizorul AI pentru pozele cu date personale, termenii columba.ro) se face înainte de lansarea publică, nu înainte de test.
- **Domeniul pentru QR și linkurile publice**: îl cumpără utilizatorul; e permanent, independent de numele programului. Până atunci, în cod e o setare (`PUBLIC_BASE_URL`); QR-urile se tipăresc doar după ce domeniul e fix.

## 11a. Alegeri făcute de Claude (de verificat de utilizator)

- **Fișiere-exemplu** în `docs/exemple/`: cele două pedigree-uri primite (`pedigree-compuclub.webp`, `pedigree-foto-5-generatii.webp`) și un clasament columba.ro lipit (`clasament-columba-lipit.txt`, primele 13 rânduri, cu numele, codurile și telefonul înlocuite cu date fictive). Pentru teste, dezvoltatorii pot deschide de mână câte o pagină de clasament, ca orice vizitator; serverul programului nu o face niciodată. În repo intră doar exemple anonimizate.
- **Fără mod offline** în Etapa 1: programul cere internet (porumbarul e de obicei acasă, cu Wi-Fi sau semnal). Formularele păstrează ce ai scris dacă pică netul pentru scurt timp. Offline complet: Etapa 3, dacă cer crescătorii.
- **Format deschis**: pagina publică a pedigree-ului oferă, la același link, și varianta pentru programe (JSON, format documentat și versionat „porumbar-pedigree v1”), ca alte programe să-l poată citi. E același format ca exportul.

## 12. Lăsat la alegerea builderului

Structura tabelelor, librăriile (PDF, QR, parsare), designul ecranelor (respectând: text mare, puțini pași, română), lista completă de culori, formula „notei de reproducător”, limita zilnică de importuri AI, furnizorul de email, ordinea de construire a pașilor din secțiunea 2.
