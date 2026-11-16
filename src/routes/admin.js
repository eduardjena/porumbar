import express from 'express';
import { config } from '../config.js';
import { all, insert, nowIso, one, run, tx } from '../db.js';
import { HttpError, badRequest, notFound, realDate, text } from '../http.js';
import { hashPassword, randomToken, requireAccount, sha256 } from '../accounts.js';
import { sendMail } from '../mail.js';
import { isAdminEmail, logEvent, plusOneYear, subscriptionOf } from '../subscriptions.js';

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
const STATUSES = ['pending', 'active', 'expiring', 'expired'];

function requireAdmin(req, res, next) {
  if (!req.account?.isAdmin) return next(new HttpError(403, 'Doar vânzătorul are acces aici.'));
  next();
}

const validDate = (v, field) => realDate(v, field);

function row(a) {
  const sub = subscriptionOf(a);
  return {
    id: a.id,
    name: a.name,
    email: a.email,
    phone: a.phone ?? null,
    createdAt: a.created_at,
    lastLoginAt: a.last_login_at ?? null,
    lastSeenAt: a.last_seen_at ?? a.last_seen ?? null,
    subscriptionStart: a.subscription_start ?? null,
    subscriptionEnd: a.subscription_end ?? null,
    status: isAdminEmail(a.email) ? 'admin' : sub.status,
    daysLeft: sub.daysLeft,
    aiCredit: Math.round(Number(a.ai_credit_micros ?? 0) / 1e4) / 100,
    pigeons: Number(a.pigeons ?? 0),
    reads: Number(a.reads ?? 0),
    reminderSentAt: a.reminder_sent_for && a.reminder_sent_for === a.subscription_end ? a.reminder_sent_at : null,
    // Făcut din consolă și încă fără parolă aleasă.
    invited: !!a.invited,
  };
}

const ACCOUNT_SQL = `
  SELECT a.*,
         (SELECT count(*) FROM pigeons p WHERE p.account_id = a.id AND p.kind = 'own') AS pigeons,
         (SELECT count(*) FROM pedigree_reads r WHERE r.account_id = a.id) AS reads,
         (SELECT max(last_seen_at) FROM sessions s WHERE s.account_id = a.id) AS last_seen
    FROM accounts a`;

async function accountRow(id) {
  const a = await one(`${ACCOUNT_SQL} WHERE a.id = ?`, Number(id) || 0);
  if (!a) throw notFound('Contul nu a fost găsit.');
  return a;
}

