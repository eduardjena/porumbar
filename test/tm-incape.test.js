import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmIncape, tmRaza, tmWidth } from '../web/src/app/pages/retea/tm-incape.ts';

// 3 = „T+M” (ro), 8 = „apa+anya” (hu)
test('T+M incape pe felii late, nu pe cele inguste', () => {
  assert.equal(tmIncape(480, 11.25, 12, 3), true);
  assert.equal(tmIncape(100, 5, 12, 3), false);
});

test('latimea tine de lungimea textului: „apa+anya” cere mai mult loc decat „T+M”', () => {
  assert.equal(tmWidth(12, 3), 26);
  assert.equal(tmWidth(12, 8), 68);
  // arc = 200 * 11.25 * pi / 180 = 39,3 px: incap 3 caractere (26 + 8), nu 8 (68 + 8)
  assert.equal(tmIncape(200, 11.25, 12, 3), true);
  assert.equal(tmIncape(200, 11.25, 12, 8), false);
});

test('T+M nu atinge numarul radial (mobil, inelul 3, font 17, 7 cifre)', () => {
  // r1 = 78+2*92 = 262, r2 = 354, rm = 308+4; numar de ~7 cifre = 7*0.62*17 = 74px => jumatate 37
  for (const chars of [3, 8]) {
    const r = tmRaza(262, 354, 312, 37, 22.5, 14, chars);
    assert.ok(r === null || r - 7 >= 312 + 37 + 3 || r + 7 <= 312 - 37 - 3);
  }
});

test('T+M merge la marginea exterioara cand numarul e scurt, nu cand e lung', () => {
  const scurt = tmRaza(262, 354, 312, 15, 22.5, 12, 3);
  assert.ok(scurt != null && scurt > 312);
  assert.equal(tmRaza(262, 354, 312, 40, 22.5, 14, 3), null); // nici exterior, nici interior nu au loc
});

test('pe felia ingusta, textul lung nu se mai pune (ramane conturul)', () => {
  // inelul 4 pe calculator: r1 = 354, r2 = 446, felie de 11,25 grade; exterior = 437 => arc 85,8 px
  assert.equal(tmRaza(354, 446, 404, 20, 11.25, 12, 3), 437);
  assert.equal(tmRaza(354, 446, 404, 20, 11.25, 14, 8), null); // 8 * 0,7 * 14 = 79 + 8 > arc
});

test('limita: numarul se opreste exact la marginea cu aer', () => {
  // exterior = 354-3-6 = 345; liber daca 345-6 >= 312+jum+3 => jum <= 24
  assert.equal(tmRaza(262, 354, 312, 24, 22.5, 12, 3), 345);
  assert.notEqual(tmRaza(262, 354, 312, 24.5, 22.5, 12, 3), 345);
});
