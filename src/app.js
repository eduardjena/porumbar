import express from 'express';
import { errorHandler } from './http.js';
import { publicCatalog } from './catalog.js';
import { authRouter } from './routes/auth.js';
import { pigeonsRouter } from './routes/pigeons.js';
import { familyRouter } from './routes/family.js';
import { journalRouter } from './routes/journal.js';
import { photosRouter } from './routes/photos.js';

export const DEFAULT_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
].join('; ');

/** Cererile care modifică date trebuie să fie JSON (protecție CSRF); încărcările de mai jos își verifică singure tipul. */
const RAW_UPLOADS = [/^\/api\/pigeons\/\d+\/photos$/];

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy': DEFAULT_CSP,
    });
    next();
  });

  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const changes = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const hasBody = Number(req.headers['content-length'] || 0) > 0 || req.headers['transfer-encoding'];
    if (changes && hasBody && !req.is('application/json') && !RAW_UPLOADS.some((r) => r.test(req.originalUrl.split('?')[0]))) {
      return res.status(415).json({ error: 'Cererea trebuie trimisă ca JSON.' });
    }
    next();
  });
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.get('/api/catalog', (req, res) => res.json(publicCatalog()));
  app.use('/api/auth', authRouter());
  // Familia înaintea fișei: /api/pigeons/lookup nu trebuie luat drept id de porumbel.
  app.use('/api', familyRouter());
  app.use('/api', journalRouter());
  app.use('/api', photosRouter());
  app.use('/api/pigeons', pigeonsRouter());

  app.use('/api', (req, res) => res.status(404).json({ error: 'Nu a fost găsit.' }));
  app.use(errorHandler);
  return app;
}
