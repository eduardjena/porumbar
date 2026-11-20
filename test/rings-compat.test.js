import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRing, formatRing, ringKey } from '../src/rings.js';

/*
 * Compatibilitatea cu inelele deja salvate: cheile (ring_key, ring_country, ring_year, ring_club, ring_number) stau în
 * baza de date, iar afișarea se face din ele. Pentru fiecare inel recunoscut înainte de „inelele din toată lumea”
 * (2026-11-20), parseRing → ringKey și formatRing trebuie să dea exact ce dădeau atunci. Valorile de mai jos au fost
 * scoase din parserul vechi; nu se schimbă.
 */
const now = new Date('2026-11-16');

const PINNED = [
  {"raw":"RO-26-800546 L","ok":true,"unringed":false,"country":"RO","year":2026,"club":null,"number":"800546","sex":"M","key":"RO|2026||800546","display":"RO-26-800546"},
  {"raw":"RO-17-159927 T","ok":true,"unringed":false,"country":"RO","year":2017,"club":null,"number":"159927","sex":"F","key":"RO|2017||159927","display":"RO-17-159927"},
  {"raw":"412084/15 RO","ok":true,"unringed":false,"country":"RO","year":2015,"club":null,"number":"412084","sex":null,"key":"RO|2015||412084","display":"RO-15-412084"},
  {"raw":"898910/09 RO M","ok":true,"unringed":false,"country":"RO","year":2009,"club":null,"number":"898910","sex":"M","key":"RO|2009||898910","display":"RO-09-898910"},
  {"raw":"738256/09F","ok":true,"unringed":false,"country":"RO","year":2009,"club":null,"number":"738256","sex":"F","key":"RO|2009||738256","display":"RO-09-738256"},
  {"raw":"RO 25 1326835","ok":true,"unringed":false,"country":"RO","year":2025,"club":null,"number":"1326835","sex":null,"key":"RO|2025||1326835","display":"RO-25-1326835"},
  {"raw":"RO-25-0276971","ok":true,"unringed":false,"country":"RO","year":2025,"club":null,"number":"276971","sex":null,"key":"RO|2025||276971","display":"RO-25-276971"},
  {"raw":"NL-11-1724956 L","ok":true,"unringed":false,"country":"NL","year":2011,"club":null,"number":"1724956","sex":"M","key":"NL|2011||1724956","display":"NL-11-1724956"},
  {"raw":"5218055/02 NL M","ok":true,"unringed":false,"country":"NL","year":2002,"club":null,"number":"5218055","sex":"M","key":"NL|2002||5218055","display":"NL-02-5218055"},
  {"raw":"6008107/08 BELG M","ok":true,"unringed":false,"country":"BE","year":2008,"club":null,"number":"6008107","sex":"M","key":"BE|2008||6008107","display":"BE-08-6008107"},
  {"raw":"BE-25-2091885","ok":true,"unringed":false,"country":"BE","year":2025,"club":null,"number":"2091885","sex":null,"key":"BE|2025||2091885","display":"BE-25-2091885"},
  {"raw":"DV-08778-24-271","ok":true,"unringed":false,"country":"DV","year":2024,"club":"8778","number":"271","sex":null,"key":"DV|2024|8778|271","display":"DV-08778-24-271"},
  {"raw":"DV-8778-24-262","ok":true,"unringed":false,"country":"DV","year":2024,"club":"8778","number":"262","sex":null,"key":"DV|2024|8778|262","display":"DV-08778-24-262"},
  {"raw":"1441788/05 NL M","ok":true,"unringed":false,"country":"NL","year":2005,"club":null,"number":"1441788","sex":"M","key":"NL|2005||1441788","display":"NL-05-1441788"},
  {"raw":"NL-03-1395255 L","ok":true,"unringed":false,"country":"NL","year":2003,"club":null,"number":"1395255","sex":"M","key":"NL|2003||1395255","display":"NL-03-1395255"},
  {"raw":"123456/99 RO","ok":true,"unringed":false,"country":"RO","year":1999,"club":null,"number":"123456","sex":null,"key":"RO|1999||123456","display":"RO-99-123456"},
  {"raw":"DV 17-01063-813 F","ok":true,"unringed":false,"country":"DV","year":2017,"club":"1063","number":"813","sex":"F","key":"DV|2017|1063|813","display":"DV-01063-17-813"},
  {"raw":"DV-10-01063-714 M","ok":true,"unringed":false,"country":"DV","year":2010,"club":"1063","number":"714","sex":"M","key":"DV|2010|1063|714","display":"DV-01063-10-714"},
  {"raw":"AUS 18-301-1405 M","ok":true,"unringed":false,"country":"AT","year":2018,"club":"301","number":"1405","sex":"M","key":"AT|2018|301|1405","display":"AT-18-301-1405"},
  {"raw":"AUS-11-335-216 F","ok":true,"unringed":false,"country":"AT","year":2011,"club":"335","number":"216","sex":"F","key":"AT|2011|335|216","display":"AT-11-335-216"},
  {"raw":"159989/19 ESP","ok":true,"unringed":false,"country":"ES","year":2019,"club":null,"number":"159989","sex":null,"key":"ES|2019||159989","display":"ES-19-159989"},
  {"raw":"159989 019-ESP","ok":true,"unringed":false,"country":"ES","year":2019,"club":null,"number":"159989","sex":null,"key":"ES|2019||159989","display":"ES-19-159989"},
  {"raw":"159989/019 ESP","ok":true,"unringed":false,"country":"ES","year":2019,"club":null,"number":"159989","sex":null,"key":"ES|2019||159989","display":"ES-19-159989"},
  {"raw":"159989-019-ESP","ok":true,"unringed":false,"country":"ES","year":2019,"club":null,"number":"159989","sex":null,"key":"ES|2019||159989","display":"ES-19-159989"},
  {"raw":"0561385-2017-RO","ok":true,"unringed":false,"country":"RO","year":2017,"club":null,"number":"561385","sex":null,"key":"RO|2017||561385","display":"RO-17-561385"},
  {"raw":"1783831-2009-NL","ok":true,"unringed":false,"country":"NL","year":2009,"club":null,"number":"1783831","sex":null,"key":"NL|2009||1783831","display":"NL-09-1783831"},
  {"raw":"Ro 439175 - 2020","ok":true,"unringed":false,"country":"RO","year":2020,"club":null,"number":"439175","sex":null,"key":"RO|2020||439175","display":"RO-20-439175"},
  {"raw":"B 6024428 - 2019","ok":true,"unringed":false,"country":"BE","year":2019,"club":null,"number":"6024428","sex":null,"key":"BE|2019||6024428","display":"BE-19-6024428"},
  {"raw":"B 6203712-2012","ok":true,"unringed":false,"country":"BE","year":2012,"club":null,"number":"6203712","sex":null,"key":"BE|2012||6203712","display":"BE-12-6203712"},
  {"raw":"276971/25 RO","ok":true,"unringed":false,"country":"RO","year":2025,"club":null,"number":"276971","sex":null,"key":"RO|2025||276971","display":"RO-25-276971"},
  {"raw":"RO 25 276971","ok":true,"unringed":false,"country":"RO","year":2025,"club":null,"number":"276971","sex":null,"key":"RO|2025||276971","display":"RO-25-276971"},
  {"raw":"ro-25-276971","ok":true,"unringed":false,"country":"RO","year":2025,"club":null,"number":"276971","sex":null,"key":"RO|2025||276971","display":"RO-25-276971"},
  {"raw":"DV-01063-17-813","ok":true,"unringed":false,"country":"DV","year":2017,"club":"1063","number":"813","sex":null,"key":"DV|2017|1063|813","display":"DV-01063-17-813"},
  {"raw":"AT-18-301-1405","ok":true,"unringed":false,"country":"AT","year":2018,"club":"301","number":"1405","sex":null,"key":"AT|2018|301|1405","display":"AT-18-301-1405"},
  {"raw":"AUS 18-302-1405","ok":true,"unringed":false,"country":"AT","year":2018,"club":"302","number":"1405","sex":null,"key":"AT|2018|302|1405","display":"AT-18-302-1405"},
  {"raw":"RO-17-561385","ok":true,"unringed":false,"country":"RO","year":2017,"club":null,"number":"561385","sex":null,"key":"RO|2017||561385","display":"RO-17-561385"},
  {"raw":"BE-19-6024428","ok":true,"unringed":false,"country":"BE","year":2019,"club":null,"number":"6024428","sex":null,"key":"BE|2019||6024428","display":"BE-19-6024428"},
  {"raw":"ES-19-159989","ok":true,"unringed":false,"country":"ES","year":2019,"club":null,"number":"159989","sex":null,"key":"ES|2019||159989","display":"ES-19-159989"},
  {"raw":"RO-26-800546 H","ok":true,"unringed":false,"country":"RO","year":2026,"club":null,"number":"800546","sex":"M","key":"RO|2026||800546","display":"RO-26-800546"},
  {"raw":"412084/15 RO ♂","ok":true,"unringed":false,"country":"RO","year":2015,"club":null,"number":"412084","sex":"M","key":"RO|2015||412084","display":"RO-15-412084"},
  {"raw":"RO-26-800546 ♀","ok":true,"unringed":false,"country":"RO","year":2026,"club":null,"number":"800546","sex":"F","key":"RO|2026||800546","display":"RO-26-800546"},
  {"raw":"RO-24-276971","ok":true,"unringed":false,"country":"RO","year":2024,"club":null,"number":"276971","sex":null,"key":"RO|2024||276971","display":"RO-24-276971"},
  {"raw":"NL-25-276971","ok":true,"unringed":false,"country":"NL","year":2025,"club":null,"number":"276971","sex":null,"key":"NL|2025||276971","display":"NL-25-276971"},
  {"raw":"HU-2023-29-14530","ok":true,"unringed":false,"country":"HU","year":2023,"club":"29","number":"14530","sex":null,"key":"HU|2023|29|14530","display":"HU-2023-29-14530"},
  {"raw":"HU-2023-29-14530 H","ok":true,"unringed":false,"country":"HU","year":2023,"club":"29","number":"14530","sex":"M","key":"HU|2023|29|14530","display":"HU-2023-29-14530"},
  {"raw":"HU-2019-10-12345 T","ok":true,"unringed":false,"country":"HU","year":2019,"club":"10","number":"12345","sex":"F","key":"HU|2019|10|12345","display":"HU-2019-10-12345"},
  {"raw":"HU 2019-10-12345","ok":true,"unringed":false,"country":"HU","year":2019,"club":"10","number":"12345","sex":null,"key":"HU|2019|10|12345","display":"HU-2019-10-12345"},
  {"raw":"HU-23-29-14530","ok":true,"unringed":false,"country":"HU","year":2023,"club":"29","number":"14530","sex":null,"key":"HU|2023|29|14530","display":"HU-2023-29-14530"},
  {"raw":"HU 2019 10 12345","ok":true,"unringed":false,"country":"HU","year":2019,"club":"10","number":"12345","sex":null,"key":"HU|2019|10|12345","display":"HU-2019-10-12345"},
  {"raw":"HU-2024-D-123456","ok":true,"unringed":false,"country":"HU","year":2024,"club":"D","number":"123456","sex":null,"key":"HU|2024|D|123456","display":"HU-2024-D-123456"},
  {"raw":"HU-2024-M-12345 T","ok":true,"unringed":false,"country":"HU","year":2024,"club":"M","number":"12345","sex":"F","key":"HU|2024|M|12345","display":"HU-2024-M-12345"},
  {"raw":"HU-2023-04-41013 H","ok":true,"unringed":false,"country":"HU","year":2023,"club":"04","number":"41013","sex":"M","key":"HU|2023|04|41013","display":"HU-2023-04-41013"},
  {"raw":"HU24-04-41013","ok":true,"unringed":false,"country":"HU","year":2024,"club":"04","number":"41013","sex":null,"key":"HU|2024|04|41013","display":"HU-2024-04-41013"},
  {"raw":"HU-24-04-41013 ♂","ok":true,"unringed":false,"country":"HU","year":2024,"club":"04","number":"41013","sex":"M","key":"HU|2024|04|41013","display":"HU-2024-04-41013"},
  {"raw":"HU24-04-41013♀","ok":true,"unringed":false,"country":"HU","year":2024,"club":"04","number":"41013","sex":"F","key":"HU|2024|04|41013","display":"HU-2024-04-41013"},
  {"raw":"HUN-24-04-41013","ok":true,"unringed":false,"country":"HU","year":2024,"club":"04","number":"41013","sex":null,"key":"HU|2024|04|41013","display":"HU-2024-04-41013"},
  {"raw":"HU-2024-4-41013","ok":true,"unringed":false,"country":"HU","year":2024,"club":"04","number":"41013","sex":null,"key":"HU|2024|04|41013","display":"HU-2024-04-41013"},
  {"raw":"HU-2023-10-14530","ok":true,"unringed":false,"country":"HU","year":2023,"club":"10","number":"14530","sex":null,"key":"HU|2023|10|14530","display":"HU-2023-10-14530"},
  {"raw":"HU 23-29-14530 H","ok":true,"unringed":false,"country":"HU","year":2023,"club":"29","number":"14530","sex":"M","key":"HU|2023|29|14530","display":"HU-2023-29-14530"},
  {"raw":"HU-2023-19-7483","ok":true,"unringed":false,"country":"HU","year":2023,"club":"19","number":"7483","sex":null,"key":"HU|2023|19|7483","display":"HU-2023-19-7483"},
  {"raw":"H-2023-19-7483","ok":true,"unringed":false,"country":"HU","year":2023,"club":"19","number":"7483","sex":null,"key":"HU|2023|19|7483","display":"HU-2023-19-7483"},
  {"raw":"HUN 2023 19 7483","ok":true,"unringed":false,"country":"HU","year":2023,"club":"19","number":"7483","sex":null,"key":"HU|2023|19|7483","display":"HU-2023-19-7483"},
  {"raw":"DV 04010-14-126","ok":true,"unringed":false,"country":"DV","year":2014,"club":"4010","number":"126","sex":null,"key":"DV|2014|4010|126","display":"DV-04010-14-126"},
  {"raw":"DV-02114-20-527","ok":true,"unringed":false,"country":"DV","year":2020,"club":"2114","number":"527","sex":null,"key":"DV|2020|2114|527","display":"DV-02114-20-527"},
  {"raw":"DV-01769-26-959","ok":true,"unringed":false,"country":"DV","year":2026,"club":"1769","number":"959","sex":null,"key":"DV|2026|1769|959","display":"DV-01769-26-959"},
  {"raw":"DV 01545-16-007","ok":true,"unringed":false,"country":"DV","year":2016,"club":"1545","number":"7","sex":null,"key":"DV|2016|1545|7","display":"DV-01545-16-7"},
  {"raw":"D-01545-16-101","ok":true,"unringed":false,"country":"DV","year":2016,"club":"1545","number":"101","sex":null,"key":"DV|2016|1545|101","display":"DV-01545-16-101"},
  {"raw":"DE 08778 24 271","ok":true,"unringed":false,"country":"DV","year":2024,"club":"8778","number":"271","sex":null,"key":"DV|2024|8778|271","display":"DV-08778-24-271"},
  {"raw":"DV 08778 24 271 M","ok":true,"unringed":false,"country":"DV","year":2024,"club":"8778","number":"271","sex":"M","key":"DV|2024|8778|271","display":"DV-08778-24-271"},
  {"raw":"AUS 18 301 1405","ok":true,"unringed":false,"country":"AT","year":2018,"club":"301","number":"1405","sex":null,"key":"AT|2018|301|1405","display":"AT-18-301-1405"},
  {"raw":"AT 18-301-1405","ok":true,"unringed":false,"country":"AT","year":2018,"club":"301","number":"1405","sex":null,"key":"AT|2018|301|1405","display":"AT-18-301-1405"},
  {"raw":"A-18-301-1405","ok":true,"unringed":false,"country":"AT","year":2018,"club":"301","number":"1405","sex":null,"key":"AT|2018|301|1405","display":"AT-18-301-1405"},
  {"raw":"AUT 18-415-120","ok":true,"unringed":false,"country":"AT","year":2018,"club":"415","number":"120","sex":null,"key":"AT|2018|415|120","display":"AT-18-415-120"},
  {"raw":"AT-25-12345","ok":true,"unringed":false,"country":"AT","year":2025,"club":null,"number":"12345","sex":null,"key":"AT|2025||12345","display":"AT-25-12345"},
  {"raw":"A 19 12345","ok":true,"unringed":false,"country":"AT","year":2019,"club":null,"number":"12345","sex":null,"key":"AT|2019||12345","display":"AT-19-12345"},
  {"raw":"ESP-19-159989","ok":true,"unringed":false,"country":"ES","year":2019,"club":null,"number":"159989","sex":null,"key":"ES|2019||159989","display":"ES-19-159989"},
  {"raw":"ES-2023--73732","ok":true,"unringed":false,"country":"ES","year":2023,"club":null,"number":"73732","sex":null,"key":"ES|2023||73732","display":"ES-23-73732"},
  {"raw":"E 19 159989","ok":true,"unringed":false,"country":"ES","year":2019,"club":null,"number":"159989","sex":null,"key":"ES|2019||159989","display":"ES-19-159989"},
  {"raw":"159989/2019 ESP","ok":true,"unringed":false,"country":"ES","year":2019,"club":null,"number":"159989","sex":null,"key":"ES|2019||159989","display":"ES-19-159989"},
  {"raw":"159989-19-ESP","ok":true,"unringed":false,"country":"ES","year":2019,"club":null,"number":"159989","sex":null,"key":"ES|2019||159989","display":"ES-19-159989"},
  {"raw":"ESP 2019 159989","ok":true,"unringed":false,"country":"ES","year":2019,"club":null,"number":"159989","sex":null,"key":"ES|2019||159989","display":"ES-19-159989"},
  {"raw":"2091850-25","ok":true,"unringed":false,"country":"RO","year":2025,"club":null,"number":"2091850","sex":null,"key":"RO|2025||2091850","display":"RO-25-2091850"},
  {"raw":"579175-2023","ok":true,"unringed":false,"country":"RO","year":2023,"club":null,"number":"579175","sex":null,"key":"RO|2023||579175","display":"RO-23-579175"},
  {"raw":"5007900/19","ok":true,"unringed":false,"country":"RO","year":2019,"club":null,"number":"5007900","sex":null,"key":"RO|2019||5007900","display":"RO-19-5007900"},
  {"raw":"414415-23-SRB","ok":true,"unringed":false,"country":"RS","year":2023,"club":null,"number":"414415","sex":null,"key":"RS|2023||414415","display":"RS-23-414415"},
  {"raw":"398221/23","ok":true,"unringed":false,"country":"RO","year":2023,"club":null,"number":"398221","sex":null,"key":"RO|2023||398221","display":"RO-23-398221"},
  {"raw":"1626537-16 NL","ok":true,"unringed":false,"country":"NL","year":2016,"club":null,"number":"1626537","sex":null,"key":"NL|2016||1626537","display":"NL-16-1626537"},
  {"raw":"738256/09 F","ok":true,"unringed":false,"country":"RO","year":2009,"club":null,"number":"738256","sex":"F","key":"RO|2009||738256","display":"RO-09-738256"},
  {"raw":"0000123/25 RO","ok":true,"unringed":false,"country":"RO","year":2025,"club":null,"number":"123","sex":null,"key":"RO|2025||123","display":"RO-25-123"},
  {"raw":"BELG-2023--6079117","ok":true,"unringed":false,"country":"BE","year":2023,"club":null,"number":"6079117","sex":null,"key":"BE|2023||6079117","display":"BE-23-6079117"},
  {"raw":"BE 2021-1234567","ok":true,"unringed":false,"country":"BE","year":2021,"club":null,"number":"1234567","sex":null,"key":"BE|2021||1234567","display":"BE-21-1234567"},
  {"raw":"NL 2021-1234567","ok":true,"unringed":false,"country":"NL","year":2021,"club":null,"number":"1234567","sex":null,"key":"NL|2021||1234567","display":"NL-21-1234567"},
  {"raw":"FR 20-123456","ok":true,"unringed":false,"country":"FR","year":2020,"club":null,"number":"123456","sex":null,"key":"FR|2020||123456","display":"FR-20-123456"},
  {"raw":"FR-24-268705","ok":true,"unringed":false,"country":"FR","year":2024,"club":null,"number":"268705","sex":null,"key":"FR|2024||268705","display":"FR-24-268705"},
  {"raw":"FR-21-006470","ok":true,"unringed":false,"country":"FR","year":2021,"club":null,"number":"6470","sex":null,"key":"FR|2021||6470","display":"FR-21-6470"},
  {"raw":"FR-2025-305078","ok":true,"unringed":false,"country":"FR","year":2025,"club":null,"number":"305078","sex":null,"key":"FR|2025||305078","display":"FR-25-305078"},
  {"raw":"F 20 123456","ok":true,"unringed":false,"country":"FR","year":2020,"club":null,"number":"123456","sex":null,"key":"FR|2020||123456","display":"FR-20-123456"},
  {"raw":"IT-24-611854","ok":true,"unringed":false,"country":"IT","year":2024,"club":null,"number":"611854","sex":null,"key":"IT|2024||611854","display":"IT-24-611854"},
  {"raw":"I 24 611854","ok":true,"unringed":false,"country":"IT","year":2024,"club":null,"number":"611854","sex":null,"key":"IT|2024||611854","display":"IT-24-611854"},
  {"raw":"CH 19 12345","ok":true,"unringed":false,"country":"CH","year":2019,"club":null,"number":"12345","sex":null,"key":"CH|2019||12345","display":"CH-19-12345"},
  {"raw":"PT 25 5156074","ok":true,"unringed":false,"country":"PT","year":2025,"club":null,"number":"5156074","sex":null,"key":"PT|2025||5156074","display":"PT-25-5156074"},
  {"raw":"P 25 5156074","ok":true,"unringed":false,"country":"PT","year":2025,"club":null,"number":"5156074","sex":null,"key":"PT|2025||5156074","display":"PT-25-5156074"},
  {"raw":"RO 2024 1929323","ok":true,"unringed":false,"country":"RO","year":2024,"club":null,"number":"1929323","sex":null,"key":"RO|2024||1929323","display":"RO-24-1929323"},
  {"raw":"RO-2024-123456","ok":true,"unringed":false,"country":"RO","year":2024,"club":null,"number":"123456","sex":null,"key":"RO|2024||123456","display":"RO-24-123456"},
  {"raw":"CZ-08-0154-1723","ok":true,"unringed":false,"country":"CZ","year":2008,"club":"154","number":"1723","sex":null,"key":"CZ|2008|154|1723","display":"CZ-08-154-1723"},
  {"raw":"CZ-01-0148-123","ok":true,"unringed":false,"country":"CZ","year":2001,"club":"148","number":"123","sex":null,"key":"CZ|2001|148|123","display":"CZ-01-148-123"},
  {"raw":"PL-11-1234567","ok":true,"unringed":false,"country":"PL","year":2011,"club":null,"number":"1234567","sex":null,"key":"PL|2011||1234567","display":"PL-11-1234567"},
  {"raw":"PL 18-301-1405","ok":true,"unringed":false,"country":"PL","year":2018,"club":"301","number":"1405","sex":null,"key":"PL|2018|301|1405","display":"PL-18-301-1405"},
  {"raw":"GB 22 12345","ok":true,"unringed":false,"country":"GB","year":2022,"club":null,"number":"12345","sex":null,"key":"GB|2022||12345","display":"GB-22-12345"},
  {"raw":"GBR-22-12345","ok":true,"unringed":false,"country":"GB","year":2022,"club":null,"number":"12345","sex":null,"key":"GB|2022||12345","display":"GB-22-12345"},
  {"raw":"BG 23 19087","ok":true,"unringed":false,"country":"BG","year":2023,"club":null,"number":"19087","sex":null,"key":"BG|2023||19087","display":"BG-23-19087"},
  {"raw":"MD-20-12345","ok":true,"unringed":false,"country":"MD","year":2020,"club":null,"number":"12345","sex":null,"key":"MD|2020||12345","display":"MD-20-12345"},
  {"raw":"UA 2024 2225210","ok":true,"unringed":false,"country":"UA","year":2024,"club":null,"number":"2225210","sex":null,"key":"UA|2024||2225210","display":"UA-24-2225210"},
  {"raw":"SK 20 1234","ok":true,"unringed":false,"country":"SK","year":2020,"club":null,"number":"1234","sex":null,"key":"SK|2020||1234","display":"SK-20-1234"},
  {"raw":"RS-23-414415","ok":true,"unringed":false,"country":"RS","year":2023,"club":null,"number":"414415","sex":null,"key":"RS|2023||414415","display":"RS-23-414415"},
  {"raw":"SRB-2025-618503","ok":true,"unringed":false,"country":"RS","year":2025,"club":null,"number":"618503","sex":null,"key":"RS|2025||618503","display":"RS-25-618503"},
  {"raw":"SRB 23 414415","ok":true,"unringed":false,"country":"RS","year":2023,"club":null,"number":"414415","sex":null,"key":"RS|2023||414415","display":"RS-23-414415"},
  {"raw":"TW 26 123456","ok":true,"unringed":false,"country":"TW","year":2026,"club":null,"number":"123456","sex":null,"key":"TW|2026||123456","display":"TW-26-123456"},
  {"raw":"CN-19-123456","ok":true,"unringed":false,"country":"CN","year":2019,"club":null,"number":"123456","sex":null,"key":"CN|2019||123456","display":"CN-19-123456"},
  {"raw":"CHN-2019-123456","ok":true,"unringed":false,"country":"CN","year":2019,"club":null,"number":"123456","sex":null,"key":"CN|2019||123456","display":"CN-19-123456"},
  {"raw":"US 2019 12345","ok":true,"unringed":false,"country":"US","year":2019,"club":null,"number":"12345","sex":null,"key":"US|2019||12345","display":"US-19-12345"},
  {"raw":"USA 19 12345","ok":true,"unringed":false,"country":"US","year":2019,"club":null,"number":"12345","sex":null,"key":"US|2019||12345","display":"US-19-12345"},
  {"raw":"DK-24-123456","ok":true,"unringed":false,"country":"DK","year":2024,"club":null,"number":"123456","sex":null,"key":"DK|2024||123456","display":"DK-24-123456"},
  {"raw":"DAN 24 1698","ok":true,"unringed":false,"country":"DK","year":2024,"club":null,"number":"1698","sex":null,"key":"DK|2024||1698","display":"DK-24-1698"},
  {"raw":"RO 439175-2020","ok":true,"unringed":false,"country":"RO","year":2020,"club":null,"number":"439175","sex":null,"key":"RO|2020||439175","display":"RO-20-439175"},
  {"raw":"NL 1724956-2011","ok":true,"unringed":false,"country":"NL","year":2011,"club":null,"number":"1724956","sex":null,"key":"NL|2011||1724956","display":"NL-11-1724956"},
  {"raw":"DV 17-1063-813","ok":true,"unringed":false,"country":"DV","year":2017,"club":"1063","number":"813","sex":null,"key":"DV|2017|1063|813","display":"DV-01063-17-813"},
  {"raw":"DV-17-01063-813","ok":true,"unringed":false,"country":"DV","year":2017,"club":"1063","number":"813","sex":null,"key":"DV|2017|1063|813","display":"DV-01063-17-813"},
  {"raw":"CZ 08 0154 1723","ok":true,"unringed":false,"country":"CZ","year":2008,"club":"154","number":"1723","sex":null,"key":"CZ|2008|154|1723","display":"CZ-08-154-1723"},
  // Danemarca cu club (scrise cu anul în față, ca la myloft): afișarea veche, cu anul primul, rămâne.
  {"raw":"DK 15-151-1958","ok":true,"unringed":false,"country":"DK","year":2015,"club":"151","number":"1958","sex":null,"key":"DK|2015|151|1958","display":"DK-15-151-1958"},
  {"raw":"DAN 26-046-0205","ok":true,"unringed":false,"country":"DK","year":2026,"club":"46","number":"205","sex":null,"key":"DK|2026|46|205","display":"DK-26-46-205"},
  {"raw":"DAN 18-127-0694","ok":true,"unringed":false,"country":"DK","year":2018,"club":"127","number":"694","sex":null,"key":"DK|2018|127|694","display":"DK-18-127-694"},
  {"raw":"DK-24-242-1698","ok":true,"unringed":false,"country":"DK","year":2024,"club":"242","number":"1698","sex":null,"key":"DK|2024|242|1698","display":"DK-24-242-1698"},
  {"raw":"DK 03 127 694","ok":true,"unringed":false,"country":"DK","year":2003,"club":"127","number":"694","sex":null,"key":"DK|2003|127|694","display":"DK-03-127-694"},
  {"raw":"DAN-11-335-216 F","ok":true,"unringed":false,"country":"DK","year":2011,"club":"335","number":"216","sex":"F","key":"DK|2011|335|216","display":"DK-11-335-216"},
];

