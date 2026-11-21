# Tratamente pe tot porumbarul, cu amintiri pe telefon: design

Data: 2026-11-21 · Branch: `feat/tratamente` (worktree `C:\dev\porumbar-tratamente`, din `main` f6273d5).

## De ce
Crescătorul **uită când se termină cura și când vine vaccinul următor**. Azi Porumbar are doar jurnalul porumbelului
(intrări cu dată, tipuri `nota / tratament / vaccin / antrenament / altele`), câte un porumbel o dată: o cură în apă
dată la tot porumbarul nu are unde să stea, iar aplicația nu amintește nimic. Concurența: myloft și Pigeon Planner nu
au tratamente; câteva aplicații mici de telefon (PigeonPro, Pigeon Loft Manager, PigeonKeeper) au tratamente și
memento-uri. Ținta e amintirea care „te trage de mânecă”; registrul vine de la sine.

## Ce vrea vânzătorul (decis în conversație)
- Un tratament se dă **odată unui grup**: tot porumbarul, concurenții, reproducătorii, tineretul sau porumbei aleși.
- Amintirea ajunge la om prin **notificare pe telefon** (varianta 3), cu **Panoul** și **emailul** ca plasă de siguranță.
- Fișa „Tratament nou”, momentele notificărilor și ce nu facem acum: aprobate așa cum sunt mai jos.

## Obiective
1. **Tratament nou** (fișă scurtă, mare, pe telefon):
   - **Ce dai:** listă cu sugestii (numele bolii / vaccinului, nu medicamente; ro + hu) sau text liber, de ex. „Ronidazol 10%”.
   - **Fel:** Tratament / Vaccin (devine tipul intrării din jurnal).
   - **Cui:** Tot porumbarul · Concurenții · Reproducătorii · Tineretul · Aleg eu porumbeii. Grupurile vin din
     **starea** porumbelului (`concurent`, `reproducator`, `tanar`). „Tot porumbarul” = porumbeii proprii fără starea
     `vandut / pierdut / mort`. Starea `accidentat` e inclusă la „tot porumbarul”, nu în grupuri.
   - **Cum:** apă / hrană / pastilă / injecție / picături.
   - **Începe** (data, `<app-date>`) + **Câte zile** (1–60) → arată „se termină pe …”.
   - **Se repetă:** nu / peste N zile / peste 1 an (aceeași zi și lună).
   - **Notă** (doza scrisă de om, max. 1000 de caractere).
2. **Jurnalul porumbelului**: fiecare porumbel care primește tratamentul are automat o intrare (data = ziua de început,
   tipul = tratament/vaccin, textul de ex. „Tricomonază (în apă, 21–25.11.2026) — 2 g la 1 l apă”). Intrarea e legată
   de tratament: modificarea tratamentului o rescrie, ștergerea o șterge. Intrarea legată nu se șterge separat din fișa
   porumbelului (trimite la tratament).
3. **Pagina Tratamente**: În curs · Urmează · Gata (cele mai noi întâi); deschiderea unui tratament arată porumbeii lui,
   cu Modifică / Anulează / Șterge.
4. **Panoul**: o bandă sus „În curs: Tricomonază, ziua 3 din 5” (câte un rând pe tratament) și „Urmează” — tratamentele
   din următoarele 30 de zile. Apăsarea duce la tratament.
5. **Notificări pe telefon** (Web Push, standard, trimise de serverul Porumbar):
   - **în seara dinainte** de început, ora **19:00**: „Mâine începe: Tricomonază, 24 de porumbei (în apă)”;
   - **în dimineața ultimei zile**, ora **07:00**: „Azi e ultima zi: Tricomonază” — doar dacă tratamentul are ≥ 2 zile;
   - pentru un tratament **care se repetă**, în plus **cu 3 zile înainte**, ora 19:00: „Joi: vaccin paramixo, 24 de
     porumbei” (ca să aibă timp să cumpere vaccinul).
   - Mai multe tratamente în același moment → **o singură notificare** pentru cont, cu toate.
   - Apăsarea notificării deschide tratamentul (sau Panoul când sunt mai multe).
   - Ora României (`Europe/Bucharest`, cu ora de vară), indiferent de fusul serverului.
