import crypto from 'node:crypto';
import { config } from './config.js';
import { one, run, tx } from './db.js';
import { sendMail } from './mail.js';
import { isoDate, logEvent, plusOneYear } from './subscriptions.js';

/*
 * Plata prin Polar (merchant of record): un singur produs, „Pigeonrama – 1 an”, plătit o dată, cu prețuri în lei,
 * euro și yeni. Omul pleacă la pagina de plată Polar (o sesiune făcută de server, POST /v1/checkouts/) și se întoarce
 * la /plata/gata. Contul se activează doar din webhook (POST /api/polar/webhook, semnat după Standard Webhooks):
 * evenimentul `order.paid` cu produsul nostru dă un an, o singură dată pe comandă (payments.polar_order_id unic).
 * Rambursarea se notează și vânzătorul primește un email, dar abonamentul nu se taie singur: hotărăște el din consolă.
 * Contestațiile de card nu au eveniment la Polar: le vede vânzătorul în panoul Polar.
 */

/** Cât de vechi (sau din viitor) poate fi `webhook-timestamp`, în secunde. */
export const SIGNATURE_TOLERANCE_SEC = 300;

/** Webhook-ul merge doar cu secretul și cu produsul puse în mediu. */
export const polarConfigured = () => !!config.polarWebhookSecret && !!config.polarProductId;

/**
 * Cheile HMAC posibile pentru secretul `whsec_…`: Standard Webhooks (partea de după `whsec_`, în base64) și forma
 * veche Polar (secretele de dinainte de 8 sept. 2026: octeții textului întreg). Le încercăm pe amândouă.
 */
function keysOf(secret) {
  const keys = [Buffer.from(secret, 'utf8')];
  if (secret.startsWith('whsec_')) {
    const b64 = secret.slice('whsec_'.length);
    if (/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) keys.unshift(Buffer.from(b64, 'base64'));
  }
  return keys;
}

/**
 * Semnătura Standard Webhooks: antetele `webhook-id`, `webhook-timestamp` (secunde unix) și `webhook-signature`
 * („v1,<base64>”, mai multe separate prin spațiu cât timp se schimbă secretul). Semnătura = HMAC-SHA256 pe
 * `${id}.${timestamp}.${corpul brut}`, comparată în timp constant; timpul mai departe de 5 minute = refuzat.
 */
export function verifyPolarSignature(rawBody, headers, secret, nowSec = Math.floor(Date.now() / 1000)) {
  if (!secret || !Buffer.isBuffer(rawBody) || !headers) return false;
  const id = headers['webhook-id'];
  const ts = headers['webhook-timestamp'];
  const sig = headers['webhook-signature'];
  if (typeof id !== 'string' || !id || id.length > 200 || typeof ts !== 'string' || !/^\d{1,12}$/.test(ts) || typeof sig !== 'string') return false;
  if (Math.abs(nowSec - Number(ts)) > SIGNATURE_TOLERANCE_SEC) return false;
  const given = sig.split(' ').map((s) => s.trim()).filter((s) => s.startsWith('v1,')).map((s) => s.slice(3));
  if (!given.length) return false;
  let ok = false;
  for (const key of keysOf(secret)) {
    const expected = crypto.createHmac('sha256', key).update(`${id}.${ts}.`).update(rawBody).digest();
    // Toate se compară (fără oprire la prima potrivire), ca timpul să nu spună care a mers.
    for (const g of given) {
      const buf = /^[A-Za-z0-9+/]+={0,2}$/.test(g) ? Buffer.from(g, 'base64') : null;
      if (buf && buf.length === expected.length && crypto.timingSafeEqual(buf, expected)) ok = true;
    }
  }
  return ok;
}

/**
 * Perioada plătită: de la cea mai târzie dintre azi, sfârșitul probei și sfârșitul abonamentului (cele două doar dacă
 * sunt în viitor), încă un an. Zilele de sfârșit nu sunt incluse, deci anul nou se lipește exact de cel vechi.
 */
export function paidPeriod(account, today) {
  let start = today;
  for (const d of [account.trial_end, account.subscription_end]) if (d && d > start) start = d;
  return { start, end: plusOneYear(start) };
}

/** Plata nu se poate lega (consola): `status` 404 / 409, `message` în română. */
export class PaymentLinkError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'PaymentLinkError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Anul plătit pe cont (blocat, ca două plăți să se pună una după alta), ziua plății, plata legată de cont și
 * evenimentul din istoric. Folosit de webhook și de legarea de mână a unei plăți nepotrivite.
 */
