import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { newAccount, today } from './helpers/accounts.js';

let server;
let base;
const call = apiCaller(() => ({ base }));
before(async () => {
  ({ server, base } = await startTestApp());
});
after(() => server?.close());

const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
let seq = 0;
async function pigeon(cookie, status, kind = 'own') {
  seq += 1;
  const ring = kind === 'own' ? `RO-25-${String(700000 + seq)}` : `RO-20-${String(800000 + seq)}`;
  const r = await call('/api/pigeons', { method: 'POST', cookie, body: { kind, ring, status } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data.pigeon;
}
const journal = async (cookie, p) => (await call(`/api/pigeons/${p.id}/journal`, { cookie })).data.entries;
const body = (o = {}) => ({ name: 'tricomonaza', kind: 'tratament', method: 'apa', startDate: today(), days: 5, target: 'toti', repeat: null, ...o });
const post = (cookie, o) => call('/api/treatments', { method: 'POST', cookie, body: body(o) });

test('creează pentru tot porumbarul, azi', async () => {
  const a = await newAccount(call, 'A');
  const p1 = await pigeon(a, 'concurent');
  const p2 = await pigeon(a, 'tanar');
  const p3 = await pigeon(a, 'vandut');
  const r = await post(a, { note: 'cu lămâie' });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const t = r.data.treatment;
  assert.equal(t.count, 2);
  assert.equal(t.status, 'in_curs');
  assert.equal(t.day, 1);
  assert.equal(t.endDate, addDays(today(), 4));
  assert.equal(t.label, 'Tricomonază (gălbenele)');
  assert.equal(t.repeat, null);
  for (const p of [p1, p2]) {
    const e = (await journal(a, p)).filter((x) => x.type === 'tratament');
    assert.equal(e.length, 1);
    assert.equal(e[0].treatmentId, t.id);
    assert.equal(e[0].date, today());
    assert.match(e[0].text, /^Tricomonază \(gălbenele\) \(În apă, \d\d\.\d\d\.\d{4} – \d\d\.\d\d\.\d{4}\) — cu lămâie$/);
  }
  assert.equal((await journal(a, p3)).length, 0);
  const one = await call(`/api/treatments/${t.id}`, { cookie: a });
  assert.equal(one.status, 200);
  assert.deepEqual(one.data.pigeons.map((p) => p.id).sort(), [p1.id, p2.id].sort());
  assert.equal((await call(`/api/treatments/count?target=toti`, { cookie: a })).data.count, 2);
  assert.equal((await call(`/api/treatments/count?target=tineret`, { cookie: a })).data.count, 1);
  const list = await call('/api/treatments?stare=in_curs', { cookie: a });
  assert.deepEqual(list.data.treatments.map((x) => x.id), [t.id]);
});

test('o zi: perioada apare o singură dată; vaccin; nume liber', async () => {
  const a = await newAccount(call, 'A');
  const p = await pigeon(a, 'concurent');
  const r = await post(a, { name: 'Vitamine', kind: 'vaccin', method: 'injectie', days: 1 });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.treatment.label, 'Vitamine');
  const e = (await journal(a, p))[0];
  assert.equal(e.type, 'vaccin');
  assert.match(e.text, /^Vitamine \(Injecție, \d\d\.\d\d\.\d{4}\)$/);
});

test('grupul se fixează la început, nu la salvare', async () => {
  const { freezeTreatment } = await import('../src/treatments.js');
  const { one, all } = await import('../src/db.js');
  const a = await newAccount(call, 'A');
  const p1 = await pigeon(a, 'concurent');
  await pigeon(a, 'tanar');
  const r = await post(a, { target: 'concurenti', startDate: addDays(today(), 2) });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const t = r.data.treatment;
  assert.equal(t.status, 'urmeaza');
  assert.equal(t.count, 1);
  await pigeon(a, 'concurent');
  assert.equal((await call(`/api/treatments/${t.id}`, { cookie: a })).data.treatment.count, 2, 'încă neînghețat');
  assert.equal((await journal(a, p1)).length, 0);
  // Simulăm ziua de început.
  await freezeTreatment(await one('SELECT * FROM treatments WHERE id = ?', t.id), 'ro', { today: addDays(today(), 2) });
  assert.equal((await all('SELECT * FROM treatment_pigeons WHERE treatment_id = ?', t.id)).length, 2);
  assert.equal((await journal(a, p1)).length, 1);
  await call(`/api/pigeons/${p1.id}`, { method: 'PATCH', cookie: a, body: { status: 'vandut' } });
  const after = (await call(`/api/treatments/${t.id}`, { cookie: a })).data;
  assert.equal(after.treatment.count, 2, 'vândut după fixare rămâne în tratament');
  assert.equal((await journal(a, p1)).length, 1);
});

test('alege eu: doar porumbei proprii, vii', async () => {
  const a = await newAccount(call, 'A');
  const b = await newAccount(call, 'B');
  const ok = await pigeon(a, 'concurent');
  const strain = await pigeon(b, 'concurent');
  const dead = await pigeon(a, 'mort');
  const ext = await pigeon(a, null, 'external');
  for (const ids of [[strain.id], [dead.id], [ext.id], [ok.id, strain.id], [999999999]]) {
    const r = await post(a, { target: 'alesi', pigeonIds: ids });
    assert.equal(r.status, 400, JSON.stringify([ids, r.data]));
  }
  const good = await post(a, { target: 'alesi', pigeonIds: [ok.id, ok.id] });
  assert.equal(good.status, 201, JSON.stringify(good.data));
  assert.equal(good.data.treatment.count, 1);
  assert.equal((await journal(a, ok)).length, 1);
  assert.equal((await post(a, { target: 'alesi', pigeonIds: [] })).data.error, 'Grupul ales nu are porumbei.');
});

test('grup gol', async () => {
  const a = await newAccount(call, 'A');
  const r = await post(a, { target: 'concurenti' });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /nu are porumbei/);
});

