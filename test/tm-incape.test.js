import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmIncape, tmRaza } from '../web/src/app/pages/retea/tm-incape.ts';

test('T+M incape pe felii late, nu pe cele inguste', () => {
  assert.equal(tmIncape(480, 11.25, 12), true);
  assert.equal(tmIncape(100, 5, 12), false);
});

test('T+M nu atinge numarul radial (mobil, inelul 3, font 17, 7 cifre)', () => {
  // r1 = 78+2*92 = 262, r2 = 354, rm = 308+4; numar de ~7 cifre = 7*0.62*17 = 74px => jumatate 37
  const r = tmRaza(262, 354, 312, 37, 22.5, 14);
  assert.ok(r === null || r - 7 >= 312 + 37 + 3 || r + 7 <= 312 - 37 - 3);
});

test('T+M merge la marginea exterioara cand numarul e scurt, nu cand e lung', () => {
  const scurt = tmRaza(262, 354, 312, 15, 22.5, 12);
  assert.ok(scurt != null && scurt > 312);
  assert.equal(tmRaza(262, 354, 312, 40, 22.5, 14), null); // nici exterior, nici interior nu au loc
});

test('limita: numarul se opreste exact la marginea cu aer', () => {
  // exterior = 354-3-6 = 345; liber daca 345-6 >= 312+jum+3 => jum <= 24
  assert.equal(tmRaza(262, 354, 312, 24, 22.5, 12), 345);
  assert.notEqual(tmRaza(262, 354, 312, 24.5, 22.5, 12), 345);
});
