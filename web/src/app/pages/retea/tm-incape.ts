/** Cât scris „T+M” cere un corp de literă (3 caractere groase, ~0,7 din mărime fiecare). */
export const tmWidth = (font: number) => Math.ceil(3 * 0.7 * font);

/**
 * Încape semnul „T+M” pe felie? Arcul feliei la raza dată (unghiul în grade) trebuie să fie
 * mai lung decât scrisul plus un mic cadru. Dacă nu încape, rămâne doar conturul gros.
 */
export function tmIncape(raza: number, unghiGrade: number, font: number): boolean {
  const arc = (raza * unghiGrade * Math.PI) / 180;
  return arc >= tmWidth(font) + 8;
}
