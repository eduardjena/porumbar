// Dockerfile: etapa „web” copiază tot ce importă interfața din src/ (altfel build-ul din Docker nu găsește fișierul). Pur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';

const root = resolve(import.meta.dirname, '..');

function files(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

test('Dockerfile: etapa web copiază fiecare src/*.js importat din web/src (și .d.ts-ul lui)', () => {
  const docker = readFileSync(join(root, 'Dockerfile'), 'utf8');
  const webStage = docker.split(/^FROM /m).find((s) => s.includes(' AS web'));
  const copied = new Set();
  for (const m of webStage.matchAll(/^COPY\s+(.+?)\s+\S+\s*$/gm)) for (const f of m[1].split(/\s+/)) copied.add(f);
  const needed = new Set();
  for (const f of files(join(root, 'web', 'src')).filter((p) => /\.ts$/.test(p))) {
    for (const m of readFileSync(f, 'utf8').matchAll(/from\s+'([^']+)'/g)) {
      if (!m[1].startsWith('.')) continue;
      const target = resolve(dirname(f), m[1]);
      if (dirname(target) !== join(root, 'src')) continue;
      needed.add(`src/${basename(target)}`);
      const dts = target.replace(/\.js$/, '.d.ts');
      if (existsSync(dts)) needed.add(`src/${basename(dts)}`);
    }
  }
  assert.ok(needed.size > 0);
  for (const n of needed) assert.ok(copied.has(n), `${n} lipsește din COPY-ul etapei web din Dockerfile`);
});
