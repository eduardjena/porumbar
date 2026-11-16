import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { errorHandler } from './http.js';
import { publicCatalog } from './catalog.js';
import { authRouter } from './routes/auth.js';
import { pigeonsRouter } from './routes/pigeons.js';
import { familyRouter } from './routes/family.js';
import { journalRouter } from './routes/journal.js';
import { viewsRouter } from './routes/views.js';
import { pedigreesRouter } from './routes/pedigrees.js';
import { publicRouter } from './routes/public.js';
import { transfersRouter } from './routes/transfers.js';

export const WEB_DIR = path.join(import.meta.dirname, '..', 'web', 'dist', 'web', 'browser');
const WEB_INDEX = path.join(WEB_DIR, 'index.html');

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
    if (changes && hasBody && !req.is('application/json')) {
      return res.status(415).json({ error: 'Cererea trebuie trimisă ca JSON.' });
    }
    next();
  });
  // Poza / PDF-ul unui pedigree vine ca JSON (base64), deci aici limita e mai mare; restul rămâne la 1 MB.
  app.use('/api/pedigrees/read', express.json({ limit: '17mb' }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.get('/api/catalog', (req, res) => res.json(publicCatalog()));
  app.use('/api/auth', authRouter());
  // Familia înaintea fișei: /api/pigeons/lookup nu trebuie luat drept id de porumbel.
  app.use('/api', familyRouter());
  app.use('/api', journalRouter());
  app.use('/api', viewsRouter());
  app.use('/api', pedigreesRouter());
  app.use('/api', publicRouter());
  app.use('/api', transfersRouter());
  app.use('/api/pigeons', pigeonsRouter());

  app.use('/api', (req, res) => res.status(404).json({ error: 'Nu a fost găsit.' }));

  // Interfața (build Angular). Fișierele cu hash în nume se pot ține în cache un an; restul rutelor primesc index.html.
  if (fs.existsSync(WEB_INDEX)) {
    app.use(
      express.static(WEB_DIR, {
        index: false,
        setHeaders: (res, file) => {
          if (/[-.][A-Za-z0-9_-]{8,}\.(js|css)$/.test(file)) res.set('Cache-Control', 'public, max-age=31536000, immutable');
        },
      }),
    );
    app.get(/.*/, (req, res) => res.set('Cache-Control', 'no-cache').sendFile(WEB_INDEX));
  }
  app.use(errorHandler);
  return app;
}
