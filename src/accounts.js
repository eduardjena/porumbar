import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { one, run, nowIso } from './db.js';
import { HttpError, badRequest } from './http.js';

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
export const TREE_VIEWS = ['carduri', 'evantai', 'sange', 'retea', '3d'];

export const publicAccount = (a) => ({
  id: a.id,
  email: a.email,
  name: a.name,
  phone: a.phone ?? null,
  address: a.address ?? null,
  treeView: TREE_VIEWS.includes(a.tree_view) ? a.tree_view : TREE_VIEWS[0],
  // Ce apare pe pedigree-ul public și pe cel tipărit, pe lângă nume (implicit nimic).
  showPhone: !!a.show_phone,
  showAddress: !!a.show_address,
  showEmail: !!a.show_email,
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
      `SELECT a.id, a.email, a.name, a.phone, a.address, a.tree_view, a.show_phone, a.show_address, a.show_email, s.last_seen_at
         FROM sessions s JOIN accounts a ON a.id = s.account_id
        WHERE s.token_hash = ? AND s.last_seen_at > now() - make_interval(days => ?)`,
      hash, SESSION_DAYS,
    );
    if (!row) throw new HttpError(401, 'Trebuie să intri în cont.');
    // Actualizat cel mult o dată pe oră, ca sesiunea să nu expire cât e folosită.
    if (Date.now() - Date.parse(row.last_seen_at) > 3600_000) await run('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?', nowIso(), hash);
    req.account = publicAccount(row);
    req.sessionHash = hash;
    next();
  } catch (err) {
    next(err);
  }
}