6. **Pornirea notificărilor**, în **Cont**: butonul mare „Primesc amintiri pe telefonul ăsta” (pe fiecare dispozitiv),
   „Trimite o probă”, „Opresc pe telefonul ăsta”. Pe iPhone, când browserul nu e aplicația de pe ecranul principal,
   în locul butonului apare explicația pas cu pas „Partajează → Adaugă pe ecranul principal”, apoi deschiderea din
   iconiță. Pe un browser care nu știe notificări: un rând simplu că primește emailul.
7. **Emailul** (plasa de siguranță): **cel mult un email pe zi pentru un cont, seara la 19:00, și doar când are ceva
   de făcut**, numai pentru conturile **fără niciun dispozitiv cu notificări pornite** (sau ale căror trimiteri de
   seară au eșuat toate). Emailul adună tot: ce începe mâine, ce are mâine ultima zi, ce se repetă peste 3 zile. Fără
   email de dimineață. Din Cont se poate opri („Nu vreau amintiri pe email”). Motivul: la ~1.000 de utilizatori trebuie
   să încapă în limita unei căsuțe obișnuite (fără serviciu de mail plătit) — estimat ~30 pe zi, vârfuri ~150.

## Ce nu facem acum (non-obiective)
- Hrana, stocul de hrană și de medicamente.
- Dozele calculate automat, sfaturi medicale („ce să dau pentru…”), medicamente cu nume comercial în sugestii.
- Notificări prin SMS, Firebase, OneSignal sau alt serviciu străin.
- Calendar comun cu concursurile (legătura „cura după concurs” poate veni mai târziu).
- Bifa „am dat azi” pe zile.

## Anti-obiective (eșec chiar dacă „merge”)
- Spam: mai mult de o notificare pentru același moment, sau aceeași notificare de două ori (de ex. când o publicare
  nouă pe Railway pornește peste cea veche).
- Datele crescătorilor trimise la terți (în afară de serviciul de push al browserului, care primește doar mesajul
  criptat) sau CSP-ul slăbit.
- Ceva ce sună a sfat veterinar.
- Fișa cu multe câmpuri obligatorii: obligatorii sunt doar „Ce dai”, „Cui” (cu porumbei) și „Începe”.

## Abordări
1. **Tratamentul ca lucru separat** (ales): tabele proprii, jurnalul fiecărui porumbel se scrie din el; serverul trimite
   Web Push cu chei VAPID proprii, o verificare pe oră. Modificarea / anularea se face într-un singur loc; Panoul și
   „Urmează” citesc direct tratamentele.
2. **Doar intrări în jurnal** la fiecare porumbel: o cură greșită la 40 de porumbei s-ar corecta în 40 de locuri și
   „Urmează” n-ar avea de unde lua datele. Respinsă.
3. **Serviciu străin de notificări** (Firebase / OneSignal): date la terți, CSP-ul ar trebui deschis pentru scripturile
   lor, cost și dependență pentru câteva mesaje pe zi. Respinsă.

## Decizii tehnice (alegerile constructorului, marcate)
- **Date** (migrare nouă în `src/db.js`):
  - `treatments` (cont, nume, fel `tratament|vaccin`, mod, `start_date`, `days`, notă, țintă
    `toti|concurenti|reproducatori|tineret|alesi`, repetare `null|zile|an` + `repeat_days`, `parent_id` pentru
    repetarea care a născut-o, `cancelled_at`, `created_at`);
  - `treatment_pigeons` (tratament, porumbel) — porumbeii **hotărâți la ziua de început**: pentru un grup după stare,
    lista se fixează când începe tratamentul (sau la salvare, dacă începe azi sau a început deja), ca la vaccinul de
    peste un an să intre tineretul nou; la „Aleg eu” lista e cea aleasă. *(alegerea mea)*
  - `journal_entries.treatment_id` (nullable, `ON DELETE CASCADE`);
  - `push_subscriptions` (cont, `endpoint` unic, `p256dh`, `auth`, `user_agent` scurt, `created_at`, `last_ok_at`);
    un abonament care primește 404/410 se șterge;
  - `treatment_notices` (tratament, fel `inainte|ultima_zi|repetare`, data) cu **cheie unică**: rândul se scrie
    înainte de trimitere (`INSERT … ON CONFLICT DO NOTHING`), deci două servere pornite simultan nu trimit de două ori;
  - `accounts.reminder_email` (implicit da).
