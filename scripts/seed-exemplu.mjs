/*
 * npm run seed:exemplu — pune în serverul pornit local (implicit http://localhost:3100) un cont de exemplu cu pedigree-ul
 * din docs/exemple/pedigree-foto-5-generatii.webp, ca arborele și consangvinizarea să se poată vedea pe ecran.
 * Contul de exemplu (doar pentru dezvoltare): exemplu@porumbar.local / exemplu-porumbar-2026
 */
import { apiCaller } from '../test/helpers/api.js';
import { loadPedigree } from '../test/helpers/load-pedigree.js';
import { PEDIGREE_FOTO } from '../test/fixtures/pedigree-foto.js';

const base = process.argv[2] || 'http://localhost:3100';
const EMAIL = 'exemplu@porumbar.local';
const PASSWORD = 'exemplu-porumbar-2026';
const call = apiCaller(() => ({ base }));

let r = await call('/api/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } });
if (r.status !== 200) r = await call('/api/auth/register', { method: 'POST', body: { email: EMAIL, password: PASSWORD, name: 'Porumbar de exemplu' } });
if (![200, 201].includes(r.status)) throw new Error(`Contul de exemplu: ${r.status} ${JSON.stringify(r.data)}`);
const cookie = r.res.headers.get('set-cookie').split(';')[0];

const existing = await call(`/api/pigeons/lookup?ring=${encodeURIComponent(PEDIGREE_FOTO.ring)}`, { cookie });
if (existing.data.matches.length) {
  console.log(`Exemplul există deja: ${base}/porumbei/${existing.data.matches[0].pigeon.id}`);
} else {
  const id = await loadPedigree(call, cookie, PEDIGREE_FOTO);
  await call(`/api/pigeons/${id}`, { method: 'PATCH', cookie, body: { name: 'FUMUR', status: 'concurent', color: 'albastru', lines: ['Van Heteren', 'Comb. Den Haan'] } });
  console.log(`Gata: ${base}/porumbei/${id}`);
}
console.log(`Intră cu ${EMAIL} / ${PASSWORD}`);
