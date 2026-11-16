// Pedigree-ul din docs/exemple/pedigree-compuclub.webp, transcris (4 generații, 15 căsuțe).
// Numele crescătorilor români de pe original sunt scoase (date personale); rămân porecle, culori și rezultate.
const n = (ring, name, color, text, father = null, mother = null) => ({ ring, name, color, text, father, mother });

export const PEDIGREE_COMPUCLUB = n(
  'RO-26-800546 L', 'DE 546', 'Gut', '',
  n(
    'RO-24-199163 L', 'DE 163', 'Gut', 'Accidentat. Nu a fost concurat',
    n(
      'RO-18-1020679 L', 'Super Velden Junior', 'Albastru', '1 Nat.MaratonG.Prix. 1 Madona 4.345 p. 17 Birzai 13.443 p',
      n('NL-11-1724956 L', 'Super Velden', 'Albastru brocat', 'Chr vd Velden. Super reproducator'),
      n('RO-14-556005 T', 'DE 005', 'Albastra p.a', 'Super reproducatoare. 2 Nat.Palmares As'),
    ),
    n(
      'RO-17-159927 T', 'DE 927', 'Guta', 'Matca. Super reproducatoare. 1 Birzai Palm.3 ani. 1 Vilnius 10.591 p',
      n('RO-15-306067 L', '1 MADONA', 'Solzat p.a', 'Matca. Superreproducator'),
      n('RO-14-556180 T', 'DE 180', 'Guta', 'Matca. Semisora cu "Tripla Campioana"'),
    ),
  ),
  n(
    'RO-24-671653 T', 'DE 653', 'Albastra', '217 Riga 2.772 p. 2544 Madona 18.630 p',
    n(
      'NL-11-4401218 L', 'DE 218', 'Albastru', 'First Prize Pigeons. Consangvin "Donkere Barcelona". Super reproducator',
      n('NL-03-1395255 L', 'Fiu DE PIJL 823', 'Albastra', 'First Prize pigeons. Tatal lui "DE Raket"'),
      n('NL-05-1592769 T', 'Incest Donkere Barce', 'Solzat', 'First Prize Pigeons. Incest "Donkere Barcelona" 1 Nat.As'),
    ),
    n(
      'RO-23-2044914 T', 'Fica Power 914', 'Albastra p.a', 'Consangvina "Power Night". 1 World Best Pigeons Super Maraton 2021',
      n('RO-18-1020652 L', 'Power Night', 'Albastru p.a', '1 World Best Pigeons Super Maraton 0,2p'),
      n('RO-21-207671 T', 'Nepoata Power 671', 'Albastra p.a', '1 Birzai Palm."23-24. 2 Nat.Maraton Extrem'),
    ),
  ),
);
