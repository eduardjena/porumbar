/** Cât scris „T+M” cere un corp de literă: `chars` caractere groase (în maghiară „apa+anya” = 8), ~0,7 din mărime fiecare. */
export const tmWidth = (font: number, chars: number) => Math.ceil(chars * 0.7 * font);

/**
 * Încape semnul „T+M” (`chars` caractere) pe felie? Arcul feliei la raza dată (unghiul în grade) trebuie să fie
 * mai lung decât scrisul plus un mic cadru. Dacă nu încape, rămâne doar conturul gros.
 */
export function tmIncape(raza: number, unghiGrade: number, font: number, chars: number): boolean {
  const arc = (raza * unghiGrade * Math.PI) / 180;
  return arc >= tmWidth(font, chars) + 8;
}

/**
 * Raza la care se așază „T+M” pe o felie, fără să atingă scrisul numărului (null = nu e loc, rămâne conturul).
 * Scrisul numărului ocupă pe rază [rm - jum, rm + jum] (la inelele exterioare stă pe rază, deci jum = jumătate din
 * lungimea lui; la cele interioare stă pe arc, deci jum = jumătate din înălțimea literei). „T+M” are înălțimea
 * corpului de literă; încearcă întâi marginea exterioară, apoi cea interioară (după dunga de sex, 7px).
 * `chars` = lungimea scrisului „T+M” în limba ecranului.
 */
export function tmRaza(r1: number, r2: number, rm: number, jumEticheta: number, unghiGrade: number, font: number, chars: number): number | null {
  const aer = 3;
  const exterior = r2 - aer - font / 2;
  const interior = r1 + 7 + aer + font / 2;
  for (const r of [exterior, interior]) {
    const liber = r > rm ? r - font / 2 >= rm + jumEticheta + aer : r + font / 2 <= rm - jumEticheta - aer;
    if (liber && tmIncape(r, unghiGrade, font, chars)) return r;
  }
  return null;
}
