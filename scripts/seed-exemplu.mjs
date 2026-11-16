/*
 * npm run seed:exemplu — pune în serverul pornit local (implicit http://localhost:3100) un cont de exemplu cu cele două
 * pedigree-uri din docs/exemple/, ca porumbarul, arborele și consangvinizarea să se poată încerca pe date reale.
 * Contul de exemplu (doar pentru dezvoltare): exemplu@porumbar.local / exemplu-porumbar-2026
 */
import { apiCaller } from '../test/helpers/api.js';
import { loadPedigree } from '../test/helpers/load-pedigree.js';
import { PEDIGREE_FOTO } from '../test/fixtures/pedigree-foto.js';
import { PEDIGREE_COMPUCLUB } from '../test/fixtures/pedigree-compuclub.js';

const base = process.argv[2] || 'http://localhost:3100';
const EMAIL = 'exemplu@porumbar.local';
const PASSWORD = 'exemplu-porumbar-2026';
const call = apiCaller(() => ({ base }));

let r = await call('/api/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } });
if (r.status !== 200) r = await call('/api/auth/register', { method: 'POST', body: { email: EMAIL, password: PASSWORD, name: 'Porumbar de exemplu' } });
if (![200, 201].includes(r.status)) throw new Error(`Contul de exemplu: ${r.status} ${JSON.stringify(r.data)}`);
const cookie = r.res.headers.get('set-cookie').split(';')[0];

const EXAMPLES = [
  { pedigree: PEDIGREE_FOTO, extra: { name: 'FUMUR', status: 'concurent', color: 'albastru', lines: ['Van Heteren', 'Comb. Den Haan'] } },
  { pedigree: PEDIGREE_COMPUCLUB, extra: { status: 'tanar', lines: ['Super Velden', 'Power Night', 'Donkere Barcelona'] } },
];

for (const { pedigree, extra } of EXAMPLES) {
  const existing = await call(`/api/pigeons/lookup?ring=${encodeURIComponent(pedigree.ring)}`, { cookie });
  const own = existing.data.matches.find((m) => m.pigeon.kind === 'own');
  if (own) {
    console.log(`Există deja: ${base}/porumbei/${own.pigeon.id}`);
    continue;
  }
  const id = await loadPedigree(call, cookie, pedigree);
  await call(`/api/pigeons/${id}`, { method: 'PATCH', cookie, body: extra });
  console.log(`Gata: ${base}/porumbei/${id}`);
}
console.log(`Intră cu ${EMAIL} / ${PASSWORD}`);
