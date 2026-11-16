/*
 * Valoarea unui porumbel (0–100) până vin rezultatele de concurs (design 1b, aprobat de utilizator):
 *   50% evaluarea la mână (media notelor 1–5 → 0–100), doar dacă există cel puțin o notă;
 *   30% puii din porumbar: min(n, 10) / 10 · 100;
 *   20% marcat „reproducător”.
 * Fără note, ponderile rămase se reîmpart. Fără note, fără pui și nemarcat reproducător → „fără date” (score null).
 */
const WEIGHTS = { evaluare: 0.5, pui: 0.3, reproducator: 0.2 };

const bandOf = (score) => (score == null ? 0 : score >= 80 ? 5 : score >= 60 ? 4 : score >= 40 ? 3 : score >= 20 ? 2 : 1);

export function pigeonValue({ scores = {}, offspringCount = 0, status = null } = {}) {
  const notes = Object.values(scores ?? {}).filter((v) => Number.isFinite(v));
  const parts = {};
  if (notes.length) parts.evaluare = ((notes.reduce((a, b) => a + b, 0) / notes.length - 1) / 4) * 100;
  parts.pui = (Math.min(offspringCount, 10) / 10) * 100;
  parts.reproducator = status === 'reproducator' ? 100 : 0;

  if (!notes.length && offspringCount === 0 && status !== 'reproducator') return { score: null, band: 0, parts };

  let sum = 0;
  let weight = 0;
  for (const [k, v] of Object.entries(parts)) {
    sum += v * WEIGHTS[k];
    weight += WEIGHTS[k];
  }
  const score = Math.round(sum / weight);
  return { score, band: bandOf(score), parts };
}
