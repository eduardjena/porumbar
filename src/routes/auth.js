import express from 'express';
import { one, run, insert, tx, nowIso } from '../db.js';
import { HttpError, badRequest, text, oneOf, rateLimit } from '../http.js';
import { config } from '../config.js';
import { sendMail } from '../mail.js';
import { onAccountDeleted } from '../hooks.js';
import {
  requireAccount, createSession, endSession, hashPassword, checkPassword, validatePassword,
  publicAccount, randomToken, sha256, TREE_VIEWS,
} from '../accounts.js';
import { isAdminEmail, isoDate, plusDays, logEvent, TERMS_VERSION, TRIAL_DAYS } from '../subscriptions.js';
import { isDisposableEmail } from '../disposable.js';
import { isLang, isPublicLang, t } from '../i18n.js';
import { readsOf } from '../reads.js';

const RESET_MINUTES = 60;
const CONFIRM_DAYS = 7;
let dummyHash = null;
const emailOf = (v) => {
  const e = text(v, 'camp.email', { max: 200 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw badRequest('eroare.email_gresit');
  return e;
};
// Țara, ca cod ISO din două litere (RO, HU, JP…); doar codurile cunoscute.
const REGIONS = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
const countryOf = (v) => {
  const c = String(v ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c) || !REGIONS.of(c)) throw badRequest('eroare.tara_lipsa');
  return c;
};

export function authRouter() {
  const r = express.Router();
  const loginLimit = rateLimit({
    windowMs: 15 * 60_000,
    max: 10,
    failuresOnly: true,
    // Același email cu spații sau alte litere mari e aceeași țintă (altfel limita s-ar ocoli).
    key: (req) => `${req.ip}|${String(req.body?.email ?? '').trim().toLowerCase()}`,
  });
  const registerLimit = rateLimit({
    windowMs: 60 * 60_000,
    max: Number(process.env.REGISTER_PER_HOUR) || (process.env.NODE_ENV === 'test' ? 100_000 : 20),
    key: (req) => `register|${req.ip}`,
  });
  const mailLimit = rateLimit({ windowMs: 15 * 60_000, max: 5, key: (req) => `forgot|${req.ip}` });
  // „Trimite din nou” linkul de confirmare: puține emailuri (găzduirea are o limită de emailuri pe zi).
  const resendLimit = rateLimit({ windowMs: 15 * 60_000, max: 3, key: (req) => `confirm|${req.ip}` });
  // Ghicitul token-urilor de confirmare (fiecare greșit = 400): se numără doar încercările eșuate.
  const confirmLimit = rateLimit({ windowMs: 15 * 60_000, max: 20, failuresOnly: true, key: (req) => `confirm-token|${req.ip}` });

  // Linkul de confirmare a emailului; un mail eșuat nu oprește nimic (omul are „Trimite din nou”).
  async function sendConfirmation(account) {
    const token = randomToken();
    await run(
      `INSERT INTO email_confirmations (token_hash, account_id, expires_at) VALUES (?, ?, now() + make_interval(days => ?))`,
      sha256(token), account.id, CONFIRM_DAYS,
    );
    try {
      await sendMail({
        to: account.email,
        subject: t(account.lang, 'mail.confirmare.subiect'),
        text: t(account.lang, 'mail.confirmare.text', { nume: account.name, link: `${config.publicBaseUrl}/confirma/${token}` }),
      });
    } catch (err) {
      console.error('[porumbar] Mailul de confirmare nu a plecat:', err.message); // i18n: ro
    }
  }
  // Ghicitul token-urilor de resetare (fiecare greșit = 400): se numără doar încercările eșuate, ca o resetare
  // reușită să nu blocheze omul. Token-ul e oricum de 256 de biți; limita e o apărare în plus.
  const resetLimit = rateLimit({ windowMs: 15 * 60_000, max: 20, failuresOnly: true, key: (req) => `reset|${req.ip}` });

  r.post('/register', registerLimit, async (req, res) => {
    // Câmp-capcană: oamenii nu-l văd, roboții îl completează. Răspuns de succes, dar fără cont și fără email.
    if (String(req.body?.website ?? '').trim()) return res.status(201).json({ account: null });
    if (req.body?.acceptTerms !== true) throw badRequest('eroare.termeni_necesari');
    const email = emailOf(req.body?.email);
    // Contul vânzătorului se face doar la pornirea serverului (ADMIN_EMAIL + ADMIN_PASSWORD), niciodată din formular:
    // altfel primul care se înregistra cu acel email devenea admin.
    if (isAdminEmail(email)) throw new HttpError(409, 'eroare.email_exista');
    if (isDisposableEmail(email)) throw badRequest('eroare.email_unica_folosinta');
    const password = validatePassword(req.body?.password);
    const name = text(req.body?.name, 'camp.nume', { max: 120 });
    const country = countryOf(req.body?.country);
    // Limba de pe ecran (toate limbile sunt publice; una nepublică o poate pune doar vânzătorul).
    const lang = req.body?.lang ?? 'ro';
    if (!isPublicLang(lang)) throw badRequest('eroare.limba_indisponibila');
    if (await one('SELECT 1 FROM accounts WHERE lower(email) = lower(?)', email)) {
      throw new HttpError(409, 'eroare.email_exista');
    }
    // Numele de la înscriere e și numele de pe fișă (îl poate schimba vânzătorul).
    const id = await insert(
      `INSERT INTO accounts (email, name, pedigree_name, password_hash, created_at, lang, country, terms_version, terms_accepted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, now())`,
      email, name, name, await hashPassword(password), nowIso(), lang, country, TERMS_VERSION,
    );
    await createSession(res, id, req.headers['user-agent']);
    // Contul e „doar citire” până omul deschide linkul din email; vânzătorul află abia la confirmare (un cont real).
    await sendConfirmation({ id, email, name, lang });
    res.status(201).json({ account: publicAccount(await one('SELECT * FROM accounts WHERE id = ?', id)) });
  });

  r.post('/login', loginLimit, async (req, res) => {
    const email = String(req.body?.email ?? '').trim();
    const account = email ? await one('SELECT * FROM accounts WHERE lower(email) = lower(?)', email) : null;
    // Comparația rulează și fără cont, ca durata să nu spună dacă emailul există.
    dummyHash ??= await hashPassword('fara-cont-fara-cont');
    const ok = await checkPassword(account?.password_hash ?? dummyHash, req.body?.password);
    // Același mesaj pentru orice greșeală (nu spune cine are cont), cu un îndemn pentru cei făcuți de vânzător.
    if (!account || !ok) throw new HttpError(401, 'eroare.login_gresit');
    await createSession(res, account.id, req.headers['user-agent']);
    res.json({ account: publicAccount(account) });
  });

  r.post('/logout', async (req, res) => {
    await endSession(req, res);
    res.status(204).end();
  });

  r.get('/me', requireAccount, async (req, res) => {
    // Citirile din poze ale anului de abonament (fără cost: acela e pentru vânzător).
    const { used, allowed, perYear, fullFrom } = await readsOf(req.account.id);
    const { n } = await one('SELECT COUNT(*)::int AS n FROM push_subscriptions WHERE account_id = ?', req.account.id);
    res.json({ account: { ...req.account, pushDevices: n, reads: { used, allowed, perYear, fullFrom } } });
  });

  r.patch('/me', requireAccount, async (req, res) => {
    const b = req.body ?? {};
    // Numele, numele de pe fișă, telefonul și adresa le pune vânzătorul (altfel oricine ar face fișe pe numele altora).
    // Adminul (vânzătorul) își schimbă singur datele lui.
    const locked = ['name', 'pedigreeName', 'phone', 'address'].filter((k) => b[k] !== undefined);
    if (locked.length && !req.account.isAdmin) {
      throw new HttpError(403, 'eroare.date_doar_vanzator');
    }
    const name = b.name === undefined ? req.account.name : text(b.name, 'camp.nume', { max: 120 });
    const pedigreeName = b.pedigreeName === undefined ? req.account.pedigreeName : text(b.pedigreeName, 'camp.nume_fisa', { max: 120, optional: true });
    const phone = b.phone === undefined ? req.account.phone : text(b.phone, 'camp.telefon', { max: 40, optional: true });
    const address = b.address === undefined ? req.account.address : text(b.address, 'camp.adresa', { max: 300, optional: true });
    // Limba: oricare publică sau cea pe care o are deja; una în probă o pune doar vânzătorul.
    let lang = req.account.lang;
    if (b.lang !== undefined) {
      if (!isLang(b.lang)) throw badRequest('eroare.limba_indisponibila');
      if (b.lang !== lang && !isPublicLang(b.lang) && !req.account.isAdmin) {
        throw new HttpError(403, 'eroare.limba_doar_vanzator');
      }
      lang = b.lang;
    }
    // Codul de crescător de pe clasament: litere mari, fără spații; gol = fără cod.
    let breederCode = req.account.breederCode;
    if (b.breederCode !== undefined) {
      const code = String(b.breederCode ?? '').toUpperCase().replace(/\s+/g, '');
      if (code && !/^[A-Z0-9.-]{2,20}$/.test(code)) throw badRequest('eroare.cod_crescator');
      breederCode = code || null;
    }
    const treeView = b.treeView === undefined ? req.account.treeView : oneOf(b.treeView, TREE_VIEWS, 'camp.vedere_arbore');
    const flag = (key) => {
      if (b[key] === undefined) return req.account[key];
      if (typeof b[key] !== 'boolean') throw badRequest('eroare.bife');
      return b[key];
    };
    await run(
      `UPDATE accounts SET name = ?, pedigree_name = ?, phone = ?, address = ?, tree_view = ?, show_phone = ?, show_address = ?, show_email = ?,
              print_phone = ?, print_address = ?, print_email = ?, lang = ?, breeder_code = ?, reminder_email = ? WHERE id = ?`,
      name, pedigreeName, phone, address, treeView, flag('showPhone'), flag('showAddress'), flag('showEmail'),
      flag('printPhone'), flag('printAddress'), flag('printEmail'), lang, breederCode, flag('reminderEmail'), req.account.id,
    );
    res.json({ account: publicAccount(await one('SELECT * FROM accounts WHERE id = ?', req.account.id)) });
  });

  r.delete('/me', requireAccount, loginLimit, async (req, res) => {
    const account = await one('SELECT * FROM accounts WHERE id = ?', req.account.id);
    if (!(await checkPassword(account.password_hash, req.body?.password))) throw new HttpError(401, 'eroare.parola_gresita');
    await tx(async () => {
      await onAccountDeleted(account.id);
      await run('DELETE FROM accounts WHERE id = ?', account.id);
    });
    res.clearCookie('porumbar_session', { path: '/' });
    res.status(204).end();
  });

  r.post('/forgot', mailLimit, async (req, res) => {
    const email = String(req.body?.email ?? '').trim();
    const account = email ? await one('SELECT * FROM accounts WHERE lower(email) = lower(?)', email) : null;
    if (account) {
      const token = randomToken();
      await run(
        `INSERT INTO password_resets (token_hash, account_id, expires_at) VALUES (?, ?, now() + make_interval(mins => ?))`,
        sha256(token), account.id, RESET_MINUTES,
      );
      const link = `${config.publicBaseUrl}/parola-noua/${token}`;
      await sendMail({
        to: account.email,
        subject: t(account.lang, 'mail.parola.subiect'),
        text: t(account.lang, 'mail.parola_uitata.text', { nume: account.name, link }),
      });
    } else if (email && process.env.NODE_ENV !== 'test') {
      console.log('[porumbar] Parolă uitată: adresa scrisă nu e a niciunui cont; nu s-a trimis nimic.'); // i18n: ro
    }
    // Același răspuns pentru orice email: nu se află cine are cont.
    res.json({ ok: true });
  });

  r.post('/reset', resetLimit, async (req, res) => {
    const password = validatePassword(req.body?.password);
    const hash = sha256(String(req.body?.token ?? ''));
    const accountId = await tx(async () => {
      const row = await one('SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > now() FOR UPDATE', hash);
      if (!row) throw badRequest('eroare.link_expirat');
      // Linkul folosit și toate celelalte linkuri încă nefolosite ale contului nu mai merg.
      await run('UPDATE password_resets SET used_at = now() WHERE account_id = ? AND used_at IS NULL', row.account_id);
      // Linkul a venit pe email, deci emailul e al omului: dacă nu era confirmat, se confirmă acum și pornește proba.
      await run(
        `UPDATE accounts SET password_hash = ?, invited = false, email_confirmed_at = COALESCE(email_confirmed_at, now()),
                trial_end = CASE WHEN email_confirmed_at IS NULL AND trial_end IS NULL AND subscription_end IS NULL THEN ?::date ELSE trial_end END
          WHERE id = ?`,
        await hashPassword(password), plusDays(isoDate(), TRIAL_DAYS), row.account_id,
      );
      // Parola nouă închide toate sesiunile vechi (cineva poate fi intrat cu parola veche).
      await run('DELETE FROM sessions WHERE account_id = ?', row.account_id);
      return row.account_id;
    });
    await createSession(res, accountId, req.headers['user-agent']);
    res.json({ account: publicAccount(await one('SELECT * FROM accounts WHERE id = ?', accountId)) });
  });

  r.post('/confirm', confirmLimit, async (req, res) => {
    const hash = sha256(String(req.body?.token ?? ''));
    const { accountId, first } = await tx(async () => {
      const row = await one('SELECT * FROM email_confirmations WHERE token_hash = ? AND used_at IS NULL AND expires_at > now() FOR UPDATE', hash);
      if (!row) throw badRequest('eroare.link_expirat');
      await run('UPDATE email_confirmations SET used_at = now() WHERE account_id = ? AND used_at IS NULL', row.account_id);
      const before = await one('SELECT email_confirmed_at FROM accounts WHERE id = ? FOR UPDATE', row.account_id);
      // Proba de 30 de zile pornește la confirmare (doar o dată, și doar fără abonament plătit).
      await run(
        `UPDATE accounts SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
                trial_end = CASE WHEN trial_end IS NULL AND subscription_end IS NULL THEN ?::date ELSE trial_end END
          WHERE id = ?`,
        plusDays(isoDate(), TRIAL_DAYS), row.account_id,
      );
      await logEvent(row.account_id, 'confirmed', { note: 'email confirmat' }); // i18n: ro
      return { accountId: row.account_id, first: !before?.email_confirmed_at };
    });
    const account = await one('SELECT * FROM accounts WHERE id = ?', accountId);
    // Vânzătorul află de contul nou abia acum: e un cont real, cu emailul confirmat. Un mail eșuat nu oprește nimic.
    if (first && config.adminEmail) {
      try {
        await sendMail({
          to: config.adminEmail,
          // Pentru vânzător: în română.
          subject: `Cont nou în Pigeonrama: ${account.name}`, // i18n: ro
          text:
            `Și-a făcut cont în Pigeonrama și și-a confirmat emailul:\n\nNume: ${account.name}\nEmail: ${account.email}\nȚara: ${account.country ?? '—'}\n` + // i18n: ro
            `Data: ${new Date().toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' })}\n\n` + // i18n: ro
            `Proba de 30 de zile a pornit singură, până pe ${account.trial_end ? new Date(`${account.trial_end}T00:00:00Z`).toLocaleDateString('ro-RO', { timeZone: 'UTC' }) : '—'}. Îl găsești în consola vânzătorului:\n${config.publicBaseUrl}/vanzator\n`, // i18n: ro
        });
      } catch (err) {
        console.error('[porumbar] Mailul despre contul nou nu a plecat:', err.message); // i18n: ro
      }
    }
    res.json({ account: publicAccount(account) });
  });

  r.post('/confirm/resend', requireAccount, resendLimit, async (req, res) => {
    const a = await one('SELECT * FROM accounts WHERE id = ?', req.account.id);
    if (!a.email_confirmed_at) {
      // Linkurile vechi nu mai merg.
      await run('UPDATE email_confirmations SET used_at = now() WHERE account_id = ? AND used_at IS NULL', a.id);
      await sendConfirmation(a);
    }
    res.json({ ok: true });
  });

  return r;
}
