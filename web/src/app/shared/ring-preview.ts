import { formatRing, parseRing } from '../../../../src/rings.js';

/*
 * Ce a înțeles programul din inelul scris: aceleași reguli ca pe server (src/rings.js, importat direct), ca telefonul să
 * arate exact ce se va salva. Fără Angular, ca să se poată testa cu Node (test/rings-web.test.js).
 */
export interface RingPreview {
  /** Recunoscut (sau fără inel, „000”). */
  ok: boolean;
  /** Forma normalizată (RO-25-276971, GB-22-T-12345); goală dacă nu e recunoscut sau e fără inel. */
  display: string;
  sex: 'M' | 'F' | null;
  unringed: boolean;
  /** Inel maghiar fără numărul organizatorului: se refuză la un porumbel propriu. */
  needsClub: boolean;
  /** Scris, dar nerecunoscut: se păstrează cum e scris (avertisment blând, nu eroare). */
  unknown: boolean;
}

export function previewRing(text: string): RingPreview {
  const r = parseRing(text);
  return {
    ok: r.ok,
    display: r.ok && !r.unringed ? formatRing(r) : '',
    sex: r.sex,
    unringed: r.unringed,
    needsClub: Boolean(r.needsClub),
    unknown: !r.ok && !r.needsClub && Boolean(r.raw),
  };
}
