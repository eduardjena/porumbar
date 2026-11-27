import express from 'express';
import { config } from '../config.js';
import { all, insert, nowIso, one, run, tx } from '../db.js';
import { HttpError, badRequest, notFound, rateLimit, realDate, text } from '../http.js';
import { checkPassword, hashPassword, randomToken, requireAccount, sha256 } from '../accounts.js';
import { backupPassphrase, createBackup } from '../backup.js';
import { sendMail } from '../mail.js';
import { isAdminEmail, isoDate, logEvent, plusDays, plusOneYear, subscriptionOf, TRIAL_DAYS } from '../subscriptions.js';
import { isLang, t } from '../i18n.js';
import { releaseTrialPigeon } from '../trial-export.js';
import { PaymentLinkError, grantPaidYear } from '../polar.js';
import { YEAR_READS_WHERE, readsOfRow } from '../reads.js';

/*
 * Consola vânzătorului (un singur admin: contul cu ADMIN_EMAIL). Vede datele de cont ale crescătorilor (nume,
 * email, telefon, abonament, credit, câți porumbei au) – niciodată porumbeii lor. Activează abonamentul după plată,
 * adaugă credit pentru citirea pozelor, trimite un link de parolă nouă (parola o alege doar omul).
 */

const PASSWORD_LINK_HOURS = 24;
const INVITE_LINK_HOURS = 7 * 24; // linkul de activare al unui cont făcut din consolă