for (const want of PINNED) {
  test(`compatibil: ${want.raw}`, () => {
    const r = parseRing(want.raw, { now });
    assert.equal(r.ok, want.ok);
    assert.equal(r.unringed, want.unringed);
    for (const k of ['country', 'year', 'club', 'number', 'sex']) assert.equal(r[k], want[k], k);
    assert.equal(ringKey(r), want.key, 'cheia');
    assert.equal(formatRing(r), want.display, 'afișarea');
  });
}

test('compatibil: afișarea veche (cea arătată până acum) se citește înapoi în aceeași cheie', () => {
  for (const want of PINNED.filter((w) => w.ok)) assert.equal(ringKey(parseRing(want.display, { now })), want.key, want.display);
});

test('compatibil: fără inel rămâne fără inel, fără cheie', () => {
  for (const [raw, sex] of [['000 M', 'M'], ['0000/07 RO M', 'M'], ['000', null], ['00000', null]]) {
    const r = parseRing(raw, { now });
    assert.equal(r.ok, true, raw);
    assert.equal(r.unringed, true, raw);
    assert.equal(r.sex, sex, raw);
    assert.equal(ringKey(r), null, raw);
    assert.equal(formatRing(r), raw, raw);
  }
});

test('compatibil: ce nu se citea nici acum nu devine inel recunoscut', () => {
  for (const raw of ['Govaerts pedigreu distrus', '159989 019', '159989/019', '159989 119-ESP', 'Latebred', 'xyz', '']) {
    const r = parseRing(raw, { now });
    assert.equal(r.ok, false, raw);
    assert.equal(ringKey(r), null, raw);
  }
});

test('compatibil: inelul maghiar fără organizator rămâne refuzat', () => {
  for (const raw of ['14530/23 HU', 'HU-23-14530', 'HU 2023 14530']) {
    const r = parseRing(raw, { now });
    assert.equal(r.ok, false, raw);
    assert.equal(r.needsClub, true, raw);
  }
});
