import { config } from './config.js';
import { t, ref, localeOf } from './i18n.js';
import { HttpError } from './http.js';
import { all, insert, run } from './db.js';
import { sendMail } from './mail.js';

/*
 * Abonamentele (consola vânzătorului): crescătorul plătește în afara aplicației, iar adminul (un singur cont, cel cu
 * emailul ADMIN_EMAIL) îi pune data de început; abonamentul ține un an. Înainte de plată: la înscriere contul e
 * neconfirmat; linkul din emailul de confirmare pornește singur proba de 30 de zile (fără vânzător). Fără abonament activ contul e „doar citire”:
 * vede și tipărește tot, dar nu adaugă și nu schimbă nimic (datele nu se pierd niciodată). Cu 30 de zile înainte de
 * expirare pleacă un singur email de memento, iar contul apare în consolă la „Expiră curând”.
 */

export const REMIND_DAYS = 30;
export const TRIAL_DAYS = 30;
/** Versiunea termenilor acceptați la înscriere (se schimbă când se schimbă termenii de pe sit). */
export const TERMS_VERSION = '2026-11-26';
const DAY = 86_400_000;

/** Ziua calendaristică în România (abonamentul se termină la miezul nopții de aici, nu la 02:00 / 03:00). */
export const isoDate = (d = new Date()) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Bucharest' });
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);

/** Data de sfârșit: exact un an după început (29 februarie → 28 februarie). */
export function plusOneYear(start) {
  const [y, m, d] = start.split('-').map(Number);
  const end = new Date(Date.UTC(y + 1, m - 1, d));
  if (end.getUTCMonth() !== m - 1) end.setUTCDate(0);
  return end.toISOString().slice(0, 10);
}

/** O zi calendaristică (YYYY-MM-DD) plus n zile. */
export function plusDays(isoDay, n) {
  return new Date(Date.parse(`${isoDay}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}

export const isAdminEmail = (email) => !!config.adminEmail && String(email ?? '').toLowerCase() === config.adminEmail;

/**
 * Starea contului: abonamentul plătit are întâietate (active, expiring = activ cu mai puțin de 30 de zile, expired =
 * ziua de sfârșit a trecut; ziua de sfârșit nu mai e inclusă). Fără abonament: unconfirmed (emailul nu e confirmat),
 * trial (proba de 30 de zile în curs) sau trial-ended (ziua de sfârșit a probei a venit). Rândul trebuie să aibă
 * email_confirmed_at și trial_end (vezi ACCOUNT_STATE_COLUMNS).
 */
export function subscriptionOf(a, now = new Date()) {
  const today = isoDate(now);
  const end = a.subscription_end ?? null;
  const daysLeft = end ? daysBetween(today, end) : null;
  const trialEnd = a.trial_end ?? null;
  const trialDaysLeft = trialEnd ? Math.max(0, daysBetween(today, trialEnd)) : null;
  let status;
  if (end) status = daysLeft <= 0 ? 'expired' : daysLeft <= REMIND_DAYS ? 'expiring' : 'active';
  else if (!a.email_confirmed_at) status = 'unconfirmed';
  else status = trialDaysLeft > 0 ? 'trial' : 'trial-ended';
  const admin = isAdminEmail(a.email);
  const active = admin || status === 'active' || status === 'expiring' || status === 'trial';
  return { start: a.subscription_start ?? null, end, status, daysLeft, active, trialEnd, trialDaysLeft };
}

/** Coloanele de care are nevoie subscriptionOf (pentru SELECT-uri care nu iau tot rândul). */
export const ACCOUNT_STATE_COLUMNS = 'subscription_start, subscription_end, email_confirmed_at, trial_end';

/** Eroarea pentru un cont „doar citire” (402): neconfirmat, proba terminată sau abonamentul expirat. */
export function readOnlyError(status) {
  const key = status === 'unconfirmed' ? 'eroare.doar_citire_neconfirmat' : status === 'trial-ended' ? 'eroare.doar_citire_proba' : 'eroare.doar_citire_expirat';
  const how = config.sellerContact ? ref('eroare.activare_contact', { contact: config.sellerContact }) : ref('eroare.activare_vanzator');
  return new HttpError(402, key, { activare: how });
}

export const logEvent = (accountId, kind, { amountMicros = null, note = null } = {}) =>
  insert('INSERT INTO account_events (account_id, kind, amount_micros, note, created_at) VALUES (?, ?, ?, ?, now())', accountId, kind, amountMicros, note);

/** Memento-urile: o dată pe abonament, când mai sunt cel mult 30 de zile. Întoarce câte au plecat. */
export async function sendReminders(now = new Date()) {
  const today = isoDate(now);
  const limit = isoDate(new Date(now.getTime() + REMIND_DAYS * DAY));
  const due = await all(
    `SELECT id, email, name, lang, subscription_end FROM accounts
      WHERE subscription_end > ? AND subscription_end <= ? AND reminder_sent_for IS DISTINCT FROM subscription_end`,
    today, limit,
  );
  for (const a of due) {
    const lang = a.lang ?? 'ro';
    const end = new Date(`${a.subscription_end}T00:00:00Z`).toLocaleDateString(localeOf(lang), { timeZone: 'UTC' });
    const how = config.sellerContact ? ref('mail.memento.plata_contact', { contact: config.sellerContact }) : ref('mail.memento.plata_vanzator');
    try {
      await sendMail({
        to: a.email,
        subject: t(lang, 'mail.memento.subiect'),
        text: t(lang, 'mail.memento.text', { nume: a.name, data: end, plata: how }),
      });
    } catch (e) {
      console.error(`[porumbar] Memento-ul pentru ${a.email} nu a plecat:`, e.message);
      continue;
    }
    await run('UPDATE accounts SET reminder_sent_for = subscription_end, reminder_sent_at = now() WHERE id = ?', a.id);
    // Nota din istoric e pentru consola vânzătorului (în română, cu data ca înainte).
    const endRo = new Date(`${a.subscription_end}T00:00:00Z`).toLocaleDateString('ro-RO', { timeZone: 'UTC' });
    await logEvent(a.id, 'reminder', { note: `expiră pe ${endRo}` }); // i18n: ro
  }
  return due.length;
}

/** Verificarea memento-urilor la pornire și apoi la 6 ore (serverul rulează o singură instanță). */
export function startReminders() {
  const tick = () => sendReminders().catch((e) => console.error('[porumbar] Memento-urile nu au rulat:', e.message));
  setTimeout(tick, 10_000).unref();
  setInterval(tick, 6 * 3600_000).unref();
}
