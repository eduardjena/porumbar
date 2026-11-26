import { fallbackKey, formatRing, japaneseRingText, parseRing } from '../../../../src/rings.js';

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
  /** Scris, dar nerecunoscut: se păstrează cum e scris (avertisment blând, nu eroare). Fals pentru un text fără nicio
   * literă sau cifră („??”), pe care serverul îl refuză la un porumbel propriu. */
  unknown: boolean;
}

/** `lang` = limba contului: la `ja` inelul japonez scris fără „JPN” (25-AB-01234) se citește ca JP, ca pe server. */
export function previewRing(text: string, lang?: string | null): RingPreview {
  const r = parseRing(lang === 'ja' ? japaneseRingText(text) : text);
  return {
    ok: r.ok,
    display: r.ok && !r.unringed ? formatRing(r) : '',
    sex: r.sex,
    unringed: r.unringed,
    needsClub: Boolean(r.needsClub),
    unknown: fallbackKey(r) !== null,
  };
}
