# Porumbar: 5 paletare de culori (propunere)

Data: 2026-11-16. Doar propunere: codul aplicației nu a fost schimbat. Previzualizare: [paletare.html](paletare.html) (se deschide direct în browser, fără internet).

Toate cele cinci păstrează regulile aplicației: temă deschisă (pentru lumina zilei), text de bază închis pe alb, **o singură culoare pentru acțiuni** (butoane, navigare) și **o scară de valoare separată** (5 → 1), dintr-o cu totul altă familie de culoare decât butoanele, ca o notă să nu pară niciodată un buton. „Fără date” (valoarea 0) e gri neutru, cu margine punctată și liniuță în loc de cifră, ca în aplicația de acum. Literele rămân Atkinson Hyperlegible Next. Fără degradeuri, fără neon.

Numele tokenurilor sunt cele din `web/src/styles.css`, deci o paletă se poate pune în aplicație schimbând doar blocul `:root`.

## Cum s-a verificat

- Contrastul este calculat după formula WCAG 2.x (luminanță relativă). Prag: **4,5 : 1** pentru tot ce e text (AA, text normal).
- Ordinea scării de valoare: luminozitatea L* (CIELAB) crește strict de la valoarea 5 (închis) la 1 (deschis).
- Distanța dintre culori: ΔE2000. Peste ~10 se vede clar alăturat, peste ~25 sunt culori diferite.
- Valorile 5 și 4 au cifra albă, valorile 3, 2, 1 cifră închisă: așa se citesc în soare, iar treptele diferă și ca luminozitate, nu doar ca nuanță (merg și pentru cine nu deosebește bine culorile).

## Pe scurt

| Paletă | Caracter | Acțiuni | Valoare | Alb pe accent |
|---|---|---|---|---|
| **Pământ** | Cald și liniștit, ca lemnul porumbarului și pământul de afară | `#a33d1c` | `#33501a` → `#e7efd2` | 6,48 : 1 |
| **Grafit** | Neutru și foarte curat | `#c2410c` | `#0f5132` → `#daf2e3` | 5,18 : 1 |
| **Livadă** | Proaspăt, ca o dimineață în grădină | `#0b6b5e` | `#73390a` → `#fcefcd` | 6,40 : 1 |
| **Marină** (recomandată) | Serios și de încredere | `#1f3b70` | `#11502f` → `#e2f2df` | 10,95 : 1 |
| **Lavandă** | Modern și prietenos | `#5b3cc4` | `#0f5741` → `#e2f6ed` | 7,27 : 1 |

## 1. Pământ

Cald și liniștit, ca lemnul porumbarului și pământul de afară: crem, maro și cărămiziu pe butoane. Valoarea porumbeilor pe verde-măsliniu.

