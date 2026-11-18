import { badRequest } from './http.js';
import { t, ref } from './i18n.js';

/*
 * Culorile probabile ale puilor unei perechi, după genetica clasică a porumbeilor (moștenire mendeliană):
 *   - culoarea de bază, legată de sex (pe cromozomul Z): roșu cenușiu (BA) > albastru / negru (+) > maro (b);
 *   - diluția, legată de sex, recesivă (argintiu, gălbui, kaki);
 *   - desenul aripii, autozomal: solzat închis (CT) > solzat (C) > cu dungi (+) > fără dungi (c);
 *   - negrul uniform (spread, S), autozomal, dominant; acoperă desenul.
 * Masculul are două copii pe Z, femela una (de la tatăl ei): de aceea rezultatul e separat pe sexe.
 * Simplificări spuse pe ecran: locii se iau independenți (baza și diluția sunt de fapt apropiate pe Z), bălțatul,
 * tărcatul (grizzle), albul și alte gene modificatoare nu intră; ce nu se știe nu se ghicește (locusul e scos).
 */

const BASE = ['BA', '+', 'b']; // ordinea dominanței
const PATTERN = ['CT', 'C', '+', 'c'];
const rank = (order, a) => order.indexOf(a);
const top = (order, a, b) => (rank(order, a) <= rank(order, b) ? a : b);

// Numele culorilor (în i18n/): genetica.baza.<cod>.<0|1 diluat>, genetica.uniform.<cod>.<0|1>, genetica.desen.<cod>,
// genetica.poarta.<desen>. Codurile „+” devin „plus” în chei.
const k = (code) => (code === '+' ? 'plus' : code);

/** Factorii siguri dintr-o culoare din listă (ce nu e sigur rămâne null = nu se știe). */
const FROM_COLOR = {
  albastru: { base: '+', pattern: '+', spread: false, dilute: false },
  solzat: { base: '+', pattern: 'C', spread: false, dilute: false },
  // „Albastru brocat” (utilizatorul, 2026-11-16) = albastru solzat (blue checker), ca „roșu brocat” pe roșu.
  'albastru-brocat': { base: '+', pattern: 'C', spread: false, dilute: false },
  'solzat-inchis': { base: '+', pattern: 'CT', spread: false, dilute: false },
  // „Vânăt” (utilizatorul) = albastru cu dungi, culoarea porumbelului sălbatic.
  vanat: { base: '+', pattern: '+', spread: false, dilute: false },
  // „Gut” (utilizatorul, 2026-11-16): bază albastru-negru cu desen solzat închis (pene cu margini negre), dominant peste dungi.
  gut: { base: '+', pattern: 'CT', spread: false, dilute: false },
  negru: { base: '+', pattern: null, spread: true, dilute: false },
  rosu: { base: 'BA', pattern: null, spread: false, dilute: false },
  'rosu-brocat': { base: 'BA', pattern: 'C', spread: false, dilute: false },
  argintiu: { base: '+', pattern: null, spread: false, dilute: true },
  galbui: { base: 'BA', pattern: null, spread: false, dilute: true },
  // „Dun” (maro-cenușiu) = negru diluat.
  dun: { base: '+', pattern: null, spread: true, dilute: true },
};

export function factorsFromColor(code, sex) {
  const f = FROM_COLOR[code] ?? { base: null, pattern: null, spread: null, dilute: null };
  return { sex, ...f };
}

/**
 * Ce poartă ascuns un porumbel, dedus sigur (sau cu presupunerea obișnuită că părintele e „curat”) din culorile
 * părinților lui: mama îi dă fiului singura ei copie de pe Z; un părinte cu varianta cea mai recesivă o dă sigur.
 */