/** Un link de parolă (activare sau parolă nouă), folosit o singură dată. */
async function passwordLinkFor(accountId, hours) {
  const token = randomToken();
  await run(
    `INSERT INTO password_resets (token_hash, account_id, expires_at) VALUES (?, ?, now() + make_interval(hours => ?))`,
    sha256(token), accountId, hours,
  );
  return `${config.publicBaseUrl}/parola-noua/${token}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES = ['unconfirmed', 'trial', 'trial-ended', 'active', 'expiring', 'expired'];

function requireAdmin(req, res, next) {
  if (!req.account?.isAdmin) return next(new HttpError(403, 'Doar vânzătorul are acces aici.')); // i18n: ro
  next();
}

const validDate = (v, field) => realDate(v, field);

/** CNP-ul românesc: 13 cifre, ultima e cifra de control (cheia 279146358279). */
export function validCnp(cnp) {
  if (!/^[1-9]\d{12}$/.test(cnp)) return false;
  const key = '279146358279';
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(cnp[i]) * Number(key[i]);
  const control = sum % 11 === 10 ? 1 : sum % 11;
  return control === Number(cnp[12]);
}

/*
 * „Date pe fișă” din consolă: persoană fizică (nume, CNP) sau firmă (denumire, CUI, Reg. Com.), plus ce apare jos pe
 * fișă: numele de pe fișă, telefonul, adresa. CNP-ul și datele firmei rămân doar în consolă.
 */
function identityOf(b) {
  const kind = b.kind ?? 'pf';
  if (!['pf', 'firma'].includes(kind)) throw badRequest('Alege „persoană fizică” sau „firmă”.'); // i18n: ro
  const out = {
    kind,
    name: text(b.name, 'nume', { max: 120 }),
    sheetName: text(b.sheetName, 'numele de pe fișă', { max: 120, optional: true }), // i18n: ro
    phone: text(b.phone, 'telefon', { max: 40, optional: true }),
    address: text(b.address, 'adresă', { max: 300, optional: true }), // i18n: ro
    // Lipsă = rămâne cea de acum.
    lang: b.lang ?? null,
    cnp: null,
    companyName: null,
    cui: null,
    regCom: null,
  };
  if (out.lang !== null && !isLang(out.lang)) throw badRequest('Limba aleasă nu este disponibilă.'); // i18n: ro
  if (kind === 'pf') {
    // Lipit din alt document poate avea spații între cifre.
    out.cnp = text(typeof b.cnp === 'string' ? b.cnp.replace(/\s+/g, '') : b.cnp, 'CNP', { max: 13, optional: true });
    if (out.cnp && !validCnp(out.cnp)) throw badRequest('CNP-ul nu pare corect (13 cifre, verifică-l încă o dată).'); // i18n: ro
  } else {
    out.companyName = text(b.companyName, 'denumirea firmei', { max: 200, optional: true });
    const cui = text(b.cui, 'CUI', { max: 14, optional: true });
    out.cui = cui ? cui.replace(/\s+/g, '').toUpperCase() : null;
    if (out.cui && !/^(RO)?\d{2,10}$/.test(out.cui)) throw badRequest('CUI-ul nu pare corect (de exemplu RO12345678).');
    out.regCom = text(b.regCom, 'Nr. Reg. Com.', { max: 40, optional: true });
  }
  return out;
}

const IDENTITY_SQL = `UPDATE accounts SET legal_kind = ?, name = ?, pedigree_name = ?, phone = ?, address = ?, cnp = ?, company_name = ?,
  company_cui = ?, company_reg = ?, lang = COALESCE(?, lang) WHERE id = ?`;
const identityParams = (i, id) => [i.kind, i.name, i.sheetName, i.phone, i.address, i.cnp, i.companyName, i.cui, i.regCom, i.lang, id];
const NEED_SHEET_NAME = 'Pune întâi numele de pe fișă (la „Date pe fișă”), apoi activează abonamentul.'; // i18n: ro

function row(a) {
  const sub = subscriptionOf(a);
  return {
    id: a.id,
    name: a.name,
    email: a.email,
    phone: a.phone ?? null,
    // Date pe fișă (le pune doar vânzătorul).
    kind: a.legal_kind ?? 'pf',
    sheetName: a.pedigree_name ?? null,
    address: a.address ?? null,
    cnp: a.cnp ?? null,
    companyName: a.company_name ?? null,
    cui: a.company_cui ?? null,
    regCom: a.company_reg ?? null,
    lang: a.lang ?? 'ro',
    createdAt: a.created_at,
    lastLoginAt: a.last_login_at ?? null,
    lastSeenAt: a.last_seen_at ?? a.last_seen ?? null,
    subscriptionStart: a.subscription_start ?? null,
    subscriptionEnd: a.subscription_end ?? null,
    status: isAdminEmail(a.email) ? 'admin' : sub.status,
    daysLeft: sub.daysLeft,
    // Proba de 30 de zile (fără abonament plătit): ziua de sfârșit; și când și-a confirmat emailul.
    trialEnd: sub.trialEnd,
    emailConfirmedAt: a.email_confirmed_at ?? null,
    country: a.country ?? null,
    // În probă: porumbelul ales de om pentru fișă / QR (inelul sau numele), dacă l-a ales.
    trialPigeon: a.trial_pigeon_id ? a.trial_pigeon_label ?? a.trial_pigeon_ring ?? '—' : null,
    // Citirile din poze: în anul curent de abonament (folosite / limită, costul în dolari) și de la început.
    reads: readsOfRow(a),
    pigeons: Number(a.pigeons ?? 0),
    readsTotal: Number(a.reads ?? 0),
    reminderSentAt: a.reminder_sent_for && a.reminder_sent_for === a.subscription_end ? a.reminder_sent_at : null,
    // Făcut din consolă și încă fără parolă aleasă.
    invited: !!a.invited,
  };
}

/** O plată Polar pentru consolă; sumele rămân în unități mici (bani / cenți), consola le arată cu moneda. */
const paymentOut = (p) => ({
  id: p.id,
  order: p.polar_order_id,
  date: p.created_at,
  amount: p.amount_minor == null ? null : Number(p.amount_minor),
  refunded: Number(p.refunded_minor ?? 0),
  currency: p.currency ?? null,
  country: p.country ?? null,
  periodStart: p.period_start ?? null,
  periodEnd: p.period_end ?? null,
  status: p.status,
  accountId: p.account_id ?? null,
  adjustedAt: p.adjusted_at ?? null,
});
const PAYMENT_COLS = 'id, polar_order_id, created_at, amount_minor, refunded_minor, currency, country, period_start, period_end, status, account_id, adjusted_at';

const ACCOUNT_SQL = `
  SELECT a.*,
         (SELECT count(*) FROM pigeons p WHERE p.account_id = a.id AND p.kind = 'own') AS pigeons,
         (SELECT count(*) FROM pedigree_reads r WHERE r.account_id = a.id) AS reads,
         (SELECT count(*) FROM pedigree_reads r WHERE ${YEAR_READS_WHERE}) AS reads_year,
         (SELECT coalesce(sum(r.cost_micros), 0) FROM pedigree_reads r WHERE ${YEAR_READS_WHERE}) AS cost_year,
         (SELECT max(last_seen_at) FROM sessions s WHERE s.account_id = a.id) AS last_seen,
         (SELECT coalesce(p.ring_raw, p.name) FROM pigeons p WHERE p.id = a.trial_pigeon_id AND p.account_id = a.id) AS trial_pigeon_label
    FROM accounts a`;

async function accountRow(id) {
  const a = await one(`${ACCOUNT_SQL} WHERE a.id = ?`, Number(id) || 0);
  if (!a) throw notFound('Contul nu a fost găsit.'); // i18n: ro
  return a;
}

export function adminRouter() {
  const r = express.Router();
  r.use(requireAccount, requireAdmin);

  r.get('/accounts', async (req, res) => {
    const q = String(req.query.q ?? '').trim().toLowerCase();
    const filter = STATUSES.includes(req.query.filter) ? req.query.filter : null;
    const rows = (await all(`${ACCOUNT_SQL} ORDER BY a.created_at DESC`)).map(row).filter((a) => a.status !== 'admin');
    const counts = { all: rows.length, unconfirmed: 0, trial: 0, 'trial-ended': 0, active: 0, expiring: 0, expired: 0 };
    for (const a of rows) counts[a.status]++;
    const shown = rows
      .filter((a) => !filter || a.status === filter)
      .filter((a) => !q || [a.name, a.sheetName, a.companyName, a.email, a.phone].some((x) => String(x ?? '').toLowerCase().includes(q)));
    // De încasat primele: cele care expiră curând, după zile rămase.
    if (filter === 'expiring') shown.sort((a, b) => a.daysLeft - b.daysLeft);
    res.json({ accounts: shown, counts, mailConfigured: !!config.smtp });
  });

  // „Crescător nou”: contul fără parolă + link de activare (7 zile) pe care vânzătorul îl trimite pe telefon / email.
  // Opțional, în același pas: abonamentul (a plătit deja; citirile din poze sunt incluse în el).
  r.post('/accounts', async (req, res) => {
    const b = req.body ?? {};
    const ident = identityOf(b);
    const email = text(b.email, 'email', { max: 200 });
    if (!EMAIL_RE.test(email)) throw badRequest('Adresa de email nu pare corectă.'); // i18n: ro
    const { name, phone } = ident;
    const activate = b.activate === true;
    if (activate && !ident.sheetName) throw badRequest(NEED_SHEET_NAME);
    const start = activate ? validDate(b.start, 'Data de început') : null; // i18n: ro
    const note = text(b.note, 'notă', { max: 300, optional: true }); // i18n: ro
    if (isAdminEmail(email)) throw new HttpError(409, 'Există deja un cont cu acest email.'); // i18n: ro
    const created = await tx(async () => {
      if (await one('SELECT 1 FROM accounts WHERE lower(email) = lower(?)', email)) throw new HttpError(409, 'Există deja un cont cu acest email.'); // i18n: ro
      // Parola de pornire nu o știe nimeni (o valoare aleatoare); omul își alege parola din link.
      const id = await insert(
        // Contul făcut de vânzător e confirmat (omul nu mai confirmă nimic); proba de 30 de zile pornește de azi,
        // în afară de cazul în care vânzătorul îi activează de la început o perioadă plătită.
        `INSERT INTO accounts (email, name, phone, password_hash, invited, created_at, email_confirmed_at, trial_end)
         VALUES (?, ?, ?, ?, true, ?, now(), ?)`,
        email, name, phone, await hashPassword(randomToken()), nowIso(), activate ? null : plusDays(isoDate(), TRIAL_DAYS),
      );
      await run(IDENTITY_SQL, ...identityParams(ident, id));
      await logEvent(id, 'created', { note: note ?? 'făcut din consolă' }); // i18n: ro
      if (activate) {
        await run('UPDATE accounts SET subscription_start = ?, subscription_end = ? WHERE id = ?', start, plusOneYear(start), id);
        await logEvent(id, 'subscription', { note: [`${start} → ${plusOneYear(start)}`, note].filter(Boolean).join(' · ') });
      }
      return { id, link: await passwordLinkFor(id, INVITE_LINK_HOURS) };
    });
    let emailed = !!config.smtp;
    try {
      await sendMail({
        to: email,
        // Pentru crescător: în limba contului lui.
        subject: t(ident.lang ?? 'ro', 'mail.cont_nou.subiect'),
        text: t(ident.lang ?? 'ro', 'mail.cont_nou.text', { nume: name, link: created.link }),
      });
    } catch {
      emailed = false;
    }
    res.status(201).json({ account: row(await accountRow(created.id)), link: created.link, emailed });
  });

  r.get('/accounts/:id', async (req, res) => {
    const a = await accountRow(req.params.id);
    const events = await all('SELECT kind, amount_micros, note, created_at FROM account_events WHERE account_id = ? ORDER BY created_at DESC, id DESC LIMIT 200', a.id);
    const payments = await all(`SELECT ${PAYMENT_COLS} FROM payments WHERE account_id = ? ORDER BY created_at DESC, id DESC`, a.id);
    res.json({
      account: row(a),
      payments: payments.map(paymentOut),
      events: events.map((e) => ({ kind: e.kind, amount: e.amount_micros == null ? null : Math.round(e.amount_micros / 1e4) / 100, note: e.note, createdAt: e.created_at })),
    });
  });

  // Plățile Polar fără cont (plătitorul n-a venit din aplicație sau contul nu mai există): de legat de mână.
  r.get('/payments', async (req, res) => {
    const status = ['unmatched', 'applied', 'refunded', 'partially_refunded'].includes(req.query.status) ? req.query.status : null;
    const rows = await all(
      `SELECT ${PAYMENT_COLS} FROM payments ${status ? 'WHERE status = ?' : ''} ORDER BY created_at DESC, id DESC LIMIT 200`,
      ...(status ? [status] : []),
    );
    res.json({ payments: rows.map(paymentOut) });
  });

  // „Rambursări”: plățile rambursate (toate sau o parte) al căror an plătit e încă pe cont. Vânzătorul hotărăște;
  // după ce taie anul (din „Abonament”), nu mai apar.
  r.get('/refunds', async (req, res) => {
    const rows = await all(
      `SELECT ${PAYMENT_COLS.split(', ').map((c) => `p.${c}`).join(', ')}, a.name AS account_name, a.email AS account_email, a.subscription_end
         FROM payments p JOIN accounts a ON a.id = p.account_id
        WHERE p.status IN ('refunded', 'partially_refunded') AND p.period_end IS NOT NULL AND a.subscription_end >= p.period_end
        ORDER BY p.adjusted_at DESC NULLS LAST, p.id DESC LIMIT 200`,
    );
    res.json({ refunds: rows.map((p) => ({ ...paymentOut(p), accountName: p.account_name, accountEmail: p.account_email, subscriptionEnd: p.subscription_end })) });
  });

  // Leagă o plată nepotrivită de un cont: același an plătit ca la webhook (o singură dată; refuzat dacă nu e „unmatched”).
  r.post('/payments/:id/link', async (req, res) => {
    const accountId = Number(req.body?.accountId);
    if (!Number.isSafeInteger(accountId) || accountId < 1) throw badRequest('Alege contul crescătorului.'); // i18n: ro
    const paymentId = Number(req.params.id);
    if (!Number.isSafeInteger(paymentId) || paymentId < 1) throw notFound('Plata nu există.'); // i18n: ro
    try {
      res.json(await grantPaidYear(accountId, paymentId));
    } catch (e) {
      if (e instanceof PaymentLinkError) throw new HttpError(e.status, e.message);
      throw e;
    }
  });

  // Activare / prelungire după plată: data de început; sfârșitul = un an mai târziu (sau altă dată aleasă).
  r.post('/accounts/:id/subscription', async (req, res) => {
    const start = validDate(req.body?.start, 'Data de început'); // i18n: ro
    const end = req.body?.end ? validDate(req.body.end, 'Data de sfârșit') : plusOneYear(start); // i18n: ro
    if (end <= start) throw badRequest('Sfârșitul trebuie să fie după început.'); // i18n: ro
    const note = text(req.body?.note, 'notă', { max: 300, optional: true }); // i18n: ro
    const a = await tx(async () => {
      const acc = await accountRow(req.params.id);
      if (!acc.pedigree_name) throw badRequest(NEED_SHEET_NAME);
      await run('UPDATE accounts SET subscription_start = ?, subscription_end = ?, paid_on = NULL, extra_reads = 0 WHERE id = ?', start, end, acc.id);
      await logEvent(acc.id, 'subscription', { note: [`${start} → ${end}`, note].filter(Boolean).join(' · ') });
      return accountRow(acc.id);
    });
    res.json({ account: row(a) });
  });

  // „Date pe fișă”: tipul (persoană fizică / firmă), CNP / CUI, numele de pe fișă, telefonul, adresa. Crescătorul nu le
  // poate schimba; cu abonament activ numele de pe fișă nu se poate goli.
  r.patch('/accounts/:id/identity', async (req, res) => {
    const ident = identityOf(req.body ?? {});
    const a = await tx(async () => {
      const acc = await accountRow(req.params.id);
      if (!ident.sheetName && acc.subscription_start) throw badRequest('Numele de pe fișă nu poate rămâne gol la un cont activat.'); // i18n: ro
      await run(IDENTITY_SQL, ...identityParams(ident, acc.id));
      // În istoric: ce era și ce e acum (la o neînțelegere se vede cine ce a avut pe fișă).
      const was = { nume: acc.name, 'pe fișă': acc.pedigree_name, telefon: acc.phone, adresa: acc.address, limba: acc.lang }; // i18n: ro
      const now = { nume: ident.name, 'pe fișă': ident.sheetName, telefon: ident.phone, adresa: ident.address, limba: ident.lang ?? acc.lang }; // i18n: ro
      const changed = Object.keys(was)
        .filter((k) => (was[k] ?? null) !== (now[k] ?? null))
        .map((k) => `${k}: ${was[k] ?? '—'} → ${now[k] ?? '—'}`)
        .join(' · ');
      await logEvent(acc.id, 'identity', { note: changed || 'date actualizate' });
      return accountRow(acc.id);
    });
    res.json({ account: row(a) });
  });

  // Eliberează porumbelul ales în probă (de ex. omul a corectat inelul): omul poate alege din nou.
  r.delete('/accounts/:id/trial-pigeon', async (req, res) => {
    const acc = await accountRow(req.params.id);
    await releaseTrialPigeon(acc.id);
    res.json({ account: row(await accountRow(acc.id)) });
  });

  // Citiri din poze în plus pentru anul curent de abonament (negativ = corectură; nu coboară sub zero).
  r.post('/accounts/:id/reads', async (req, res) => {
    const amount = req.body?.amount;
    if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 10000) {
      throw badRequest('Scrie câte citiri, de exemplu 50 (sau -10 ca să scazi).'); // i18n: ro
    }
    const note = text(req.body?.note, 'notă', { max: 300, optional: true }); // i18n: ro
    const a = await tx(async () => {
      const acc = await accountRow(req.params.id);
      const { extra_reads: before } = await one('SELECT extra_reads FROM accounts WHERE id = ? FOR UPDATE', acc.id);
      const { extra_reads: after } = await one('UPDATE accounts SET extra_reads = GREATEST(0, extra_reads + ?) WHERE id = ? RETURNING extra_reads', amount, acc.id);
      // În istoric: ce s-a schimbat de fapt (o corectură de -10 pe 2 scade 2).
      const diff = Number(after) - Number(before);
      await logEvent(acc.id, 'reads', { note: [`${diff > 0 ? '+' : ''}${diff} citiri`, note].filter(Boolean).join(' · ') }); // i18n: ro
      return accountRow(acc.id);
    });
    res.json({ account: row(a) });
  });

  // Link de parolă nouă (24 h, o folosire): pleacă pe email și îl vede și adminul (îl poate trimite pe telefon).
  // Copia de siguranță a bazei de date (criptată cu BACKUP_PASSPHRASE): cere din nou parola vânzătorului, cel mult 5 pe
  // oră, și îi trimite un email la fiecare descărcare (dacă n-a fost el, află imediat). src/backup.js.
  r.get('/backup', (req, res) => res.json({ ready: !!backupPassphrase() }));
  r.post('/backup', rateLimit({ windowMs: 3600_000, max: 5, key: (req) => `backup:${req.account.id}` }), async (req, res) => {
    const passphrase = backupPassphrase();
    if (!passphrase) throw new HttpError(409, 'Pune întâi parola copiilor (BACKUP_PASSPHRASE, cel puțin 12 caractere) pe Railway.'); // i18n: ro
    const me = await one('SELECT password_hash FROM accounts WHERE id = ?', req.account.id);
    if (!me || !(await checkPassword(me.password_hash, req.body?.password))) throw new HttpError(403, 'Parola nu e bună.'); // i18n: ro
    const { file, counts } = await createBackup(passphrase);
    const stamp = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Bucharest' }).replace(' ', '-').replace(/:/g, '').slice(0, 15);
    const name = `pigeonrama-copie-${stamp}.pgrb`;
    console.log(`[porumbar] Copie de siguranță descărcată de ${req.account.email} (${file.length} octeți).`); // i18n: ro
    if (config.adminEmail) {
      const lines = [
        `S-a descărcat o copie de siguranță a bazei de date Pigeonrama (${name}).`, // i18n: ro
        '',
        `Cine: ${req.account.email}`, // i18n: ro
        `Când: ${new Date().toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' })}`, // i18n: ro
        `De la adresa IP: ${req.ip}`, // i18n: ro
        `Crescători: ${counts.accounts ?? 0} · porumbei: ${counts.pigeons ?? 0} · plăți: ${counts.payments ?? 0}`, // i18n: ro
        '',
        'Dacă nu ai fost tu, schimbă-ți imediat parola de vânzător și parola copiilor (BACKUP_PASSPHRASE) pe Railway.', // i18n: ro
        '',
      ];
      sendMail({ to: config.adminEmail, subject: 'Pigeonrama: s-a descărcat o copie de siguranță', text: lines.join('\n') }).catch((e) => // i18n: ro
        console.error('[porumbar] Emailul despre copia de siguranță nu a plecat:', e.message)); // i18n: ro
    }
    res.set({ 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' });
    res.send(file);
  });

  r.post('/accounts/:id/password-link', async (req, res) => {
    const a = await accountRow(req.params.id);
    // Cine n-a intrat încă niciodată (făcut din consolă) primește iar 7 zile; restul, 24 de ore.
    const hours = a.invited ? INVITE_LINK_HOURS : PASSWORD_LINK_HOURS;
    const link = await passwordLinkFor(a.id, hours);
    let emailed = !!config.smtp; // fără SMTP emailul doar se scrie în jurnalul serverului
    try {
      await sendMail({
        to: a.email,
        subject: t(a.lang, 'mail.parola.subiect'),
        text: t(a.lang, a.invited ? 'mail.parola_link.text_7zile' : 'mail.parola_link.text_24ore', { nume: a.name, link }),
      });
    } catch {
      emailed = false;
    }
    await logEvent(a.id, 'password-link', { note: emailed ? 'trimis pe email' : 'emailul nu a plecat' });
    res.json({ link, emailed, hours });
  });

  return r;
}