**Sigla:** Cercul siglei devine cărămiziu (#A33D1C).

| Token | Valoare | Folosit pentru |
|---|---|---|
| `--bg` | `#f5f0e8` | fundalul paginii |
| `--surface` | `#fffdf9` | carduri, câmpuri, antet |
| `--surface-2` | `#efe8dc` | zone secundare, insigne |
| `--border` | `#e2d8c8` | margini fine |
| `--border-strong` | `#c2b39c` | margini de câmp / buton secundar |
| `--text` | `#2b2117` | text de bază |
| `--muted` | `#625345` | text secundar (an, culoare, indicii) |
| `--accent` | `#a33d1c` | butoane principale, navigare activă |
| `--accent-strong` | `#7c2c12` | apăsat / hover, text pe accent-soft |
| `--accent-soft` | `#f8e5da` | fundal pentru selecție |
| `--accent-ink` | `#ffffff` | text pe accent |
| `--danger` | `#9a1a34` | ștergere, erori |
| `--danger-soft` | `#f9e3e7` | fundal eroare |
| `--warn` | `#7d4a00` | atenționări |
| `--warn-soft` | `#fbefd4` | fundal atenționare |
| `--ok` | `#3d5c12` | confirmări |
| `--ok-soft` | `#eaf0da` | fundal confirmare |
| `--male` | `#2b5a86` | M (mascul) |
| `--female` | `#8c357f` | F (femelă) |
| `--band-5` | `#33501a` | valoare 5 (cei mai buni) |
| `--band-5-ink` | `#ffffff` | cifra / textul pe band-5 |
| `--band-4` | `#567a28` | valoare 4 |
| `--band-4-ink` | `#ffffff` | cifra / textul pe band-4 |
| `--band-3` | `#90b256` | valoare 3 |
| `--band-3-ink` | `#1e2f08` | cifra / textul pe band-3 |
| `--band-2` | `#c8d99c` | valoare 2 |
| `--band-2-ink` | `#24350c` | cifra / textul pe band-2 |
| `--band-1` | `#e7efd2` | valoare 1 (slabi) |
| `--band-1-ink` | `#34461a` | cifra / textul pe band-1 |
| `--band-0` | `#ebe6df` | fără date |
| `--band-0-ink` | `#5e5043` | cifra / textul pe band-0 |

**Contrast** (toate trec pragul de 4,5 : 1):

| Pereche | Raport |
|---|---|
| Text pe fundal (`--text` pe `--bg`) | 13,89 : 1 |
| Text pe suprafață (`--text` pe `--surface`) | 15,51 : 1 |
| Text pe suprafață 2 (`--text` pe `--surface-2`) | 12,94 : 1 |
| Text estompat pe suprafață (`--muted` pe `--surface`) | 7,27 : 1 |
| Text estompat pe fundal (`--muted` pe `--bg`) | 6,51 : 1 |
| Text estompat pe suprafață 2 (`--muted` pe `--surface-2`) | 6,07 : 1 |
| Alb pe accent (`--accent-ink` pe `--accent`) | 6,48 : 1 |
| Alb pe accent închis (`--accent-ink` pe `--accent-strong`) | 9,43 : 1 |
| Accent ca text pe suprafață (`--accent` pe `--surface`) | 6,38 : 1 |
| Accent pe accent-soft (`--accent-strong` pe `--accent-soft`) | 7,73 : 1 |
| Pericol pe suprafață (`--danger` pe `--surface`) | 8,04 : 1 |
| Pericol pe danger-soft (`--danger` pe `--danger-soft`) | 6,68 : 1 |
| Atenție pe warn-soft (`--warn` pe `--warn-soft`) | 6,45 : 1 |
| OK pe ok-soft (`--ok` pe `--ok-soft`) | 6,56 : 1 |
| Mascul (text) pe suprafață (`--male` pe `--surface`) | 7,10 : 1 |
| Femelă (text) pe suprafață (`--female` pe `--surface`) | 7,05 : 1 |
| Valoare 5: cerneală pe fond (`--band-5-ink` pe `--band-5`) | 9,12 : 1 |
| Valoare 4: cerneală pe fond (`--band-4-ink` pe `--band-4`) | 4,99 : 1 |
| Valoare 3: cerneală pe fond (`--band-3-ink` pe `--band-3`) | 5,93 : 1 |
| Valoare 2: cerneală pe fond (`--band-2-ink` pe `--band-2`) | 8,72 : 1 |
| Valoare 1: cerneală pe fond (`--band-1-ink` pe `--band-1`) | 8,68 : 1 |
| Valoare 0: cerneală pe fond (`--band-0-ink` pe `--band-0`) | 6,26 : 1 |

**Scara de valoare:** L* = 31 → 47 → 68 → 84 → 93 (de la 5 la 1, crește strict); pași ΔE2000 între trepte vecine: 14,9, 19,4, 13,0, 10,2. Fără date: croma 4,0 (practic gri), ΔE 11,0 față de valoarea 1, plus margine punctată și „–”.

**Distanțe (ΔE2000):** accent ↔ valoarea 5 = 43,3, accent ↔ valoarea 4 = 46,1; mascul ↔ femelă = 30,8, mascul ↔ accent = 41,3, femelă ↔ accent = 33,2; pericol ↔ accent = 15,5.

**De reținut:** cărămiziul butoanelor și roșul-vin de la „Șterge” sunt rude (ΔE ~15). Se deosebesc, dar pericolul trebuie să aibă mereu iconiță și text clar („Șterge”), nu doar culoarea.

## 2. Grafit

Neutru și foarte curat: alb și gri, cu o singură culoare puternică, portocaliul, doar pe ce se apasă. Ochiul găsește imediat butonul.

**Sigla:** Cercul siglei devine portocaliu (#C2410C); alternativ rămâne grafit (#1F2328).

| Token | Valoare | Folosit pentru |
|---|---|---|
| `--bg` | `#f4f4f3` | fundalul paginii |
| `--surface` | `#ffffff` | carduri, câmpuri, antet |
| `--surface-2` | `#ececea` | zone secundare, insigne |
| `--border` | `#dcdcd9` | margini fine |
| `--border-strong` | `#b5b5b0` | margini de câmp / buton secundar |
| `--text` | `#1a1b1d` | text de bază |
| `--muted` | `#55575b` | text secundar (an, culoare, indicii) |
| `--accent` | `#c2410c` | butoane principale, navigare activă |
| `--accent-strong` | `#9a3209` | apăsat / hover, text pe accent-soft |
| `--accent-soft` | `#fdeee4` | fundal pentru selecție |
| `--accent-ink` | `#ffffff` | text pe accent |
| `--danger` | `#a5122f` | ștergere, erori |
| `--danger-soft` | `#fbe6ea` | fundal eroare |
| `--warn` | `#7f5200` | atenționări |
| `--warn-soft` | `#fdf3d7` | fundal atenționare |
| `--ok` | `#17663a` | confirmări |
| `--ok-soft` | `#e2f3e8` | fundal confirmare |
| `--male` | `#1d5a9e` | M (mascul) |
| `--female` | `#a62d6b` | F (femelă) |
| `--band-5` | `#0f5132` | valoare 5 (cei mai buni) |
| `--band-5-ink` | `#ffffff` | cifra / textul pe band-5 |
| `--band-4` | `#1d7a4b` | valoare 4 |
| `--band-4-ink` | `#ffffff` | cifra / textul pe band-4 |
| `--band-3` | `#5db487` | valoare 3 |
| `--band-3-ink` | `#0a3520` | cifra / textul pe band-3 |
| `--band-2` | `#a9dcbf` | valoare 2 |
| `--band-2-ink` | `#0c3a22` | cifra / textul pe band-2 |
| `--band-1` | `#daf2e3` | valoare 1 (slabi) |
| `--band-1-ink` | `#1a4a30` | cifra / textul pe band-1 |
| `--band-0` | `#ececea` | fără date |
| `--band-0-ink` | `#55575b` | cifra / textul pe band-0 |

**Contrast** (toate trec pragul de 4,5 : 1):

| Pereche | Raport |
|---|---|
| Text pe fundal (`--text` pe `--bg`) | 15,66 : 1 |
| Text pe suprafață (`--text` pe `--surface`) | 17,24 : 1 |
| Text pe suprafață 2 (`--text` pe `--surface-2`) | 14,57 : 1 |
| Text estompat pe suprafață (`--muted` pe `--surface`) | 7,24 : 1 |
| Text estompat pe fundal (`--muted` pe `--bg`) | 6,58 : 1 |
| Text estompat pe suprafață 2 (`--muted` pe `--surface-2`) | 6,12 : 1 |
| Alb pe accent (`--accent-ink` pe `--accent`) | 5,18 : 1 |
| Alb pe accent închis (`--accent-ink` pe `--accent-strong`) | 7,41 : 1 |
| Accent ca text pe suprafață (`--accent` pe `--surface`) | 5,18 : 1 |
| Accent pe accent-soft (`--accent-strong` pe `--accent-soft`) | 6,54 : 1 |
| Pericol pe suprafață (`--danger` pe `--surface`) | 7,70 : 1 |
| Pericol pe danger-soft (`--danger` pe `--danger-soft`) | 6,46 : 1 |
| Atenție pe warn-soft (`--warn` pe `--warn-soft`) | 6,10 : 1 |
| OK pe ok-soft (`--ok` pe `--ok-soft`) | 6,08 : 1 |
| Mascul (text) pe suprafață (`--male` pe `--surface`) | 6,98 : 1 |
| Femelă (text) pe suprafață (`--female` pe `--surface`) | 6,54 : 1 |
| Valoare 5: cerneală pe fond (`--band-5-ink` pe `--band-5`) | 9,36 : 1 |
| Valoare 4: cerneală pe fond (`--band-4-ink` pe `--band-4`) | 5,33 : 1 |
| Valoare 3: cerneală pe fond (`--band-3-ink` pe `--band-3`) | 5,41 : 1 |
| Valoare 2: cerneală pe fond (`--band-2-ink` pe `--band-2`) | 8,32 : 1 |
| Valoare 1: cerneală pe fond (`--band-1-ink` pe `--band-1`) | 8,61 : 1 |
| Valoare 0: cerneală pe fond (`--band-0-ink` pe `--band-0`) | 6,12 : 1 |

**Scara de valoare:** L* = 30 → 45 → 67 → 84 → 93 (de la 5 la 1, crește strict); pași ΔE2000 între trepte vecine: 13,7, 20,4, 13,7, 10,1. Fără date: croma 1,0 (practic gri), ΔE 11,4 față de valoarea 1, plus margine punctată și „–”.

**Distanțe (ΔE2000):** accent ↔ valoarea 5 = 52,5, accent ↔ valoarea 4 = 55,5; mascul ↔ femelă = 35,7, mascul ↔ accent = 46,2, femelă ↔ accent = 31,4; pericol ↔ accent = 18,6.

**De reținut:** portocaliul butoanelor și roșul de pericol sunt apropiate (ΔE ~19); de aceea pericolul e mutat spre carmin (`#A5122F`) și trebuie să aibă mereu iconiță și text. Sigla portocalie e cea mai mare schimbare de identitate dintre cele cinci.

## 3. Livadă

Proaspăt, ca o dimineață în grădină: alb cu o umbră de mentă și acțiuni pe verde-petrol. Valoarea porumbeilor pe auriu-miere, ca medaliile de concurs.

**Sigla:** Cercul siglei devine verde-petrol (#0B6B5E).

| Token | Valoare | Folosit pentru |
|---|---|---|
| `--bg` | `#f0f6f3` | fundalul paginii |
| `--surface` | `#ffffff` | carduri, câmpuri, antet |
| `--surface-2` | `#e5efea` | zone secundare, insigne |
| `--border` | `#d2e1da` | margini fine |
| `--border-strong` | `#a6c1b5` | margini de câmp / buton secundar |
| `--text` | `#10241e` | text de bază |
| `--muted` | `#455d56` | text secundar (an, culoare, indicii) |
| `--accent` | `#0b6b5e` | butoane principale, navigare activă |
| `--accent-strong` | `#064f46` | apăsat / hover, text pe accent-soft |
| `--accent-soft` | `#ddf1eb` | fundal pentru selecție |
| `--accent-ink` | `#ffffff` | text pe accent |
| `--danger` | `#b3261e` | ștergere, erori |
| `--danger-soft` | `#fce8e6` | fundal eroare |
| `--warn` | `#8a3f00` | atenționări |
| `--warn-soft` | `#fdeedd` | fundal atenționare |
| `--ok` | `#1f6b3a` | confirmări |
| `--ok-soft` | `#e2f2e7` | fundal confirmare |
| `--male` | `#255da3` | M (mascul) |
| `--female` | `#a4326c` | F (femelă) |
| `--band-5` | `#73390a` | valoare 5 (cei mai buni) |
| `--band-5-ink` | `#ffffff` | cifra / textul pe band-5 |
| `--band-4` | `#a35a07` | valoare 4 |
| `--band-4-ink` | `#ffffff` | cifra / textul pe band-4 |
| `--band-3` | `#dc9634` | valoare 3 |
| `--band-3-ink` | `#3b2100` | cifra / textul pe band-3 |
| `--band-2` | `#f3cf7e` | valoare 2 |
| `--band-2-ink` | `#3d2500` | cifra / textul pe band-2 |
| `--band-1` | `#fcefcd` | valoare 1 (slabi) |
| `--band-1-ink` | `#5a3a00` | cifra / textul pe band-1 |
| `--band-0` | `#e6ebe9` | fără date |
| `--band-0-ink` | `#455d56` | cifra / textul pe band-0 |

**Contrast** (toate trec pragul de 4,5 : 1):

| Pereche | Raport |
|---|---|
| Text pe fundal (`--text` pe `--bg`) | 14,83 : 1 |
| Text pe suprafață (`--text` pe `--surface`) | 16,24 : 1 |
| Text pe suprafață 2 (`--text` pe `--surface-2`) | 13,82 : 1 |
| Text estompat pe suprafață (`--muted` pe `--surface`) | 7,11 : 1 |
| Text estompat pe fundal (`--muted` pe `--bg`) | 6,50 : 1 |
| Text estompat pe suprafață 2 (`--muted` pe `--surface-2`) | 6,05 : 1 |
| Alb pe accent (`--accent-ink` pe `--accent`) | 6,40 : 1 |
| Alb pe accent închis (`--accent-ink` pe `--accent-strong`) | 9,48 : 1 |
| Accent ca text pe suprafață (`--accent` pe `--surface`) | 6,40 : 1 |
| Accent pe accent-soft (`--accent-strong` pe `--accent-soft`) | 8,06 : 1 |
| Pericol pe suprafață (`--danger` pe `--surface`) | 6,54 : 1 |
| Pericol pe danger-soft (`--danger` pe `--danger-soft`) | 5,55 : 1 |
| Atenție pe warn-soft (`--warn` pe `--warn-soft`) | 6,61 : 1 |
| OK pe ok-soft (`--ok` pe `--ok-soft`) | 5,61 : 1 |
| Mascul (text) pe suprafață (`--male` pe `--surface`) | 6,62 : 1 |
| Femelă (text) pe suprafață (`--female` pe `--surface`) | 6,46 : 1 |
| Valoare 5: cerneală pe fond (`--band-5-ink` pe `--band-5`) | 9,06 : 1 |
| Valoare 4: cerneală pe fond (`--band-4-ink` pe `--band-4`) | 5,22 : 1 |
| Valoare 3: cerneală pe fond (`--band-3-ink` pe `--band-3`) | 6,02 : 1 |
| Valoare 2: cerneală pe fond (`--band-2-ink` pe `--band-2`) | 9,59 : 1 |
| Valoare 1: cerneală pe fond (`--band-1-ink` pe `--band-1`) | 9,00 : 1 |
| Valoare 0: cerneală pe fond (`--band-0-ink` pe `--band-0`) | 5,90 : 1 |

**Scara de valoare:** L* = 31 → 46 → 67 → 85 → 95 (de la 5 la 1, crește strict); pași ΔE2000 între trepte vecine: 14,0, 20,9, 15,9, 13,0. Fără date: croma 2,1 (practic gri), ΔE 12,9 față de valoarea 1, plus margine punctată și „–”.

**Distanțe (ΔE2000):** accent ↔ valoarea 5 = 40,4, accent ↔ valoarea 4 = 41,4; mascul ↔ femelă = 34,7, mascul ↔ accent = 29,8, femelă ↔ accent = 44,9; pericol ↔ accent = 53,5.

**De reținut:** e singura paletă care mută valoarea de pe verde pe auriu (verdele e acum al butoanelor). Auriul „ca medaliile” se înțelege ușor, dar e o schimbare față de decizia de acum („valoarea pe verde”). Atenționarea (`--warn`) e maro-portocaliu, apropiat de scară; se folosește doar cu iconiță și fond propriu.

## 4. Marină (recomandată)

Serios și de încredere: bleumarin pe hârtie caldă, ca un carnet de concurs bine ținut. Contrast foarte mare, se citește bine în soare.

**Sigla:** Cercul siglei devine bleumarin (#1F3B70), cu un inel subțire auriu opțional.

**Antetul** aplicației e plin, în culoarea accentului (bleumarin), cu text alb; restul paginii rămâne pe hârtie caldă.

| Token | Valoare | Folosit pentru |
|---|---|---|
| `--bg` | `#f6f3ed` | fundalul paginii |
| `--surface` | `#fffdf8` | carduri, câmpuri, antet |
| `--surface-2` | `#efeae0` | zone secundare, insigne |
| `--border` | `#e0d9cb` | margini fine |
| `--border-strong` | `#bdb39f` | margini de câmp / buton secundar |
| `--text` | `#121c33` | text de bază |
| `--muted` | `#4c5468` | text secundar (an, culoare, indicii) |
| `--accent` | `#1f3b70` | butoane principale, navigare activă |
| `--accent-strong` | `#142a53` | apăsat / hover, text pe accent-soft |
| `--accent-soft` | `#f9ebcf` | fundal pentru selecție |
| `--accent-ink` | `#ffffff` | text pe accent |
| `--danger` | `#b42318` | ștergere, erori |
| `--danger-soft` | `#fbe8e5` | fundal eroare |
| `--warn` | `#8a4b00` | atenționări |
| `--warn-soft` | `#fdf0d6` | fundal atenționare |
| `--ok` | `#17663a` | confirmări |
| `--ok-soft` | `#e3f2e7` | fundal confirmare |
| `--male` | `#0f6585` | M (mascul) |
| `--female` | `#a62d6b` | F (femelă) |
| `--band-5` | `#11502f` | valoare 5 (cei mai buni) |
| `--band-5-ink` | `#ffffff` | cifra / textul pe band-5 |
| `--band-4` | `#257a45` | valoare 4 |
| `--band-4-ink` | `#ffffff` | cifra / textul pe band-4 |
| `--band-3` | `#66b37c` | valoare 3 |
| `--band-3-ink` | `#0b3519` | cifra / textul pe band-3 |
| `--band-2` | `#b2dcb9` | valoare 2 |
| `--band-2-ink` | `#0e3a1e` | cifra / textul pe band-2 |
| `--band-1` | `#e2f2df` | valoare 1 (slabi) |
| `--band-1-ink` | `#1f4a2b` | cifra / textul pe band-1 |
| `--band-0` | `#ece7de` | fără date |
| `--band-0-ink` | `#4c5468` | cifra / textul pe band-0 |

**Contrast** (toate trec pragul de 4,5 : 1):

| Pereche | Raport |
|---|---|
| Text pe fundal (`--text` pe `--bg`) | 15,30 : 1 |
| Text pe suprafață (`--text` pe `--surface`) | 16,66 : 1 |
| Text pe suprafață 2 (`--text` pe `--surface-2`) | 14,13 : 1 |
| Text estompat pe suprafață (`--muted` pe `--surface`) | 7,44 : 1 |
| Text estompat pe fundal (`--muted` pe `--bg`) | 6,83 : 1 |
| Text estompat pe suprafață 2 (`--muted` pe `--surface-2`) | 6,31 : 1 |
| Alb pe accent (`--accent-ink` pe `--accent`) | 10,95 : 1 |
| Alb pe accent închis (`--accent-ink` pe `--accent-strong`) | 14,13 : 1 |
| Accent ca text pe suprafață (`--accent` pe `--surface`) | 10,77 : 1 |
| Accent pe accent-soft (`--accent-strong` pe `--accent-soft`) | 11,99 : 1 |
| Pericol pe suprafață (`--danger` pe `--surface`) | 6,47 : 1 |
| Pericol pe danger-soft (`--danger` pe `--danger-soft`) | 5,56 : 1 |
| Atenție pe warn-soft (`--warn` pe `--warn-soft`) | 6,03 : 1 |
| OK pe ok-soft (`--ok` pe `--ok-soft`) | 6,04 : 1 |
| Mascul (text) pe suprafață (`--male` pe `--surface`) | 6,41 : 1 |
| Femelă (text) pe suprafață (`--female` pe `--surface`) | 6,44 : 1 |
| Valoare 5: cerneală pe fond (`--band-5-ink` pe `--band-5`) | 9,49 : 1 |
| Valoare 4: cerneală pe fond (`--band-4-ink` pe `--band-4`) | 5,32 : 1 |
| Valoare 3: cerneală pe fond (`--band-3-ink` pe `--band-3`) | 5,40 : 1 |
| Valoare 2: cerneală pe fond (`--band-2-ink` pe `--band-2`) | 8,42 : 1 |
| Valoare 1: cerneală pe fond (`--band-1-ink` pe `--band-1`) | 8,68 : 1 |
| Valoare 0: cerneală pe fond (`--band-0-ink` pe `--band-0`) | 6,14 : 1 |

**Scara de valoare:** L* = 30 → 45 → 67 → 84 → 94 (de la 5 la 1, crește strict); pași ΔE2000 între trepte vecine: 14,2, 20,2, 14,4, 10,6. Fără date: croma 5,0 (practic gri), ΔE 10,4 față de valoarea 1, plus margine punctată și „–”.

**Distanțe (ΔE2000):** accent ↔ valoarea 5 = 35,8, accent ↔ valoarea 4 = 43,3; mascul ↔ femelă = 46,3, mascul ↔ accent = 17,7, femelă ↔ accent = 32,0; pericol ↔ accent = 41,8.

## 5. Lavandă

Modern și prietenos: fundaluri pastelate, dar text și butoane închise la culoare, deci la fel de clare. Acțiuni pe violet, valoarea pe verde-mentă.

**Sigla:** Cercul siglei devine violet (#5B3CC4).

| Token | Valoare | Folosit pentru |
|---|---|---|
| `--bg` | `#f5f3fb` | fundalul paginii |
| `--surface` | `#ffffff` | carduri, câmpuri, antet |
| `--surface-2` | `#eeeaf8` | zone secundare, insigne |
| `--border` | `#dfd9ef` | margini fine |
| `--border-strong` | `#bdb2db` | margini de câmp / buton secundar |
| `--text` | `#1c1830` | text de bază |
| `--muted` | `#544d69` | text secundar (an, culoare, indicii) |
| `--accent` | `#5b3cc4` | butoane principale, navigare activă |
| `--accent-strong` | `#432a9b` | apăsat / hover, text pe accent-soft |
| `--accent-soft` | `#ece6fc` | fundal pentru selecție |
| `--accent-ink` | `#ffffff` | text pe accent |
| `--danger` | `#b42318` | ștergere, erori |
| `--danger-soft` | `#fdeae7` | fundal eroare |
| `--warn` | `#8a4b00` | atenționări |
| `--warn-soft` | `#fff2da` | fundal atenționare |
| `--ok` | `#14684a` | confirmări |
| `--ok-soft` | `#e0f4ea` | fundal confirmare |
| `--male` | `#1e62a8` | M (mascul) |
| `--female` | `#b0305a` | F (femelă) |
| `--band-5` | `#0f5741` | valoare 5 (cei mai buni) |
| `--band-5-ink` | `#ffffff` | cifra / textul pe band-5 |
| `--band-4` | `#1f7d5e` | valoare 4 |
| `--band-4-ink` | `#ffffff` | cifra / textul pe band-4 |
| `--band-3` | `#60bc98` | valoare 3 |
| `--band-3-ink` | `#083827` | cifra / textul pe band-3 |
| `--band-2` | `#ade3cc` | valoare 2 |
| `--band-2-ink` | `#0a3d2a` | cifra / textul pe band-2 |
| `--band-1` | `#e2f6ed` | valoare 1 (slabi) |
| `--band-1-ink` | `#1a4a37` | cifra / textul pe band-1 |
| `--band-0` | `#eceaf1` | fără date |
| `--band-0-ink` | `#544d69` | cifra / textul pe band-0 |

**Contrast** (toate trec pragul de 4,5 : 1):

| Pereche | Raport |
|---|---|
| Text pe fundal (`--text` pe `--bg`) | 15,62 : 1 |
| Text pe suprafață (`--text` pe `--surface`) | 17,17 : 1 |
| Text pe suprafață 2 (`--text` pe `--surface-2`) | 14,53 : 1 |
| Text estompat pe suprafață (`--muted` pe `--surface`) | 7,95 : 1 |
| Text estompat pe fundal (`--muted` pe `--bg`) | 7,23 : 1 |
| Text estompat pe suprafață 2 (`--muted` pe `--surface-2`) | 6,72 : 1 |
| Alb pe accent (`--accent-ink` pe `--accent`) | 7,27 : 1 |
| Alb pe accent închis (`--accent-ink` pe `--accent-strong`) | 10,28 : 1 |
| Accent ca text pe suprafață (`--accent` pe `--surface`) | 7,27 : 1 |
| Accent pe accent-soft (`--accent-strong` pe `--accent-soft`) | 8,46 : 1 |
| Pericol pe suprafață (`--danger` pe `--surface`) | 6,57 : 1 |
| Pericol pe danger-soft (`--danger` pe `--danger-soft`) | 5,67 : 1 |
| Atenție pe warn-soft (`--warn` pe `--warn-soft`) | 6,14 : 1 |
| OK pe ok-soft (`--ok` pe `--ok-soft`) | 5,89 : 1 |
| Mascul (text) pe suprafață (`--male` pe `--surface`) | 6,24 : 1 |
| Femelă (text) pe suprafață (`--female` pe `--surface`) | 6,15 : 1 |
| Valoare 5: cerneală pe fond (`--band-5-ink` pe `--band-5`) | 8,54 : 1 |
| Valoare 4: cerneală pe fond (`--band-4-ink` pe `--band-4`) | 5,06 : 1 |
| Valoare 3: cerneală pe fond (`--band-3-ink` pe `--band-3`) | 5,70 : 1 |
| Valoare 2: cerneală pe fond (`--band-2-ink` pe `--band-2`) | 8,54 : 1 |
| Valoare 1: cerneală pe fond (`--band-1-ink` pe `--band-1`) | 8,97 : 1 |
| Valoare 0: cerneală pe fond (`--band-0-ink` pe `--band-0`) | 6,66 : 1 |

**Scara de valoare:** L* = 32 → 47 → 70 → 86 → 95 (de la 5 la 1, crește strict); pași ΔE2000 între trepte vecine: 12,8, 21,0, 13,1, 11,5. Fără date: croma 3,7 (practic gri), ΔE 13,1 față de valoarea 1, plus margine punctată și „–”.

**Distanțe (ΔE2000):** accent ↔ valoarea 5 = 41,0, accent ↔ valoarea 4 = 44,5; mascul ↔ femelă = 38,9, mascul ↔ accent = 18,1, femelă ↔ accent = 29,1; pericol ↔ accent = 41,9.

**De reținut:** violetul e cel mai „la modă”, dar și cel mai puțin legat de lumea porumbarilor; unii crescători în vârstă îl pot găsi prea jucăuș.

## Recomandare: Marină

1. **Se citește cel mai bine afară.** Alb pe bleumarin are 10,95 : 1 (aproape dublu față de pragul AA și mult peste albastrul de acum, 5,91 : 1). Butoanele și navigarea rămân clare și în soare puternic, pe ecran cu luminozitate mică.
2. **Continuitate fără să pară vechi.** Sigla rămâne albastră, doar mai adâncă; oamenii o recunosc. Ce face aspectul de acum să pară „învechit” e combinația albastru mediu + fundal gri-albăstrui (stilul aplicațiilor de acum zece ani); bleumarinul pe hârtie caldă arată actual și liniștit, ca un carnet bine ținut.
3. **Păstrează decizia „valoarea pe verde”.** Verdele scării e la ΔE 35,8–43,3 de butoane: o notă nu se confundă cu un buton. Roșul de pericol e clar separat de acțiuni (ΔE 41,8).
4. **Mascul / femelă:** albastru-petrol și zmeuriu, ΔE 46,3 între ele (cea mai mare distanță dintre cele cinci), plus literele M / F.
5. **Antet plin bleumarin:** dă aplicației o identitate clară și separă vizual „unde sunt” de conținut, fără degradeuri sau efecte.

**A doua alegere:** Grafit, dacă se vrea ceva cu adevărat nou (cel mai „actual” aspect, portocaliul sare în ochi), cu prețul unei sigle portocalii și al unui pericol mai apropiat de butoane.

**Variantă întunecată (opțională, pentru Marină):** fundal `#0f1626`, suprafață `#17203a`, text `#eef1f7`, estompat `#a9b3c9`, accent `#8fb0ff` cu text `#0b1530` pe el, scara de valoare aceeași nuanță de verde, inversată ca luminozitate (5 = `#6fd39a` cu cifră `#062615`). Contraste verificate: text 15,96 și 14,23 : 1, estompat 7,65 : 1, text pe buton 8,44 : 1, valoarea 5 8,84 : 1. Nu e cerută acum; aplicația se folosește mai ales ziua.

## Ce urmează, dacă se alege una

Se înlocuiește blocul `:root` din `web/src/styles.css` cu tokenurile paletei și culoarea cercului din `web/public/icon.svg` (și din manifest, `theme_color`). Pentru Marină, antetul primește `background: var(--accent); color: var(--accent-ink)`.
