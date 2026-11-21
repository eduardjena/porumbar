import express from 'express';
import { one, run, tx, nowIso, lockAccount } from '../db.js';
import { HttpError, badRequest, notFound, text } from '../http.js';
import { config } from '../config.js';
import { requireAccount } from '../accounts.js';
import { t, ref } from '../i18n.js';
import { sendPush } from '../push.js';

const MAX_DEVICES = 10;

function endpointOf(v) {
  const endpoint = text(v, 'camp.adresa_dispozitiv', { max: 1000 });
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    throw badRequest('eroare.valoare_invalida_camp', { camp: ref('camp.adresa_dispozitiv') });
  }
  if (url.protocol !== 'https:') throw badRequest('eroare.valoare_invalida_camp', { camp: ref('camp.adresa_dispozitiv') });
  return endpoint;
}

/** Abonamentele telefoanelor la notificări; montat la /api/auth/push (scutit de regula „doar citire”). */
export function pushRouter() {
  const r = express.Router();

  r.get('/config', requireAccount, (req, res) => {
    if (!config.pushReady) throw notFound();
    res.json({ publicKey: config.vapidPublicKey });
  });

  r.post('/', requireAccount, async (req, res) => {
    const endpoint = endpointOf(req.body?.endpoint);
    const p256dh = text(req.body?.keys?.p256dh, 'camp.cheie', { max: 200 });
    const auth = text(req.body?.keys?.auth, 'camp.cheie', { max: 200 });
    const userAgent = String(req.headers['user-agent'] ?? '').slice(0, 200) || null;
    await tx(async () => {
      await lockAccount(req.account.id);
      // Același telefon, alt cont: abonamentul trece la contul care a intrat acum.
      await run(
        `INSERT INTO push_subscriptions (account_id, endpoint, p256dh, auth, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (endpoint) DO UPDATE SET account_id = EXCLUDED.account_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
                                              user_agent = EXCLUDED.user_agent, created_at = EXCLUDED.created_at`,
        req.account.id, endpoint, p256dh, auth, userAgent, nowIso(),
      );
      // Cel mult 10 dispozitive: cele mai vechi pleacă.
      await run(
        `DELETE FROM push_subscriptions WHERE account_id = ? AND id NOT IN
           (SELECT id FROM push_subscriptions WHERE account_id = ? ORDER BY created_at DESC, id DESC LIMIT ${MAX_DEVICES})`,
        req.account.id, req.account.id,
      );
    });
    res.status(201).json({ ok: true });
  });

  r.delete('/', requireAccount, async (req, res) => {
    const endpoint = text(req.body?.endpoint, 'camp.adresa_dispozitiv', { max: 1000 });
    await run('DELETE FROM push_subscriptions WHERE account_id = ? AND endpoint = ?', req.account.id, endpoint);
    res.status(204).end();
  });

  r.post('/test', requireAccount, async (req, res) => {
    const endpoint = text(req.body?.endpoint, 'camp.adresa_dispozitiv', { max: 1000 });
    const sub = await one('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE account_id = ? AND endpoint = ?', req.account.id, endpoint);
    if (!sub) throw new HttpError(404, 'eroare.negasit');
    const result = await sendPush(sub, { title: t(req.lang, 'push.titlu'), body: t(req.lang, 'push.proba'), url: '/porumbar' });
    if (result === 'gone') await run('DELETE FROM push_subscriptions WHERE id = ?', sub.id);
    else if (result === 'ok') await run('UPDATE push_subscriptions SET last_ok_at = ? WHERE id = ?', nowIso(), sub.id);
    res.json({ result });
  });

  return r;
}
