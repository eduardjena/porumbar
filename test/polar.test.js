import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { apiCaller } from './helpers/api.js';
import { startTestApp } from './helpers/db.js';
import { adminCookie, newAccount, today } from './helpers/accounts.js';

// Plata prin Polar: doar un webhook semnat cu secretul nostru dă un an plătit, o singură dată pe comandă.
// Valori de test (niciun secret real în repo): secretul e în forma Standard Webhooks („whsec_” + base64).
const KEY = Buffer.from('cheie-de-test-doar-pentru-teste-polar-32');
const SECRET = `whsec_${KEY.toString('base64')}`;
const PRODUCT = '11111111-2222-4333-8444-555555555555';
process.env.POLAR_WEBHOOK_SECRET = SECRET;
process.env.POLAR_PRODUCT_ID = PRODUCT;

let server;
let base;
let db;
let mailMod;
const call = apiCaller(() => ({ base }));
const plusDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const nowSec = () => Math.floor(Date.now() / 1000);

before(async () => {
  ({ server, base } = await startTestApp());
  db = await import('../src/db.js');
  mailMod = await import('../src/mail.js');
});
after(() => server?.close());

let seq = 0;
const uuid = () => crypto.randomUUID();

/** O comandă Polar (câmpurile pe care le citim), plătită. */
function order(accountId, { id = uuid(), product = PRODUCT, total = 15000, tax = 2603, currency = 'ron', country = 'RO', metadata, refunded = 0, status = 'paid' } = {}) {
  return {
    id,
    status,
    paid: true,
    product_id: product,
    total_amount: total,
    tax_amount: tax,
    net_amount: total - tax,
    refunded_amount: refunded,
    currency,
    billing_reason: 'purchase',
    billing_address: { country },
    metadata: metadata !== undefined ? metadata : { accountId: String(accountId) },
    customer: { id: uuid(), email: 'client@exemplu.test', external_id: null },
    created_at: new Date().toISOString(),
  };
}
const event = (type, data) => ({ type, timestamp: new Date().toISOString(), data });

/** Trimite evenimentul ca Polar: corp brut, semnat Standard Webhooks (sau cu antetele date). */
function hook(evt, { key = KEY, ts = nowSec(), id = `msg_${++seq}`, signature, raw } = {}) {
  const body = raw ?? JSON.stringify(evt);
  const sig = signature ?? `v1,${crypto.createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64')}`;
  return call('/api/polar/webhook', {
    method: 'POST', raw: body, auth: 'none',
    headers: { 'Content-Type': 'application/json', 'webhook-id': id, 'webhook-timestamp': String(ts), 'webhook-signature': sig },
  });
}

const me = async (cookie) => (await call('/api/auth/me', { cookie })).data.account;
const accountOf = (id) => db.one('SELECT subscription_start, subscription_end, paid_on, trial_end FROM accounts WHERE id = ?', id);

test('semnătura: doar cererea semnată cu secretul nostru, în 5 minute, schimbă ceva', async () => {
  const c = await newAccount(call, 'Polar', { trial: true });
  const id = (await me(c)).id;
  const o = order(id);
  for (const opts of [{ key: Buffer.from('alta-cheie') }, { ts: nowSec() - 600 }, { signature: 'v1,nimic' }, { signature: '' }]) {
    const r = await hook(event('order.paid', o), opts);
    assert.equal(r.status, 403, JSON.stringify(opts));
  }
  assert.equal((await accountOf(id)).subscription_end, null);
  const ok = await hook(event('order.paid', o));
  assert.equal(ok.status, 200);
  assert.equal(ok.data.status, 'applied');
});

test('secretul în forma veche Polar (octeții textului întreg) e primit și el', async () => {
  const c = await newAccount(call, 'Vechi', { trial: true });
  const id = (await me(c)).id;
  const r = await hook(event('order.paid', order(id)), { key: Buffer.from(SECRET, 'utf8') });
  assert.equal(r.status, 200);
  assert.equal(r.data.status, 'applied');
});

