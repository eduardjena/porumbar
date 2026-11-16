// Conturi de test: fiecare apel creează un cont nou și întoarce cookie-ul lui.
let n = 0;

export async function newAccount(call, name = 'Crescător') {
  n += 1;
  const r = await call('/api/auth/register', {
    method: 'POST',
    auth: 'none',
    body: { email: `crescator${n}-${process.pid}@exemplu.test`, password: 'parola-de-test-123', name: `${name} ${n}` },
  });
  if (r.status !== 201) throw new Error(`Contul de test nu s-a creat: ${r.status} ${JSON.stringify(r.data)}`);
  return r.res.headers.get('set-cookie').split(';')[0];
}
