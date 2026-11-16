import { config } from './config.js';
import { all, insert, run } from './db.js';
import { sendMail } from './mail.js';

/*
 * Abonamentele (consola vânzătorului): crescătorul plătește în afara aplicației, iar adminul (un singur cont, cel cu
 * emailul ADMIN_EMAIL) îi pune data de început; abonamentul ține un an. Fără abonament activ contul e „doar citire”:
 * vede și tipărește tot, dar nu adaugă și nu schimbă nimic (datele nu se pierd niciodată). Cu 30 de zile înainte de
 * expirare pleacă un singur email de memento, iar contul apare în consolă la „Expiră curând”.
 */

export const REMIND_DAYS = 30;
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

export const isAdminEmail = (email) => !!config.adminEmail && String(email ?? '').toLowerCase() === config.adminEmail;

/**
 * Starea abonamentului: pending (încă neactivat), active, expiring (activ, mai puțin de 30 de zile),
 * expired (ziua de sfârșit a trecut). Ziua de sfârșit nu mai e inclusă.
 */
export function subscriptionOf(a, now = new Date()) {
  const today = isoDate(now);
  const end = a.subscription_end ?? null;
  const daysLeft = end ? daysBetween(today, end) : null;
  const status = !end ? 'pending' : daysLeft <= 0 ? 'expired' : daysLeft <= REMIND_DAYS ? 'expiring' : 'active';
  const admin = isAdminEmail(a.email);
  return { start: a.subscription_start ?? null, end, status, daysLeft, active: admin || status === 'active' || status === 'expiring' };
}

/** Mesajul pentru un cont „doar citire” (402). */
export function readOnlyMessage(status) {
  const why = status === 'expired' ? 'Abonamentul tău a expirat' : 'Contul tău nu este activ încă';
  const how = config.sellerContact ? ` Pentru activare: ${config.sellerContact}.` : ' Pentru activare, ia legătura cu cel de la care ai primit programul.';
  return `${why}, așa că acum e doar citire: poți vedea și tipări porumbeii, dar nu poți adăuga sau schimba nimic.${how}`;
}

export const logEvent = (accountId, kind, { amountMicros = null, note = null } = {}) =>
  insert('INSERT INTO account_events (account_id, kind, amount_micros, note, created_at) VALUES (?, ?, ?, ?, now())', accountId, kind, amountMicros, note);

/** Memento-urile: o dată pe abonament, când mai sunt cel mult 30 de zile. Întoarce câte au plecat. */
export async function sendReminders(now = new Date()) {
  const today = isoDate(now);
  const limit = isoDate(new Date(now.getTime() + REMIND_DAYS * DAY));
  const due = await all(
    `SELECT id, email, name, subscription_end FROM accounts
      WHERE subscription_end > ? AND subscription_end <= ? AND reminder_sent_for IS DISTINCT FROM subscription_end`,
    today, limit,
  );
  for (const a of due) {
    const end = new Date(`${a.subscription_end}T00:00:00Z`).toLocaleDateString('ro-RO', { timeZone: 'UTC' });
    const how = config.sellerContact ? `Pentru plată și activare: ${config.sellerContact}.` : 'Pentru plată și activare, ia legătura cu cel de la care ai primit programul.';
    try {
      await sendMail({
        to: a.email,
        subject: 'Abonamentul Porumbar expiră în curând',
        text:
          `Bună, ${a.name}!\n\nAbonamentul tău Porumbar expiră pe ${end}.\n` +
          `Ca să poți adăuga și schimba porumbei și după această dată, achită abonamentul pentru încă un an. ${how}\n\n` +
          'Datele tale nu se pierd: și fără abonament îți poți vedea și tipări porumbeii.\n',
      });
    } catch (e) {
      console.error(`[porumbar] Memento-ul pentru ${a.email} nu a plecat:`, e.message);
      continue;
    }
    await run('UPDATE accounts SET reminder_sent_for = subscription_end, reminder_sent_at = now() WHERE id = ?', a.id);
    await logEvent(a.id, 'reminder', { note: `expiră pe ${end}` });
  }
  return due.length;
}

/** Verificarea memento-urilor la pornire și apoi la 6 ore (serverul rulează o singură instanță). */
export function startReminders() {
  const tick = () => sendReminders().catch((e) => console.error('[porumbar] Memento-urile nu au rulat:', e.message));
  setTimeout(tick, 10_000).unref();
  setInterval(tick, 6 * 3600_000).unref();
}
