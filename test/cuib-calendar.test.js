import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { newAccount, today as todayFn } from './helpers/accounts.js';

let server;
let base;
let a;
let b;
let n = 0;
const call = apiCaller(() => ({ base }));
const today = todayFn();
const day = (k) => new Date(Date.parse(`${today}T00:00:00Z`) + k * 86400e3).toISOString().slice(0, 10);

before(async () => {
  ({ server, base } = await startTestApp());
  a = await newAccount(call, 'A');
  b = await newAccount(call, 'B');
});
after(() => server?.close());

// Perechea nouă (porumbei noi, sezon propriu) și ponta ei.
async function pair(cookie, { nest = null, names = false } = {}) {
  n += 1;
  const mk = async (sex, ring) => (await call('/api/pigeons', { method: 'POST', cookie, body: { kind: 'own', ring, sex, ...(names ? { name: `${sex === 'M' ? 'Fulger' : 'Vânta'}${n}` } : {}) } })).data.pigeon;
  const cock = await mk('M', `RO-24-${200000 + n * 2}`);
  const hen = await mk('F', `RO-24-${200001 + n * 2}`);
  const r = await call('/api/pairs', { method: 'POST', cookie, body: { cockId: cock.id, henId: hen.id, season: 2026, nest } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data.pair;
}
const clutch = async (cookie, p, body) => {
  const r = await call(`/api/pairs/${p.id}/clutches`, { method: 'POST', cookie, body });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data.clutch;
};
const patch = (cookie, c, body) => call(`/api/clutches/${c.id}`, { method: 'PATCH', cookie, body });
const items = async (cookie, c) => {
  const r = await call('/api/breeding/calendar', { cookie });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.today, today);
  return r.data.items.filter((i) => i.clutchId === c.id);
};

test('banda: al doilea ou așteptat azi; când vine, dispare', async () => {
  const p = await pair(a, { nest: '7' });
  const c = await clutch(a, p, { egg1On: day(-2) });
  const it = await items(a, c);
  assert.equal(it.length, 1);
  assert.equal(it[0].kind, 'ou2');
  assert.equal(it[0].state, 'azi');
  assert.equal(it[0].label, '7');
  assert.equal(it[0].nest, '7');
  assert.equal(it[0].fosterLabel, null);
  assert.equal(it[0].fosterNest, null);
  assert.equal(it[0].pairId, p.id);
  assert.equal(it[0].ownPairId, p.id);
  assert.equal((await patch(a, c, { egg2On: today })).status, 200);
  assert.equal((await items(a, c)).length, 0);
});

test('mirarea: data pusă și ouă limpezi → mirarea dispare, eclozarea numără ouăle rămase', async () => {
  const p = await pair(a, { names: true });
  const c = await clutch(a, p, { egg1On: day(-17), egg2On: day(-15) });
  let it = await items(a, c);
  assert.deepEqual(it.map((i) => i.kind).sort(), ['eclozare', 'mirare']);
  assert.match(it[0].label, /^Fulger\d+ × Vânta\d+$/);
  assert.equal(it[0].nest, null);
  const r = await patch(a, c, { candledOn: day(-10), infertile: 1 });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.clutch.candledOn, day(-10));
  it = await items(a, c);
  assert.deepEqual(it.map((i) => i.kind), ['eclozare']);
  assert.equal(it[0].eggs, 2);
  assert.equal(it[0].eggsLeft, 1);
  assert.equal(it[0].infertile, 1);
  assert.equal(it[0].broken, 0);
  assert.equal((await patch(a, c, { candledOn: day(-18) })).status, 400, 'mirarea nu e înaintea primului ou');
});

test('închisă: „Nu mai urmări” scoate ponta, golirea o aduce înapoi', async () => {
  const p = await pair(a);
  const c = await clutch(a, p, { egg1On: day(-2) });
  assert.equal((await items(a, c)).length, 1);
  const r = await patch(a, c, { calendarClosedOn: today });
  assert.equal(r.data.clutch.calendarClosedOn, today);
  assert.equal((await items(a, c)).length, 0);
  assert.equal((await patch(a, c, { calendarClosedOn: null })).data.clutch.calendarClosedOn, null);
  assert.equal((await items(a, c)).length, 1);
});

