# Racing-pigeon ring number formats: Africa, Oceania, Middle East, South Asia

Notes for software that has to recognise and normalise ring numbers. Research date: 2026-11-20.
Verification levels used below:
- **[fetched]**: the page itself was read, and the ring text is quoted as it appears there.
- **[snippet]**: seen only in a search-engine summary of the page. The page was not opened, so it may be paraphrased. Treat as unverified.
- **[unverified]**: an inference, or nothing was found.

## 1. Country / organisation codes and their variants

### Takeaway
None of these countries uses one consistent ISO-style code. The prefix depends on the issuing body and on whoever typed the result list. South Africa writes `ZA` on rings and in results, with older rings showing `SA`. Australia prints no country code at all, only a state or association code. The Gulf states use `UAE` or `AE`, `KW` or `KUW`, `KSA`, and `QATAR` or `QTR`. Zimbabwe uses `ZW`, not `ZIM`. Pakistan appears as `PK` [snippet]. Egypt appears as `EG` [snippet].

### Cited Findings
**South Africa (SANPO; the federations are the issuing unions)**
- The official SANPO lost-pigeon page gives these examples: `ZA 2016 FB 1234`, `ZA 2017 765432` and `ZA 2015 NRU 02481`. Its form has three fields: "Ring Year", "Ring Abbreviation [A-Z]" and "Ring Number [0-9]". It also says: "The ring of every pigeon contains information about the year in which the pigeon was rung, the area and the number." [fetched] — [SANPO Lost Pigeons](https://www.sanpo.co.za/Public/pubLost.aspx)
- Victoria Falls one-loft race (Zimbabwe), final race of 25 July 2025, South African entrants: `ZA24 HOBY 223`, `ZA24 OERF 5992`, `ZA24 SLIM 2267`, `ZA24 JJJ 428`, and `ZA24 1289` (no union code) [fetched] — [VFWCPR Final Race report](https://www.victoriafallswcpr.com/news.php?id=712)
- Same race, Loft List 2023 (published 2022-12-23): `ZA21 CRU 1115`, `ZA21 FB 20901`, `ZA21 KUR 5391`, `ZA21 SLIM 8693` [fetched] — [VFWCPR loft list 2023](https://www.victoriafallswcpr.com/news.php?id=537)
- A Gauteng newspaper (2018) explains a ring as "GPU (Gauteng Pigeon Union) ZA17 (year of issue) 13309 (ring number)". It says federation rings carry the federation abbreviation, a 2-digit year and a number, while rings supplied directly by SANPO carry only the year and a number [snippet; the page returned 403] — [Citizen / Germiston City News 2018](https://www.citizen.co.za/germiston-city-news/sports-news/2018/05/11/you-can-help-lost-racing-pigeons-get-home/)
- Older or alternative forms: `SA 2004 THU 17193`, plus auction or sales listings showing `ZA NDK 1277-25` (year written after the number) and `ZA SANPO 13142 '22` [snippet] — search summary of [Farmers Weekly](https://www.farmersweekly.co.za/animals/pigeons/golden-tt-shows-the-value-of-a-world-class-female-racing-pigeon/) and related pages. The exact page for each example was not confirmed.
- A South African stud catalogue (2024) lists rings as `CAS 306/05` and `CAS 370/05`: a union code, the number, and the year after a slash [snippet] — [Diamond Pigeon Stud catalogue Jan 2024](https://diamondpigeonstud.co.za/wp-content/uploads/2024/01/Lets-Trade-Catalogue-Januarie-2024.pdf)
- "SAHPU" was not found in any source. The national body is SANPO, which issues each fancier a SANPO ID [snippet] — [SANPO](https://www.sanpo.co.za/Public/pubLost.aspx)

**Zimbabwe**
- From the Victoria Falls Loft List 2023: `ZW21 BSFC 1789`, `ZW21 MRPF 4220`, `ZW21 BSFC 939` (Zimbabwean entrants) [fetched] — [VFWCPR loft list 2023](https://www.victoriafallswcpr.com/news.php?id=537). The format is `ZW` + 2-digit year, then a union or club code (BSFC, MRPF), then a serial. No `ZIM` prefix was seen.
- A search summary also showed `ZW21 MRPF 4256`, and a Zimbabwe-listed `ZA 20-268075` [snippet] — [victoriafallswcpr.com search results](https://www.victoriafallswcpr.com/news.php?id=544)

**Gulf states (Victoria Falls and Dubai results)**
- Kuwait: `KW 25-165209`, `KW 24-66539`, `KW CLUB 25-2518`, `KW CLUB 25-21032` (Victoria Falls 2025) [fetched] — [VFWCPR Final Race](https://www.victoriafallswcpr.com/news.php?id=712). Also `KW FED 21-1099620`, a ring owned by a South African entrant [fetched] — [VFWCPR loft list 2023](https://www.victoriafallswcpr.com/news.php?id=537). The Dubai basket list instead writes `KUW-2023-1-1230264`, `KUW-2023-1-87664` and `KUW-2023-1-26767` [fetched] — [Dubai Pigeon Race basket list](https://dubaipigeonrace.com/basketlist/)
- Qatar: `QATAR HPHC 24-515` and `QATAR HPHC 24-38951` (Victoria Falls 2025) [fetched] — [VFWCPR Final Race](https://www.victoriafallswcpr.com/news.php?id=712). Dubai writes `QTR-2023-1-1021` and `QTR-2023-1-1023` [fetched] — [Dubai basket list](https://dubaipigeonrace.com/basketlist/)
- UAE: `UAE-2023-1-1600613`, `UAE-2023-1-1600602`, `AE-2023-1-1101384`, `AE-2023-1-1105064` [fetched]. Also `AE-2023-1-1601599`, listed with country "Pakistan", which means the ring country and the owner country differ — [Dubai basket list](https://dubaipigeonrace.com/basketlist/). Other forms: `UAE-25-102283`, `UAE-25-1007140`, `AE-25-1033881` on dubaipigeonrace.com result pages, and PIPA writes `UAE25-1002825`, `UAE18-1000366`, `UAE19-1001027` [snippet] — [Dubai Grand Average 2026](https://dubaipigeonrace.com/grand-average-ace-international-sprint-2026/), [PIPA Dubai OLR YB race](https://www.pipa.be/en/articles/young-bird-race-dubai-olr-featured-multiple-international-winners-40338)
- Saudi Arabia: `KSA 21-142167` (entrant Abdulah Nasser, Saudi Arabia) [fetched] — [VFWCPR loft list 2023](https://www.victoriafallswcpr.com/news.php?id=537). Only one real example was found.

**Egypt**
- `EG24-453` (Pyramids OLR 2025 final winner) and `EG2024-67` [snippet, Eijerkamp news pages] — [Eijerkamp OLR results part 2](https://www.eijerkamp.com/latest-news/72964/topresults-worldwide-with-eijerkamp-pigeons-in-one-loft-races-part-2), [Eijerkamp Egypt Derby Aal Nagib](https://www.eijerkamp.com/one-loft-races/72888/eijerkamp-pigeons-impress-again-in-egypt-%E2%80%98queen-nefertiti%E2%80%99-and-%E2%80%98087%E2%80%99-succesful-derby-aal-nagib). No `EGY` prefix was seen on rings.

**Morocco**
- Reports of found pigeons give the ring as "19108 Maroc 2018" and "Maroc 2019 58978" (finder transcriptions, word order varies) [snippet] — [takadoum.e-monsite.com](http://takadoum.e-monsite.com/pages/pigeon-trouve.html), [pigeonsdumaroc forum](https://pigeonsdumaroc.forumactif.com/t83-pigeon-du-maroc-trouve-au-bresil). The ring text seems to be the word "MAROC", not `MAR` [unverified].

**Pakistan**
- Race results on TOPIGEON (Islamabad Racing Pigeon Club 2024/25, Sargodha RPA 2025) show `PK24-GHL-16` and `PK-G2-049` [snippet; fetching the page returned nothing] — [TOPIGEON Islamabad RPC](https://www.topigeon.com/results.asp?d=11838592&s=Race), [TOPIGEON Sargodha](https://www.topigeon.com/results.asp?d=11838533&s=Race&Page=1). The middle code appears to be a loft code (GHL, G2) [snippet].

**New Zealand**
- MyPigeons (Benzing), the NZ results platform, gives the format as Country Code - Year - Organisation - Ring Number. Christchurch CDC results (12/10/2019) show `NZ-2018-MF-79` and `NZ-2017-PN-604` [snippet] — [MyPigeons NZ Christchurch CDC](https://mypigeons.benzing.live/new-zealand/gr/results/print/by-fancier/r-1-t-4-christchurch-cdc/), [MyPigeons NZ lost](https://mypigeons.benzing.live/new-zealand/en/lost/). The national body is Pigeon Racing New Zealand (PRNZ) — [prnz.org.nz](https://www.prnz.org.nz/)

**Other countries seen in the same Gulf lists (useful for the parser)**
- `ES-2023--73732` (double hyphen = empty middle field), `DV-2023-01777-491`, `BELG-2023--6079117`, `TR-2023-55-1404`, `GB-2023-N-121`, `WHU-2023-1E-3000` [fetched] — [Dubai basket list](https://dubaipigeonrace.com/basketlist/)

### Inferences
- A recogniser needs a table that maps several prefixes to one country: ZA, SA (older) → South Africa; ZW → Zimbabwe; KW, KUW, "KW CLUB", "KW FED" → Kuwait; QATAR, QTR (+ HPHC) → Qatar; UAE, AE → UAE; KSA → Saudi Arabia; PK → Pakistan; EG → Egypt; MAROC → Morocco; NZ → New Zealand.
- Within one race, the ring's country can differ from the owner's country: `AE-…` owned in Pakistan, `KW FED …` owned in South Africa, `ZW21 …` owned in the Netherlands. Store the ring prefix, not the owner's nationality.
- The 2-digit year is placed differently depending on the source: glued to the prefix (`ZA24`, `ZW21`, `EG24`, `UAE25-`), after the club code (`KW 25-`, `QATAR HPHC 24-`), as a 4-digit field (`UAE-2023-1-…`, `NZ-2018-…`), or after the serial (`ZA NDK 1277-25`, `CAS 306/05`).

### Gaps
- **Namibia, Algeria, Iran, Iraq, India**: no real ring examples were found within the search budget. The only Iraq-linked ring seen was `DAN 116-21-0145`, which is a Danish ring owned via an Iraqi agent ([VFWCPR agents/search](https://www.victoriafallswcpr.com/agents.php), snippet). Codes such as IRN, IRQ, IND and ALG on rings remain unverified.
- No official specification from SANPO, the Kuwait or Qatar federations, the UAE federation, Egypt or Morocco (FRMCV) was found.

## 2. Australia: what is on the ring, and "AUS" (Australia) vs Austria

### Takeaway
Australian rings carry an issuing-body code, a 2-digit year and a serial. Results print them as `ORG-YY-NNNN` (e.g. `VRPU-23-10537`, `VHA-23-1549`, `WPF-22-2082`). No real Australian race result printed a country code (`AUS` or `AU`). The Australian Pigeon Council's example ring starts with `AUST`, but that word is not in its own list of prefixes. In pigeon results, `AU` normally means the American Racing Pigeon Union, not Australia. No evidence was found of `AUS` being used for Austria on rings. Austrian rings show `AUT` or "AUSTRIA" [snippet].

### Cited Findings
- The Australian Pigeon Council explains the example ring "AUST 26 12345 0452538115" as: issuing body or country, then the hatch year (2026), then a unique number, then a contact phone number. Its table of "Common Australian Ring Prefixes" lists ACP (Australian Pigeon Centre), QRPF (Queensland Racing Pigeon Federation), VHA (Victorian Homing Association), VRPU (Victorian Racing Pigeon Union), SAHPA (South Australian Homing Pigeon Association) and WPF (Western Pigeon Federation). "AUST" itself is not in that table [fetched] — [Australian Pigeon Council, Pigeon Tips](https://www.australianpigeoncouncil.com.au/pigeon-tips)
- The Australian Racing Pigeon Journal describes the format as "a series of letters, a year, and a number for example VHA 2010 1234", where VHA is the Victorian Homing Association [fetched] — [Australian Racing Pigeon Journal](https://www.pigeonjournal.com/found.htm)
- ANPA (Australian National Pigeon Association, the fancy/show breeds body) describes rings carrying "ANPA", a 2-digit year, a letter A–D for ring size, and a number [snippet] — [ANPA lost pigeons](https://www.anpa.com.au/lost-pigeons)
- The VRPU Annual Report 2024 contains all 2024 race results (e.g. Race 1 Shepparton 1, 150 km, 30/06/24). Ring numbers seen there: `VRPU-22-4496`, `VRPU-21-3347`, `VRPU-23-10537`, `VRPU-22-362100`, `VHA-23-1549`, `VHA-22-19889`, `VPU-23-6434`, `VPO-21-46`, `PRV-22-821`, `GIPP-23-3917`, `GMPF-22-19931`, `WPF-22-2082`, `EUR-22-76`, `SA-22-6338`. Prefix counts in the extracted text: VRPU 306, VPU 27, VPO 24, WPF 24, VHA 14, PRV 10, EUR 5, RPA 5, GMPF 3, CC 3, GIPP 2, SA 1, KYAB 1, ACT 1, AUCC 1, VRU 1. A few appear space-separated (`VPU 23 9262`, `VHA 23 1549`) [fetched; text extracted from the PDF] — [VRPU Annual Report 2024](https://vrpu.com.au/wp-content/uploads/2025/03/VRPU-Annual-Report-2024.pdf)
- A pigeonrace.net results page for the Victorian Homing Association shows `QPF-12-8205` [snippet] — [pigeonrace.net VHA](https://www.pigeonrace.net/fed/vha/results/612/10537/77269)
- **AU = USA, not Australia.** The Victoria Falls Loft List 2023 has rings `AU21 HRPC 3876` and `AU21 OCC 4932` whose entrant country is listed as the United States [fetched] — [VFWCPR loft list 2023](https://www.victoriafallswcpr.com/news.php?id=537). Banding guides list AU as the American Racing Pigeon Union [snippet] — [Pigeonpedia: Pigeon banding](https://pigeonpedia.com/pigeon-banding/)
- Austria: one race entry list writes `AUT-2025-413-743`, and Victoria Falls lists an Austrian entrant as `AUSTRIA 503-18-863` [snippet] — search results ([victoriafallswcpr.com](https://www.victoriafallswcpr.com/news.php?id=160), [AviRings derby participant](https://derby.avirings.com/en/Participants/Participant/F257)). Ring-collector lists show both "AUSTRIA-87…07" and "AUST-91…05" (Australia), plus an "AUS-82" entry of unclear origin [snippet; hobby forum] — [Pigeonbasics ring list](http://forum.pigeonbasics.com/topic/9201-ring-list-come-look/)

### Inferences
- A pedigree reading "AUS 23 …" is ambiguous. Australian rings do not carry AUS, so an "AUS" prefix most likely comes from a pedigree writer. Austrian sources use AUT or AUSTRIA. This is unconfirmed. Resolve it from context (seller country, whether the next token is an Australian union code such as VRPU, VHA or WPF, or Austria's typical 3-digit club number `503-18-863`), not from the prefix alone.
- Prefixes that clash across countries: `SA` appears in Australian results (`SA-22-6338`, probably a South Australian issuing body, unverified) but also on older South African rings (`SA 2004 …`), and `SA` is South Africa's informal code. `AU` = USA (AU, the American Racing Pigeon Union), not Australia or Austria. `ACT` in Australian results is probably the Australian Capital Territory (unverified).
- The year in Australian results is two digits after the union code. The serial runs from 2 to 6 digits.

### Gaps
- No official ring specification was found from Australian state federations (VRPU, QRPF, NSW bodies, the SA association, WA's WPF). NSW-specific prefixes were not identified.
- No real Western pedigree or auction page was found that writes "AUS" for an Australian bird, or "AUS" for an Austrian bird. Both uses remain unverified.

## 3. Structure, examples per country, ambiguities

### Takeaway
A general token pattern covers almost all of them: `PREFIX[YY] [CLUB] SERIAL` or `PREFIX-YYYY-[CLUB]-SERIAL`, with separators from the set {space, `-`, `--`, `/`, none} and the year as 2 or 4 digits, either before or after the serial.

### Cited Findings
- South Africa: `ZA YYYY UNION NNNN` (official example), `ZAYY UNION NNNN` (results), `ZAYY NNNN` (SANPO-direct rings with no union code) — [SANPO](https://www.sanpo.co.za/Public/pubLost.aspx), [VFWCPR](https://www.victoriafallswcpr.com/news.php?id=712)
- Australia: `UNION-YY-N…` — [VRPU 2024](https://vrpu.com.au/wp-content/uploads/2025/03/VRPU-Annual-Report-2024.pdf)
- Dubai / UAE: `CC-YYYY-1-NNNNNNN`. A middle field "1" appears for the Gulf countries (UAE, AE, KUW, QTR); its meaning is unknown [fetched] — [Dubai basket list](https://dubaipigeonrace.com/basketlist/)
- New Zealand: `NZ-YYYY-CLUB-N` [snippet] — [MyPigeons NZ](https://mypigeons.benzing.live/new-zealand/gr/results/print/by-fancier/r-1-t-4-christchurch-cdc/)

### Inferences
- Number of real examples per country: South Africa ≥ 3 [fetched]; Zimbabwe 3 [fetched]; Australia ≥ 3 [fetched]; Kuwait ≥ 3 [fetched]; Qatar ≥ 3 [fetched]; UAE ≥ 3 [fetched]; New Zealand 2 [snippet]; Saudi Arabia 1 [fetched]; Egypt 2 [snippet]; Morocco 2 [snippet]; Pakistan 2 [snippet]; Namibia, Algeria, Iran, Iraq, India 0.
- Collisions to handle: `SA` (South Africa or South Australia), `AU` (USA AU vs Australia/Austria), `AUS`/`AUST` (Australia) vs `AUT`/`AUSTRIA`, `KW` (Kuwait) vs other uses, and `ZA` appearing on a Zimbabwe-listed bird.

### Gaps
- The "current as of 2026" status could not be confirmed for most countries. The newest dated evidence is Victoria Falls in July 2025, the Dubai 2025–26 season [snippet], and the VRPU 2024 season.
- The South African Million Dollar Pigeon Race was searched, but no 2024 or 2025 results with ring lists were found. Its winners in the sources are mostly foreign-ringed birds (e.g. `DV-01233-18-2080`) [snippet] — [racingpigeoninternational.com](https://racingpigeoninternational.com/the-23rd-south-african-million-dollar-pigeon-race-the-final-race/)
