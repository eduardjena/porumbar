/** Așteaptă cel mult `ms`; nu pică niciodată (o rețea care nu răspunde nu ține pe nimeni pe loc). Fără importuri, testat cu Node. */
export function within(work: Promise<unknown>, ms: number): Promise<void> {
  return new Promise((done) => {
    const timer = setTimeout(done, ms);
    const end = () => {
      clearTimeout(timer);
      done();
    };
    work.then(end, end);
  });
}

/** Limita de timp la pregătirea PDF-ului trimis (rețea blocată → eroare, butonul revine). */
export const PDF_TIMEOUT_MS = 30_000;

/** Ca `within`, dar când trece timpul, pică cu eroarea dată (lucrarea rămasă în urmă e ignorată). */
export function withTimeout<T>(work: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(onTimeout()), ms);
    work.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}