test('validări', async () => {
  const a = await newAccount(call, 'A');
  await pigeon(a, 'concurent');
  for (const o of [{ days: 0 }, { days: 61 }, { days: 1.5 }, { kind: 'inventat' }, { method: 'inventat' }, { startDate: '2026-02-30' }, { startDate: 'ieri' }, { note: 'x'.repeat(1001) }, { name: '' }, { target: 'altii' }, { repeat: { kind: 'zile', days: 0 } }, { repeat: { kind: 'luna' } }]) {
    const r = await post(a, o);
    assert.equal(r.status, 400, JSON.stringify([o, r.data]));
  }
  assert.equal((await post(a, {})).status, 201);
});

test('modifică rescrie jurnalul și refixează lista', async () => {
  const a = await newAccount(call, 'A');
  const p1 = await pigeon(a, 'concurent');
  const p2 = await pigeon(a, 'concurent');
  const p3 = await pigeon(a, 'tanar');
  const t = (await post(a, { target: 'alesi', pigeonIds: [p1.id, p2.id] })).data.treatment;
  const before = (await journal(a, p1))[0].text;
  const r = await call(`/api/treatments/${t.id}`, { method: 'PATCH', cookie: a, body: body({ target: 'alesi', pigeonIds: [p2.id, p3.id], days: 3 }) });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.treatment.days, 3);
  assert.equal(r.data.treatment.count, 2);
  assert.notEqual((await journal(a, p2))[0].text, before);
  assert.match((await journal(a, p2))[0].text, new RegExp(addDays(today(), 2).split('-').reverse().join('\\.')));
  assert.equal((await journal(a, p1)).length, 0, 'scos din listă');
  assert.equal((await journal(a, p3)).length, 1, 'adăugat');
  // Schimbarea țintei în grup: refixat din starea de acum.
  const r2 = await call(`/api/treatments/${t.id}`, { method: 'PATCH', cookie: a, body: body({ target: 'tineret' }) });
  assert.equal(r2.data.treatment.count, 1);
  assert.equal((await journal(a, p2)).length, 0);
  assert.equal((await journal(a, p3)).length, 1);
  // Mutat în viitor: jurnalul se golește.
  const r3 = await call(`/api/treatments/${t.id}`, { method: 'PATCH', cookie: a, body: body({ target: 'tineret', startDate: addDays(today(), 3) }) });
  assert.equal(r3.data.treatment.status, 'urmeaza');
  assert.equal((await journal(a, p3)).length, 0);
});