export function inferHidden(child, father, mother) {
  const out = { ...child };
  if (child.sex === 'M' && child.base) {
    const given = [mother?.base, father?.base === 'b' ? 'b' : null].filter(Boolean);
    const lower = given.filter((a) => rank(BASE, a) > rank(BASE, child.base)).sort((a, b) => rank(BASE, b) - rank(BASE, a))[0];
    if (lower) out.baseHidden = lower;
  }
  if (child.sex === 'M' && child.dilute === false && (mother?.dilute === true || father?.dilute === true)) out.diluteHidden = true;
  if (child.pattern) {
    const lower = [father?.pattern, mother?.pattern].filter((a) => a && rank(PATTERN, a) > rank(PATTERN, child.pattern)).sort((a, b) => rank(PATTERN, b) - rank(PATTERN, a))[0];
    if (lower) out.patternHidden = lower;
  }
  if (child.spread === true && (father?.spread === false || mother?.spread === false)) out.spreadHidden = false;
  return out;
}

/** Factorii trimiși de om (de pe ecran), verificați. */
export function cleanFactors(f, sex) {
  if (!f || typeof f !== 'object') throw badRequest('Lipsesc datele culorii.');
  const one = (v, allowed, label) => {
    if (v === undefined || v === null || v === '') return null;
    if (!allowed.includes(v)) throw badRequest('eroare.valoare_invalida_camp', { camp: ref(label) });
    return v;
  };
  const bool = (v, label) => {
    if (v === undefined || v === null || v === '') return null;
    if (typeof v !== 'boolean') throw badRequest('eroare.da_sau_nu', { camp: ref(label) });
    return v;
  };
  const out = {
    sex,
    base: one(f.base, BASE, 'camp.culoarea_de_baza'),
    pattern: one(f.pattern, PATTERN, 'camp.desenul'),
    spread: bool(f.spread, 'camp.uniform'),
    dilute: bool(f.dilute, 'camp.dilutia'),
    patternHidden: one(f.patternHidden, PATTERN, 'camp.desenul_ascuns'),
    spreadHidden: bool(f.spreadHidden, 'camp.uniform_ascuns'),
  };
  if (sex === 'M') {
    out.baseHidden = one(f.baseHidden, BASE, 'camp.culoarea_ascunsa');
    out.diluteHidden = bool(f.diluteHidden, 'camp.dilutia_ascunsa');
  }
  // Ce e ascuns e mereu mai „slab” decât ce se vede; altfel s-ar vedea el.
  if (out.base && out.baseHidden && rank(BASE, out.baseHidden) < rank(BASE, out.base)) out.baseHidden = null;
  if (out.pattern && out.patternHidden && rank(PATTERN, out.patternHidden) < rank(PATTERN, out.pattern)) out.patternHidden = null;
  if (out.spread === false) out.spreadHidden = null;
  if (out.dilute === true) out.diluteHidden = null;
  return out;
}

// Gameții unui locus: [alelă, probabilitate].
const pairGametes = (a, b) => (a === b ? [[a, 1]] : [[a, 0.5], [b, 0.5]]);

/**
 * Puii perechii: pentru masculi și pentru femele, culorile cu procentul lor (și ce poartă ascuns masculii).
 * `unknown`: ce nu se știe la unul din părinți și deci nu intră în calcul.
 */
