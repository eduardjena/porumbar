/*
 * npm run seed:exemplu — pune în serverul pornit local (implicit http://localhost:3100) un cont de exemplu cu cele două
 * pedigree-uri din docs/exemple/, ca porumbarul, arborele și consangvinizarea să se poată încerca pe date reale.
 * Contul de exemplu (doar pentru dezvoltare): exemplu@porumbar.local / exemplu-porumbar-2026
 * Adminul (consola vânzătorului) se face la pornirea serverului din .env: ADMIN_EMAIL=admin@porumbar.local și
 * ADMIN_PASSWORD=admin-porumbar-2026 (doar pentru dezvoltare).
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
const exampleId = r.data.account.id;

// Adminul (vânzătorul): activează contul de exemplu și îi dă credit pentru citiri, ca la un crescător care a plătit.
const ADMIN_EMAIL = 'admin@porumbar.local';
const ADMIN_PASSWORD = 'admin-porumbar-2026';
const ra = await call('/api/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
if (ra.status !== 200 || !ra.data.account.isAdmin) {
  console.log('Atenție: pune ADMIN_EMAIL=admin@porumbar.local și ADMIN_PASSWORD=admin-porumbar-2026 în .env, repornește serverul, apoi rulează din nou.');
} else {
  const admin = ra.res.headers.get('set-cookie').split(';')[0];
  if (!r.data.account.subscription?.active) {
    await call(`/api/admin/accounts/${exampleId}/subscription`, { method: 'POST', cookie: admin, body: { start: new Date().toISOString().slice(0, 10), note: 'cont de exemplu' } });
  }
  if (!(r.data.account.aiCredit > 0)) {
    await call(`/api/admin/accounts/${exampleId}/credit`, { method: 'POST', cookie: admin, body: { amount: 5, note: 'cont de exemplu' } });
  }
}

const EXAMPLES = [
  {
    pedigree: PEDIGREE_FOTO,
    extra: {
      name: 'FUMUR', status: 'reproducator', color: 'albastru', lines: ['Van Heteren', 'Comb. Den Haan'],
      evaluation: { scores: { echilibru: 5, musculatura: 4, aripa: 5, penaj: 4, ochi: 4 }, calitati: 'Exemplu: echilibru foarte bun' },
    },
  },
  {
    pedigree: PEDIGREE_COMPUCLUB,
    extra: {
      status: 'tanar', lines: ['Super Velden', 'Power Night', 'Donkere Barcelona'],
      evaluation: { scores: { echilibru: 3, musculatura: 3, aripa: 4 } },
    },
  },
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
// Liniile fondatorilor din pedigree-ul foto (din numele crescătorilor de pe original), pentru vederea „Linii de sânge”.
const FOUNDER_LINES = {
  'NL-00-5027686': 'Van Heteren', '2552146/94 NL F': 'Van Heteren', 'NL-01-5125329': 'Van Heteren', 'NL-02-5218055': 'Van Heteren',
  'NL-00-2467210': 'Den Haan', 'NL-02-2354101': 'Den Haan', 'NL-04-1954746': 'Den Haan',
  'NL-04-2050319': 'Verkerk', 'NL-05-2195846': 'Schaerlaeckens', 'NL-05-1441788': 'Reedijk', 'NL-04-1643587': 'Roording',
  '6008107/08 BELG M': 'Belgia',
};
for (const [ring, line] of Object.entries(FOUNDER_LINES)) {
  const found = (await call(`/api/pigeons/lookup?ring=${encodeURIComponent(ring)}`, { cookie })).data.matches[0];
  if (found && !found.pigeon.lines?.length) await call(`/api/pigeons/${found.pigeon.id}`, { method: 'PATCH', cookie, body: { lines: [line] } });
}
const govaerts = (await call('/api/pigeons?q=govaerts&kind=external', { cookie })).data.pigeons[0];
if (govaerts) await call(`/api/pigeons/${govaerts.id}`, { method: 'PATCH', cookie, body: { lines: ['Govaerts'] } });

// 40 de pui inventați (date de test), ca grila și rețeaua să arate ca un porumbar adevărat: părinți din exemple,
// note diferite, unii marcați reproducători.
const own = async (ring) => (await call(`/api/pigeons/lookup?ring=${encodeURIComponent(ring)}`, { cookie })).data.matches.find((m) => m.pigeon.kind === 'own')?.pigeon;
const fumur = await own(PEDIGREE_FOTO.ring);
const de546 = await own(PEDIGREE_COMPUCLUB.ring);
const dam = (await call(`/api/pigeons/lookup?ring=${encodeURIComponent('RO-24-671653')}`, { cookie })).data.matches[0]?.pigeon;
let rnd = 7;
const next = () => (rnd = (rnd * 9301 + 49297) % 233280) / 233280;
let added = 0;
for (let i = 1; i <= 40; i++) {
  const ring = `RO-25-${900000 + i}`;
  if (await own(ring)) continue;
  const scores = next() < 0.85 ? { echilibru: 1 + Math.floor(next() * 5), musculatura: 1 + Math.floor(next() * 5), aripa: 1 + Math.floor(next() * 5) } : {};
  const body = { kind: 'own', ring, sex: next() < 0.5 ? 'M' : 'F', name: `Pui ${i}`, status: next() < 0.15 ? 'reproducator' : 'tanar', evaluation: { scores } };
  const r = await call('/api/pigeons', { method: 'POST', cookie, body });
  if (r.status !== 201) throw new Error(`${ring}: ${r.status} ${JSON.stringify(r.data)}`);
  const father = i % 2 ? fumur : de546;
  await call(`/api/pigeons/${r.data.pigeon.id}/parents`, { method: 'PUT', cookie, body: { fatherId: father?.id ?? null, motherId: i % 3 === 0 ? (dam?.id ?? null) : null } });
  added++;
}
if (added) console.log(`Am adăugat ${added} pui de test.`);
console.log(`Intră cu ${EMAIL} / ${PASSWORD}; consola vânzătorului: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
