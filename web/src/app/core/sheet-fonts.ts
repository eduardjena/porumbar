import { FontFaceInfo, facesFor, parseFace } from './font-faces';

/*
 * Fonturile foii pentru PDF. Foaia se desenează și imediat se face poză: feliile fontului japonez trebuie cerute și
 * așteptate (document.fonts.ready singur se poate termina înainte să fie cerute), iar în poză se pun doar ele, căci
 * html-to-image ar încorpora toate feliile familiei.
 */
export const JAPANESE_FONT = 'Noto Sans JP';

interface SheetText {
  families: Set<string>;
  /** Greutatea → literele scrise cu ea. */
  texts: Map<number, Set<number>>;
}

function readText(sheet: HTMLElement): SheetText {
  const families = new Set<string>();
  const texts = new Map<number, Set<number>>();
  const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.nodeValue?.trim();
    if (!text || !n.parentElement) continue;
    const style = getComputedStyle(n.parentElement);
    for (const f of style.fontFamily.split(',')) families.add(f.trim().replace(/["']/g, ''));
    const weight = Number(style.fontWeight) || 400;
    const chars = texts.get(weight) ?? texts.set(weight, new Set()).get(weight)!;
    for (const c of text + text.toUpperCase()) chars.add(c.codePointAt(0)!);
  }
  return { families, texts };
}

/** Cere și așteaptă literele foii, în toate fonturile ei (un font care nu vine nu oprește PDF-ul). */
export async function loadSheetFonts(sheet: HTMLElement): Promise<void> {
  const { families, texts } = readText(sheet);
  const wanted = [...texts].flatMap(([weight, chars]) => {
    const text = String.fromCodePoint(...chars);
    return [...families].map((f) => document.fonts.load(`${weight} 16px "${f}"`, text).catch(() => []));
  });
  await Promise.all(wanted);
  await document.fonts.ready;
}

/** CSS-ul fonturilor pentru html-to-image; undefined = foaia nu are fontul japonez, deci ca până acum (toate fețele). */
export async function sheetFontCss(sheet: HTMLElement): Promise<string | undefined> {
  const { families, texts } = readText(sheet);
  if (!families.has(JAPANESE_FONT)) return undefined;
  const faces: FontFaceInfo[] = [];
  for (const css of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(css.cssRules)) {
        if (!(rule instanceof CSSFontFaceRule)) continue;
        const face = parseFace(rule.cssText);
        if (face) faces.push({ ...face, url: new URL(face.url, css.href ?? document.baseURI).href });
      }
    } catch {
      /* o foaie de stil care nu se poate citi (de ex. a unei extensii) */
    }
  }
  return (await Promise.all(facesFor(faces, families, texts).map(embed))).join('\n');
}

async function embed(face: FontFaceInfo): Promise<string> {
  try {
    const r = await fetch(face.url);
    if (!r.ok) return '';
    const data = await dataUrl(await r.blob());
    return face.css.replace(/([{;\s])src:[^;}]+/, (_, before: string) => `${before}src: url("${data}")`);
  } catch {
    return '';
  }
}

const dataUrl = (blob: Blob) =>
  new Promise<string>((done, fail) => {
    const reader = new FileReader();
    reader.onload = () => done(String(reader.result));
    reader.onerror = () => fail(reader.error);
    reader.readAsDataURL(blob);
  });
