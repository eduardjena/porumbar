// Conturi de test: fiecare apel creează un cont nou și întoarce cookie-ul lui.
// Contul nou e activat de admin (abonament de azi, un an), ca testele să poată scrie; { active: false } îl lasă
// „doar citire”, ca un cont care n-a plătit încă.
let n = 0;
process.env.ADMIN_EMAIL ??= 'admin@porumbar.test';
// Adminul se face la pornirea serverului din ADMIN_EMAIL + ADMIN_PASSWORD (formularul de cont nou îl refuză).
process.env.ADMIN_PASSWORD ??= 'parola-admin-de-test-123';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const admins = new WeakMap();

/** Cookie-ul adminului pentru serverul acestui `call` (contul se face la prima nevoie). */
export async function adminCookie(call) {
  if (admins.has(call)) return admins.get(call);
  const r = await call('/api/auth/login', { method: 'POST', auth: 'none', body: { email: process.env.ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  if (r.status !== 200) throw new Error(`Adminul de test: ${r.status} ${JSON.stringify(r.data)}`);
  const cookie = r.res.headers.get('set-cookie').split(';')[0];
  admins.set(call, cookie);
  return cookie;
}

export const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Bucharest' });

export async function newAccount(call, name = 'Crescător', { active = true, trial = false } = {}) {
  n += 1;
  const r = await call('/api/auth/register', {
    method: 'POST',
    auth: 'none',
    body: { email: `crescator${n}-${process.pid}@exemplu.test`, password: 'parola-de-test-123', name: `${name} ${n}`, country: 'RO', phone: '0700 000 000', city: 'Brașov', acceptTerms: true },
  });
  if (r.status !== 201) throw new Error(`Contul de test nu s-a creat: ${r.status} ${JSON.stringify(r.data)}`);
  // Înscrierea nu intră în cont: intră linkul din emailul de confirmare (pornește proba de 30 de zile).
  const cookie = await confirmAndEnter(call, r.data.account.email);
  // { trial: true }: rămâne în proba de 30 de zile (fără abonament plătit).
  if (trial) return cookie;
  if (!active) {
    // „Neactivat” = doar citire: proba s-a terminat (ieri), fără abonament plătit.
    const { run } = await import('../../src/db.js');
    await run("UPDATE accounts SET trial_end = (now() AT TIME ZONE 'Europe/Bucharest')::date - 1 WHERE id = ?", r.data.account.id);
  }
  if (active) {
    // Abonamentul se activează doar cu numele de pe fișă pus de vânzător.
    const id = r.data.account.id;
    const i = await call(`/api/admin/accounts/${id}/identity`, { method: 'PATCH', cookie: await adminCookie(call), body: { name: `${name} ${n}`, sheetName: `${name} ${n}` } });
    if (i.status !== 200) throw new Error(`Datele de pe fișă ale contului de test: ${i.status} ${JSON.stringify(i.data)}`);
    const a = await call(`/api/admin/accounts/${r.data.account.id}/subscription`, { method: 'POST', cookie: await adminCookie(call), body: { start: today() } });
    if (a.status !== 200) throw new Error(`Activarea contului de test: ${a.status} ${JSON.stringify(a.data)}`);
  }
  return cookie;
}

/** Vânzătorul pune datele de pe fișă (numele de pe fișă e cerut la activare). */
export async function setIdentity(call, accountId, body) {
  const r = await call(`/api/admin/accounts/${accountId}/identity`, { method: 'PATCH', cookie: await adminCookie(call), body });
  if (r.status !== 200) throw new Error(`Datele de pe fișă: ${r.status} ${JSON.stringify(r.data)}`);
  return r.data.account;
}

/** Vânzătorul schimbă limba contului (restul datelor de pe fișă rămân cum sunt). */
export async function setLang(call, accountId, lang) {
  const cookie = await adminCookie(call);
  const a = (await call(`/api/admin/accounts/${accountId}`, { cookie })).data.account;
  const body = { kind: a.kind, name: a.name, sheetName: a.sheetName, phone: a.phone, address: a.address, cnp: a.cnp, companyName: a.companyName, cui: a.cui, regCom: a.regCom, lang };
  const r = await call(`/api/admin/accounts/${accountId}/identity`, { method: 'PATCH', cookie, body });
  if (r.status !== 200) throw new Error(`Limba contului: ${r.status} ${JSON.stringify(r.data)}`);
  return r.data.account;
}

/** Linkul din emailul de confirmare: confirmă și intră în cont; întoarce cookie-ul sesiunii. */
export async function confirmAndEnter(call, email) {
  const { sentMails } = await import('../../src/mail.js');
  const mail = [...sentMails].reverse().find((m) => m.to === email && /\/confirma\//.test(m.text));
  if (!mail) throw new Error(`Niciun email de confirmare către ${email}`);
  const r = await call('/api/auth/confirm', { method: 'POST', auth: 'none', body: { token: mail.text.match(/\/confirma\/(\S+)/)[1] } });
  if (r.status !== 200) throw new Error(`Confirmarea: ${r.status} ${JSON.stringify(r.data)}`);
  return r.res.headers.get('set-cookie').split(';')[0];
}

/** Omul își confirmă emailul: tokenul se ia din ultimul email de confirmare trimis către adresa lui. */
export async function confirmEmail(call, email) {
  const { sentMails } = await import('../../src/mail.js');
  const mail = [...sentMails].reverse().find((m) => m.to === email && /\/confirma\//.test(m.text));
  if (!mail) throw new Error(`Niciun email de confirmare către ${email}`);
  const r = await call('/api/auth/confirm', { method: 'POST', auth: 'none', body: { token: mail.text.match(/\/confirma\/(\S+)/)[1] } });
  if (r.status !== 200) throw new Error(`Confirmarea: ${r.status} ${JSON.stringify(r.data)}`);
  return r.data.account;
}
