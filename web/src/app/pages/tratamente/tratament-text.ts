import { formatDay, t, glue } from '../../core/i18n';
import { Treatment, TreatmentRepeat } from '../../core/models';
import { IconName } from '../../shared/icon';

/*
 * Cum se scrie un tratament pentru om, la fel în listă, în detaliu și în banda de pe Panou. Fișier separat (fără
 * componente), ca Panoul să nu aducă paginile Tratamente odată cu el.
 */

/** Vaccinul are seringă, tratamentul picurătoare. */
export const kindIcon = (tr: Pick<Treatment, 'kind'>): IconName => (tr.kind === 'vaccin' ? 'vaccin' : 'tratament');

/** Ziua de azi pe telefon, „AAAA-LL-ZZ”. */
export function todayIso(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/** Ziua de după `n` zile, „AAAA-LL-ZZ” (fără fus orar). */
export function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
}

/** Începutul următorului din lanț (ca pe server): peste N zile de la început, sau aceeași zi peste un an (29.02 → 28.02). */
export function nextStart(startDate: string, repeat: TreatmentRepeat | null): string | null {
  if (!repeat) return null;
  if (repeat.kind === 'zile') return addDays(startDate, repeat.days);
  const [y, m, d] = startDate.split('-').map(Number);
  const next = new Date(Date.UTC(y + 1, m - 1, d));
  if (next.getUTCMonth() !== m - 1) next.setUTCDate(0);
  return next.toISOString().slice(0, 10);
}

/** „21.11.2026 – 25.11.2026”, sau o singură dată pentru un tratament de o zi. */
export function periodText(tr: Pick<Treatment, 'startDate' | 'endDate' | 'days'>): string {
  return tr.days === 1 ? formatDay(tr.startDate) : `${formatDay(tr.startDate)}${glue(' – ')}${formatDay(tr.endDate)}`;
}

/** Unde a ajuns: „ziua 3 din 5” / „azi”, „începe pe …”, „terminat pe …”, „oprit pe …”. */
export function statusText(tr: Treatment): string {
  switch (tr.status) {
    case 'in_curs': return tr.days === 1 ? t('tratamente.azi') : t('tratamente.ziua_din', { zi: tr.day, zile: tr.days });
    case 'urmeaza': return t('tratamente.incepe_pe', { data: formatDay(tr.startDate) });
    case 'anulat': return t('tratamente.oprit_pe', { data: formatDay(tr.cancelledOn) });
    default: return t('tratamente.terminat_pe', { data: formatDay(tr.endDate) });
  }
}

/** Eticheta scurtă a stării (pastila din listă și din detaliu). */
export const statusLabel = (tr: Treatment) => t(`tratamente.stare_${tr.status}`);

/** „Nu”, „Peste 21 de zile”, „În fiecare an, în aceeași zi”. */
export function repeatText(repeat: TreatmentRepeat | null): string {
  if (!repeat) return t('tratamente.repeta_nu');
  return repeat.kind === 'zile' ? t('tratamente.repeta_peste', { count: repeat.days }) : t('tratamente.repeta_anual');
}
