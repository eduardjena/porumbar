import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { errorHandler } from './http.js';
import { publicCatalog } from './catalog.js';
import { isLang, flatDictionary, requestLang, langScope, t } from './i18n.js';
import { authRouter } from './routes/auth.js';
import { pushRouter } from './routes/push.js';
import { pigeonsRouter } from './routes/pigeons.js';
import { familyRouter } from './routes/family.js';
import { journalRouter } from './routes/journal.js';
import { resultsRouter } from './routes/results.js';
import { breedingRouter } from './routes/breeding.js';
import { viewsRouter } from './routes/views.js';
import { pedigreesRouter } from './routes/pedigrees.js';
import { requireAccount, optionalAccount } from './accounts.js';
import { publicRouter } from './routes/public.js';
import { transfersRouter } from './routes/transfers.js';
import { adminRouter } from './routes/admin.js';
import { treatmentsRouter } from './routes/treatments.js';
import { importsRouter } from './routes/imports.js';

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
  "worker-src 'self'",
].join('; ');

/** Cererea vine din pagina altui site? (Sec-Fetch-Site al browserului, altfel Origin față de Host.) */
function crossSite(req) {
  const site = req.headers['sec-fetch-site'];
  if (site) return site === 'cross-site';
  const origin = req.headers.origin;
  if (!origin || origin === 'null') return origin === 'null';
  try {
    return new URL(origin).host !== req.headers.host;
  } catch {
    return true;
  }
}

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
    // Limba cererii: fără cont, limba aleasă pe ecran (Accept-Language), dacă e publică; altfel româna.
    // Cu cont, requireAccount o înlocuiește cu limba contului.
    req.lang = requestLang(req.headers['accept-language']);
    langScope(req.lang, next);
  });

  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const changes = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const hasBody = Number(req.headers['content-length'] || 0) > 0 || req.headers['transfer-encoding'];
    if (changes && hasBody && !req.is('application/json')) {
      return res.status(415).json({ error: t(req.lang, 'eroare.doar_json') });
    }
    // Scrieri venite de pe alt site (și cele fără corp, pe care regula JSON nu le prinde): refuzate.
    if (changes && crossSite(req)) return res.status(403).json({ error: t(req.lang, 'eroare.cerere_refuzata') });
    next();
  });
  // Poza / PDF-ul unui pedigree vine ca JSON (base64), deci aici limita e mai mare; restul rămâne la 1 MB. Corpul mare
  // se citește doar după ce se știe cine e omul, iar conținutul arhivat (gzip) nu se dezarhivează nicăieri.
  app.use('/api/pedigrees/read', requireAccount, express.json({ limit: '17mb', inflate: false }));
  // Tabelul adus din Excel (cel mult 3.000 de rânduri): cel mult 2 MB, tot după ce se știe cine e omul.
  app.use('/api/import/excel', requireAccount, express.json({ limit: '2mb', inflate: false }));
  app.use(express.json({ limit: '1mb', inflate: false }));

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.get('/api/catalog', optionalAccount, (req, res) => res.json(publicCatalog(req.lang)));
  // Înaintea lui /api/auth: sub /api/auth, deci scutit de regula „doar citire” (și fără abonament se pot porni amintirile).
  app.use('/api/auth/push', pushRouter());
  app.use('/api/auth', authRouter());
  // Familia înaintea fișei: /api/pigeons/lookup nu trebuie luat drept id de porumbel.
  app.use('/api', familyRouter());
  app.use('/api', journalRouter());
  app.use('/api', resultsRouter());
  app.use('/api', breedingRouter());
  app.use('/api', viewsRouter());
  app.use('/api', pedigreesRouter());
  app.use('/api', publicRouter());
  app.use('/api', transfersRouter());
  app.use('/api', treatmentsRouter());
  app.use('/api/import/excel', importsRouter());
  app.use('/api/admin', adminRouter());
  app.use('/api/pigeons', pigeonsRouter());

  app.use('/api', (req, res) => res.status(404).json({ error: t(req.lang, 'eroare.negasit') }));

  // Dicționarele pentru interfață (româna e deja în pachet; celelalte se aduc de aici).
  app.get('/i18n/:file', (req, res) => {
    const lang = /^([a-z]{2})\.json$/.exec(req.params.file)?.[1];
    if (!lang || !isLang(lang)) return res.status(404).json({ error: t(req.lang, 'eroare.negasit') });
    res.set('Cache-Control', 'no-cache').json(flatDictionary(lang));
  });

  // Interfața (build Angular). Fișierele cu hash în nume se pot ține în cache un an; restul rutelor primesc index.html.
  if (fs.existsSync(WEB_INDEX)) {
    app.use(
      express.static(WEB_DIR, {
        index: false,
        setHeaders: (res, file) => {
          // Service worker-ul: browserul îl verifică la fiecare pornire, deci nu stă în cache; poate controla tot site-ul.
          if (path.basename(file) === 'sw.js') res.set({ 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/' });
          else if (/[-.][A-Za-z0-9_-]{8,}\.(js|css)$/.test(file)) res.set('Cache-Control', 'public, max-age=31536000, immutable');
        },
      }),
    );
    app.get(/.*/, (req, res) => res.set('Cache-Control', 'no-cache').sendFile(WEB_INDEX));
  }
  app.use(errorHandler);
  return app;
}
