// Conturi de test: fiecare apel creează un cont nou și întoarce cookie-ul lui.
// Contul nou e activat de admin (abonament de azi, un an), ca testele să poată scrie; { active: false } îl lasă
// „doar citire”, ca un cont care n-a plătit încă.
let n = 0;
process.env.ADMIN_EMAIL ??= 'admin@porumbar.test';
const ADMIN_PASSWORD = 'parola-admin-de-test-123';
const admins = new WeakMap();

/** Cookie-ul adminului pentru serverul acestui `call` (contul se face la prima nevoie). */
export async function adminCookie(call) {
  if (admins.has(call)) return admins.get(call);
  let r = await call('/api/auth/register', {
    method: 'POST',
    auth: 'none',
    body: { email: process.env.ADMIN_EMAIL, password: ADMIN_PASSWORD, name: 'Vânzătorul' },
  });
  if (r.status === 409) r = await call('/api/auth/login', { method: 'POST', auth: 'none', body: { email: process.env.ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  if (![200, 201].includes(r.status)) throw new Error(`Adminul de test: ${r.status} ${JSON.stringify(r.data)}`);
  const cookie = r.res.headers.get('set-cookie').split(';')[0];
  admins.set(call, cookie);
  return cookie;
}

export const today = () => new Date().toISOString().slice(0, 10);

export async function newAccount(call, name = 'Crescător', { active = true } = {}) {
  n += 1;
  const r = await call('/api/auth/register', {
    method: 'POST',
    auth: 'none',
    body: { email: `crescator${n}-${process.pid}@exemplu.test`, password: 'parola-de-test-123', name: `${name} ${n}` },
  });
  if (r.status !== 201) throw new Error(`Contul de test nu s-a creat: ${r.status} ${JSON.stringify(r.data)}`);
  if (active) {
    const a = await call(`/api/admin/accounts/${r.data.account.id}/subscription`, { method: 'POST', cookie: await adminCookie(call), body: { start: today() } });
    if (a.status !== 200) throw new Error(`Activarea contului de test: ${a.status} ${JSON.stringify(a.data)}`);
  }
  return r.res.headers.get('set-cookie').split(';')[0];
}