- **Repetarea**: la salvare se creează și tratamentul următor (planificat), cu aceeași țintă; când începe acela, se
  creează următorul. Anularea unuia oprește lanțul de acolo încolo. *(alegerea mea)*
- **Numerotarea migrării**: `main` are 21 de migrări; `feat/plata-paddle` (nepublicată) adaugă 22–25. Tratamentele
  folosesc următorul număr liber **de pe ramura care intră a doua**; la unire, migrarea se renumerotează după ultima
  existentă (o migrare rulată nu se schimbă — vezi regula din `src/db.js`).
- **Push**: pachetul npm `web-push` (VAPID, criptarea mesajului). Cheile în `.env` / Railway: `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` al vânzătorului) — niciodată în chat sau în repo. Fără chei:
  butonul din Cont nu apare, rămân Panoul și emailul. Cheia publică ajunge la browser prin `GET /api/push/config`.
- **Service worker** propriu, mic, `web/public/sw.js` servit la `/sw.js` (scope `/`, fără cache agresiv), doar
  `push` + `notificationclick`; nu face cache offline la aplicație. CSP-ul rămâne `'self'` (verifică `worker-src`).
  `manifest.webmanifest` trebuie să aibă `display: standalone` pentru iPhone.
- **Programatorul**: un `setInterval` pe oră pornit la pornirea serverului (ca la memento-urile existente), plus o
  rulare la pornire; calculează momentele în `Europe/Bucharest`. O notificare ratată (server oprit la 19:00) se
  trimite la următoarea verificare **doar dacă momentul nu a trecut cu mai mult de 3 ore**. *(alegerea mea)*
- **Cont fără abonament (doar citire)**: nu poate crea / modifica tratamente (regula existentă din `accounts.js`), dar
  amintirile pentru tratamentele deja salvate **continuă** (e sănătatea porumbeilor). Abonarea la notificări e o
  scriere permisă și în doar-citire. *(alegerea mea)*
- **Limba** notificării și a emailului = limba contului; toate textele noi în `i18n/ro.json` și `i18n/hu.json`.
- **Meniu**: „Tratamente” cu iconiță SVG proprie, ajungi la ea dintr-o atingere din Panou; locul exact în meniu îl
  alege constructorul, consecvent cu benzile de submeniu existente.

## Reguli detaliate (alegerile mele, după verificarea designului)
1. **Momentele notificărilor** se calculează la fiecare verificare din starea curentă a tratamentului. Un moment se
   trimite dacă: a sosit, n-a trecut cu mai mult de 3 ore, e **după** crearea / ultima modificare a tratamentului,
   tratamentul nu e anulat, are ≥ 1 porumbel și nu există deja rândul `(tratament, fel, data)` în
   `treatment_notices`. Deci: un tratament salvat azi care începe azi nu primește „mâine începe”, nici unul salvat
   seara după 19:00 pentru mâine (omul tocmai l-a scris); „ultima zi” vine normal. Dacă omul mută datele, momentele noi se trimit (planul s-a
   schimbat); rândurile vechi rămân ca istoric.
2. **Modifică** poate schimba orice, oricând. Până la ziua de început, grupul se socotește din stările de acum (nu e
   fixat); în ziua de început lista se fixează (prima verificare de după miezul nopții sau prima citire, care vine
   întâi). Dacă după început omul schimbă ținta sau porumbeii aleși, lista se refixează, iar intrările din jurnal se
   pun la zi (se adaugă, se șterg, se rescrie textul). Modificarea unui tratament care se repetă schimbă doar acel
   tratament; dacă se schimbă repetarea, următorul tratament planificat (încă neînceput) se refăce.
3. **Lanțul repetărilor:** „peste N zile” se socotește de la începutul celui de dinainte; „peste 1 an” = aceeași zi și
   lună (29 februarie → 28 februarie). Există mereu **un singur** tratament următor planificat; când începe acela, se
   creează următorul. **Șterge** = tratamentul acesta, intrările lui din jurnal și următorul planificat; cel de dinainte
   rămâne, dar nu se mai repetă. **Anulează** e doar pentru unul în curs: intrările din jurnal rămân, cu „oprit pe …”,
   iar următorul planificat se șterge. Cele neîncepute nu se anulează, se șterg.
