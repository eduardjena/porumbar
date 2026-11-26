/*
 * Ce fețe de font (@font-face) folosește o foaie, după literele de pe ea. Fără importuri, testat cu Node
 * (test/font-japonez.test.js). Fontul japonez are peste 200 de felii: în PDF intră doar cele de pe foaie.
 */
export interface FontFaceInfo {
  family: string;
  /** Greutatea (la fonturile variabile, de la–până la). */
  weight: [number, number];
  /** Literele feței (unicode-range); null = toate. */
  range: [number, number][] | null;
  url: string;
  css: string;
}

/** Regula @font-face, citită din textul ei; null dacă nu are un fișier. */
export function parseFace(css: string): FontFaceInfo | null {
  const value = (name: string) => new RegExp(`[{;\\s]${name}:\\s*([^;}]+)`).exec(css)?.[1].trim();
  const urls = [...(value('src') ?? '').matchAll(/url\((['"]?)(.+?)\1\)/g)].map((m) => m[2]);
  const family = value('font-family')?.replace(/['"]/g, '');
  if (!urls.length || !family) return null;
  const weights = (value('font-weight') ?? '400').replace('normal', '400').replace('bold', '700').split(/\s+/).map(Number);
  return {
    family,
    weight: [weights[0], weights[1] ?? weights[0]],
    range: value('unicode-range')?.split(',').map(parseRange) ?? null,
    url: urls.find((u) => u.includes('.woff2')) ?? urls[0],
    css,
  };
}

/** „U+3041-3043”, „U+65E5” sau „U+4??”. */
function parseRange(text: string): [number, number] {
  const [from, to] = text.trim().slice(2).split('-');
  return [parseInt(from.replace(/\?/g, '0'), 16), parseInt((to ?? from).replace(/\?/g, 'f'), 16)];
}

/** La fețele cu o singură greutate avem doar 400 și 700: până la 500 se scrie cu prima, mai gros cu a doua (ca browserul). */
const atWeight = (f: FontFaceInfo, w: number) => (f.weight[0] === f.weight[1] ? f.weight[0] >= 600 === w > 500 : true);

/** Fețele familiilor folosite care au litere de pe foaie. `texts`: greutatea → literele scrise cu ea. */
export function facesFor(faces: FontFaceInfo[], families: Set<string>, texts: Map<number, Set<number>>): FontFaceInfo[] {
  const covers = (f: FontFaceInfo, chars: Set<number>) =>
    !f.range || [...chars].some((c) => f.range!.some(([a, b]) => c >= a && c <= b));
  return faces
    .filter((f) => families.has(f.family) && [...texts].some(([w, chars]) => atWeight(f, w) && covers(f, chars)))
    .filter((f, i, all) => all.findIndex((x) => x.url === f.url) === i);
}

/** CSS-ul fețelor aduse; undefined dacă n-a venit niciuna (html-to-image le caută atunci pe ale lui, nu rămâne fără fonturi). */
export const joinFontCss = (parts: string[]): string | undefined => parts.join('\n').trim() || undefined;
