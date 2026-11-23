// „Adu porumbeii din Excel”: citirea fișierului ales (.xlsx, .xls, .csv, .txt) în rânduri de text.
// Singurul loc care importă SheetJS; se încarcă doar cu import() din pagina de import.
// Fără text pentru om aici. Analizorul de text (CSV) vine ca parametru, ca să nu importăm alt modul.
import * as XLSX from 'xlsx';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export type Sheet = { name: string; rows: string[][] };

// Scoate rândurile goale de la coadă și coloanele goale de la coadă.
function trim(rows: string[][]): string[][] {
  const text = rows.map((r) => r.map((c) => String(c ?? '')));
  while (text.length && text[text.length - 1].every((c) => c.trim() === '')) text.pop();
  let width = 0;
  for (const r of text) {
    for (let i = r.length - 1; i >= width; i--) {
      if (r[i].trim() !== '') { width = i + 1; break; }
    }
  }
  return text.map((r) => { const o = r.slice(0, width); while (o.length < width) o.push(''); return o; });
}

// Octeții ca text: UTF-8, iar dacă apare � (nu e UTF-8), windows-1250.
function decodeText(data: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8').decode(data);
  return utf8.includes('\uFFFD') ? new TextDecoder('windows-1250').decode(data) : utf8;
}

// SheetJS ține data ca zi la miezul nopții UTC, deci citim componentele UTC.
function zzllaaaa(d: Date): string {
  const p = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCFullYear(), 4)}`;
}

// Datele ies mereu ca zz.ll.aaaa, oricare ar fi formatul din celulă (m/d/yy etc.).
function dateFormat(ws: XLSX.WorkSheet): XLSX.WorkSheet {
  for (const key of Object.keys(ws)) {
    if (key[0] === '!') continue;
    const cell = ws[key] as XLSX.CellObject;
    if (cell.t === 'd') { cell.z = 'dd.mm.yyyy'; cell.w = zzllaaaa(cell.v as Date); }
  }
  return ws;
}

// Rândurile foii, cu rândurile goale păstrate și cu rânduri goale în față cât începe foaia mai jos de rândul 1, ca
// indicele + 1 să fie numărul rândului din Excel. Zona citită se oprește la ultima celulă cu ceva în ea (o zonă
// formatată până la capătul foii, A1:XFD1048576, nu face un milion de rânduri).
function sheetRows(ws: XLSX.WorkSheet): string[][] {
  if (!ws['!ref']) return [];
  const start = XLSX.utils.decode_range(ws['!ref']).s;
  let lastRow = -1;
  let lastCol = -1;
  for (const key of Object.keys(ws)) {
    if (key[0] === '!') continue;
    const cell = ws[key] as XLSX.CellObject;
    if (cell.v == null || String(cell.w ?? cell.v).trim() === '') continue;
    const at = XLSX.utils.decode_cell(key);
    if (at.r > lastRow) lastRow = at.r;
    if (at.c > lastCol) lastCol = at.c;
  }
  if (lastRow < start.r || lastCol < start.c) return [];
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, {
    header: 1, raw: false, defval: '', blankrows: true, dateNF: 'dd.mm.yyyy',
    range: { s: start, e: { r: lastRow, c: lastCol } },
  });
  const above: string[][] = Array.from({ length: start.r }, () => []);
  return trim([...above, ...rows]);
}

export function readWorkbook(data: ArrayBuffer, fileName: string, parseText: (text: string) => string[][]): Sheet[] {
  if (data.byteLength > MAX_FILE_BYTES) throw new Error('fisier_mare');
  try {
    if (/\.(csv|txt)$/i.test(fileName)) {
      return [{ name: fileName, rows: trim(parseText(decodeText(data))) }];
    }
    const wb = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'dd.mm.yyyy' });
    return wb.SheetNames.map((name) => ({ name, rows: sheetRows(dateFormat(wb.Sheets[name])) }));
  } catch {
    throw new Error('fisier_necitit');
  }
}

// Prima foaie cu cel puțin 2 rânduri nevide (antet + date); altfel prima.
export function firstSheetWithData(sheets: Sheet[]): number {
  const i = sheets.findIndex((s) => s.rows.filter((r) => r.some((c) => c.trim() !== '')).length >= 2);
  return i < 0 ? 0 : i;
}