test('plata în probă: anul începe la sfârșitul probei; citirile se numără de la ziua plății; a doua livrare nu dă încă un an', async () => {
  const c = await newAccount(call, 'Proba', { trial: true });
  const id = (await me(c)).id;
  const before = await accountOf(id);
  const o = order(id);
  assert.equal((await hook(event('order.paid', o))).data.status, 'applied');
  const a = await accountOf(id);
  assert.equal(a.subscription_start, before.trial_end);
  assert.equal(a.paid_on, today());
  assert.equal((await me(c)).subscription.status, 'active');
  const again = await hook(event('order.paid', o));
  assert.equal(again.data.status, 'duplicate');
  assert.deepEqual(await accountOf(id), a);
  const p = await db.one('SELECT amount_minor, tax_minor, currency, country, status FROM payments WHERE polar_order_id = ?', o.id);
  assert.deepEqual({ ...p, amount_minor: Number(p.amount_minor), tax_minor: Number(p.tax_minor) }, { amount_minor: 15000, tax_minor: 2603, currency: 'RON', country: 'RO', status: 'applied' });
});

test('după probă: anul începe azi; prelungirea înainte de sfârșit se lipește de anul vechi', async () => {
  const c = await newAccount(call, 'Dupa', { active: false });
  const id = (await me(c)).id;
  await hook(event('order.paid', order(id)));
  const a = await accountOf(id);
  assert.equal(a.subscription_start, today());
  await hook(event('order.paid', order(id)));
  const b = await accountOf(id);
  assert.equal(b.subscription_start, a.subscription_end);
});

test('alt produs sau comandă neplătită: ignorate (202), fără schimbări', async () => {
  const c = await newAccount(call, 'Alt', { trial: true });
  const id = (await me(c)).id;
  const r = await hook(event('order.paid', order(id, { product: uuid() })));
  assert.equal(r.status, 202);
  const unpaid = { ...order(id), paid: false, status: 'pending' };
  assert.equal((await hook(event('order.paid', unpaid))).status, 202);
  assert.equal((await hook(event('checkout.updated', { id: uuid() }))).status, 202);
  assert.equal((await accountOf(id)).subscription_end, null);
});

test('plata fără cont: nepotrivită; vânzătorul o leagă o singură dată', async () => {
  const c = await newAccount(call, 'Fara', { trial: true });
  const id = (await me(c)).id;
  const o = order(id, { metadata: {} });
  assert.equal((await hook(event('order.paid', o))).data.status, 'unmatched');
  const admin = await adminCookie(call);
  const list = (await call('/api/admin/payments?status=unmatched', { cookie: admin })).data.payments;
  const p = list.find((x) => x.order === o.id);
  assert.ok(p);
  const link = await call(`/api/admin/payments/${p.id}/link`, { method: 'POST', cookie: admin, body: { accountId: id } });
  assert.equal(link.status, 200, JSON.stringify(link.data));
  assert.ok((await accountOf(id)).subscription_end);
  const twice = await call(`/api/admin/payments/${p.id}/link`, { method: 'POST', cookie: admin, body: { accountId: id } });
  assert.equal(twice.status, 409);
  const detail = (await call(`/api/admin/accounts/${id}`, { cookie: admin })).data;
  assert.equal(detail.payments.length, 1);
});

test('rambursarea: notată (parțială, apoi totală), abonamentul rămâne, vânzătorul primește email și o vede la Rambursări', async () => {
  const c = await newAccount(call, 'Ramburs', { trial: true });
  const id = (await me(c)).id;
  const o = order(id);
  await hook(event('order.paid', o));
  const end = (await accountOf(id)).subscription_end;
  const mails = mailMod.sentMails.length;
  const part = await hook(event('order.refunded', { ...o, refunded_amount: 5000, status: 'partially_refunded' }));
  assert.equal(part.data.status, 'partially_refunded');
  assert.equal((await hook(event('order.updated', { ...o, refunded_amount: 5000, status: 'partially_refunded' }))).data.status, 'duplicate');
  const full = await hook(event('order.refunded', { ...o, refunded_amount: 15000, status: 'refunded' }));
  assert.equal(full.data.status, 'refunded');
  assert.equal((await accountOf(id)).subscription_end, end);
  assert.equal(mailMod.sentMails.slice(mails).filter((m) => m.to === process.env.ADMIN_EMAIL && /rambursare/.test(m.subject)).length, 2);
  const admin = await adminCookie(call);
  const refunds = (await call('/api/admin/refunds', { cookie: admin })).data.refunds;
  assert.ok(refunds.some((r) => r.order === o.id && r.status === 'refunded'));
});

