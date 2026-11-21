/** Cheia publică vine în base64 „url-safe”; abonarea o vrea ca octeți. */
export function keyBytes(key: string): Uint8Array<ArrayBuffer> {
  const b64 = (key + '='.repeat((4 - (key.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Abonamentul existent a fost făcut cu aceeași cheie a serverului? (fără cheie cunoscută = nu) */
export function sameKey(existing: ArrayBuffer | null | undefined, expected: Uint8Array): boolean {
  if (!existing) return false;
  const a = new Uint8Array(existing);
  return a.length === expected.length && a.every((b, i) => b === expected[i]);
}
