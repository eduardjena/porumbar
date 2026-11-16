// Pedigree-ul din docs/exemple/pedigree-foto-5-generatii.webp, transcris (5 generații, 31 de căsuțe).
// Partea tăiată din dreapta pozei: textele sunt scurtate la ce se vede.
const n = (ring, text, father = null, mother = null) => ({ ring, text, father, mother });

export const PEDIGREE_FOTO = n(
  '412084/15 RO',
  'FUMUR',
  n(
    '898910/09 RO M',
    'Pestrit. Loc 1 National la 5 Ani General palmares, prezent 5 ani la rand in Expozitia Nationala',
    n(
      '037069/08 RO M',
      'Pestrit. Este Tatal lui 898910/09. Loc 1 National 5 Ani General Palmares',
      n('5218055/02 NL M', 'VAN HETEREN ;Epernay. Loc 1/1401 Houdeng', n('5027686/00 NL M', 'VAN HETEREN UIT KOPPEL 46'), n('2552146/94 NL F', '"Diana" Van Heteren')),
      n('1954746/04 NL F', 'De 746 Comb.Den Haan. Kras Super Reproducatoare', n('2467210/00 NL M', 'Champ Jr. Comb.Den Haan'), n('2354101/02 NL F', 'Zwarte Appel Comb Den Haan')),
    ),
    n(
      '853126/08 RO F',
      'Vanata. Mama lui 898910/09. Loc 1 Nat 5 Ani General Palmares',
      n('030937/07 RO M', 'Fiu 329 VAN HETEREN & G&S Verkerk', n('5125329/01 NL M', 'VAN HETEREN ARLON LOC 5/3407'), n('2050319/04 NL F', 'BELOKI&Kylie G&S Verkerk')),
      n('030962/07 RO F', 'SUPER REPRODUCATOARE', n('000 M', 'Govaerts pedigreu distrus'), n('2195846/05 NL F', 'Latebred BasVK?? Schaerlaeckens darkblue')),
    ),
  ),
  n(
    '1255168/13 RO F',
    'Vanata. Buna Zburatoare ca Pui',
    n(
      '2001542/10 RO M',
      '"542" Pestrit. LOC 1 nat As MARATON Y. LOC 1/970 268 KM',
      n('738262/09 RO M', 'Super Reproducator', n('1441788/05 NL M', 'Schalie boy Reedijk-Jongekrijg'), n('1643587/04 NL F', 'daughter Costa Roording')),
      n('738256/09 RO F', 'Super Reproducatoare. Mama :2001542/10', n('6008107/08 BELG M', 'Super Zburator'), n('1954746/04 NL F', 'De 746 Comb.Den Haan')),
    ),
    n(
      '2267511/12 RO F',
      'Pestrita. Super Zburatoare ca Pui',
      n('709951/08 RO M', 'Pestrit. Super Reproducator', n('0000/07 RO M', 'Vanat. A fost neinelat'), n('1954746/04 NL F', 'De 746 Comb.Den Haan')),
      n('853144/08 RO F', 'Vnata. Buna Reproducatoare', n('030937/07 RO M', 'Fiu 329 VAN HETEREN'), n('030962/07 RO F', 'SUPER REPRODUCATOARE')),
    ),
  ),
);
