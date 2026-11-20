# Racing pigeon ring (band) number formats in the Americas (USA, Canada, Mexico, Latin America)

Research date: 2026-11-20. Scope: how band numbers are written on the band and in pedigrees, results and auctions, so software can recognise and normalise them. South Africa is out of scope. Its "ZA" and one-loft examples appear only where they show up in US entries.

Method note: two US breeder pedigree PDFs were downloaded and run through `pdftotext`, so their examples below are verbatim. The pigeon.org lost-bird page returned HTTP 404 on direct fetch on 2026-11-20. Its content below comes from the search-engine summary of that URL and is marked as such.

## 1. Organisation prefix vs country code, and how pedigrees write them (USA / Canada)

### Takeaway
North American bands carry an **organisation code**, not an FCI country code: AU/ARPU, IF, CU/CRPU, NPA, IPB, NBRC, ADA. Then come a year (2 or 4 digits), a free-form club/loft code and a serial. The order of these elements in pedigrees and results is **not fixed**. Verified real examples show at least six different orderings, sometimes in the same document. A parser has to identify the parts by type (org token, year, alphabetic club, numeric serial), not by position.

### Cited Findings
**Organisation codes**
- USGS lists the pigeon band organisation codes as "AU or ARPU, CU, IF, IPB, NPA, NBRC, or ADA". Bands are often aluminium, coated with coloured plastic. — [USGS – Identifying unusual bands](https://www.usgs.gov/centers/pwrc/science/identifying-unusual-bands)
- The NPA page expands the codes as IF = "INTERNATIONAL FEDERATION", AU = "AMERICAN RACING PIGEON UNION", CU = "CANADIAN PIGEON UNION", IPB = "INDEPENDENT PIGEON BREEDERS" and NBRC = "NATIONAL BIRMINGHAM ROLLER CLUB". — [NPA – Found pigeon](https://npausa.com/customer_service/found_pigeon.html)
- IFPigeon names AU (American Racing Pigeon Union), CU or CRPU (Canadian), FOYS (Foy's Pigeon Supply, a supplier, not a federation), NPA, NBRC and ADA as organisations that "do NOT use "IF" on their bands". — [IFPigeon – How to read pigeon bands](https://ifpigeon.com/how-to-read-pigeon-bands)
- Canada.ca lists "CU: Canadian Racing Pigeon Union Inc." — [Canada.ca – How to report a banded bird](https://www.canada.ca/en/environment-climate-change/services/bird-banding/how-to-report.html) (via search summary)
- Penn State Extension expands IF as the International Federation of American Homing Pigeon Fanciers. — [Penn State Extension – Homing pigeon, lost pigeon](https://extension.psu.edu/homing-pigeon-lost-pigeon) (via search summary)

**Generic structure (official / semi-official descriptions)**
- USGS describes the parts as organisation code + "a recent year (2001or 01, etc.)" + "a club code of 2 to 4 letters" + "a 4 to 5 digit number". It gives no full example. — [USGS](https://www.usgs.gov/centers/pwrc/science/identifying-unusual-bands)
- pigeon.org (AU) describes four parts: organisation (AU), hatch year, club letters ("one, two or three letters", per the search summary) and a one-up number unique within those club letters. It warns that "sometimes the hatching date and bird ID number are reversed". To find the owner, you search only the letters that follow the year. — [pigeon.org lost bird info](https://pigeon.org/pages/lostbirdinfo.html) (search summary; page returned 404 on direct fetch)
- **Conflict:** pigeon.org says 1–3 club letters and USGS says 2–4. The real examples below include club codes of 1 to 15+ characters, with spaces, hyphens, "&" and accents. Neither limit holds in practice.

**Verified real AU examples (verbatim from US pedigrees and race entry lists)**
- Vicstrom Loft (Utah) pedigree, created Nov 2025: "Band # 25138 RMR AU 2025", also written as "RMR 25138"; sire "AU 23 Vita King 10311"; "AU22-26829" (no club letters); dam "AU 18 RMR 18861"; "AU 13 ACE 0666" (leading zero); "AU 10 RPUSA 9166"; "AU 05 OHF 3686"; "AU 04 RPUSA 222"; "AU 14 GHC 1801"; "19970-AU19-RMR" (serial-ORGyy-club). Foreign ancestors in the same sheet: "NL 17-3714190", "BELG-07-5708503". — [Vicstrom Loft pedigree PDF](https://d2bjxxbwld7023.cloudfront.net/public/uploads/product/7648a7e6120f2d542fc494afc25fab7f.pdf)
- Hertzog Family Loft pedigree: "BAND/RING: AU 100 HERTZOG 2024" (org serial club yyyy); "AU 108 HERTZOG 2022"; "AU 273 HERTZOG 2022"; "AU 95 JOJOS 2019"; "AU LOU 2172 20" (org club serial yy); "AU 2181 18" (no club); "AU WEYER 374 17"; "AU TFC 221 19"; "AU TFC 1013 15"; "AU CBS 268 21"; "AU CBS 1141 19"; "AU WBC 106 16". Foreign ancestors: "BELG 6092000 14" (serial then yy), "NL 1237601 11". — [Hertzog Family Loft pedigree PDF](https://d2bjxxbwld7023.cloudfront.net/public/uploads/product/a124d2e63cc4fb16114fe9dfc5459e5e.pdf)
- Victoria Falls World Challenge loft list, 2018-02-22 (2017 birds from US entrants, written org+yyyy club serial): "AU2017 ARPU 14314", "AU2017 CAN-AM 17279", "AU2017 F&D LOFTS 17219", "AU2017 QUEST SYNDICATE 16578", "AU2017 MOB MOBILE AL 17117", "AU2017 GT 10", "AU2017 CHAMP 11", "AU2017 AA 13312", "AU2017 TWO BE WON 17008", "AU2017 G&L OCHOA 643". — [Victoria Falls WCPR loft list (news id=91)](https://www.victoriafallswcpr.com/news.php?id=91)
- Breeder sheets: "2023 AU AUB 491", "AU-2023-ARPU-27428" and "AU 23 MRR 866". These come from the search-engine summary of cloudfront pedigree PDFs and were not checked verbatim. — [search result PDFs, e.g.](https://d2bjxxbwld7023.cloudfront.net/public/uploads/product/7d1e9badc1df922b3604833e3d8cf9e7.pdf)

**IF (International Federation of American Homing Pigeon Fanciers)**
- The official example is "IF-1234-SCHOLAR-06": IF, then serial 1234, then club code SCHOLAR, then year (2 digits). The page itself is inconsistent: it labels the year "(09)" while the example ends in 06. It sets no length for club code or serial. — [IFPigeon – How to read pigeon bands](https://ifpigeon.com/how-to-read-pigeon-bands)
- In the IF store, regular band orders "start with a number 1 (not zero)" (e.g. 1–100, 201–300). — [IFPigeon store](https://ifpigeon.com/if-store) (via search summary)
- Verified pedigree examples (Hertzog pedigree): "IF PROTEGE99 11", "IF PROTEGE15 10", "IF PROTEGE287 10", "IF PROTEGE3 14", "IF PROTEGE23 13". Here the club code and serial are **run together with no separator**. "IF KR 198 12" is also in the sheet. — [Hertzog pedigree PDF](https://d2bjxxbwld7023.cloudfront.net/public/uploads/product/a124d2e63cc4fb16114fe9dfc5459e5e.pdf)
- Race entry list (2018): "IF2017 LHC 992", "IF2017 CLAUSING 41", "IF2017 IRISH SYND 7705", "IF2017 RPC 1623", "IF2017 KOLV 1181", "IF2017 TRI-BORO 633", "IF2017 WVC 113", "IF2017 PVI 139" and "IF2017 PROTÉGÉ 79" (with accented characters). — [Victoria Falls WCPR news id=91](https://www.victoriafallswcpr.com/news.php?id=91)
- From a search summary, not checked verbatim: "IF 176 PROTEGE 2022" on a breeder pedigree sheet. — [cloudfront pedigree PDFs (search)](https://d2bjxxbwld7023.cloudfront.net/public/uploads/product/26be704320048273ad451385f9e94cb1.pdf)

**NPA (National Pigeon Association; mainly fancy pigeons)**
- The official example is "NPA 7 07 AT 1089": NPA = origin, 7 = **band size**, 07 = birth year, AT = "band alphabetical sequence", 1089 = serial. This is the only North American format found that has a band-size digit. — [NPA – Found pigeon](https://npausa.com/customer_service/found_pigeon.html)

**CU / CRPU (Canadian Racing Pigeon Union)**
- The CRPU lost-bird form example reads "year 2016, club letters QUINTE, ring number 000000". That is a six-letter club code and a six-digit ring number. The main form asks for Year, Club letter(s), Ring number, while other forms on the same site use the order Year, Ring #, Letters. The page does not show how the parts are laid out physically on the band. — [CRPU lost bird (crpu.speedfancier.com)](https://crpu.speedfancier.com/lost-bird) (crpu.ca/lost-bird-reporting/ redirects there)
- Real entries (2018 race list, Canadian lofts): "CU 17 9307" (Eldorado Lofts Canada); "CU 17 7759", "CU 17 7710", "CU 17 7754" (Vaccaro Heavenly Loft). **No club letters are shown.** A Canadian syndicate also entered birds on AU bands: "AU2017 AA 13312". — [Victoria Falls WCPR news id=91](https://www.victoriafallswcpr.com/news.php?id=91)
- "CU21 MTN 3401" (Dogwood Mountain Syndicate) appears in a 2022 auction list. — [Victoria Falls WCPR news id=500](https://victoriafallswcpr.com/news.php?id=500)

**IPB, NBRC, ADA, FOYS:** apart from their names (see the sources above), I found no format description or example.

**Unidentified US prefixes seen in real lists**
- "US2017 APC LOFT 17213" (APC Loft) and "KWC17 144886" (Dan McLaughlin) appear in the 2018 list. Which organisation issued them is unverified. — [Victoria Falls WCPR news id=91](https://www.victoriafallswcpr.com/news.php?id=91)

### Inferences
- Orderings actually seen for AU/IF, where Y = year, C = club, N = serial:
  - `ORG Y C N` (AU 18 RMR 18861; AU2017 ARPU 14314)
  - `ORG N C Y` (AU 100 HERTZOG 2024; the official IF order IF-1234-SCHOLAR-06)
  - `ORG C N Y` (AU LOU 2172 20; IF PROTEGE99 11)
  - `N C ORG Y` (25138 RMR AU 2025)
  - `N-ORGY-C` (19970-AU19-RMR)
  - `ORG Y-N` with no club (AU22-26829)
  - `C N` with no org or year (RMR 25138)
- Normalisation rule for software: tokenise on space, "-" and "/". Then:
  - The org token is AU|ARPU|IF|CU|CRPU|NPA|IPB|NBRC|ADA, possibly glued to a year ("AU2017", "AU19").
  - The year is a 4-digit 19xx/20xx or a 2-digit number next to the org.
  - The club code is the alphabetic tokens: possibly several words, "&", "-" or accents, and possibly glued to the serial ("PROTEGE99").
  - The serial is the remaining 1–6 digit number; keep leading zeros as written ("0666").
  - Canonical form suggestion: `AU-2025-RMR-25138`, i.e. org, 4-digit year, club uppercased with internal spaces kept or collapsed, then serial.
- Telling a 2-digit year from a short serial is ambiguous when both are 2 digits ("AU CBS 268 21" is fine, but "AU GT 10" with no year is not). Treat a 2-digit number glued to or adjacent to the org as the year, and a trailing 2-digit number as the year only when another number exists.
- The same bird can be written two ways in one document ("25138 RMR AU 2025" / "RMR 25138"). Matching should key on (org, year, club, serial).
- US pedigrees write European rings in non-FCI ways: "BELG 6092000 14" (serial before year), "BELG-07-5708503", "NL 1237601 11". The recogniser must accept the yy at the end, and "BELG" as a Belgian alias.

### Gaps
- No primary AU (pigeon.org) or IF band-ordering page with the official character layout was retrieved. pigeon.org's lost-bird page returned 404.
- I found no official club-code list or length rules for AU, IF or CU, and nothing on IPB's format.
- Whether AU bands physically show "AU" or "ARPU" as the org mark: USGS treats both as the AU org code, but "ARPU" also appears as a **club** code ("AU2017 ARPU 14314"), so this needs confirmation.
- Physical layout on the band (one line or two, ring around) was not verified for any North American organisation.

## 2. Structure details: year, club letters, serial digits, suffixes; one-loft race bands

### Takeaway
- **Year:** both 2-digit and 4-digit years are in use (USGS confirms both).
- **Club/loft code:** effectively free text; real examples run from 1 character to multi-word names.
- **Serial:** 1–6 digits; NPA adds a band-size digit.
- I found no "S" or other suffix convention for North American bands.
- One-loft races (OLR) issue their own race-specific bands, and these appear in US entrants' lists with the race's own prefix.

### Cited Findings
- Year format "2001or 01"; club code "2 to 4 letters"; "4 to 5 digit number". — [USGS](https://www.usgs.gov/centers/pwrc/science/identifying-unusual-bands)
- Club letters can be one, two or three letters. The number is a one-up number unique per club letters. — [pigeon.org](https://pigeon.org/pages/lostbirdinfo.html) (search summary; page 404 on fetch)
- Serials as short as 2 digits ("AU2017 GT 10", "AU2017 CHAMP 11", "IF2017 PROTÉGÉ 79") and as long as 5 ("AU2017 F&D LOFTS 17219"). Club codes include "CAN-AM", "F&D LOFTS", "MOB MOBILE AL", "QUEST SYNDICATE", "G&L OCHOA" and "TWO BE WON". — [Victoria Falls WCPR news id=91](https://www.victoriafallswcpr.com/news.php?id=91)
- A six-digit CRPU ring number example ("000000"). — [CRPU lost bird](https://crpu.speedfancier.com/lost-bird)
- NPA band size digit ("NPA 7 07 AT 1089"). — [NPA](https://npausa.com/customer_service/found_pigeon.html)
- **One-loft race bands seen with US entrants:** "VFWCPR ZA17 3645", "VFWCPR ZA17 3030", "VFWCPR ZA17 3283" (Victoria Falls race bands, a South African race, out of scope, shown only for format). — [Victoria Falls WCPR news id=91](https://www.victoriafallswcpr.com/news.php?id=91)
- A US pedigree refers to a one-loft race bird as "GHC 13776/23", in the context "Florida GHC" (2023–2024 races): race acronym, serial, "/", yy. — [Hertzog pedigree PDF](https://d2bjxxbwld7023.cloudfront.net/public/uploads/product/a124d2e63cc4fb16114fe9dfc5459e5e.pdf)
- The Vicstrom pedigree mentions results in the "High Desert Classic" and "Breeders Fall Classic 2022" but gives the birds' AU bands, not race bands. — [Vicstrom pedigree PDF](https://d2bjxxbwld7023.cloudfront.net/public/uploads/product/7648a7e6120f2d542fc494afc25fab7f.pdf)

### Inferences
- US one-loft races seem to use either an AU/IF band with the race name as the "club" code ("AU2017 CHAMP 11", "AU2017 HIGH POINT 3168", where CHAMP and HIGH POINT look like race or syndicate names) or the race's own acronym band ("GHC 13776/23"). Software should accept an unknown alphabetic prefix followed by a serial and a year, and keep it as an "other/OLR" org instead of rejecting it.
- No "S" suffix was seen in any American example.

### Gaps
- I found no official rules from a US one-loft race (e.g. the band ordering or band format pages of major US OLRs). Whether "GHC" bands are AU-issued or private is unverified.
- Whether AU/IF serials are zero-padded on the band itself (the CRPU example "000000" suggests 6-digit padding for CU) is unverified.

## 3. Latin American country codes and structures (Mexico, Puerto Rico, Brazil, Argentina, Uruguay, Chile, Colombia, Peru, Cuba)

### Takeaway
I found one verified real Mexican ring, "MEX21 FMC 097917": country code MEX, yy, federation code FMC, then a 6-digit serial. For Brazil, Argentina and Uruguay I found only descriptive statements: a ring with number, year and country; registration in a national federation or registry. I found no source for the exact ring layout or country code. For Chile, Colombia, Peru, Cuba and Puerto Rico, I found nothing usable.

### Cited Findings
- **Mexico:** "Aztec Loft: MEX21 FMC 097917", in a 2022 Victoria Falls auction list. — [Victoria Falls WCPR news id=500](https://victoriafallswcpr.com/news.php?id=500)
- **Mexico:** a 2026 article names the Federación Mexicana de Colombocultores (FMC) as a pigeon federation. Also, "FCM" in Mexico is the Federación Canófila Mexicana (dogs/cats), **not** pigeons. — [Purebred Pigeon, Jan/Feb 2026](https://purebredpigeon.com/online/JF26mag/6) (via search summary)
- **Mexico:** in CDMX clubs, chicks get their identification ring about one week after hatching; no format given. — [Chilango](https://www.chilango.com/noticias/colombofilia-palomas-mensajeras-cdmx/) (via search summary)
- **Brazil:** the ring works as an "RG" (ID card) carrying an identification number, birth year and country of origin. Brazil has 73 official clubs coordinated by the FCB (Federação Columbófila Brasileira), which is affiliated to the FCI. — [NSC Total](https://www.nsctotal.com.br/?p=7825388) (via search summary)
- **Brazil:** registration with the FCB is the first step; the ring carries the registration number. — [Acessa.com](https://www.acessa.com/infantil/arquivo/animais/2007/02/23-pombo/amp/index.html) (via search summary; 2007 children's article, low authority)
- **Argentina:** Federación Colombófila Argentina, founded 1926. — [Bichos de Campo](https://bichosdecampo.com/antes-del-telefono-estuvieron-las-palomas-mensajeras-que-incluso-ayudaron-en-una-eleccion-nacional-que-es-la-colombofilia-y-quienes-la-practican) (via search summary)
- **Argentina:** a national law/bill requires the FCA to verify each pigeon's birth year and the registration number in the Registro Nacional de Desarrollo y Potencial Colombófilo. — [HCDN document](https://www4.hcdn.gob.ar/dependencias/dcomisiones/periodo-132/132-340.pdf) (via search summary)
- **Argentina:** SENASA Resolución 577/2012 covers competition movement documents (DT-e, RENSCo). A USDA export certificate to Argentina identifies birds by "closed ring / Microchips No." — [Resolución 577/2012](https://www.argentina.gob.ar/normativa/nacional/norma-204945/texto); [USDA APHIS certificate](https://www.aphis.usda.gov/sites/default/files/argentina-carrier-pigeons-hc.pdf) (via search summary)
- **Uruguay:** each pigeon is registered at the Palomar Militar. "Antes llevaban un anillo de goma en la pata enumerado" ("they used to wear a numbered rubber ring on the leg"); now tracking is electronic by chip. — [La Mañana (Uruguay)](https://www.xn--lamaana-7za.uy/actualidad/palomas-mensajeras-vuelos-que-generan-pasiones) (via search summary)
- The Victoria Falls race lists agents for Argentina, Brazil and Mexico, but its 2018 and 2022 lists contain no BRA/ARG/URU rings. — [Victoria Falls WCPR agents](https://www.victoriafallswcpr.com/agents.php) (via search summary); [news id=91](https://www.victoriafallswcpr.com/news.php?id=91)

### Inferences
- "MEX21 FMC 097917" suggests Mexico uses an FCI-style country prefix (MEX) plus a 2-digit year, plus a federation/club code (FMC, probably the Federación Mexicana de Colombofilia/Colombocultores), plus a 6-digit zero-padded serial. This is one example only, so it is not a confirmed standard.
- The Uruguayan "rubber numbered ring" is most likely the old race countermark (timing rubber), not the permanent identity ring. The chip is the electronic timing ring. The article should not be read as saying Uruguay has no identity rings. This is an inference and unverified.
- Brazil and Argentina are FCI members (Brazil confirmed via NSC Total; Argentina not confirmed here), so their rings likely follow FCI practice (country code, year, serial). The exact code (BRA vs BR, ARG vs AR) is **unverified**.

### Gaps
- No primary federation source (FCB Brazil, FCA Argentina, FMC Mexico, Uruguay, Chile, Colombia, Peru, Cuba, Puerto Rico) describing ring layout was found. Searches in Spanish and Portuguese returned only general articles.
- No real ring examples were found for Brazil, Argentina, Uruguay, Chile, Colombia, Peru, Cuba or Puerto Rico (auction searches on pipa.be, pitts.be and herbots.be returned only European rings).
- Puerto Rico: whether fanciers there use AU/IF bands (a US territory) or their own federation code is unverified.
- Cuba's ring code (e.g. "CUB") is unverified.

## 4. Ambiguities (AU vs Australia, CU vs Cuba/Canada, IF, US, BELG)

### Takeaway
The North American org codes collide with country-code conventions:
- "AU" is ARPU in the US but the ISO 2-letter code for Australia.
- "CU" is the Canadian Racing Pigeon Union in North America but the ISO 2-letter code for Cuba.
- "US", "ARPU" and race acronyms also appear in prefix position.

Context (loft country, year/club structure) has to break the tie.

### Cited Findings
- AU = American Racing Pigeon Union (US organisation code). — [NPA](https://npausa.com/customer_service/found_pigeon.html); [IFPigeon](https://ifpigeon.com/how-to-read-pigeon-bands)
- CU = Canadian Racing Pigeon Union Inc. (CRPU), also written "CRPU" on some bands. — [Canada.ca](https://www.canada.ca/en/environment-climate-change/services/bird-banding/how-to-report.html) (via search summary); [IFPigeon](https://ifpigeon.com/how-to-read-pigeon-bands)
- Real collision: an auction-list reader (an LLM summariser in this research) read "CU21 MTN 3401" (Dogwood Mountain Syndicate) as "possibly Cuba". The loft name and the "club letters" structure point to the Canadian CU. — [Victoria Falls WCPR news id=500](https://victoriafallswcpr.com/news.php?id=500)
- "ARPU" appears both as the org (USGS: "AU or ARPU") and as a club code ("AU2017 ARPU 14314", and per search summary "AU-2023-ARPU-27428"). — [USGS](https://www.usgs.gov/centers/pwrc/science/identifying-unusual-bands); [Victoria Falls WCPR news id=91](https://www.victoriafallswcpr.com/news.php?id=91)
- "US2017 APC LOFT 17213" uses "US" as a prefix (issuer unverified). — [Victoria Falls WCPR news id=91](https://www.victoriafallswcpr.com/news.php?id=91)
- US pedigrees write Belgian rings as "BELG" instead of "BE". — [Vicstrom pedigree](https://d2bjxxbwld7023.cloudfront.net/public/uploads/product/7648a7e6120f2d542fc494afc25fab7f.pdf); [Hertzog pedigree](https://d2bjxxbwld7023.cloudfront.net/public/uploads/product/a124d2e63cc4fb16114fe9dfc5459e5e.pdf)
- "IF" is also an ordinary English word and appears glued to the year ("IF2017"). — [Victoria Falls WCPR news id=91](https://www.victoriafallswcpr.com/news.php?id=91)

### Inferences
- Disambiguation heuristic:
  - If the ring has an **alphabetic club/loft code** between or around year and serial, it is North American: AU = ARPU, CU = CRPU.
  - If it is just `XX yy-nnnnnnn` (FCI style, 7-digit serial with a hyphen), treat it as a country code.
  - An Australian ring would generally not carry a free-text club code in the same way. This is unverified; Australian formats are out of scope here.
  - The user's or loft's country setting should be the strongest signal.
- Treat "ARPU" in the first position as the AU org, and "ARPU" after the year as a club code.
- "IF" should only be recognised as an org when followed by a year, digits or a club token, not as free text.

### Gaps
- No source compares AU (ARPU) bands with Australian (AU/AUS) ring formats. Australia is out of this note's scope.
- Cuba's actual ring prefix was not found, so the CU-Cuba collision is theoretical only, not confirmed from Cuban sources.