export function predictColors(sire, dam, lang = 'ro') {
  const unknown = [];
  const known = (k, label) => {
    const ok = sire[k] != null && dam[k] != null;
    if (!ok) unknown.push(t(lang, label));
    return ok;
  };
  const useBase = known('base', 'camp.culoarea_de_baza');
  const usePattern = known('pattern', 'camp.desenul');
  const useSpread = known('spread', 'camp.uniform');
  const useDilute = known('dilute', 'camp.dilutia');

  // Z (legați de sex): masculul dă una din cele două copii; femela dă Z doar fiilor.
  const sireBase = useBase ? pairGametes(sire.base, sire.baseHidden ?? sire.base) : [[null, 1]];
  const sireDil = useDilute ? pairGametes(sire.dilute, sire.diluteHidden ?? sire.dilute) : [[null, 1]];
  const pat = usePattern ? { s: pairGametes(sire.pattern, sire.patternHidden ?? sire.pattern), d: pairGametes(dam.pattern, dam.patternHidden ?? dam.pattern) } : null;
  const spr = useSpread ? { s: pairGametes(sire.spread, sire.spreadHidden ?? sire.spread), d: pairGametes(dam.spread, dam.spreadHidden ?? dam.spread) } : null;

  const autosomal = [];
  for (const [ps, pps] of pat?.s ?? [[null, 1]]) {
    for (const [pd, ppd] of pat?.d ?? [[null, 1]]) {
      for (const [ss, pss] of spr?.s ?? [[null, 1]]) {
        for (const [sd, psd] of spr?.d ?? [[null, 1]]) {
          autosomal.push({ pattern: usePattern ? [ps, pd] : null, spread: useSpread ? [ss, sd] : null, p: pps * ppd * pss * psd });
        }
      }
    }
  }

  const cocks = new Map();
  const hens = new Map();
  const add = (map, name, carries, p) => {
    const key = `${name}|${carries.join(',')}`;
    const cur = map.get(key) ?? { name, carries, pct: 0 };
    cur.pct += p * 100;
    map.set(key, cur);
  };

  for (const [zb, pb] of sireBase) {
    for (const [zd, pd] of sireDil) {
      for (const a of autosomal) {
        const p = pb * pd * a.p;
        const patternVis = a.pattern ? top(PATTERN, a.pattern[0], a.pattern[1]) : null;
        const patternLow = a.pattern ? (a.pattern[0] === patternVis ? a.pattern[1] : a.pattern[0]) : null;
        const spreadVis = a.spread ? a.spread[0] || a.spread[1] : false;
        const autoCarries = patternLow && patternLow !== patternVis && !spreadVis ? [t(lang, `genetica.poarta.${k(patternLow)}`)] : [];
        // Fiul: Z de la tată + Z-ul mamei.
        const sonBase = useBase ? top(BASE, zb, dam.base) : null;
        const sonBaseLow = useBase ? (zb === sonBase ? dam.base : zb) : null;
        const sonDil = useDilute ? zd && dam.dilute : false;
        const sonCarries = [
          ...(useBase && sonBaseLow !== sonBase ? [t(lang, `genetica.poarta_baza.${k(sonBaseLow)}`)] : []),
          ...(useDilute && !sonDil && (zd || dam.dilute) ? [t(lang, 'genetica.poarta.dilutie')] : []),
          ...autoCarries,
        ];
        add(cocks, nameOf(lang, sonBase, patternVis, spreadVis, sonDil), sonCarries, p);
        // Fiica: doar Z-ul tatălui.
        add(hens, nameOf(lang, useBase ? zb : null, patternVis, spreadVis, useDilute ? zd : false), autoCarries, p);
      }
    }
  }
  const list = (m) => [...m.values()].map((x) => ({ ...x, pct: Math.round(x.pct * 10) / 10 })).sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name));
  return { cocks: list(cocks), hens: list(hens), unknown };
}

function nameOf(lang, base, pattern, spread, dilute) {
  const d = dilute ? 1 : 0;
  if (spread && base) return t(lang, `genetica.uniform.${k(base)}.${d}`);
  if (spread) return t(lang, dilute ? 'genetica.uniform_diluat' : 'genetica.uniform_fara_baza');
  const b = base ? t(lang, `genetica.baza.${k(base)}.${d}`) : null;
  const pt = pattern ? t(lang, `genetica.desen.${k(pattern)}`) : null;
  if (b && pt) return t(lang, 'genetica.baza_si_desen', { baza: b, desen: pt });
  if (b) return b;
  if (pt) return t(lang, dilute ? 'genetica.doar_desen_diluat' : 'genetica.doar_desen', { desen: pt[0].toUpperCase() + pt.slice(1) });
  return t(lang, dilute ? 'genetica.diluat' : 'genetica.necunoscut');
}
