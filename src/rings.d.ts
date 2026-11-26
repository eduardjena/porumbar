// Tipurile pentru src/rings.js: interfața (web/src/app/shared/ring-preview.ts) folosește aceleași reguli ca serverul.

export interface ParsedRing {
  ok: boolean;
  unringed: boolean;
  raw: string;
  country: string | null;
  year: number | null;
  number: string | null;
  club: string | null;
  sex: 'M' | 'F' | null;
  needsClub?: boolean;
}

export function parseRing(text: string, options?: { now?: Date }): ParsedRing;
export function formatRing(r: Partial<ParsedRing> | null | undefined): string;
export function ringKey(r: Partial<ParsedRing> | null | undefined): string | null;
export function fallbackKey(r: Partial<ParsedRing> | null | undefined): string | null;
export function storedRingKey(r: Partial<ParsedRing> | null | undefined): string | null;
export function japaneseRingText(text: string): string;
export function ringFromColumba(matricol: string | number, an: string | number): ParsedRing;
