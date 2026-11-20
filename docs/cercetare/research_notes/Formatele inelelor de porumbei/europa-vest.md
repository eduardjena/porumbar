# Racing-pigeon ring number formats: Western Europe and the British Isles

Scope: Belgium, Netherlands, France, Germany (DV), Luxembourg, Switzerland, Austria, Denmark, Portugal, Spain, Italy, United Kingdom (RPRA/GB + NEHU, NWHU, SU/SHU, WHU; "NIPA" queried) and Ireland (IHU). Researched 2026-11-20.

Method note: PIPA (pipa.be) returned HTTP 403, Herbots lot pages from 2025 returned 404 by the time they were fetched, and the Danish and Austrian/Swiss federation pages had certificate problems (the latter two were read over plain HTTP with curl). Where a fact comes only from a search-engine summary (page not opened by me), it is marked "(search snippet)". Two official PDFs were downloaded and their text extracted: the RPRA 2018 GB ring distribution list and the IHU Southern Region 2024 ring distribution list.

## 1. Country codes on the ring and the variants written on pedigrees

### Takeaway
Every country in scope uses a letter prefix, but the prefix on the ring, on official results, and on auction pedigrees is often different (BELG vs BE vs BEL; FRANCE vs FR vs F; HOLL vs NL; DAN vs DK; POR vs PT; ITALIA vs IT; AUSTRIA vs AUT). In the British Isles the prefix is the issuing union, not the country (GB = RPRA; NEHU, NWHU, SU, WHU, IHU), so software must treat union codes as first-class prefixes.

