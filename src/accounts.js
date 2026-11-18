import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { one, run, nowIso } from './db.js';
import { HttpError, badRequest } from './http.js';
import { isAdminEmail, readOnlyMessage, subscriptionOf } from './subscriptions.js';

export const SESSION_COOKIE = 'porumbar_session';
const SESSION_DAYS = 90;

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = () => crypto.randomBytes(32).toString('base64url');
export const hashPassword = (password) => bcrypt.hash(password, 12);
export const checkPassword = (hash, password) => bcrypt.compare(String(password ?? ''), hash);

export function validatePassword(password) {
  if (typeof password !== 'string' || [...password].length < 10) throw badRequest('Parola trebuie să aibă cel puțin 10 caractere.');
  if (password.length > 200) throw badRequest('Parola este prea lungă.');
  return password;
}

/** Vederile Arborelui; prima e cea implicită. */
export const TREE_VIEWS = ['carduri', 'evantai', 'sange', 'retea'];

export const publicAccount = (a) => ({
  id: a.id,
  email: a.email,
  name: a.name,
  // Numele scris jos pe fișă, telefonul și adresa: le pune vânzătorul (omul doar le vede). CNP-ul / datele firmei nu
  // ajung aici niciodată.
  pedigreeName: a.pedigree_name ?? null,
  phone: a.phone ?? null,
  address: a.address ?? null,
  treeView: TREE_VIEWS.includes(a.tree_view) ? a.tree_view : TREE_VIEWS[0],
  // Ce apare pe linkul public / codul QR, pe lângă nume (implicit nimic).
  showPhone: !!a.show_phone,
  showAddress: !!a.show_address,
  showEmail: !!a.show_email,
  // Ce apare pe foaia tipărită și în PDF, pe lângă nume (implicit tot).
  printPhone: a.print_phone !== false,
  printAddress: a.print_address !== false,
  printEmail: a.print_email !== false,
  isAdmin: isAdminEmail(a.email),
  sellerContact: config.sellerContact,
  subscription: subscriptionOf(a),
  // Creditul pentru citirea pedigree-urilor din poze, în dolari (2 zecimale).
  aiCredit: Math.round(Number(a.ai_credit_micros ?? 0) / 1e4) / 100,
});

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    // Alte aplicații de pe același domeniu pot avea cookie-uri cu „%” invalid: le ignorăm, nu cădem.
    try {
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      /* cookie străin, ignorat */
    }
  }
  return out;
}

/** Deschide o sesiune nouă pentru cont și pune cookie-ul. */
export async function createSession(res, accountId, userAgent) {
  const token = randomToken();
  const now = nowIso();
  await run(
    'INSERT INTO sessions (token_hash, account_id, created_at, last_seen_at, user_agent) VALUES (?, ?, ?, ?, ?)',
    sha256(token), accountId, now, now, String(userAgent ?? '').slice(0, 300) || null,
  );
  // Ultima intrare în cont (o vede vânzătorul în consolă).
  await run('UPDATE accounts SET last_login_at = ?, last_seen_at = ? WHERE id = ?', now, now, accountId);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    maxAge: SESSION_DAYS * 24 * 3600 * 1000,
    path: '/',
  });
}

export async function endSession(req, res) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) await run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

/** Cererea trebuie să vină dintr-un cont intrat: pune `req.account` și `req.sessionHash`. */
export async function requireAccount(req, res, next) {
  try {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (!token) throw new HttpError(401, 'Trebuie să intri în cont.');
    const hash = sha256(token);
    const row = await one(
      `SELECT a.id, a.email, a.name, a.pedigree_name, a.phone, a.address, a.tree_view, a.show_phone, a.show_address, a.show_email,
              a.print_phone, a.print_address, a.print_email,
              a.subscription_start, a.subscription_end, a.ai_credit_micros, s.last_seen_at
         FROM sessions s JOIN accounts a ON a.id = s.account_id
        WHERE s.token_hash = ? AND s.last_seen_at > now() - make_interval(days => ?)`,
      hash, SESSION_DAYS,
    );
    if (!row) throw new HttpError(401, 'Trebuie să intri în cont.');
    // Actualizat cel mult o dată pe oră, ca sesiunea să nu expire cât e folosită.
    if (Date.now() - Date.parse(row.last_seen_at) > 3600_000) {
      const now = nowIso();
      await run('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?', now, hash);
      await run('UPDATE accounts SET last_seen_at = ? WHERE id = (SELECT account_id FROM sessions WHERE token_hash = ?)', now, hash);
    }
    req.account = publicAccount(row);
    req.sessionHash = hash;
    // Fără abonament activ: doar citire. Setările contului (/api/auth) și consola (/api/admin) merg oricum.
    const writes = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const exempt = /^\/api\/(auth|admin)(\/|$)/.test(req.originalUrl);
    if (writes && !exempt && !req.account.subscription.active) throw new HttpError(402, readOnlyMessage(req.account.subscription.status));
    next();
  } catch (err) {
    next(err);
  }
}
