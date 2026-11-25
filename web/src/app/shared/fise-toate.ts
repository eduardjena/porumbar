// Alegerea porumbeilor pentru fișele tipărite. Funcții pure, fără Angular (le încarcă și testele Node).

export const MAX_SHEETS = 200;

/** Din `?ids=`: întregi pozitivi, fără dubluri, ordinea păstrată, cel mult MAX_SHEETS. */
export function parseIds(q: string | null | undefined): number[] {
  if (!q) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const part of q.split(',')) {
    const token = part.trim();
    if (!/^\d+$/.test(token)) continue;
    const id = Number(token);
    if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_SHEETS) break;
  }
  return out;
}

/** Id-urile în ordinea de pe ecran (grupă după grupă), fără dubluri. */
export function idsOfGroups(groups: { items: { id: number }[] }[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item.id);
    }
  }
  return out;
}
