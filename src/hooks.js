/*
 * Ce trebuie făcut în afara bazei de date când dispare un cont (de ex. fișierele pozelor).
 * Modulele care au astfel de date se înscriu aici; rulează în tranzacția ștergerii, înainte de DELETE.
 */
const accountDeleted = [];

export const whenAccountDeleted = (fn) => accountDeleted.push(fn);

export async function onAccountDeleted(accountId) {
  for (const fn of accountDeleted) await fn(accountId);
}