### Cited Findings
**Official / federation lists of prefixes**
- Austrian federation (ÖBTZ) list of ring designations: "Belg" = Belgium; "DV, DVX, DDR" = Germany; "Dan" = Denmark; "France" = France; "Italia" = Italy; "NL" = Netherlands; "AUSTRIA" = Austria; "CH" = Switzerland; "ESP" = Spain; also Norge, PL/RP, RO/RSR, SK, SLO, CS/CZ, HUNG, CRO, YU, BG. The same page says a big "A" on a foot ring means a fancy (show) pigeon, not a racing pigeon — [ÖBTZ Zufliegermeldungen](http://www.brieftauben.at/pages/zufliegermeldungen.php)
- RPRA 2018 GB ring distribution list, "Overseas" table of ring prefixes: "BELG", "FRANCE", "D.V.", "HOLL / N.L.", "PORT", "POLAND", "ESP", "MALTA", "IF", "AU" — [RPRA 2018 Ring List (PDF)](https://www.pigeonnetwork.com/wp-content/uploads/RPRA-2018-Ring-List.pdf)
- Same RPRA list, British prefixes: "For Rings Prefixed - NWHU … Wales / WHU … NEHU … IHU … SU"; the British section lists GB (RPRA), NEHU (North of England Homing Union), NWHU (North West Homing Union), SU (Scottish Homing Union), WHU (Welsh Homing Union), IHU (Irish Homing Pigeon Union), plus fancy/roller prefixes (NPA, NRC, NTU, BSRF, INFPA, etc.) — [RPRA 2018 Ring List (PDF)](https://www.pigeonnetwork.com/wp-content/uploads/RPRA-2018-Ring-List.pdf)
- Dutch NPO lost-pigeon page: Belgian rings carry "BE" or "BELG"; Germany "DV"; Denmark "Dan"; England/Wales "GB, NEHU, NWHU, WHU, WALES" (the page writes both WHU and WHPU); France "F"/"FR"; Hungary "HUNG"; Poland "PL" or "RP"; Slovakia "SK"; Czech "CZ" — [NPO Duif gevonden](https://www.duivensportbond.nl/duif-gevonden-30)
- NWHU stray page lists the Scottish union as **SU** (not SHU); "NIPA" does not appear; the fancy-pigeon body is **NPA** (National Pigeon Association) — [NWHU Stray Pigeons](https://nwhu.co.uk/TempDir/stray-pigeons/)
- RPRA: "GB denotes that it is an RPRA ring" — [RPRA stray reporting](https://www.rpra.org/stray-reporting/)
- Swiss lost-pigeon service: racing rings show "CH = Ländercode" — [Zugeflogenendienst (CH)](http://www.zugeflogen.contactus.ch/)
- IHU rings carry "IHU" plus a regional letter: "S" for Southern Region (Republic of Ireland), "N" for Northern Region (Northern Ireland) (search snippet, IHU-related site) — [Irish Homing Union – IHU S Rings](http://www.27829.mrsite.com/page11.htm); corroborated by the RPRA list: "Serial letter 'N' rings to be reported to J. Hughes … Lisburn" and "Serial letter 'S' rings to be reported to Irish Homing Union, PO Box 12633, Dublin 12" — [RPRA 2018 Ring List (PDF)](https://www.pigeonnetwork.com/wp-content/uploads/RPRA-2018-Ring-List.pdf)
- France: the matricule ring shows "numéro matricule, année, pays comme pour les voitures", example "FRANCE 166548-98" — [colombophiliefr.com Que faire ?](https://www.colombophiliefr.com/que-faire/)
- Italy: the ring shows "ITALIA", the year below it, and a 6-digit number (search snippet) — [colombofilare.com ritrovato](http://www.colombofilare.com/Vecchiosito/ritrovato.html)
- Austria: ring text "AUSTRIA" = Austrian federation — [ÖBTZ](http://www.brieftauben.at/pages/zufliegermeldungen.php)
- Denmark: "DAN" stands for Danmark (search snippet from the Danish federation's lost-pigeon pages) — [DdB fundet](https://db.brevduen.dk/ddbfundet.htm), [DdB abc7](https://db.brevduen.dk/ddbabc7.htm)
- Portugal: Portuguese auction listings write "7157629./17 POR"; MC-Auctions files are titled both "PT 25 5156074" and "POR 25 5129179" (search snippet + file titles) — [MC-Auctions PT 25 5156074](https://www.mc-auctions.com/wp-content/uploads/2025/12/PT-25-5156074.pdf), [MC-Auctions POR 25 5129179](https://www.mc-auctions.com/wp-content/uploads/2025/10/POR-25-5129179.pdf)
- Spain: RFCE-related classification tables write "ESP0144872-2019" (search snippet) — [Club Betula / RFCE classification PDF](https://www.clubbetula.com/SPORTIVA%202020/0-ClasificacionFEderaciones-fusionado.pdf)
- Luxembourg: a 2017 Belgian club result lists "THEISMAN - LUX - 1175039-16" (search snippet) — [Championnat Habay 2017 (SlideShare)](https://fr.slideshare.net/slideshow/championnat-habay2017/80106043)

**Variants seen on auction pedigrees / results**
- Belgium: "BE 14-6176883", "BE-08-2169241" (Herbots) and "BEL-08-6338005" (MC-Auctions listing) (search snippets) — [Herbots Jos Vercammen article](https://www.herbots.be/fr/article/hok-jos-vercammen-vremde-1st-national-champion), [MC-Auctions ?p=32259](https://www.mc-auctions.com/?p=32259); "BELG 21 5001234" given as an example by a pedigree-software guide — [Pigeon Pedigree Manager guide](https://pigeonpedigreemanager.com/guides/pigeon-ring-numbers-explained)
- Italy: Herbots writes "IT-24-611854", "IT-24-617130" — [Herbots IT-24-611854](https://www.herbots.be/en/auction/pigeon-bids-racing-to-2025-part-5/item/IT-24-611854), [Herbots IT-24-617130](https://www.herbots.be/en/auction/pigeon-bids-racing-to-2025-part-1/item/IT-24-617130)
- Denmark: MC-Auctions writes "DAN 242 24 1698" and "DAN-013-22-4331" (file titles / search snippet) — [MC-Auctions DAN 242 24 1698](https://www.mc-auctions.com/wp-content/uploads/2026/01/DAN-242-24-1698.pdf), [MC-Auctions Team Bang](https://www.mc-auctions.com/shop/auctions/team-bang)
- Switzerland: Herbots writes "CH-23-15931" — [Herbots CH-23-15931](https://www.herbots.be/en/auction/pigeon-bids-olr-birds-zg-helios-breeding-1/item/CH-23-15931) (URL from search results; page was 404 when fetched)

### Inferences
- Normalisation table for software (prefix variants → canonical ISO-like country):
  - Belgium: BELG, BE, BEL, B (B unverified on rings) → BE
  - Netherlands: NL, N.L., HOLL → NL
  - France: FRANCE, FR, F, FRA (FRA unverified) → FR
  - Germany: DV, D.V., DVX, DDR (East Germany, historic), D/DE (D/DE not verified as ring text; likely only in software) → DV/DE
  - Luxembourg: LUX (L unverified) → LU
  - Switzerland: CH (SUI not found on rings; unverified) → CH
  - Austria: AUSTRIA (AUT/A unverified for racing rings; "A" is a fancy-pigeon ring in Austria) → AT
  - Denmark: DAN (DK seen in race result text, not as ring prefix) → DK
  - Portugal: POR, PORT, PT → PT
  - Spain: ESP (E unverified) → ES
  - Italy: ITALIA, IT (ITA unverified) → IT
  - UK unions: GB, NEHU, NWHU, SU (SHU is a common written alias of the Scottish union's name, not seen as ring prefix), WHU (also WHPU / WALES per NPO page) → keep union as prefix, country = GB
  - Ireland: IHU (+ N or S regional letter) → keep IHU, country = IE or GB-NIR depending on N/S
- "NIPA" in the brief appears to be a confusion with **NPA** (National Pigeon Association, a fancy/show pigeon body) or with the IHU Northern Region; I found no ring prefix "NIPA".

### Gaps
- No primary FCI document listing all member ring codes was retrieved (FCI site not reached).
- No primary source confirms ring text "SUI", "AUT", "LUX" variants other than LUX, "ITA", "DK" as a ring prefix, "E" for Spain, or "L" for Luxembourg.
- The year in which Belgium switched from "BELG" to "BE" on the ring was not found (sources only say both exist). Same for France "FRANCE" → "FR" and Netherlands "HOLL" → "NL".

## 2. Structure and order of parts (year, club/union number, series letters, serial, separators, check digits)

### Takeaway
Three families exist: (a) **country + year + national serial** (BE, NL, FR, PT, ES, IT, CH, LUX), with 5–7 digit serials; (b) **country + club/association number + year + short serial** (DV, AUSTRIA, DAN); (c) **union + year + series letter(s) + serial** (GB/RPRA and the British/Irish unions). No check digits were documented for any country. The year is 2 digits on most rings but 4 digits on modern BE/NL/IT rings and on some printed forms.

### Cited Findings
**Belgium (KBDB)**
- Ring = country code BE + year + 7 digits, example "BE 2021-1234567"; the KBDB owner lookup asks for the 7-digit number, the 4-digit year — [NPO Duif gevonden](https://www.duivensportbond.nl/duif-gevonden-30); KBDB mutation system works only for Belgian ring numbers "die uit 7 cijfers bestaan" (search snippet) — [KBDB Handleiding automatische mutatie (PDF)](https://www.kbdb.be/wp-content/uploads/2024/01/Handleiding-automatische-mutatie-van-Belgische-duiven.pdf)
- KBDB lookup only for rings "met vermelding BE op de ring" (search snippet) — [KBDB Duif opzoeken](https://www.kbdb.be/duif-opzoeken/)

**Netherlands (NPO)**
- "Op een Nederlandse ring is de landcode NL vermeld met daarachter een jaartal met nog 7 cijfers (bijv. NL 2021-1234567)"; search form asks for 4-digit year and the "7-cijferige ringnummer"; records kept only 20 years — [NPO Duif gevonden](https://www.duivensportbond.nl/duif-gevonden-30)
- Not racing: Dutch ornamental pigeon rings carry "EE" + "NL-S" (Sierduivenbond) or "NL-H" (Kleindierliefhebbers Nederland), with ring diameter, 2-digit year and serial — [NPO Duif gevonden](https://www.duivensportbond.nl/duif-gevonden-30)

**France (FCF)**
- Order on ring: number, year, country: "FRANCE 166548-98" (6-digit matricule, 2-digit year) — [colombophiliefr.com Que faire ?](https://www.colombophiliefr.com/que-faire/)
- NPO describes French rings as "FR 20-123456" (six digits after the year) — [NPO Duif gevonden](https://www.duivensportbond.nl/duif-gevonden-30)
- FCF ring allocations are published as ranges per society, e.g. 2024 "1 001 – 1 306 Hornaing", "22 101 – 22 300 Crespin Quievrechain"; numbers written with a space as thousands separator — [colombophiliefr.com recherche propriétaire](https://www.colombophiliefr.com/recherche-proprietaire/)
- Not racing: French show pigeon ring "F 10 99 M 2085" (F = France, 10 = ring diameter, 99 = year, M 2085 = number) (search snippet) — [pigeon-voyageur.com forum](http://pigeon-voyageur.com/index.php?mod=forum&ac=voir&id=652)

**Germany (Verband Deutscher Brieftaubenzüchter, DV)**
- "DV 12345-16-123": DV = Deutscher Verband, 12345 = club number (Vereinsnummer), 16 = last two digits of birth year, 123 = running number; advice to pad the running number with leading zeros to 4 digits ("0007") — [cyberfaktor.de Ringnummer Tipps](https://cyberfaktor.de/?id=5&seite=wissen_db)
- NPO: German number has three parts: a club number starting with 0, the year, an owner number; example "DV 04010-14-126" — [NPO Duif gevonden](https://www.duivensportbond.nl/duif-gevonden-30)
- Club number "beginnt immer mit einer 0", e.g. 01125; final number one to four digits (search snippet) — [Tierheim Bonn](https://tierheimbonn.de/2016/05/beringte-taube-gefunden-was-tun/), [vogelundnatur.de](https://www.vogelundnatur.de/brieftauben/)

**Austria (ÖBTZ)**
- "AUSTRIA 415 -18- 120": AUSTRIA = Austrian federation; 415 = Vereinsnummer (gives home location); 18 = birth year "(quer stehend)" i.e. printed sideways; 120 = running number, which together with the club number identifies the owner — [ÖBTZ Zufliegermeldungen](http://www.brieftauben.at/pages/zufliegermeldungen.php)
- Club numbers listed on the same page are 3 digits (101–107, 201, 301–336, 402–433, 501, 503 …) — [ÖBTZ Zufliegermeldungen](http://www.brieftauben.at/pages/zufliegermeldungen.php)

**Switzerland**
- Racing ring: "CH = Ländercode, 19 = Jahrgang, 12345 = Nummer der Taube"; search form: Ländercode / Jahr / Nummer ("nur Zahlen!"). Fancy pigeon ring differs: CH + size in mm + year + "A + 123" — [Zugeflogenendienst (CH)](http://www.zugeflogen.contactus.ch/)

**Luxembourg**
- Only evidence: "LUX - 1175039-16" (7-digit serial then 2-digit year) in a 2017 Belgian club result (search snippet) — [Championnat Habay 2017](https://fr.slideshare.net/slideshow/championnat-habay2017/80106043)

**Denmark (De Danske Brevdueforeninger, DdB)**
- "DAN 127-2003-0694": DAN = Danmark, 127 = local club (3 digits), 2003 = birth year, 0694 = running number; older example "DAN 040-95-0694" with 2-digit year; report form asks for the 3 digits after DAN, the year on the ring, and a ring number "der skal bestå af mindst fire cifre"; owner lookup only for rings sold from 2000 (search snippet; pages 403 to fetcher) — [DdB fundet](https://db.brevduen.dk/ddbfundet.htm), [DdB abc7](https://db.brevduen.dk/ddbabc7.htm)

**Portugal (FPC)**
- Written "7157629./17 POR" (7-digit number, 2-digit year, country) in a Portuguese loft's listings; also "3441562./13 POR", "1260671./21 POR" (search snippet) — source summarised by search engine; MC-Auctions files "PT 25 5156074", "PT 25 5332573", "POR 25 5129179" (7-digit serial) — [MC-Auctions PT 25 5332573](https://www.mc-auctions.com/wp-content/uploads/2026/02/PT-25-5332573.pdf)

**Spain (RFCE)**
- RFCE census form lists each ring as "Iniciales, Número, Año" plus colour (search snippet) — [Censo oficial RFCE 2020](https://usuaris.tinet.cat/ccmr/Censo-oficial%20RFCE%202020.pdf)
- Results write "ESP0144872-2019", "ESP0242407-2017": ESP + 7 digits (with leading zero) + 4-digit year (search snippet) — [Club Betula RFCE classification](https://www.clubbetula.com/SPORTIVA%202020/0-ClasificacionFEderaciones-fusionado.pdf)
- RFCE 2016 nest-ring licence list allocates numeric blocks per territorial federation (e.g. Asturias 1–10,800) (search snippet) — [RFCE anillas 2016 (PDF)](https://www.realfede.com/wp-content/uploads/2020/06/anillas_2016_0.pdf)
- Caution: "RFEC" (Real Federación Española de Colombicultura) is the *sport-pigeon/colombicultura* federation, not the racing federation RFCE; its rings are different — [realfec.es](https://www.realfec.es/docs/publicaciones/1/30/166.PDF)

**Italy (FCI – Federazione Colombofila Italiana)**
- Ring shows ITALIA, the year (e.g. 2008) and a 6-digit number; real find "Italia 2008 - 011334" (search snippet) — [colombofilare.com ritrovato](http://www.colombofilare.com/Vecchiosito/ritrovato.html)
- Auction format "IT-24-611854" (6 digits) — [Herbots IT-24-611854](https://www.herbots.be/en/auction/pigeon-bids-racing-to-2025-part-5/item/IT-24-611854)

**United Kingdom (RPRA = GB)**
- "e.g. GB22T12345": GB = RPRA ring; 22 = year of breeding; "T12345 identifies the specific individual bird for that year" — [RPRA stray reporting](https://www.rpra.org/stray-reporting/)
- "GB17N and GB17Z rings have six subsequent numbers, rather than the usual five … ignore the first 0, e.g. GB17Z012345 should read GB17Z12345" — [RPRA stray reporting](https://www.rpra.org/stray-reporting/)
- RPRA stray form fields: Prefix, Year (dropdown 00–26), Code, Number — [RPRA stray reporting](https://www.rpra.org/stray-reporting/); verification tool splits Prefix / Year / Code / Number — [RPRA Verify ring no](https://www.rpra.org/racing-handbook/verify-ring-no/)
- 2018 distribution list headings use the compact form "GB2018A", "GB2018B" … with 5-digit ranges "00001 - 01500"; letter series used in 2018: A, B, C, D, E, F, H, L, N, P, R, S, V, X, Z, plus a two-letter series **"GB2018SR"** (allocated to show-racer societies, e.g. "NE72 NORTH EAST COUNTIES SHOW RACER") — [RPRA 2018 Ring List (PDF)](https://www.pigeonnetwork.com/wp-content/uploads/RPRA-2018-Ring-List.pdf)

**Other British unions**
- NEHU: "the number would be of the form NEHU2008X1234" (4-digit year + letter + digits) — [NEHU Stray Bird](https://www.nehu.co.uk/lostbird.aspx)
- NWHU: RPRA auction lot titled "NWHU2025-2546 Blue Hen" (4-digit year, no visible letter, 4-digit serial) — [RPRA auction lot NRCC41](https://auction.rpra.org/auctions/uncategorized/lot-nrcc41-ireland-bros-nottingham-nwhu2025-2546-blue-hen/)
- NPO says English/Welsh unions use code + last two digits of year + series letter + number, e.g. "GB 99-D-1498" — [NPO Duif gevonden](https://www.duivensportbond.nl/duif-gevonden-30)

**Ireland (IHU)**
- 2011 sale listing writes "Blue Hen IHU 09 S 76230" (union, 2-digit year, region letter, 5-digit serial) (search snippet) — [Gibb & Byrne (pigeonnetwork)](https://www.pigeonnetwork.com/?p=6265)
- IHU Southern Region 2024 distribution list uses **6-digit** ranges "000001 001000 IHU SOUTHERN REGION" up to "139001 140000 SARSFIELD" — [IHU Southern Region Ring Distribution List 2024 (PDF)](https://res.cloudinary.com/cillianm/raw/upload/v1710497186/ihu/e2ad6ebf-66d6-4418-9172-12c7f9c72021.pdf)
- NEHU/IHU site: pigeons "up to IHU23 S" and pigeons "from 2024 on" are reported through separate forms (search snippet), suggesting a format/registry change in 2024 — [ihu.ie](https://www.ihu.ie/)
- Validator patterns from a pedigree app (non-official): "IHU 99-A-9, IHU 99-A-99999, IHU 99-AA-99999"; "GB 99-A99999"; "BE 99-9999999"; "NL 99-9999999" (search snippet; site unreachable when fetched) — [Pigero supported combinations](https://help.pigero.com/docs/en/varia/supported-combinations)

### Inferences
Suggested canonical patterns (C = country/union, YY/YYYY = year, L = letter, 9 = digit). All separators (space, "-", "/", ".") are optional in the wild and should be stripped before matching:

| Country | Canonical | Serial digits | Notes |
|---|---|---|---|
| BE | BE YY-9999999 | 7 | ring may say BELG; 4-digit year on modern rings |
| NL | NL YY-9999999 | 7 | 4-digit year on modern rings |
| FR | FR YY-999999 | 6 | ring order can be number-year-FRANCE ("166548-98") |
| DV | DV 0XXXX-YY-9999 | club 5 (leading 0), serial 1–4 | auction sites sometimes drop the leading 0 ("DV 1009 23 9V") |
| AT | AUSTRIA XXX-YY-9999 | club 3, serial 1–4 (unverified max) | year printed sideways on ring |
| DK | DAN XXX-YY-9999 | club 3, serial ≥4 | 4-digit year also used |
| CH | CH YY-99999 | 5 (from one example) | max digits unverified |
| LU | LUX 9999999-YY | 7 (one example only) | unverified |
| PT | POR/PT YY-9999999 | 7 | often written number./YY POR |
| ES | ESP 9999999-YYYY | 7 | often written without space |
| IT | IT YY-999999 | 6 | ring says ITALIA + 4-digit year |
| GB (RPRA) | GB YY L 99999 | 5 (6 for some series, e.g. 17N, 17Z) | letter series 1 letter, also "SR" |
| NEHU/NWHU/SU/WHU | UNION YY L 9999(9) | 4–5 | NWHU example has no letter (unverified generally) |
| IHU | IHU YY N/S 99999(9) | 5, 6 from 2024 (inferred from 6-digit 2024 list) | N/S = region |

- A year-position rule helps disambiguate: for BE/NL/FR/PT/ES/IT/LU the long serial (6–7 digits) distinguishes itself from the 2- or 4-digit year regardless of order; for DV/AT/DAN the middle 2-digit group is the year and the first group is the club.
- Because the GB 6-digit series has a leading zero that RPRA says to drop, normalisers should strip one leading zero from 6-digit GB serials when the first digit is 0.

### Gaps
- No official KBDB/NPO/FCF/VDBT/FCI/FPC/RFCE document giving formal field widths was retrieved; widths are from federation lost-pigeon pages and examples.
- Max length of Swiss, Austrian, Danish serials not verified.
- Whether the 2024 IHU change introduced a new written format (e.g. 6-digit serial, removal of the S/N letter) is unverified; only the 6-digit 2024 Southern list and the "up to IHU23 S / from 2024" wording were found.
- SU (Scottish) and WHU (Welsh) ring formats: no primary example found.
- No check digits documented for any country; none observed.

## 3. Real examples per country (as printed on rings, results or pedigrees)

### Takeaway
Real examples were found for all countries except Luxembourg (one example) and Switzerland/Austria (one or two each). Examples below are copied as written by the source (spacing and punctuation preserved).

### Cited Findings
- **Belgium**: "BE 14-6176883" (My Girl), "BE-08-2169241" (Golden Driesje) — [Herbots article](https://www.herbots.be/fr/article/hok-jos-vercammen-vremde-1st-national-champion) (search snippet); "BEL-08-6338005" (Olympic Niels) — [MC-Auctions](https://www.mc-auctions.com/?p=32259) (search snippet); "BE 25 4195817" — [MC-Auctions PDF](https://www.mc-auctions.com/wp-content/uploads/2026/04/BE-25-4195817.pdf); "BE20-5020563" — [Pitts news](https://pitts.be/en/news/be20-5020563-563-43e-pipa-rank-best-souillac-pigeon-belgium-roger-mertens); "BE-24-3005244" — [Herbots lot](https://www.herbots.be/en/auction/pigeon-bids-racing-to-2025-part-1/item/BE-24-3005244); "BE 24 2107099" — [Herbots pigeon page](https://www.herbots.be/en/pigeon/BE-24-2107099); year-suffixed form "5007900/19" seen on Pitts pedigrees (search snippet) — [Pitts lot](https://pitts.be/en/auctions/lucien-johan-vandebroek/lots/kleinzoon-van-stammoeder-blue-princess-grootmoeder-1ste-nationale-asduif-jonge-duiven-in-2019-2)
- **Netherlands**: "NL-26-8512919", "NL-26-8474075", "NL-26-8473258" — [MC-Auctions Team Bang](https://www.mc-auctions.com/shop/auctions/team-bang); format "NL 2021-1234567" (illustrative) — [NPO](https://www.duivensportbond.nl/duif-gevonden-30)
- **France**: "FRANCE 166548-98" — [colombophiliefr.com](https://www.colombophiliefr.com/que-faire/); "FR-24-268705" (father "FR21-006470") — [Herbots FR-24-268705](https://www.herbots.be/en/auction/pigeon-bids-racing-to-2025-part-9/item/FR-24-268705); "FR-24-273403" (father "FR19-273462") — [Herbots FR-24-273403](https://www.herbots.be/en/auction/pigeon-bids-racing-to-2025-part-2/item/FR-24-273403); "FR-24-273103" — [Herbots FR-24-273103](https://www.herbots.be/en/auction/pigeon-bids-barcelona-special-2/item/FR-24-273103); "FR-2025-305078" (4-digit year form) — [MC-Auctions France Masters 2025](https://www.mc-auctions.com/shop/auctions/france-masters-2025-wc) (search snippets)
- **Germany**: "DV-01769-26-16", "DV-01769-26-959", "DV-01769-26-934" — [MC-Auctions Team Bang](https://www.mc-auctions.com/shop/auctions/team-bang); "DV 00645 25 531" — [MC-Auctions PDF](https://www.mc-auctions.com/wp-content/uploads/2026/01/DV-00645-25-531.pdf); "DV03139 22 1154" — [Herbots PDF](https://s3.herbots.be/herbots-platform/DV03139-22-1154_PED.pdf); "DV 1009 23 9V" (leading 0 dropped, sex letter appended) — [Herbots PDF](https://s3.herbots.be/herbots-platform/DV-1009-23-9V.pdf); "DV 04010-14-126" — [NPO](https://www.duivensportbond.nl/duif-gevonden-30)
- **Luxembourg**: "LUX - 1175039-16" (search snippet) — [Championnat Habay 2017](https://fr.slideshare.net/slideshow/championnat-habay2017/80106043). Only one example found.
- **Switzerland**: "CH-23-15931" — [Herbots lot URL](https://www.herbots.be/en/auction/pigeon-bids-olr-birds-zg-helios-breeding-1/item/CH-23-15931); pattern "CH 19 12345" — [Zugeflogenendienst](http://www.zugeflogen.contactus.ch/)
- **Austria**: "AUSTRIA 415 -18- 120" — [ÖBTZ](http://www.brieftauben.at/pages/zufliegermeldungen.php). Only one example found.
- **Denmark**: "DAN 242 24 1698", "DAN 242 21 0916", "DAN 242 20 0154" — [MC-Auctions DAN-242-24-1698](https://www.mc-auctions.com/wp-content/uploads/2026/01/DAN-242-24-1698.pdf), [DAN-242-21-0916](https://www.mc-auctions.com/wp-content/uploads/2026/01/DAN-242-21-0916.pdf), [DAN-242-20-0154](https://www.mc-auctions.com/wp-content/uploads/2026/01/DAN-242-20-0154.pdf); "DAN-013-22-4331" — [MC-Auctions](https://www.mc-auctions.com/shop/auctions/team-bang) (search snippet); "DAN 127-2003-0694", "DAN 040-95-0694" — [DdB](https://db.brevduen.dk/ddbfundet.htm) (search snippet); "DAN-2026-046-0205" on AviRings auction (year placed first) (search snippet) — [AviRings Auction](https://auction.avirings.com/)
- **Portugal**: "PT 25 5156074" — [MC-Auctions](https://www.mc-auctions.com/wp-content/uploads/2025/12/PT-25-5156074.pdf); "PT 25 5332573", "PT 25 5332403" — [MC-Auctions](https://www.mc-auctions.com/wp-content/uploads/2026/02/PT-25-5332403.pdf); "POR 25 5129179" — [MC-Auctions](https://www.mc-auctions.com/wp-content/uploads/2025/10/POR-25-5129179.pdf); "7157629./17 POR" (search snippet, Portuguese loft listing; original URL not shown by search tool)
- **Spain**: "ESP0144872-2019", "ESP0242407-2017" (search snippet) — [Club Betula RFCE](https://www.clubbetula.com/SPORTIVA%202020/0-ClasificacionFEderaciones-fusionado.pdf). Only two examples, both from one source.
- **Italy**: "Italia 2008 - 011334" — [colombofilare.com](http://www.colombofilare.com/Vecchiosito/ritrovato.html) (search snippet); "IT-24-611854", "IT-24-617130", "IT-24-611855" — [Herbots](https://www.herbots.be/en/auction/pigeon-bids-racing-to-2025-part-8/item/IT-24-611855); "IT20-47897" (5 digits; search snippet, unverified) — [Herbots](https://www.herbots.be/en/auction/pigeon-bids-racing-to-2025-part-5/item/IT-24-611854)
- **United Kingdom**: "GB22T12345", "GB17Z012345" → "GB17Z12345" — [RPRA](https://www.rpra.org/stray-reporting/); "GB19 C46404" — [toppigeon.co.za PDF](https://toppigeon.co.za/wp-content/uploads/2024/07/GB19-C46404_info-1.pdf); "GB 99-D-1498" — [NPO](https://www.duivensportbond.nl/duif-gevonden-30); "NEHU2008X1234" — [NEHU](https://www.nehu.co.uk/lostbird.aspx); "NWHU2025-2546 Blue Hen" — [RPRA auction](https://auction.rpra.org/auctions/uncategorized/lot-nrcc41-ireland-bros-nottingham-nwhu2025-2546-blue-hen/)
- **Ireland**: "IHU 09 S 76230" (Blue Hen, 2011 listing; search snippet) — [Gibb & Byrne](https://www.pigeonnetwork.com/?p=6265); "ihu 10 12345" (forum, anecdotal, no letter) (search snippet) — [irishfowl.com](http://www.irishfowl.com/talk/topic-3781.html?c=10)

### Inferences
- Auction houses (Herbots, MC-Auctions) normalise to "CC-YY-NNNN" in URLs/titles, which is the most common shape a parser will see; on pedigree PDFs, however, spacing varies freely.
- Older format changes identified: Denmark 2-digit year (1995 example) vs 4-digit year (2003 example); RPRA year "GB2018A" (4-digit) in distribution lists vs "GB22T" (2-digit) on rings; IHU possible change from 2024.

### Gaps
- No example for SU (Scotland) or WHU (Wales) rings found.
- No old-format Belgian "BELG" or Dutch "HOLL" example with a date found; year of change unknown.
- The pre-2000 FR/NL/BE serial lengths were not verified (e.g., whether NL used 7 digits before the 1990s).
- Luxembourg, Austria, Switzerland and Spain have fewer than 3 independent verified examples.

## 4. How sex is appended on pedigrees

### Takeaway
Sex is commonly appended as a word or letter after the ring number, and the letters are language-specific and collide: German V (Vogel = cock) / W (Weibchen = hen); English Cock/Hen (C/H); Dutch doffer/duivin; French mâle/femelle; ♂/♀ symbols on some pedigree sheets. Only the German and English conventions are well sourced here.

### Cited Findings
- German: "DV 01545-16-007 W" and "DV 01545-16-101 V"; "W steht für Weibchen, V für Vogel"; notation is optional — [cyberfaktor.de](https://cyberfaktor.de/?id=5&seite=wissen_db)
- German suffix seen in real files: "DV 1009 23 9V", "DV 1009 23 143W" — [Herbots DV-1009-23-9V](https://s3.herbots.be/herbots-platform/DV-1009-23-9V.pdf), [Herbots DV-1009-23-143W](https://s3.herbots.be/herbots-platform/DV-1009-23-143W.pdf)
- English: "NWHU2025-2546 Blue Hen" (colour + sex after ring) — [RPRA auction](https://auction.rpra.org/auctions/uncategorized/lot-nrcc41-ireland-bros-nottingham-nwhu2025-2546-blue-hen/); "Blue Hen IHU 09 S 76230" (before ring) — [Gibb & Byrne](https://www.pigeonnetwork.com/?p=6265) (search snippet); pedigree sheets show "SEX: hen", "SEX: cock" and "Gender by DNA: Hen" with ♀ symbol (search snippet) — [cloudfront pedigree PDF](https://d2bjxxbwld7023.cloudfront.net/public/uploads/product/7d1e9badc1df922b3604833e3d8cf9e7.pdf)
- Dutch/Flemish: "duivin" = hen in Belgian lot titles ("Dochter Souillacduivin", "Duivin uit de legendarische Rocco-dynastie") — [Pitts lot](https://pitts.be/en/auctions/paul-sven-saeytijdt/lots/dochter-souillacduivin), [Pitts lot](https://pitts.be/fr/auctions/wijlen-vermeiren-andre-deel-2/lots/duivin-uit-de-legendarische-rocco-dynastie-van-philippe-dobbelaere)

### Inferences
- Parser should accept trailing sex tokens after the serial, with or without a space: V/W (German), C/H, Cock/Hen, M/F, ♂/♀, Doffer/Duivin, Mâle/Femelle. The German "V" (male) vs a possible Dutch/French "V"/"F" for female is a real collision risk; sex letters should be interpreted using the ring's country.
- A trailing single letter directly glued to a DV serial ("9V", "143W") must not be read as part of the number.

### Gaps
- Not verified with sources: Dutch abbreviation letters (D/V?), French M/F, Spanish M/H (macho/hembra), Portuguese M/F (macho/fêmea), Italian M/F (maschio/femmina), Danish H/Hun / Han. These are commonly assumed but I found no source; treat as unverified.

## 5. Ambiguities between countries' codes

### Takeaway
Most risk comes from single-letter codes and from union prefixes that look like countries: "A" (Austrian fancy ring vs Austria), "F" (France vs female), "D" (Germany vs Dutch "doffer"/Danish), "S"/"N" (IHU region letters vs GB series letters), "AU" (American Racing Union vs Australia/Austria), "IF" (US IF vs nothing European), "DK" vs "DAN", and "POR"/"PORT" vs Portugal "PT".

### Cited Findings
- "AU" and "IF" are US organisations (American Racing Union; International Federation of American Homing Pigeon Fanciers) in the RPRA overseas list, not Austria — [RPRA 2018 Ring List (PDF)](https://www.pigeonnetwork.com/wp-content/uploads/RPRA-2018-Ring-List.pdf); also "AU or IF: United States clubs" — [Pigeon Pedigree Manager](https://pigeonpedigreemanager.com/guides/pigeon-ring-numbers-explained)
- In Austria a large "A" on a foot ring marks a fancy (Rassetaube) ring — [ÖBTZ](http://www.brieftauben.at/pages/zufliegermeldungen.php)
- France's matricule ring may be read "166548-98 F" where "F indique que le pigeon est français" (search snippet) — [pigeon-voyageur.com forum](http://pigeon-voyageur.com/index.php?mod=forum&ac=voir&id=652)
- IHU "S"/"N" letters are region markers, written in the same position as RPRA series letters (GB has S and N series too: "GB2018S", "GB2018N") — [RPRA 2018 Ring List (PDF)](https://www.pigeonnetwork.com/wp-content/uploads/RPRA-2018-Ring-List.pdf)
- Germany has historic DDR (East Germany) and "DVX" codes in the Austrian list — [ÖBTZ](http://www.brieftauben.at/pages/zufliegermeldungen.php)
- Welsh union written WHU, WHPU or WALES on different pages — [NPO](https://www.duivensportbond.nl/duif-gevonden-30), [RPRA 2018 Ring List](https://www.pigeonnetwork.com/wp-content/uploads/RPRA-2018-Ring-List.pdf)
- Scottish union is "SU" on rings lists, while the body is the Scottish Homing Union (SHU) — [NWHU](https://nwhu.co.uk/TempDir/stray-pigeons/), [RPRA 2018 Ring List](https://www.pigeonnetwork.com/wp-content/uploads/RPRA-2018-Ring-List.pdf)
- Spain: RFCE (racing) vs RFEC (colombicultura) — different federations and rings — [RFCE](https://www.realfede.com/wp-content/uploads/2020/06/anillas_2016_0.pdf), [RFEC](https://www.realfec.es/docs/publicaciones/1/30/166.PDF)
- Fancy-pigeon rings in NL (NL-S, NL-H, "EE") and CH (with ring diameter) look like racing rings but are not — [NPO](https://www.duivensportbond.nl/duif-gevonden-30), [Zugeflogenendienst](http://www.zugeflogen.contactus.ch/)

### Inferences
- "AUS" in the brief's list for Austria would collide with Australia; I found no source using AUS for Austria — avoid mapping AUS → AT by default.
- "DK" appears in Danish race-result text ("DK-OL") rather than on rings; accept it as alias but output DAN/DK consistently.
- "BEL" (MC-Auctions) is an alias for Belgium; "B" alone is unverified.
- When a token after the year is a single letter: for GB/NEHU it is a series letter; for IHU it is N/S region; for DV it may be a sex letter after the serial. Position (before vs after the serial) distinguishes them.

### Gaps
- No FCI master list was obtained to confirm the official country codes for ring printing in 2026.
- Whether Luxembourg rings ever carry "L" alone was not found.
