// Fișierele interfeței: un an în cache doar cele cu hash de conținut în nume (și fonturile feliate); restul se verifică mereu.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startTestApp } from './helpers/db.js';

let server;
let base;
let app;
before(async () => {
  ({ server, base } = await startTestApp());
  app = await import('../src/app.js');
});
after(() => server?.close());

test('hasContentHash: js, css și fonturi cu hash da; fără hash nu', () => {
  for (const f of [
    'main-K2EEPKBT.js', 'chunk--vVLj0Py.js', 'styles-LYQHNXXM.css', 'C:\\dist\\media\\noto-sans-jp-0-400-normal-N6AQLONF.woff2',
    '/app/media/noto-sans-jp-0-400-normal-3OIE2UE6.woff', 'atkinson-hyperlegible-next-latin-wght-normal-VX3WN42K.woff2',
  ]) assert.equal(app.hasContentHash(f), true, f);
  for (const f of [
    'japoneza.css', 'index.html', 'icon.svg', 'manifest.webmanifest', 'font.woff2', 'noto-sans-jp-japanese-400-normal.woff2',
    'noto-sans-jp-japanese-400-normal.woff', 'atkinson-hyperlegible.woff2', 'a-N6AQLONF.ttf',
  ]) assert.equal(app.hasContentHash(f), false, f);
});

test('antetele trimise: fonturile cu hash un an, japoneza.css verificată mereu', { skip: !fs.existsSync(path.join(import.meta.dirname, '..', 'web', 'dist', 'web', 'browser', 'japoneza.css')) && 'interfața nu e construită' }, async () => {
  const font = fs.readdirSync(path.join(app.WEB_DIR, 'media')).find((f) => /^noto-sans-jp-.*\.woff2$/.test(f));
  const head = async (url) => (await fetch(`${base}${url}`)).headers.get('cache-control');
  assert.equal(await head(`/media/${font}`), 'public, max-age=31536000, immutable');
  assert.equal(await head('/japoneza.css'), 'public, max-age=0');
  assert.equal(await head('/sw.js'), 'no-cache');
});
