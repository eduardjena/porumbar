/*
 * Iconițele PNG din siglă (telefoanele nu folosesc SVG la notificări și la ecranul principal al iPhone-ului):
 *   node docs/design/sigla/fa-png.mjs
 * Le desenează Microsoft Edge (fără ecran) din SVG-urile din web/public și docs/design/sigla.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));
if (!EDGE) throw new Error('Nu găsesc Microsoft Edge.');

const JOBS = [
  // [SVG sursă, PNG, latura, fundal transparent?]
  ['web/public/icon-maskable.svg', 'web/public/icon-192.png', 192, false],
  ['web/public/icon-maskable.svg', 'web/public/icon-512.png', 512, false],
  ['web/public/icon-maskable.svg', 'web/public/apple-touch-icon.png', 180, false],
  // Semnul mic din bara telefonului: doar silueta albă (Android folosește doar forma, nu culorile).
  ['docs/design/sigla/badge.svg', 'web/public/badge-96.png', 96, true],
];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sigla-png-'));
for (const [src, out, size, transparent] of JOBS) {
  const html = path.join(tmp, 'p.html');
  const svg = fs.readFileSync(path.join(ROOT, src), 'utf8');
  fs.writeFileSync(html, `<!doctype html><html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  const args = ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--window-size=${size},${size}`, `--screenshot=${path.join(ROOT, out)}`];
  if (transparent) args.push('--default-background-color=00000000');
  execFileSync(EDGE, [...args, 'file:///' + html.split(path.sep).join('/')], { stdio: 'ignore' });
  console.log(out, fs.statSync(path.join(ROOT, out)).size, 'octeți');
}
fs.rmSync(tmp, { recursive: true, force: true });