export function adminRouter() {
  const r = express.Router();
  r.use(requireAccount, requireAdmin);

  r.get('/accounts', async (req, res) => {
    const q = String(req.query.q ?? '').trim().toLowerCase();
    const filter = STATUSES.includes(req.query.filter) ? req.query.filter : null;
    const rows = (await all(`${ACCOUNT_SQL} ORDER BY a.created_at DESC`)).map(row).filter((a) => a.status !== 'admin');
    const counts = { all: rows.length, pending: 0, active: 0, expiring: 0, expired: 0 };
    for (const a of rows) counts[a.status]++;
    const shown = rows
      .filter((a) => !filter || a.status === filter)
      .filter((a) => !q || [a.name, a.email, a.phone].some((x) => String(x ?? '').toLowerCase().includes(q)));
    // De încasat primele: cele care expiră curând, după zile rămase.
    if (filter === 'expiring') shown.sort((a, b) => a.daysLeft - b.daysLeft);
    res.json({ accounts: shown, counts, mailConfigured: !!config.smtpUrl });
  });

  // „Crescător nou”: contul fără parolă + link de activare (7 zile) pe care vânzătorul îl trimite pe telefon / email.
  // Opțional, în același pas: abonamentul (a plătit deja) și credit pentru citiri.
  r.post('/accounts', async (req, res) => {
    const b = req.body ?? {};
    const name = text(b.name, 'nume', { max: 120 });
    const email = text(b.email, 'email', { max: 200 });
    if (!EMAIL_RE.test(email)) throw badRequest('Adresa de email nu pare corectă.');
    const phone = text(b.phone, 'telefon', { max: 40, optional: true });
    const activate = b.activate === true;
    const start = activate ? validDate(b.start, 'Data de început') : null;
    const credit = b.credit == null || b.credit === 0 ? 0 : b.credit;
    if (typeof credit !== 'number' || !Number.isFinite(credit) || credit < 0 || credit > 1000) throw badRequest('Creditul se scrie în dolari, de exemplu 5.');
    const note = text(b.note, 'notă', { max: 300, optional: true });
    if (isAdminEmail(email)) throw new HttpError(409, 'Există deja un cont cu acest email.');
    const created = await tx(async () => {
      if (await one('SELECT 1 FROM accounts WHERE lower(email) = lower(?)', email)) throw new HttpError(409, 'Există deja un cont cu acest email.');
      // Parola de pornire nu o știe nimeni (o valoare aleatoare); omul își alege parola din link.
      const id = await insert(
        'INSERT INTO accounts (email, name, phone, password_hash, invited, created_at) VALUES (?, ?, ?, ?, true, ?)',
        email, name, phone, await hashPassword(randomToken()), nowIso(),
      );
      await logEvent(id, 'created', { note: note ?? 'făcut din consolă' });
      if (activate) {
        await run('UPDATE accounts SET subscription_start = ?, subscription_end = ? WHERE id = ?', start, plusOneYear(start), id);
        await logEvent(id, 'subscription', { note: [`${start} → ${plusOneYear(start)}`, note].filter(Boolean).join(' · ') });
      }
      if (credit > 0) {
        const micros = Math.round(credit * 1e6);
        await run('UPDATE accounts SET ai_credit_micros = ? WHERE id = ?', micros, id);
        await logEvent(id, 'credit', { amountMicros: micros, note });
      }
      return { id, link: await passwordLinkFor(id, INVITE_LINK_HOURS) };
    });
    let emailed = !!config.smtpUrl;
    try {
      await sendMail({
        to: email,
        subject: 'Contul tău Porumbar',
        text:
          `Bună, ${name}!\n\nȚi-am făcut un cont în Porumbar, programul pentru evidența porumbeilor și a pedigree-urilor.\n` +
          `Deschide linkul de mai jos în cel mult 7 zile și alege-ți parola; apoi intri direct în porumbarul tău:\n\n${created.link}\n\n` +
          'Parola o alegi doar tu; nimeni altcineva nu o vede.\n',
      });
    } catch {
      emailed = false;
    }
    res.status(201).json({ account: row(await accountRow(created.id)), link: created.link, emailed });
  });

  r.get('/accounts/:id', async (req, res) => {
    const a = await accountRow(req.params.id);
    const events = await all('SELECT kind, amount_micros, note, created_at FROM account_events WHERE account_id = ? ORDER BY created_at DESC, id DESC LIMIT 200', a.id);
    res.json({
      account: row(a),
      events: events.map((e) => ({ kind: e.kind, amount: e.amount_micros == null ? null : Math.round(e.amount_micros / 1e4) / 100, note: e.note, createdAt: e.created_at })),
    });
  });

  // Activare / prelungire după plată: data de început; sfârșitul = un an mai târziu (sau altă dată aleasă).
  r.post('/accounts/:id/subscription', async (req, res) => {
    const start = validDate(req.body?.start, 'Data de început');
    const end = req.body?.end ? validDate(req.body.end, 'Data de sfârșit') : plusOneYear(start);
    if (end <= start) throw badRequest('Sfârșitul trebuie să fie după început.');
    const note = text(req.body?.note, 'notă', { max: 300, optional: true });
    const a = await tx(async () => {
      const acc = await accountRow(req.params.id);
      await run('UPDATE accounts SET subscription_start = ?, subscription_end = ? WHERE id = ?', start, end, acc.id);
      await logEvent(acc.id, 'subscription', { note: [`${start} → ${end}`, note].filter(Boolean).join(' · ') });
      return accountRow(acc.id);
    });
    res.json({ account: row(a) });
  });

  // Credit pentru citirea pozelor, în dolari (negativ = corectură). Nu coboară sub zero.
  r.post('/accounts/:id/credit', async (req, res) => {
    const amount = req.body?.amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 1000) {
      throw badRequest('Scrie suma în dolari, de exemplu 5.');
    }
    const micros = Math.round(amount * 1e6);
    const note = text(req.body?.note, 'notă', { max: 300, optional: true });
    const a = await tx(async () => {
      const acc = await accountRow(req.params.id);
      const { ai_credit_micros: before } = await one('SELECT ai_credit_micros FROM accounts WHERE id = ? FOR UPDATE', acc.id);
      const { ai_credit_micros: after } = await one(
        'UPDATE accounts SET ai_credit_micros = GREATEST(0, ai_credit_micros + ?) WHERE id = ? RETURNING ai_credit_micros', micros, acc.id,
      );
      // În istoric: ce s-a schimbat de fapt (o corectură de -10 $ pe 2 $ scade 2 $, nu 10 $).
      await logEvent(acc.id, 'credit', { amountMicros: Number(after) - Number(before), note });
      return accountRow(acc.id);
    });
    res.json({ account: row(a) });
  });

  // Link de parolă nouă (24 h, o folosire): pleacă pe email și îl vede și adminul (îl poate trimite pe telefon).
  r.post('/accounts/:id/password-link', async (req, res) => {
    const a = await accountRow(req.params.id);
    // Cine n-a intrat încă niciodată (făcut din consolă) primește iar 7 zile; restul, 24 de ore.
    const hours = a.invited ? INVITE_LINK_HOURS : PASSWORD_LINK_HOURS;
    const link = await passwordLinkFor(a.id, hours);
    let emailed = !!config.smtpUrl; // fără SMTP emailul doar se scrie în jurnalul serverului
    try {
      await sendMail({
        to: a.email,
        subject: 'Parolă nouă pentru Porumbar',
        text:
          `Bună, ${a.name}!\n\nCa să intri în contul tău Porumbar, deschide linkul de mai jos în cel mult ${a.invited ? '7 zile' : '24 de ore'} ` +
          `și alege-ți o parolă nouă:\n\n${link}\n\nParola o alegi doar tu; nimeni altcineva nu o vede.\n`,
      });
    } catch {
      emailed = false;
    }
    await logEvent(a.id, 'password-link', { note: emailed ? 'trimis pe email' : 'emailul nu a plecat' });
    res.json({ link, emailed, hours });
  });

  return r;
}
