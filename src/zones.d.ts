// Tipurile pentru src/zones.js: interfața folosește aceleași reguli de zonă ca serverul.

export const BUCHAREST: 'Europe/Bucharest';
export function zoneOf(lang: string | null | undefined): string;
export const ACCOUNT_ZONES: string[];
export function langsIn(zone: string): string[];
export function langsOutside(zone: string): string[];
export function localNow(now: Date, zone: string): { date: string; hour: number; minute: number };
export function atLocal(date: string, hour: number, zone: string): Date;
export function todayIn(zone: string, now?: Date): string;
