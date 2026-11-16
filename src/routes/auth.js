import express from 'express';
import { one, run, insert, tx, nowIso } from '../db.js';
import { HttpError, badRequest, text, rateLimit } from '../http.js';
import { config } from '../config.js';
import { sendMail } from '../mail.js';
import { onAccountDeleted } from '../hooks.js';
import {
  requireAccount, createSession, endSession, hashPassword, checkPassword, validatePassword,
  publicAccount, randomToken, sha256,
} from '../accounts.js';

const RESET_MINUTES = 60;
let dummyHash = null;
const emailOf = (v) => {
  const e = text(v, 'email', { max: 200 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw badRequest('Adresa de email nu pare corectă.');
  return e;
};

export function authRouter() {
  const r = express.Router();
  const loginLimit = rateLimit({
    windowMs: 15 * 60_000,
    max: 10,
    failuresOnly: true,
    key: (req) => `${req.ip}|${String(req.body?.email ?? '').toLowerCase()}`,
  });
  const mailLimit = rateLimit({ windowMs: 15 * 60_000, max: 5, key: (req) => `forgot|${req.ip}` });

  r.post('/register', async (req, res) => {
    const email = emailOf(req.body?.email);
    const password = validatePassword(req.body?.password);
    const name = text(req.body?.name, 'nume', { max: 120 });
    if (await one('SELECT 1 FROM accounts WHERE lower(email) = lower(?)', email)) {
      throw new HttpError(409, 'Există deja un cont cu acest email.');
    }
    const id = await insert(
      'INSERT INTO accounts (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)',
      email, name, await hashPassword(password), nowIso(),
    );
    await createSession(res, id, req.headers['user-agent']);
    res.status(201).json({ account: publicAccount(await one('SELECT * FROM accounts WHERE id = ?', id)) });
  });

  r.post('/login', loginLimit, async (req, res) => {
    const email = String(req.body?.email ?? '').trim();
    const account = email ? await one('SELECT * FROM accounts WHERE lower(email) = lower(?)', email) : null;
    // Comparația rulează și fără cont, ca durata să nu spună dacă emailul există.
    dummyHash ??= await hashPassword('fara-cont-fara-cont');
    const ok = await checkPassword(account?.password_hash ?? dummyHash, req.body?.password);
    if (!account || !ok) throw new HttpError(401, 'Email sau parolă greșită.');
    await createSession(res, account.id, req.headers['user-agent']);
    res.json({ account: publicAccount(account) });
  });

  r.post('/logout', async (req, res) => {
    await endSession(req, res);
    res.status(204).end();
  });

  r.get('/me', requireAccount, (req, res) => res.json({ account: req.account }));

  r.patch('/me', requireAccount, async (req, res) => {
    const b = req.body ?? {};
    const name = b.name === undefined ? req.account.name : text(b.name, 'nume', { max: 120 });
    const phone = b.phone === undefined ? req.account.phone : text(b.phone, 'telefon', { max: 40, optional: true });
    const address = b.address === undefined ? req.account.address : text(b.address, 'adresă', { max: 300, optional: true });
    await run('UPDATE accounts SET name = ?, phone = ?, address = ? WHERE id = ?', name, phone, address, req.account.id);
    res.json({ account: publicAccount(await one('SELECT * FROM accounts WHERE id = ?', req.account.id)) });
  });

  r.delete('/me', requireAccount, loginLimit, async (req, res) => {
    const account = await one('SELECT * FROM accounts WHERE id = ?', req.account.id);
    if (!(await checkPassword(account.password_hash, req.body?.password))) throw new HttpError(401, 'Parola nu este corectă.');
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
        subject: 'Parolă nouă pentru Porumbar',
        text:
          `Bună, ${account.name}!\n\nCineva (sperăm că tu) a cerut o parolă nouă pentru contul tău Porumbar.\n` +
          `Deschide linkul de mai jos în cel mult o oră și alege parola nouă:\n\n${link}\n\n` +
          'Dacă nu ai cerut tu, nu face nimic: parola ta rămâne aceeași.\n',
      });
    }
    // Același răspuns pentru orice email: nu se află cine are cont.
    res.json({ ok: true });
  });

  r.post('/reset', async (req, res) => {
    const password = validatePassword(req.body?.password);
    const hash = sha256(String(req.body?.token ?? ''));
    const accountId = await tx(async () => {
      const row = await one('SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > now() FOR UPDATE', hash);
      if (!row) throw badRequest('Linkul a expirat sau a fost folosit.');
      await run('UPDATE password_resets SET used_at = now() WHERE token_hash = ?', hash);
      await run('UPDATE accounts SET password_hash = ? WHERE id = ?', await hashPassword(password), row.account_id);
      // Parola nouă închide toate sesiunile vechi (cineva poate fi intrat cu parola veche).
      await run('DELETE FROM sessions WHERE account_id = ?', row.account_id);
      return row.account_id;
    });
    await createSession(res, accountId, req.headers['user-agent']);
    res.json({ account: publicAccount(await one('SELECT * FROM accounts WHERE id = ?', accountId)) });
  });

  return r;
}