test('repetarea', async () => {
  const { one, all } = await import('../src/db.js');
  const a = await newAccount(call, 'A');
  await pigeon(a, 'concurent');
  const yr = await post(a, { startDate: '2028-02-29', repeat: { kind: 'an' } });
  assert.equal(yr.status, 201, JSON.stringify(yr.data));
  // Începe în viitor: copilul se face la fixare.
  assert.equal(yr.data.treatment.nextId, null);
  const { freezeTreatment } = await import('../src/treatments.js');
  await freezeTreatment(await one('SELECT * FROM treatments WHERE id = ?', yr.data.treatment.id), 'ro', { today: '2028-02-29' });
  const yr2 = (await call(`/api/treatments/${yr.data.treatment.id}`, { cookie: a })).data.treatment;
  assert.ok(yr2.nextId);
  const child = (await call(`/api/treatments/${yr2.nextId}`, { cookie: a })).data.treatment;
  assert.equal(child.startDate, '2029-02-28');
  assert.deepEqual(child.repeat, { kind: 'an' });
  // A doua fixare nu mai face încă un copil.
  await freezeTreatment(await one('SELECT * FROM treatments WHERE id = ?', yr.data.treatment.id), 'ro', { today: '2028-02-29' });
  assert.equal((await all('SELECT id FROM treatments WHERE parent_id = ?', yr.data.treatment.id)).length, 1);

  const z = (await post(a, { repeat: { kind: 'zile', days: 21 } })).data.treatment;
  assert.ok(z.nextId, 'începe azi: copilul e creat imediat');
  const zc = (await call(`/api/treatments/${z.nextId}`, { cookie: a })).data.treatment;
  assert.equal(zc.startDate, addDays(today(), 21));
  assert.equal(zc.status, 'urmeaza');
  assert.equal((await all('SELECT id FROM treatments WHERE parent_id = ?', z.id)).length, 1);
  // Schimbarea repetării refă copilul.
  const patched = await call(`/api/treatments/${z.id}`, { method: 'PATCH', cookie: a, body: body({ repeat: { kind: 'zile', days: 30 } }) });
  const nc = (await call(`/api/treatments/${patched.data.treatment.nextId}`, { cookie: a })).data.treatment;
  assert.equal(nc.startDate, addDays(today(), 30));
  assert.equal((await call(`/api/treatments/${zc.id}`, { cookie: a })).status, 404, 'copilul vechi a dispărut');
  assert.equal((await all('SELECT id FROM treatments WHERE parent_id = ?', z.id)).length, 1);
  const noRep = await call(`/api/treatments/${z.id}`, { method: 'PATCH', cookie: a, body: body({ repeat: null }) });
  assert.equal(noRep.data.treatment.nextId, null);
});

test('anulează în curs', async () => {
  const a = await newAccount(call, 'A');
  const p = await pigeon(a, 'concurent');
  const t = (await post(a, { repeat: { kind: 'zile', days: 14 } })).data.treatment;
  assert.ok(t.nextId);
  const c = await call(`/api/treatments/${t.id}/cancel`, { method: 'POST', cookie: a });
  assert.equal(c.status, 200, JSON.stringify(c.data));
  assert.equal(c.data.treatment.cancelledOn, today());
  assert.equal(c.data.treatment.status, 'anulat');
  assert.equal(c.data.treatment.nextId, null);
  assert.equal((await call(`/api/treatments/${t.nextId}`, { cookie: a })).status, 404);
  const e = await journal(a, p);
  assert.equal(e.length, 1);
  assert.match(e[0].text, / \(oprit pe \d\d\.\d\d\.\d{4}\)$/);
  assert.equal((await call(`/api/treatments/${t.id}/cancel`, { method: 'POST', cookie: a })).status, 409, 'deja anulat');
  const future = (await post(a, { startDate: addDays(today(), 3) })).data.treatment;
  const f = await call(`/api/treatments/${future.id}/cancel`, { method: 'POST', cookie: a });
  assert.equal(f.status, 409);
  assert.match(f.data.error, /nu e în curs/);
  assert.ok((await call('/api/treatments?stare=gata', { cookie: a })).data.treatments.some((x) => x.id === t.id), 'cel anulat e la „gata”');
});