4. **Numărul de porumbei:** înainte de început e numărul de acum al grupului; după fixare, porumbeii rămân în tratament
   și în jurnal chiar dacă sunt vânduți sau mor (e istoric). Salvarea cu un grup gol e refuzată („Grupul ales nu are
   porumbei”). Un tratament care la fixare are 0 porumbei nu trimite notificări.
5. **Emailul (rezumatul de seară):** la verificarea de la 19:00, după push-urile serii, un cont primește un email
   dacă are ceva pentru mâine / peste 3 zile **și** nu are niciun dispozitiv abonat sau **toate** trimiterile serii au
   dat eroare (404/410 șterg abonamentul). Un rând în `email_digests (cont, data)` cu cheie unică, scris înainte de
   trimitere: cel mult un email pe zi, nimic nu se reîncearcă (mai bine o amintire pierdută decât spam). Trimiterea e
   **rară**: o coadă care trimite câteva emailuri pe minut (implicit 10/minut, din `.env`), ca să nu treacă de limita
   căsuței. Fără `SMTP_URL` în producție: nu se trimite și nu se scrie conținutul în jurnalul serverului. Text simplu,
   în limba contului, cu linkul către Tratamente.
6. **Cine primește:** orice cont cu tratamente active, inclusiv cele doar-citire (lanțul repetărilor continuă și la
   ele). Notificările se adună pe cont la fiecare verificare; atingerea deschide tratamentul când e unul singur, altfel
   Panoul. „Cu 3 zile înainte” și „seara dinainte” sunt două momente diferite, deci două notificări (aprobat).
7. **Fusul orar:** `Europe/Bucharest` pentru toate conturile (Ungaria are același decalaj); orele nu se pot schimba
   deocamdată.
8. **Jurnalul:** o intrare pe porumbel, cu data de început; textul se compune pe server în limba contului când se
   scrie / rescrie (schimbarea limbii nu rescrie intrările vechi). Intrarea legată nu se poate șterge separat nici
   din API (`DELETE /api/journal/:id` → 409, cu mesaj care trimite la tratament).
9. **Migrarea:** pe ramura asta e 22; dacă plata intră prima în `main`, la unire se renumerotează după 25. Testele
   folosesc `SCHEMA_VERSION`, nu numere scrise de mână, unde se poate.
10. **Service worker și dispozitive:** `web/public/sw.js` ajunge necomprimat și fără hash la rădăcina build-ului;
    Express îl servește cu `Cache-Control: no-cache`; dacă CSP-ul nu are `worker-src`, se adaugă `worker-src 'self'`.
    Abonamentul se salvează după `endpoint` (dacă alt cont intră pe același telefon și pornește amintirile, abonamentul
    trece la el); la „Ieși din cont”, telefonul își șterge abonamentul.
11. **Afișare:** la un tratament de o zi, banda scrie „azi”, nu „ziua 1 din 1”. „În curs” = neanulat și azi între
    început și sfârșit. „Gata” arată ultimele 50, cu „Mai multe”. Vaccinul are altă iconiță decât tratamentul. La „Aleg
    eu” apar doar porumbeii proprii fără starea vândut / pierdut / mort.

## Constrângeri
- PostgreSQL, Node 24 ESM, Express 5, Angular standalone/signals/zoneless; `<app-date>` pentru date.
- Text de bază 18px, butoane ≥ 48px, contrast mare; iconițe SVG proprii, fără CDN.
- Separarea strictă între conturi: un tratament poate lega doar porumbei proprii ai contului.
- Datele de test fictive; nicio dată reală în repo.
- Fără publicare pe `main` / Railway fără acordul vânzătorului.

## Lăsat constructorului
Lista exactă de sugestii (boli/vaccinuri uzuale, ro + hu), textele notificărilor, aspectul paginii Tratamente și al
benzii din Panou (în stilul aplicației), cum se aleg porumbeii la „Aleg eu” (refolosind căutarea existentă), locul în
meniu.

## Lansare
Cheile VAPID le pune vânzătorul pe Railway (îl ghidăm pas cu pas). Emailul de siguranță are nevoie de `SMTP_URL` pe
Railway (aceeași condiție ca la plată). Test pe un Android și un iPhone reale înainte de publicare.
