# Citirile din poze incluse în abonament (în locul creditului)

Data: 2026-11-18 · Branch: `feat/citiri-incluse`

## De ce

Vânzătorul nu vrea să mai pună credit în dolari după fiecare plată și să explice crescătorilor ce e creditul. Citirile
pedigree-urilor din poze intră în abonament, cu o limită, iar vânzătorul vede în consolă cât folosește fiecare și cât costă.

## Ce hotărî vânzătorul

- **200 de citiri pe an de abonament**, cel mult **20 pe zi**.
- În lista crescătorilor din consolă, două coloane: **câte citiri** a făcut și **cât a costat** — costul în **dolari**
  (așa vine factura de la Anthropic; fără curs de schimb de pus de mână).

## Cum merge

- Anul de abonament începe la data de început a abonamentului (`subscription_start`); la activare / prelungire contorul
  pornește iar de la zero. Se numără citirile (reușite sau nu: și cele nereușite se plătesc) din `pedigree_reads` de la
  acea dată.
- Limita = 200 (`PEDIGREE_READS_PER_YEAR`, implicit 200) + **citirile în plus** pe care vânzătorul le poate da unui cont din
  consolă (`accounts.extra_reads`; se pun pe zero la fiecare activare / prelungire). *(Propunerea mea, din mesajul de dinainte.)*
- La limită: citirea se oprește cu mesajul „Ai folosit toate cele N citiri din abonament…; poți completa căsuțele de mână”.
  Limita pe zi (20, `PEDIGREE_READS_PER_DAY`) rămâne. Vânzătorul (adminul) citește fără limită pe an.
- Creditul în dolari dispare din aplicație: nu se mai scade, nu se mai cere, nu se mai arată (coloana `ai_credit_micros`
  rămâne în bază, nefolosită). „Adaugă credit” din consolă devine „Citiri în plus”.
- Consola: lista arată „Citiri” = `folosite / limită` în anul curent și „Cost” = costul acestor citiri în dolari;
  detaliul contului arată și totalul de la început.
- Crescătorul vede în Cont și în ecranul de citire: „Citiri din abonament: 37 din 200 (încă 163)”.

## Ce nu facem

- Fără curs de schimb, fără lei. Fără tokenuri separate (costul salvat lângă fiecare citire e de ajuns).
- Fără vânzare de pachete de citiri în aplicație.
