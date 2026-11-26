import { todayIn, zoneOf } from '../../../../src/zones.js';
import { currentLang } from './i18n';

/*
 * „Azi” în browser, „AAAA-LL-ZZ”, după ora țării contului (ro București, hu Budapesta, ja Tokyo), la fel ca pe server,
 * nu după ceasul telefonului și nu pe UTC. Limba ecranului e a contului când omul e intrat (app.config le ține la
 * unison), iar pe paginile publice e limba aleasă pe telefon. Se apelează la momentul folosirii, nu o dată la încărcare.
 */
export function todayIso(): string {
  return todayIn(zoneOf(currentLang()));
}