test('doica: ponta apare la cuibul doicii, cu perechea proprie la fosterLabel', async () => {
  const own = await pair(a, { nest: '3' });
  const foster = await pair(a, { nest: '9' });
  const c = await clutch(a, own, { egg1On: day(-2), fosterPairId: foster.id });
  const it = await items(a, c);
  assert.equal(it.length, 1);
  assert.equal(it[0].label, '9');
  assert.equal(it[0].fosterLabel, '3');
  assert.equal(it[0].fosterNest, '3');
  assert.equal(it[0].pairId, foster.id);
  assert.equal(it[0].ownPairId, own.id, 'inelarea se face pe fișa perechii pontei');
});

test('separare: celălalt cont nu vede nimic din ale mele', async () => {
  const mine = await call('/api/breeding/calendar', { cookie: a });
  assert.ok(mine.data.items.length > 0);
  const theirs = await call('/api/breeding/calendar', { cookie: b });
  assert.equal(theirs.status, 200);
  assert.deepEqual(theirs.data.items, []);
});

test('doar citire: GET merge, PATCH dă 402', async () => {
  const p = await pair(a);
  const c = await clutch(a, p, { egg1On: day(-2) });
  const ro = await newAccount(call, 'Citire', { active: false });
  assert.equal((await call('/api/breeding/calendar', { cookie: ro })).status, 200);
  assert.equal((await patch(ro, c, { calendarClosedOn: today })).status, 402);
});

test('scurtături: „N-au ieșit” și „Nu inelez” scot momentul', async () => {
  const p = await pair(a);
  const c = await clutch(a, p, { egg1On: day(-17), egg2On: day(-15) });
  assert.ok((await items(a, c)).some((i) => i.kind === 'eclozare'));
  const r = await patch(a, c, { infertile: 2 });
  assert.equal(r.data.clutch.infertile, 2);
  assert.deepEqual(await items(a, c), [], 'nu rămâne niciun rând al pontei (nici mirare, nici al doilea ou)');

  const q = await pair(a);
  const d = await clutch(a, q, { egg1On: day(-24), egg2On: day(-22), hatchedOn: day(-7), hatched: 2 });
  assert.deepEqual((await items(a, d)).map((i) => i.kind), ['inelare']);
  assert.equal((await patch(a, d, { hatched: 0 })).status, 200);
  assert.equal((await items(a, d)).length, 0);
});

test('ordinea: întârziatele întâi, apoi după zi, apoi după nume', async () => {
  const x = await newAccount(call, 'Ord');
  const p1 = await pair(x, { nest: 'B' });
  const p2 = await pair(x, { nest: 'A' });
  const p3 = await pair(x, { nest: 'C' });
  await clutch(x, p1, { egg1On: day(-2) }); // ou2 azi
  await clutch(x, p2, { egg1On: day(-2) }); // ou2 azi
  await clutch(x, p3, { egg1On: day(-30), egg2On: day(-28), hatchedOn: day(-15), hatched: 1 }); // inelare întârziată
  const r = (await call('/api/breeding/calendar', { cookie: x })).data.items;
  assert.deepEqual(r.map((i) => i.label), ['C', 'A', 'B']);
  assert.equal(r[0].state, 'intarziat');
});

test('updated_at: o modificare a pontei îl mută înainte', async () => {
  const p = await pair(a);
  const c = await clutch(a, p, { egg1On: day(-2) });
  assert.ok(c.updatedAt);
  await new Promise((r) => setTimeout(r, 15));
  const u = (await patch(a, c, { note: 'schimbată' })).data.clutch;
  assert.ok(Date.parse(u.updatedAt) > Date.parse(c.updatedAt));
});
