import fs from 'node:fs';

// Lista publică „disposable-email-domains” (CC0), câte un domeniu pe rând.
const DOMAINS = new Set(
  fs.readFileSync(new URL('./disposable-domains.txt', import.meta.url), 'utf8')
    .split(/\r?\n/).map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith('#')),
);

/**
 * Emailul are un domeniu de unică folosință? Se potrivește domeniul și domeniile-părinte (sub.mailinator.com); punctul
 * de la final („mailinator.com.”, numele complet al domeniului, la fel de bun pentru livrare) nu schimbă nimic.
 */
export function isDisposableEmail(email) {
  const domain = String(email ?? '').trim().toLowerCase().split('@').pop().replace(/\.+$/, '');
  if (!domain) return false;
  const parts = domain.split('.');
  for (let i = 0; i < parts.length - 1; i++) if (DOMAINS.has(parts.slice(i).join('.'))) return true;
  return false;
}
