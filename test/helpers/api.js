// Cererile HTTP din teste și pornirea aplicației pe un port liber.

/**
 * `state()` întoarce adresa serverului și, opțional, sesiunea implicită: { base, cookie }.
 * Opțiunile unei cereri: method, body (JSON), raw (corp brut), headers, cookie (altă sesiune), auth: 'none' (fără sesiune).
 * Răspunsul: status, data (JSON, dacă e cazul), buf (conținutul brut), res.
 */
export function apiCaller(state, { redirect = 'follow' } = {}) {
  return async (path, { method = 'GET', body, raw, headers = {}, cookie, auth } = {}) => {
    const { base, cookie: defaultCookie } = state();
    const h = { ...headers };
    if (body !== undefined && !h['Content-Type']) h['Content-Type'] = 'application/json';
    const session = cookie ?? defaultCookie;
    if (session && auth !== 'none' && !h.Authorization) h.Cookie = session;
    const res = await fetch(base + path, { method, headers: h, redirect, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
    const buf = Buffer.from(await res.arrayBuffer());
    let data = null;
    try {
      data = JSON.parse(buf.toString('utf8'));
    } catch {
      /* nu e JSON (de ex. un fișier) */
    }
    return { status: res.status, data, buf, res };
  };
}

/** Pornește aplicația pe un port liber. */
export async function listen(app) {
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