test('șterge', async () => {
  const { all } = await import('../src/db.js');
  const a = await newAccount(call, 'A');
  const p = await pigeon(a, 'concurent');
  const parent = (await post(a, { repeat: { kind: 'zile', days: 7 } })).data.treatment;
  const childId = parent.nextId;
  // Ștergi copilul: părintele rămâne și nu se mai repetă.
  assert.equal((await call(`/api/treatments/${childId}`, { method: 'DELETE', cookie: a })).status, 204);
  const left = (await call(`/api/treatments/${parent.id}`, { cookie: a })).data.treatment;
  assert.equal(left.repeat, null);
  assert.equal(left.nextId, null);
  // Ștergi un tratament cu intrări și copil.
  const t = (await post(a, { repeat: { kind: 'zile', days: 7 } })).data.treatment;
  assert.equal((await journal(a, p)).length, 2);
  assert.equal((await call(`/api/treatments/${t.id}`, { method: 'DELETE', cookie: a })).status, 204);
  assert.equal((await journal(a, p)).length, 1);
  assert.equal((await all('SELECT id FROM treatments WHERE parent_id = ?', t.id)).length, 0);
  assert.equal((await call(`/api/treatments/${t.id}`, { cookie: a })).status, 404);
  assert.equal((await call(`/api/treatments/${t.id}`, { method: 'DELETE', cookie: a })).status, 404);
});

test('jurnalul legat nu se șterge separat', async () => {
  const a = await newAccount(call, 'A');
  const b = await newAccount(call, 'B');
  const p = await pigeon(a, 'concurent');
  await post(a, {});
  const e = (await journal(a, p))[0];
  assert.equal((await call(`/api/journal/${e.id}`, { method: 'DELETE', cookie: b })).status, 404);
  const r = await call(`/api/journal/${e.id}`, { method: 'DELETE', cookie: a });
  assert.equal(r.status, 409);
  assert.match(r.data.error, /tratament/i);
  const note = (await call(`/api/pigeons/${p.id}/journal`, { method: 'POST', cookie: a, body: { date: today(), type: 'nota', text: 'x' } })).data.entry;
  assert.equal(note.treatmentId ?? null, null);
  assert.equal((await call(`/api/journal/${note.id}`, { method: 'DELETE', cookie: a })).status, 204);
});

test('separare între conturi', async () => {
  const a = await newAccount(call, 'A');
  const b = await newAccount(call, 'B');
  await pigeon(a, 'concurent');
  const t = (await post(a, {})).data.treatment;
  assert.equal((await call(`/api/treatments/${t.id}`, { cookie: b })).status, 404);
  assert.equal((await call(`/api/treatments/${t.id}`, { method: 'PATCH', cookie: b, body: body() })).status, 404);
  assert.equal((await call(`/api/treatments/${t.id}/cancel`, { method: 'POST', cookie: b })).status, 404);
  assert.equal((await call(`/api/treatments/${t.id}`, { method: 'DELETE', cookie: b })).status, 404);
  assert.deepEqual((await call('/api/treatments?stare=in_curs', { cookie: b })).data.treatments, []);
  assert.equal((await call(`/api/treatments/${t.id}`, { cookie: a })).status, 200);
  assert.equal((await call('/api/treatments', { auth: 'none' })).status, 401);
});

test('cont doar-citire', async () => {
  const { run } = await import('../src/db.js');
  const x = await newAccount(call, 'X');
  await pigeon(x, 'concurent');
  const t = (await post(x, {})).data.treatment;
  const me = (await call('/api/auth/me', { cookie: x })).data.account;
  await run(`UPDATE accounts SET subscription_start = '2000-01-01', subscription_end = '2001-01-01' WHERE id = ?`, me.id);
  assert.equal((await post(x, {})).status, 402, 'cu porumbei în cont, deci refuzul vine de la abonament');
  assert.equal((await call(`/api/treatments/${t.id}`, { method: 'PATCH', cookie: x, body: body() })).status, 402);
  assert.equal((await call(`/api/treatments/${t.id}/cancel`, { method: 'POST', cookie: x })).status, 402);
  assert.equal((await call(`/api/treatments/${t.id}`, { method: 'DELETE', cookie: x })).status, 402);
  assert.equal((await call('/api/treatments?stare=in_curs', { cookie: x })).status, 200, 'citirea merge');
  const y = await newAccount(call, 'Y', { active: false });
  assert.equal((await post(y, {})).status, 402);
});

