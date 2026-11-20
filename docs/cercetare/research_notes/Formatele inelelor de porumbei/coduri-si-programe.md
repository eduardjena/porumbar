# Coduri de țară pe inele și cum le scriu programele (cercetare, 2026-11-20)

Notă de metodă: ~19 apeluri de căutare și citire. Site-ul FCI, PDF-ul programului Olimpiadei (duivensportbond.nl), pipa.be și rubydoc nu s-au putut citi (404 / 403 / 521). Unde nu există sursă, lucrul e trecut la „Gaps” sau marcat **NEVERIFICAT**.

## 1. Există o listă oficială FCI de coduri de țară pe inele?

### Takeaway
Nu am găsit nicio listă oficială publicată de FCI cu codurile de țară de pe inele, nici în regulamente, nici într-o anexă despre inele. Fiecare federație națională își alege codul pe care îl bate pe inel, iar codurile diferă des de ISO 3166 (DV pentru Germania, B/BELG/BE pentru Belgia, HUNG, PORT, ESP, ITA, DAN, SWE, NOR). Cea mai bună sursă găsită e o listă secundară (Pigeonpedia), cu organizația din spatele fiecărui cod.

### Cited Findings
- Structura generală a inelului: cod de țară (două sau mai multe litere), anul eclozării, un cod de organizație opțional, apoi numărul. Exemplu: `GB-2020-F-28768`. Anul poate avea 2 sau 4 cifre; numărul are de la 2 cifre în sus. — [Pigeonpedia, Pigeon Banding Explained](https://pigeonpedia.com/pigeon-banding)
- Codurile de organizație se folosesc doar la unele federații: Slovacia, Cehia, Ungaria și Germania (la Germania, după codul de țară vine un număr de club care începe cu 0). — [Pigeonpedia](https://pigeonpedia.com/pigeon-banding)
- Lista de coduri dată de Pigeonpedia (cod → federație), transcrisă exact: — [Pigeonpedia](https://pigeonpedia.com/pigeon-banding)
  - AU → American Racing Pigeon Union (SUA)
  - AUSTRIA → Österreichischer Verband der Brieftaubenzüchter
  - BELG / BE → Royale Fédération Colombophile Belge
  - CU / CRPU → Canadian Racing Pigeon Union
  - CZ → Českomoravský svaz chovatelů poštovních holubů
  - DAN → De Danske Brevdueforeninger
  - DV → Verband Deutscher Brieftaubenzüchter e.V.
  - ESP → Real Federación Colombófila Española
  - FIN → Suomen Viestikyyhkyliitto
  - FR → Fédération Colombophile Française
  - RPR / GB / UK → The Royal Pigeon Racing Association
  - HUNG → Magyar Postagalambsport Szövetség
  - IF → International Federation of American Homing Pigeon Fanciers (SUA)
  - ITA → Federazione Colombofila Italiana
  - LT → Lithuanian Racing Pigeon Association
  - LUX → Fédération Colombophile Luxembourgeoise
  - MALTA → Federation of Pigeon Racing Clubs of Malta
  - NL → Nederlandse Postduivenhouders Organisatie
  - NOR → Norges Brevdueforbund
  - PL → Polski Związek Hodowców Gołębi Pocztowych
  - PORT → Federação Portuguesa de Columbofilia
  - RO → Federația Română de Columbofilie (scris pe pagină „Federatia Romana De Sport Columbofila”)
  - SK → Slovenský zväz chovateľov poštových holubov
  - SWE → Svenska Brevduvesport
- În SUA sunt două coduri naționale de organizație: AU (American Racing Pigeon Union) și IF (International Federation of American Homing Pigeon Fanciers). — [Pigeonpedia](https://pigeonpedia.com/pigeon-banding)
- Canada: CU = Canadian Racing Pigeon Union; AU = American Racing Pigeon Union; IF = International Federation. — [Canada.ca, How to report a banded bird](https://www.canada.ca/en/environment-climate-change/services/bird-banding/how-to-report.html)
- Pe inelele SUA, AU desemnează organizația națională care a înregistrat pasărea (American Racing Pigeon Union, Inc.). Formatul AU este: litere, an din 2 cifre, literele clubului, număr, de exemplu `AU 99 ABC 1234`. — [pigeon.org, lost bird info](https://pigeon.org/pages/lostbirdinfo.html); [USGS, identifying unusual bands](https://www.usgs.gov/centers/pwrc/science/identifying-unusual-bands)
- Gem-ul Ruby `pigeon_band` (open source, MIT, ultima versiune 1.0.3 din 2015) leagă codurile de pe inel de ISO 3166-1: `B` → `BE`, `DV` → `DE`, `NL` → `NL`. Doar aceste trei țări sunt suportate; orice altceva dă `country_unknown`. — [sursa pigeon_band pe GitHub](https://raw.githubusercontent.com/volkerwiegand/pigeon_band/master/lib/pigeon_band.rb); [RubyGems](https://index.rubygems.org/gems/pigeon_band?locale=en)
- Am căutat pe site-ul FCI și în documentele FCI accesibile și nu am găsit nicio listă de coduri. Singurul PDF FCI citit (de pe deduif.be, intitulat „letter explanation federations”) este o scrisoare din 2026 a președintelui FCI despre procesul cu CIO pentru numele „FCI Racing Pigeon Olympiad” și nu conține coduri. — [deduif.be PDF](https://www.deduif.be/sites/default/files/linkfiles/letter-explanation-federations.pdf)

### Inferences
- În notațiile adoptate de federații, codurile de țară **nu** sunt ISO: DV (nu DE), B/BE/BELG (Belgia), HUNG/H (Ungaria), PORT/P (Portugalia), ESP/E (Spania), ITA/I (Italia), DAN/DK (Danemarca), SWE/S (Suedia), NOR/N (Norvegia), AUSTRIA/A (Austria), GB/UK/RPR (Marea Britanie). Parserul trebuie deci să aibă un tabel de alias-uri, nu doar ISO.
- Pigeonpedia scrie codurile în forma lungă (BELG, HUNG, PORT, ITA, ESP). Pe inelele propriu-zise și în pedigree-uri apar des forme scurte de o literă sau două (B, H, P, I, E, A, D). Formele de o literă nu le-am verificat aici; vezi Gaps.

### Gaps
- **Lista oficială FCI:** nu am găsit-o. Site-ul FCI (pigeonsfci.net / fci-pigeons) și regulamentul Olimpiadei FCI nu s-au putut citi. Dacă există, cel mai probabil e în catalogul Olimpiadei, care listează păsări din toate țările. PDF-ul programului Olimpiadei de pe duivensportbond.nl a dat 404.
- **NEVERIFICAT** (cunoștințe generale, fără sursă găsită în această sesiune): forme de o literă A = Austria, B = Belgia, D = Germania (vechi, înainte de DV), E = Spania, F = Franța, H = Ungaria, I = Italia, P = Portugalia, S = Suedia, N = Norvegia, CH/SUI = Elveția, CS = Cehoslovacia (istoric, înainte de 1993), YU = Iugoslavia (istoric), DDR = RDG (istoric, până în 1990), SA/RSA = Africa de Sud, ZA, RUS, UA, BG, SRB, SLO, HR, GR, TR, CHN/CN, TW, JP. Trebuie confirmate din cataloagele Olimpiadei sau din paginile federațiilor.
- Nu am găsit datele (anii) de schimbare ale codurilor istorice, de exemplu Cehia (CS → CZ) sau Germania (D → DV).

## 2. Coliziuni și ambiguități între coduri

### Takeaway
Coliziunea cu cele mai bune dovezi e **AU**: pe inel înseamnă American Racing Pigeon Union (SUA), nu Australia. Un caz mediatizat în 2020–2021 a arătat cum un inel „AU” a fost citit ca american pe un porumbel găsit în Australia. **CU** este Canadian Racing Pigeon Union. Celelalte coliziuni (AUS, SA, H, P etc.) nu le-am putut documenta.

### Cited Findings
- AU = American Racing Pigeon Union, organizația națională din SUA care a înregistrat pasărea. — [pigeon.org](https://pigeon.org/pages/lostbirdinfo.html)
- Un porumbel găsit în Melbourne (2020) avea un inel american AU. Uniunea americană a spus că numărul aparține altei păsări din SUA și că inelul e contrafăcut („counterfeit and not traceable”). — [Fox5 Atlanta](https://www.fox5atlanta.com/news/pigeon-set-to-be-euthanized-in-australia-gets-reprieve-after-identifying-leg-band-deemed-fake); [VOA](https://www.voanews.com/a/east-asia-pacific_fake-us-leg-band-gets-pigeon-reprieve-australia/6200747.html)
- CU = Canadian Racing Pigeon Union; tot pe inelele nord-americane apar IF și NPA (National Pigeon Association). — [Canada.ca](https://www.canada.ca/en/environment-climate-change/services/bird-banding/how-to-report.html); [USGS](https://www.usgs.gov/centers/pwrc/science/identifying-unusual-bands)
- Austria apare ca „AUSTRIA” în lista Pigeonpedia, nu ca AU. — [Pigeonpedia](https://pigeonpedia.com/pigeon-banding)
- În America de Nord, ordinea elementelor variază: de obicei literele organizației vin primele, dar uneori anul și numărul sunt inversate. — [USGS](https://www.usgs.gov/centers/pwrc/science/identifying-unusual-bands)

### Inferences
- `AU` trebuie tratat implicit ca SUA (ARPU). Australia și Austria nu ar trebui deduse din `AU`. `AUS` e ambiguu (Australia sau Austria) și ar trebui cerută confirmarea utilizatorului.
- `CU` e Canada (CRPU). Ipoteza „CU = Cuba” nu are dovezi găsite.
- Pentru siguranță, un parser ar trebui să păstreze textul brut al codului și să propună țara, nu s-o impună.

### Gaps
- Nu am găsit dovezi pentru SA (Africa de Sud vs. alte sensuri), P (Portugalia vs. Polonia), H (Ungaria vs. Olanda/Holland), S (Suedia vs. Spania) sau D vs. DV. Sunt plauzibile, dar **NEVERIFICATE**.

## 3. Cum scriu inelele programele și site-urile de licitații

### Takeaway
În sursele verificate, forma canonică e **ȚARĂ-AA-NUMĂR**, cu cratime și an din 2 cifre: `BE-21-4220803`, `NL-22-8165142`. Germania are o formă proprie, **DV-0CLUB-AA-NUMĂR**: `DV-02114-20-527`, `DV-07107-19-1081`. Gem-ul `pigeon_band` codifică exact aceste reguli. Pigeon Planner „clasic” desparte numărul (text liber) de an (4 cifre). Pentru Compuclub, Benzing, Tauris/Unikon, PigeonDB, Winning Pigeon și myloft nu am găsit documentație.

### Cited Findings
- **Herbots (licitații, Belgia):** URL-urile loturilor folosesc inelul ca identificator, de exemplu `/item/BE-21-4220803`, `/item/DV-02114-20-527`, `/item/DV-07107-19-1081`. — [Herbots BE-21-4220803](https://www.herbots.be/en/auction/top-fanciers-top-quality-lcb-auction-part-3/item/BE-21-4220803); [Herbots DV-02114-20-527](https://www.herbots.be/en/auction/pigeon-bids-heremans-collection/item/DV-02114-20-527); [Herbots DV-07107-19-1081](https://www.herbots.be/en/auction/pigeon-bids-fci-part-ii/item/DV-07107-19-1081)
- Pe listări de licitații apar și inele `NL-22-8165142` și `BE-24-5007145` (văzute în rezumatul căutării, nu pe o pagină citită direct). — [Herbots, Pigeon Bids](https://www.herbots.be/en/auction/pigeon-bids-march-2024)
- **PIPA:** regulamentul spune că identitatea porumbelului se dovedește prin pedigree și cartea inelului. În țările unde federația nu dă cărți de inel, inelul de pe picior confirmă identitatea. Pagina de licitații pipa.be a dat 403, deci formatul inelelor PIPA nu e verificat. — [auctions.pipa.be](https://auctions.pipa.be/en/node/24)
- **Gem-ul `pigeon_band`**, reguli exacte din cod: — [sursa](https://raw.githubusercontent.com/volkerwiegand/pigeon_band/master/lib/pigeon_band.rb)
  - Intrarea se trece în majuscule, iar `.`, spațiul și `/` se înlocuiesc cu `-`. Dacă nu începe cu o literă, se adaugă în față țara implicită.
  - `B`: an + număr între 1000001 și 9999999. Ieșire `B-%02d-%07d`, deci `B-21-4220803`. ISO `BE`.
  - `NL`: la fel, `NL-%02d-%07d`. ISO `NL`.
  - `DV`: club 1–9999, an, număr 1–9999. Afișare `DV-0%d-%02d-%d` (de exemplu `DV-06914-12-479`). Cheia de sortare are zerouri în față: `DV-%05d-%02d-%04d`. ISO `DE`.
  - Anul se acceptă doar ca 0–99 și devine 20AA. Dacă depășește anul curent + 5, devine 19AA.
- **Pigeon Planner (versiunea „clasică”, Python/GTK, GPL)** păstrează inelul ca două câmpuri: numărul (text liber, de exemplu `BE1234567`) și anul, obligatoriu de 4 cifre. Cheia internă `pindex` este `band + year`. Afișarea e `număr / an`, iar `get_pindex_from_band_string` desparte la ultimul `/`. — [checks.py](https://raw.githubusercontent.com/GoooIce/Pigeon-Planner/HEAD/archive/pigeonplanner-classic/pigeonplanner/core/checks.py); [common.py](https://raw.githubusercontent.com/GoooIce/Pigeon-Planner/HEAD/archive/pigeonplanner-classic/pigeonplanner/core/common.py); [bandentry.py](https://raw.githubusercontent.com/GoooIce/Pigeon-Planner/HEAD/archive/pigeonplanner-classic/pigeonplanner/ui/widgets/bandentry.py) (fork al proiectului de pe SourceForge)
- Format GB/RPRA: `GB-2020-F-28768`, cu an din 4 cifre și literă de serie. — [Pigeonpedia](https://pigeonpedia.com/pigeon-banding)

### Inferences
- Un parser tolerant ar trebui să accepte orice separator (`-`, spațiu, `.`, `/`, nimic), ani din 2 sau 4 cifre (normalizați la 4), țara înainte sau lipită de an (`BE21`, `NL2022`) și să păstreze literele de serie (GB, AU). Afișarea normalizată ar fi `ȚARĂ-AA-NUMĂR`, cu excepția Germaniei, care primește segmentul de club (`DV-0CLUB-AA-NUMĂR`).
- La DV, segmentul de club începe cu 0 și are 5 cifre (`02114`, `07107`, `06914`). Nu trebuie confundat cu anul.
- La BE și NL numărul are 7 cifre (1000001–9999999 în `pigeon_band`). Zerourile din față contează la comparare.

### Gaps
- **Compuclub, Benzing, Tauris/Unikon, PigeonDB, Winning Pigeon, myloft:** nu am găsit documentație sau formate de export publice în această sesiune. Formatele lor sunt **NEVERIFICATE**.
- **Pigeon Planner 3.x/4.x:** versiunea nouă (cu câmpuri separate de țară, litere, număr și an și un „band format” configurabil) nu am găsit-o în cod. Am citit doar arhiva „classic”.
- Pigeon-Paradise (PIPA): pagina de licitații a refuzat accesul (403). Nu am verificat dacă scriu `BE21-4220803` sau `BE-21-4220803`.
- Formatul polonez (`PL-0XXX-AA-NUMĂR`, cu cod de secție) și cel român (`RO-AA-NUMĂR` sau cu cod de asociație) sunt **NEVERIFICATE**.

## 4. Sufixe de sex și culoare lipite de inel

### Takeaway
Nu am găsit surse care să descrie sistematic sufixele de sex sau culoare lipite de inel în pedigree-uri.

### Cited Findings
- Nu am găsit nicio sursă citabilă.

### Inferences
- (Fără dovezi.) Ar trebui verificat pe exemple reale de pedigree-uri: Herbots, PIPA, ghidul „How to read a pigeon pedigree” de pe pedigrepro.duckdns.org (apărut în căutare, necitit).

### Gaps
- **NEVERIFICAT**, din practică generală: în NL/BE se notează des `M`/`V` sau `D` (doffer, mascul) și `DUIF`/`P` (duivin, femelă), în engleză `C`/`H` (cock/hen) și în germană `V`/`W` (Vogel/Weibchen). Culorile apar în prescurtări precum BB (blue bar), BBW, BC/BCH (blue chequer), DC/DCH (dark chequer), R/RC (red chequer), M (mealy) și „Bl./Blauw”. Toate trebuie confirmate pe pedigree-uri reale.
