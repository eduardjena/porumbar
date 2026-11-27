import express from 'express';
import { config, polarLive } from '../config.js';
import { HttpError } from '../http.js';
import { requireAccount } from '../accounts.js';
import { createCheckout, handlePolarEvent, polarConfigured, verifyPolarSignature } from '../polar.js';

/*
 * POST /api/polar/webhook: singura cerere fără cookie care schimbă date. O apără semnătura (nu verificarea
 * „cross-site” din app.js, de care e scutită). Corpul vine brut (express.raw în app.js), pentru HMAC.
 * Răspunsurile sunt pentru Polar, nu pentru oameni: 503 fără configurare, 403 fără semnătură bună, altfel 2xx
 * (și la evenimentele ignorate, duplicate sau nepotrivite: Polar reîncearcă la orice altceva decât 2xx).
 */
export const POLAR_WEBHOOK_PATH = '/polar/webhook';

export function polarRouter() {
  const r = express.Router();
  r.post('/webhook', async (req, res) => {
    if (!polarConfigured()) {
      console.error('[porumbar] Polar: webhook primit, dar lipsesc POLAR_WEBHOOK_SECRET / POLAR_PRODUCT_ID.'); // i18n: ro
      return res.status(503).json({ error: 'not-configured' });
    }
    const raw = Buffer.isBuffer(req.body) ? req.body : null;
    if (!raw || !verifyPolarSignature(raw, req.headers, config.polarWebhookSecret)) {
      console.warn('[porumbar] Polar: webhook cu semnătură greșită sau lipsă, refuzat.'); // i18n: ro
      return res.status(403).json({ error: 'invalid-signature' });
    }
    let event;
    try {
      event = JSON.parse(raw.toString('utf8'));
    } catch {
      console.error('[porumbar] Polar: webhook semnat, dar corpul nu e JSON; ignorat.'); // i18n: ro
      return res.status(202).json({ ok: true, status: 'ignored' });
    }
    const result = await handlePolarEvent(event);
    res.status(result.status === 'ignored' ? 202 : 200).json({ ok: true, status: result.status });
  });
  return r;
}

/** Cine poate plăti acum: proba (în curs sau terminată), abonamentul care expiră curând sau a expirat. */
const CAN_PAY = new Set(['trial', 'trial-ended', 'expiring', 'expired']);

/**
 * /api/plata (cu cont):
 * - GET /: dacă plata online e pornită și dacă acest cont poate plăti acum (butonul „Plătește” apare doar atunci);
 * - POST /checkout: sesiunea de plată Polar → `{ url }`, unde pagina îl trimite pe om.
 */
export function plataRouter() {
  const r = express.Router();
  r.get('/', requireAccount, (req, res) => {
    res.json({ online: polarLive(), canPay: polarLive() && !req.account.isAdmin && CAN_PAY.has(req.account.subscription.status) });
  });
  r.post('/checkout', requireAccount, async (req, res) => {
    if (!polarLive()) throw new HttpError(404, 'eroare.plata_indisponibila');
    if (req.account.isAdmin || !CAN_PAY.has(req.account.subscription.status)) throw new HttpError(409, 'eroare.plata_nu_acum');
    try {
      res.json({ url: await createCheckout(req.account, req.ip) });
    } catch {
      throw new HttpError(502, 'eroare.plata_polar_jos');
    }
  });
  return r;
}