test('modificarea părintelui nu atinge următorul planificat decât dacă s-a schimbat repetarea / începutul', async () => {
  const { run } = await import('../src/db.js');
  const a = await newAccount(call, 'A');
  await pigeon(a, 'concurent');
  const t = (await post(a, { repeat: { kind: 'zile', days: 21 } })).data.treatment;
  await run(`UPDATE treatments SET note = 'a omului' WHERE id = ?`, t.nextId);
  const r = await call(`/api/treatments/${t.id}`, { method: 'PATCH', cookie: a, body: body({ repeat: { kind: 'zile', days: 21 }, note: 'nota nouă' }) });
  assert.equal(r.data.treatment.nextId, t.nextId, 'același copil');
  assert.equal((await call(`/api/treatments/${t.nextId}`, { cookie: a })).data.treatment.note, 'a omului');
});

test('un tratament oprit nu se mai modifică (409) și nu-și mai face următorul', async () => {
  const a = await newAccount(call, 'A');
  await pigeon(a, 'concurent');
  const t = (await post(a, { repeat: { kind: 'zile', days: 7 } })).data.treatment;
  await call(`/api/treatments/${t.id}/cancel`, { method: 'POST', cookie: a });
  const r = await call(`/api/treatments/${t.id}`, { method: 'PATCH', cookie: a, body: body({ repeat: { kind: 'zile', days: 7 }, note: 'x' }) });
  assert.equal(r.status, 409, JSON.stringify(r.data));
  assert.match(r.data.error, /oprit/);
  const after = (await call(`/api/treatments/${t.id}`, { cookie: a })).data.treatment;
  assert.equal(after.note, null, 'neschimbat');
  assert.equal(after.nextId, null);
});

test('fixarea fără `force` nu atinge un tratament oprit sau unul care n-a început', async () => {
  const { freezeTreatment } = await import('../src/treatments.js');
  const { one, run, all } = await import('../src/db.js');
  const a = await newAccount(call, 'A');
  const p = await pigeon(a, 'concurent');
  const future = (await post(a, { target: 'concurenti', startDate: addDays(today(), 2), repeat: { kind: 'zile', days: 7 } })).data.treatment;
  assert.equal(await freezeTreatment(await one('SELECT * FROM treatments WHERE id = ?', future.id), 'ro'), false);
  const f = await one('SELECT * FROM treatments WHERE id = ?', future.id);
  assert.equal(f.frozen_at, null, 'viitorul rămâne nefixat');
  assert.equal((await all('SELECT id FROM treatments WHERE parent_id = ?', future.id)).length, 0);
  assert.equal((await journal(a, p)).length, 0);
  // Oprit, dar (cumva) nefixat: nici el nu se fixează.
  await run('UPDATE treatments SET start_date = ?, cancelled_on = ? WHERE id = ?', today(), today(), future.id);
  assert.equal(await freezeTreatment(await one('SELECT * FROM treatments WHERE id = ?', future.id), 'ro'), false);
  assert.equal((await one('SELECT frozen_at FROM treatments WHERE id = ?', future.id)).frozen_at, null);
  assert.equal((await all('SELECT id FROM treatments WHERE parent_id = ?', future.id)).length, 0);
  assert.equal((await journal(a, p)).length, 0);
});

test('nextPlanned: doar când următorul din lanț n-a început', async () => {
  const { run } = await import('../src/db.js');
  const a = await newAccount(call, 'A');
  await pigeon(a, 'concurent');
  const t = (await post(a, { repeat: { kind: 'zile', days: 7 } })).data.treatment;
  assert.ok(t.nextId);
  assert.equal(t.nextPlanned, true);
  await run('UPDATE treatments SET frozen_at = now() WHERE id = ?', t.nextId);
  const again = (await call(`/api/treatments/${t.id}`, { cookie: a })).data.treatment;
  assert.equal(again.nextId, t.nextId);
  assert.equal(again.nextPlanned, false, 'următorul a început: nu se mai șterge');
  const single = (await post(a, {})).data.treatment;
  assert.equal(single.nextId, null);
  assert.equal(single.nextPlanned, false);
});

