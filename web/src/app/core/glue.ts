/* Semnele lipite între bucăți traduse. Fără importuri, testat cu Node (test/lipici.test.js). */

/** Bucata lipită („, ”, „).”, un spațiu), cu fiecare semn schimbat după harta limbii; fără hartă rămâne cum e scrisă. */
export const glueWith = (signs: Record<string, string> | undefined, text: string): string =>
  signs ? Array.from(text, (c) => signs[c] ?? c).join('') : text;
