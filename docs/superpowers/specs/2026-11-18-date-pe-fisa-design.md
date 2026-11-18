# Datele de pe fișă le pune vânzătorul

Aprobat de Eduard pe 2026-11-18 (semnalat de Alex).

## De ce
Numele de jos din stânga fișei îl scria omul în Cont, cum voia. Cine avea programul putea face fișe pe numele
altora, care nu mai cumpărau programul. Acum numele de pe fișă, telefonul și adresa le scrie doar vânzătorul.

## Ce face
- **Consola vânzătorului**, la fiecare crescător, are secțiunea „Date pe fișă”:
  - tipul: persoană fizică (nume, CNP) sau firmă (denumire, CUI, Nr. Reg. Com.);
  - numele de pe fișă, telefonul, adresa.

  Aceleași câmpuri apar și la „Crescător nou”. CNP-ul și datele firmei se văd doar în consolă: nu apar pe fișă, la link,
  în `/api/auth/me` sau în exportul pedigree-ului.
- **Abonamentul nu se activează** fără numele de pe fișă (serverul refuză).
- **În Cont**, numele, numele de pe fișă, telefonul și adresa se văd, dar nu se pot schimba. Emailul era deja fix.
  `PATCH /api/auth/me` refuză aceste câmpuri pentru crescători (adminul își poate schimba încă datele lui).
  Omul alege doar ce apare pe lângă nume: telefonul, adresa, emailul.
- **Pe fișă**, numele de jos e doar numele de pe fișă pus de vânzător, fără să mai cadă pe numele contului. Foaia
  tipărită și PDF-ul trimis folosesc datele de la server, nu pe cele din browser.
- **Conturile care au deja abonament** primesc ca nume de pe fișă ce aveau până acum (numele de pe pedigree sau,
  dacă era gol, numele contului). Conturile neactivate rămân fără nume, iar vânzătorul îl pune la activare.

## Hotărârile mele (de verificat)
- **Bife separate pentru foaie și pentru link.** Până acum foaia tipărită arăta mereu tot, iar linkul doar ce era
  bifat (implicit nimic). Cu o singură bifă comună, foaia oamenilor ar pierde brusc telefonul și adresa, sau linkurile
  lor publice ar începe să arate telefonul. Așa că sunt două coloane de bife:
  - „Pe fișă (și PDF)”, implicit totul bifat;
  - „La link și codul QR”, implicit nimic, ca până acum.
- **CNP-ul și datele firmei sunt opționale.** E obligatoriu doar numele de pe fișă, pentru activare.
- **Verificări:**
  - CNP-ul: 13 cifre, cu cifra de control;
  - CUI-ul: 2–10 cifre, cu „RO” în față opțional;
  - Nr. Reg. Com. rămâne text liber.
- **„Numele” contului**, cel de la înregistrare, îl corectează tot vânzătorul.

## Ce nu putem opri
Un PDF deja scos se poate modifica într-un program de editat PDF-uri. Închidem doar calea din aplicație.