test('două fixări simultane: un singur următor și o singură intrare pe porumbel', async () => {
  const { freezeTreatment } = await import('../src/treatments.js');
  const { one, all } = await import('../src/db.js');
  const a = await newAccount(call, 'A');
  const p1 = await pigeon(a, 'concurent');
  const p2 = await pigeon(a, 'concurent');
  const t = (await post(a, { target: 'concurenti', startDate: addDays(today(), 2), repeat: { kind: 'zile', days: 10 } })).data.treatment;
  const row = await one('SELECT * FROM treatments WHERE id = ?', t.id);
  await Promise.all(Array.from({ length: 8 }, () => freezeTreatment(row, 'ro', { today: addDays(today(), 2) })));
  assert.equal((await all('SELECT id FROM treatments WHERE parent_id = ?', t.id)).length, 1);
  for (const p of [p1, p2]) assert.equal((await journal(a, p)).length, 1);
  assert.equal((await all('SELECT * FROM treatment_pigeons WHERE treatment_id = ?', t.id)).length, 2);
});

test('citirea fixează tratamentele a căror zi de început a venit', async () => {
  const { run, all } = await import('../src/db.js');
  const a = await newAccount(call, 'A');
  const p = await pigeon(a, 'concurent');
  const t = (await post(a, { target: 'concurenti', startDate: addDays(today(), 3) })).data.treatment;
  assert.equal((await journal(a, p)).length, 0);
  await run('UPDATE treatments SET start_date = ? WHERE id = ?', today(), t.id);
  const g = await call(`/api/treatments/${t.id}`, { cookie: a });
  assert.equal(g.data.treatment.status, 'in_curs');
  assert.equal((await all('SELECT * FROM treatment_pigeons WHERE treatment_id = ?', t.id)).length, 1);
  assert.equal((await journal(a, p)).length, 1);
  // Și lista.
  const t2 = (await post(a, { target: 'toti', startDate: addDays(today(), 3) })).data.treatment;
  await run('UPDATE treatments SET start_date = ? WHERE id = ?', today(), t2.id);
  await call('/api/treatments?stare=in_curs', { cookie: a });
  assert.equal((await all('SELECT * FROM treatment_pigeons WHERE treatment_id = ?', t2.id)).length, 1);
  assert.equal((await journal(a, p)).length, 2);
});

test('anularea unuia început azi, dar nefixat, scrie întâi jurnalul', async () => {
  const { run } = await import('../src/db.js');
  const a = await newAccount(call, 'A');
  const p = await pigeon(a, 'concurent');
  const t = (await post(a, { target: 'concurenti', startDate: addDays(today(), 3) })).data.treatment;
  await run('UPDATE treatments SET start_date = ? WHERE id = ?', today(), t.id);
  const c = await call(`/api/treatments/${t.id}/cancel`, { method: 'POST', cookie: a });
  assert.equal(c.status, 200, JSON.stringify(c.data));
  const e = await journal(a, p);
  assert.equal(e.length, 1);
  assert.match(e[0].text, /oprit pe/);
});

test('repetarea nu face lanț de tratamente din trecut', async () => {
  const { all } = await import('../src/db.js');
  const a = await newAccount(call, 'A');
  await pigeon(a, 'concurent');
  const t = (await post(a, { startDate: addDays(today(), -30), repeat: { kind: 'zile', days: 7 } })).data.treatment;
  const kids = await all('SELECT start_date FROM treatments WHERE parent_id = ?', t.id);
  assert.equal(kids.length, 1);
  assert.ok(kids[0].start_date > today());
  assert.equal(kids[0].start_date, addDays(today(), 5), '30 de zile înapoi + 5 × 7 = 35');
  const y = (await post(a, { startDate: `${Number(today().slice(0, 4)) - 3}-01-15`, days: 2, repeat: { kind: 'an' } })).data.treatment;
  const yk = await all('SELECT start_date FROM treatments WHERE parent_id = ?', y.id);
  assert.equal(yk.length, 1);
  assert.ok(yk[0].start_date > today());
});

test('„gata”: ultimele 50, cu „Mai multe”', async () => {
  const a = await newAccount(call, 'A');
  await pigeon(a, 'concurent');
  const ids = [];
  for (let i = 0; i < 53; i++) ids.push((await post(a, { startDate: addDays(today(), -30 - i), days: 1 })).data.treatment.id);
  const first = (await call('/api/treatments?stare=gata', { cookie: a })).data.treatments;
  assert.equal(first.length, 50);
  const more = (await call(`/api/treatments?stare=gata&before=${first.at(-1).id}`, { cookie: a })).data.treatments;
  assert.equal(more.length, 3);
  assert.equal(new Set([...first, ...more].map((x) => x.id)).size, 53);
  assert.equal((await call('/api/treatments?stare=nimic', { cookie: a })).status, 400);
});
