// Notificările pe telefon (web push): trimiterea către dispozitivele unui cont.
import { sendNotification } from 'web-push';
import { all, run, nowIso } from './db.js';
import { config } from './config.js';

/** Trimite o notificare unui dispozitiv: 'ok', 'gone' (abonament închis, 404 / 410) sau 'error'. */
async function realSend(sub, payload) {
  if (!config.pushReady) return 'error';
  try {
    await sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { vapidDetails: { subject: config.vapidSubject, publicKey: config.vapidPublicKey, privateKey: config.vapidPrivateKey }, TTL: 24 * 3600 },
    );
    return 'ok';
  } catch (err) {
    if (err?.statusCode === 404 || err?.statusCode === 410) return 'gone';
    console.error('[porumbar] Notificarea pe telefon nu a plecat:', err?.statusCode ?? '', err?.message); // i18n: ro
    return 'error';
  }
}

let sender = realSend;

/** Doar pentru teste: înlocuiește trimiterea reală (null = înapoi la cea reală). */
export function setPushSender(fn) {
  sender = fn ?? realSend;
}

/** @returns {Promise<'ok'|'gone'|'error'>} */
export async function sendPush(sub, payload) {
  try {
    return await sender(sub, payload);
  } catch {
    return 'error';
  }
}

/** Trimite la toate dispozitivele contului; abonamentele închise se șterg, cele bune își țin ultima reușită. */
export async function pushToAccount(accountId, payload) {
  const subs = await all('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE account_id = ? ORDER BY id', accountId);
  let sent = 0;
  let failed = 0;
  for (const sub of subs) {
    const result = await sendPush(sub, payload);
    if (result === 'ok') {
      sent += 1;
      await run('UPDATE push_subscriptions SET last_ok_at = ? WHERE id = ?', nowIso(), sub.id);
    } else {
      failed += 1;
      if (result === 'gone') await run('DELETE FROM push_subscriptions WHERE id = ?', sub.id);
    }
  }
  return { sent, failed, devices: subs.length };
}