test('butonul „Plătește”: oprit fără Polar pornit; pornit, duce la pagina Polar cu contul, moneda și întoarcerea', async () => {
  const c = await newAccount(call, 'Buton', { trial: true });
  assert.deepEqual((await call('/api/plata', { cookie: c })).data, { online: false, canPay: false });
  assert.equal((await call('/api/plata/checkout', { method: 'POST', cookie: c })).status, 404);

  process.env.POLAR_ACCESS_TOKEN = 'polar_oat_token_de_test';
  const realFetch = globalThis.fetch;
  let sent = null;
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith('https://sandbox-api.polar.sh/')) {
      sent = { url: String(url), auth: opts.headers.Authorization, body: JSON.parse(opts.body) };
      return new Response(JSON.stringify({ id: uuid(), url: 'https://sandbox.polar.sh/checkout/polar_c_test' }), { status: 201 });
    }
    return realFetch(url, opts);
  };
  try {
    assert.deepEqual((await call('/api/plata', { cookie: c })).data, { online: true, canPay: true });
    const r = await call('/api/plata/checkout', { method: 'POST', cookie: c });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.url, 'https://sandbox.polar.sh/checkout/polar_c_test');
    const id = (await me(c)).id;
    assert.equal(sent.url, 'https://sandbox-api.polar.sh/v1/checkouts/');
    assert.equal(sent.auth, 'Bearer polar_oat_token_de_test');
    assert.deepEqual(sent.body.products, [PRODUCT]);
    assert.equal(sent.body.currency, 'ron');
    assert.equal(sent.body.metadata.accountId, String(id));
    assert.match(sent.body.success_url, /\/plata\/gata\?checkout_id=\{CHECKOUT_ID\}$/);

    // Contul fără abonament (proba terminată) poate plăti; cel plătit pe mai mult de 30 de zile nu (ar plăti de două ori).
    const ended = await newAccount(call, 'Terminat', { active: false });
    assert.equal((await call('/api/plata/checkout', { method: 'POST', cookie: ended })).status, 200);
    const paid = await newAccount(call, 'Platit');
    assert.equal((await call('/api/plata', { cookie: paid })).data.canPay, false);
    assert.equal((await call('/api/plata/checkout', { method: 'POST', cookie: paid })).status, 409);

    // Polar refuză emailul (de ex. un domeniu rezervat): a doua încercare, fără email, deschide totuși plata.
    let calls = 0;
    const before = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      if (String(url).startsWith('https://sandbox-api.polar.sh/')) {
        calls += 1;
        const b = JSON.parse(opts.body);
        if (b.customer_email) return new Response(JSON.stringify({ error: 'RequestValidationError', detail: [{ loc: ['body', 'customer_email'] }] }), { status: 422 });
        return new Response(JSON.stringify({ id: uuid(), url: 'https://sandbox.polar.sh/checkout/fara_email' }), { status: 201 });
      }
      return before(url, opts);
    };
    const noMail = await call('/api/plata/checkout', { method: 'POST', cookie: c });
    assert.equal(noMail.data.url, 'https://sandbox.polar.sh/checkout/fara_email');
    assert.equal(calls, 2);
    globalThis.fetch = before;

    // Japonia plătește în yeni, restul (nu România) în euro.
    await db.run("UPDATE accounts SET country = 'JP' WHERE id = ?", id);
    await call('/api/plata/checkout', { method: 'POST', cookie: c });
    assert.equal(sent.body.currency, 'jpy');
    await db.run("UPDATE accounts SET country = 'HU' WHERE id = ?", id);
    await call('/api/plata/checkout', { method: 'POST', cookie: c });
    assert.equal(sent.body.currency, 'eur');
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.POLAR_ACCESS_TOKEN;
  }
});

test('citirile din poze: plata din probă le deschide pe loc (de la ziua plății, cu primele 14 zile)', async () => {
  const c = await newAccount(call, 'Citiri', { trial: true });
  const id = (await me(c)).id;
  await hook(event('order.paid', order(id)));
  const reads = (await me(c)).reads;
  assert.equal(reads.fullFrom, plusDays(today(), 14));
});
