/* Limba fișei tipărite și a PDF-ului. Fără importuri, testat cu Node (test/limba-fisei.test.js). */
interface SheetLang {
  code: string;
  public: boolean;
}

/** Limbile fișei: româna, limbile publice și limba contului (una „în probă” doar la cine o are). */
export const sheetLangs = <L extends SheetLang>(langs: L[], mine: string | null | undefined): L[] =>
  langs.filter((l) => l.code === 'ro' || l.public || l.code === mine);

/** Limba aleasă, dacă omul de acum o are (altfel putea rămâne de la limba de dinainte sau de la alt cont); dacă nu, a ecranului. */
export const allowedSheetLang = (chosen: string | null, langs: SheetLang[], mine: string | null | undefined, screen: string): string =>
  chosen && sheetLangs(langs, mine).some((l) => l.code === chosen) ? chosen : screen;