export function grantPaidYear(accountId, paymentId) {
  return tx(async () => {
    // Întâi plata, blocată: doar o plată nepotrivită se poate lega, o singură dată. Ordinea blocărilor (plata, apoi
    // contul) e aceeași și în webhook.
    const payment = await one('SELECT id, polar_order_id, status FROM payments WHERE id = ? FOR UPDATE', paymentId);
    if (!payment) throw new PaymentLinkError(404, 'payment-missing', 'Plata nu există.'); // i18n: ro
    if (payment.status !== 'unmatched') {
      const why = payment.status === 'applied' ? 'Plata a fost deja aplicată unui cont.' : 'Plata a fost rambursată; nu mai dă un an.'; // i18n: ro
      throw new PaymentLinkError(409, 'payment-not-unmatched', why);
    }
    const acc = await one('SELECT id, trial_end, subscription_end FROM accounts WHERE id = ? FOR UPDATE', accountId);
    if (!acc) throw new PaymentLinkError(404, 'account-missing', 'Contul nu există.'); // i18n: ro
    const today = isoDate();
    const { start, end } = paidPeriod(acc, today);
    await run(
      `UPDATE accounts SET subscription_start = ?, subscription_end = ?, paid_on = ?,
              pedigree_name = CASE WHEN btrim(coalesce(pedigree_name, '')) = '' THEN name ELSE pedigree_name END
        WHERE id = ?`,
      start, end, today, acc.id,
    );
    await run("UPDATE payments SET account_id = ?, period_start = ?, period_end = ?, status = 'applied' WHERE id = ?", acc.id, start, end, payment.id);
    await logEvent(acc.id, 'subscription', { note: `${start} → ${end} · plătit prin Polar (${payment.polar_order_id})` }); // i18n: ro
    return { start, end };
  });
}

const ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACCOUNT_ID = /^[1-9]\d{0,14}$/;
const minor = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : null);
const code = (v, len) => (typeof v === 'string' && new RegExp(`^[A-Za-z]{${len}}$`).test(v) ? v.toUpperCase() : null);

/**
 * `order.paid`: comanda plătită. Doar produsul nostru, doar plătită (`paid`), doar o dată (ON CONFLICT DO NOTHING:
 * a doua livrare a aceleiași comenzi, chiar în același moment, nu mai găsește nimic de scris și nu atinge contul).
 * Contul vine din `metadata.accountId` (pus de noi la sesiunea de plată), altfel din `customer.external_id`.
 */
export async function applyOrder(order) {
  const orderId = order?.id;
  if (typeof orderId !== 'string' || !ORDER_ID.test(orderId)) return { status: 'ignored' };
  if (order.product_id !== config.polarProductId) {
    console.warn(`[porumbar] Polar: comanda ${orderId} nu e pentru produsul nostru, ignorată.`); // i18n: ro
    return { status: 'ignored' };
  }
  if (order.paid !== true && order.status !== 'paid') return { status: 'ignored' };
  const rawAccount = order.metadata?.accountId ?? order.customer?.external_id;
  const accountId = ACCOUNT_ID.test(String(rawAccount ?? '')) ? String(rawAccount) : null;
  return tx(async () => {
    const inserted = await one(
      `INSERT INTO payments (polar_order_id, amount_minor, tax_minor, currency, country, status, raw, created_at)
       VALUES (?, ?, ?, ?, ?, 'unmatched', ?::jsonb, now())
       ON CONFLICT (polar_order_id) DO NOTHING RETURNING id`,
      orderId, minor(order.total_amount), minor(order.tax_amount), code(order.currency, 3), code(order.billing_address?.country, 2), JSON.stringify(order),
    );
    if (!inserted) return { status: 'duplicate' };
    const account = accountId ? await one('SELECT id FROM accounts WHERE id = ? FOR UPDATE', accountId) : null;
    if (!account) {
      console.warn(`[porumbar] Polar: plata ${orderId} nu se potrivește cu niciun cont (${JSON.stringify(rawAccount ?? null)}); rămâne la „Plăți nepotrivite”.`); // i18n: ro
      return { status: 'unmatched' };
    }
    const period = await grantPaidYear(account.id, inserted.id);
    console.log(`[porumbar] Polar: plata ${orderId} aplicată contului ${account.id}, ${period.start} → ${period.end}.`); // i18n: ro
    return { status: 'applied', ...period };
  });
}

const roDay = (d) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString('ro-RO', { timeZone: 'UTC' }) : '—');

/**
 * `order.refunded` / `order.updated` cu bani dați înapoi (`refunded_amount` > 0): plata devine `refunded` (toată suma)
 * sau `partially_refunded`. Apare în istoricul contului, la „Rambursări” în consolă și într-un email către vânzător.
 * Abonamentul rămâne cum e: vânzătorul decide din consolă. A doua livrare (aceeași sumă rambursată) nu mai face nimic.
 */
