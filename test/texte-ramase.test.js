import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/*
 * Paza împotriva textelor uitate: orice text pe care îl vede omul stă în i18n/<limba>.json. Testul caută în cod rânduri
 * cu litere românești (ă, â, î, ș, ț) în afara comentariilor. Prinde doar textele cu diacritice, deci nu tot; restul se
 * vede pe ecran, în maghiară.
 */
const ROOT = path.join(import.meta.dirname, '..');

// Fișiere care au voie să aibă text românesc, cu motivul. Un singur rând se poate lăsa în română cu semnul
// `// i18n: ro` la capătul lui (de ex. jurnalul serverului, notele din consola vânzătorului).
const EXCEPTII = {
  'src/db.js': 'SQL-ul migrărilor și comentariile',
  'src/catalog.js': 'sinonimele culorilor, pentru citirea pedigree-urilor scrise în română',
  'src/pedigree-reader.js': 'promptul pentru citirea din poză (scris în română, pentru model)',
  'src/boot.js': 'jurnalul serverului',
  'src/config.js': 'jurnalul serverului',
  'web/src/app/pages/admin/consola.ts': 'consola vânzătorului rămâne în română',
  'web/src/app/pages/admin/identity-fields.ts': 'consola vânzătorului rămâne în română',
};

// Ecranele încă nemutate în dicționar; fiecare pas al planului le scoate pe ale lui, până lista rămâne goală.
const DE_MUTAT = new Set([
  'web/src/app/app.routes.ts',
  'web/src/app/app.ts',
  'web/src/app/core/api.ts',
  'web/src/app/core/catalog.ts',
  'web/src/app/core/confirm.ts',
  'web/src/app/core/share-pdf.ts',
  'web/src/app/pages/auth/cont-nou.ts',
  'web/src/app/pages/auth/cont.ts',
  'web/src/app/pages/auth/intra.ts',
  'web/src/app/pages/auth/parola-noua.ts',
  'web/src/app/pages/auth/parola-uitata.ts',
  'web/src/app/pages/panou/panou-bar.ts',
  'web/src/app/pages/panou/panou-view.ts',
  'web/src/app/pages/panou/panou.ts',
  'web/src/app/pages/pedigree-hartie/cititor-poza.ts',
  'web/src/app/pages/pedigree-hartie/pedigree-hartie.ts',
  'web/src/app/pages/perechi/culori-pui.ts',
  'web/src/app/pages/perechi/pereche.ts',
  'web/src/app/pages/perechi/perechi.ts',
  'web/src/app/pages/porumbar/porumbar.ts',
  'web/src/app/pages/porumbel-form/porumbel-form.ts',
  'web/src/app/pages/porumbel/arbore.ts',
  'web/src/app/pages/porumbel/partajare.ts',
  'web/src/app/pages/porumbel/porumbel.ts',
  'web/src/app/pages/porumbel/rezultate.ts',
  'web/src/app/pages/porumbel/tiparire.ts',
  'web/src/app/pages/porumbel/vanzare.ts',
  'web/src/app/pages/public/public-pedigree.ts',
  'web/src/app/pages/retea/arbore-data.ts',
  'web/src/app/pages/retea/arbore-panou.ts',
  'web/src/app/pages/retea/arbore.ts',
  'web/src/app/pages/retea/retea.ts',
  'web/src/app/pages/retea/vedere-carduri.ts',
  'web/src/app/pages/retea/vedere-evantai.ts',
  'web/src/app/pages/retea/vedere-sange.ts',
  'web/src/app/pages/scaneaza/scaneaza.ts',
  'web/src/app/pages/vanzari/vanzari.ts',
  'web/src/app/shared/breadcrumbs.ts',
  'web/src/app/shared/parents-editor.ts',
  'web/src/app/shared/password-field.ts',
  'web/src/app/shared/pedigree-page.ts',
  'web/src/app/shared/pedigree-sheet.ts',
  'web/src/app/shared/pigeon-chip.ts',
  'web/src/app/shared/pigeon-picker.ts',
  'web/src/app/shared/ring-input.ts',
  'web/src/app/shared/share-button.ts',
  'web/src/app/shared/view-toggle.ts',
]);

const RO = /[ăâîșțĂÂÎȘȚ]/;

function files(dir, ext) {
  return fs.readdirSync(path.join(ROOT, dir), { recursive: true })
    .filter((f) => f.endsWith(ext) && !f.endsWith(`.spec${ext}`))
    .map((f) => `${dir}/${f.replaceAll('\\', '/')}`);
}

/** Rândurile cu text românesc, fără comentarii (`//…`, `/* … *\/`, `<!-- … -->`). */
export function romanianLines(source) {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks
    .split('\n')
    .map((line, i) => ({ n: i + 1, text: line.includes('// i18n: ro') ? '' : line.replace(/(^|\s)\/\/.*$/, '').trim() }))
    .filter((l) => RO.test(l.text));
}

test('niciun text românesc rămas în cod în afara dicționarelor', () => {
  const found = [];
  const emptied = [];
  for (const f of [...files('src', '.js'), ...files('web/src/app', '.ts')]) {
    const lines = romanianLines(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    if (DE_MUTAT.has(f)) {
      if (!lines.length) emptied.push(f);
      continue;
    }
    if (EXCEPTII[f]) continue;
    for (const l of lines) found.push(`${f}:${l.n}: ${l.text.slice(0, 100)}`);
  }
  assert.deepEqual(found, [], `Texte de mutat în i18n/:\n${found.join('\n')}`);
  assert.deepEqual(emptied, [], 'Fișiere mutate deja: scoate-le din DE_MUTAT');
});
