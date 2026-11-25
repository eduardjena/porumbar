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