export async function applyRefund(order) {
  const orderId = order?.id;
  if (typeof orderId !== 'string' || !ORDER_ID.test(orderId)) return { status: 'ignored' };
  const refunded = minor(order.refunded_amount);
  if (!refunded) return { status: 'ignored' };
  const result = await tx(async () => {
    const payment = await one(
      `SELECT p.id, p.account_id, p.status, p.refunded_minor, p.amount_minor, p.currency, p.period_start, p.period_end,
              a.name, a.email, a.subscription_end
         FROM payments p LEFT JOIN accounts a ON a.id = p.account_id
        WHERE p.polar_order_id = ? FOR UPDATE OF p`,
      orderId,
    );
    if (!payment) {
      console.warn(`[porumbar] Polar: rambursare pentru comanda necunoscută ${orderId}, ignorată.`); // i18n: ro
      return { status: 'ignored' };
    }
    if (Number(payment.refunded_minor) >= refunded) return { status: 'duplicate' };
    const total = minor(order.total_amount) ?? Number(payment.amount_minor ?? 0);
    const full = order.status === 'refunded' || (total > 0 && refunded >= total);
    const target = full ? 'refunded' : 'partially_refunded';
    await run('UPDATE payments SET status = ?, refunded_minor = ?, adjusted_at = now() WHERE id = ?', target, refunded, payment.id);
    const sum = `${(refunded / 100).toFixed(2)} ${payment.currency ?? ''}`.trim();
    const what = full ? `rambursare totală (${sum})` : `rambursare parțială (${sum})`; // i18n: ro
    if (payment.account_id) {
      await logEvent(payment.account_id, 'payment', { note: `${what} în Polar (${orderId}) · abonamentul nu s-a schimbat` }); // i18n: ro
    }
    console.log(`[porumbar] Polar: ${what} pentru ${orderId}.`); // i18n: ro
    return { status: target, what, payment };
  });
  if (result.payment) await mailSellerRefund(orderId, result.what, result.payment);
  return { status: result.status };
}

/** Emailul către vânzător despre o rambursare (în română). Un email eșuat nu oprește webhook-ul. */
async function mailSellerRefund(orderId, what, p) {
  if (!config.adminEmail) return;
  const who = p.account_id ? `${p.name} (${p.email})` : 'plata nu era legată de niciun cont'; // i18n: ro
  const lines = [`Polar a făcut o ${what} pentru comanda ${orderId}.`, '', `Contul: ${who}`]; // i18n: ro
  if (p.account_id && p.period_end) {
    lines.push(`Perioada plătită cu ea: ${roDay(p.period_start)} → ${roDay(p.period_end)}`); // i18n: ro
    lines.push(`Abonamentul contului ține acum până pe ${roDay(p.subscription_end)}.`); // i18n: ro
  }
  lines.push('', 'Abonamentul nu s-a schimbat singur: hotărăști tu din consola vânzătorului (secțiunea „Rambursări”):', `${config.publicBaseUrl}/vanzator`, ''); // i18n: ro
  try {
    await sendMail({ to: config.adminEmail, subject: `Pigeonrama: ${what} ${p.account_id ? `pentru ${p.name}` : 'pentru o plată fără cont'}`, text: lines.join('\n') }); // i18n: ro
  } catch (e) {
    console.error(`[porumbar] Emailul către vânzător despre ${orderId} nu a plecat:`, e.message); // i18n: ro
  }
}

/** Un eveniment Polar deja verificat: ce face cu el. Orice alt tip = ignorat (dar 2xx, ca Polar să nu reîncerce). */
export async function handlePolarEvent(event) {
  switch (event?.type) {
    case 'order.paid':
      return applyOrder(event.data);
    case 'order.refunded':
    case 'order.updated':
      return applyRefund(event.data);
    default:
      return { status: 'ignored' };
  }
}

/** Moneda după țara contului: lei în România, yeni în Japonia, euro în rest (prețurile le pune vânzătorul în Polar). */
export const currencyFor = (country) => (country === 'RO' ? 'ron' : country === 'JP' ? 'jpy' : 'eur');

/** Adresa IP a omului doar dacă e publică (Polar o folosește pentru țară); cele locale nu se trimit. */
const publicIp = (ip) => {
  const v = String(ip ?? '').replace(/^::ffff:/, '');
  if (!v || v === '::1' || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|f[cd]|fe80)/i.test(v)) return undefined;
  return v;
};

/**
 * Sesiunea de plată Polar pentru cont (o sesiune nouă la fiecare apăsare; ține 24 de ore). Întoarce adresa paginii
 * de plată. Emailul și numele sunt completate (adresa nu: completată, Polar ar cere-o întreagă); țara o ia Polar din
 * IP; moneda o alegem noi după țara contului. Contul vine înapoi în webhook prin `metadata.accountId`.
 */
export async function createCheckout(account, ip, fetchImpl = fetch) {
  const body = {
    products: [config.polarProductId],
    currency: currencyFor(account.country),
    customer_email: account.email,
    customer_name: account.name,
    external_customer_id: String(account.id),
    metadata: { accountId: String(account.id) },
    locale: account.lang,
    success_url: `${config.publicBaseUrl}/plata/gata?checkout_id={CHECKOUT_ID}`,
    return_url: `${config.publicBaseUrl}/cont`,
    allow_discount_codes: false,
    ...(publicIp(ip) ? { customer_ip_address: publicIp(ip) } : {}),
  };
  const res = await fetchImpl(`${config.polarApi}/v1/checkouts/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.polarAccessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || typeof data?.url !== 'string' || !/^https:\/\//.test(data.url)) {
    console.error(`[porumbar] Polar: sesiunea de plată nu s-a făcut (${res.status}):`, JSON.stringify(data)?.slice(0, 500)); // i18n: ro
    throw new Error('polar-checkout');
  }
  return data.url;
}
