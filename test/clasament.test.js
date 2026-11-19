import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readPasted, ownRows, ringKeyOf } from '../web/src/app/shared/clasament.ts';

// Clasamentul columba.ro lipit (date fictive): docs/exemple/clasament-columba-lipit.txt.
const text = fs.readFileSync(new URL('../docs/exemple/clasament-columba-lipit.txt', import.meta.url), 'utf8');

test('antetul completează concursul: nr., organizator, categorie, dată, loc, ora lansării, angajați', () => {
  assert.deepEqual(readPasted(text).race, {
    number: 1,
    organizer: 'Valcea',
    category: 'viteza',
    date: '2026-05-04',
    releasePlace: 'Yablanita',
    releaseTime: '08:01:00',
    entered: 10023,
  });
});

test('rândurile: locul, codul, inelul (MATRICOL + AN), sexul, sosirea, distanța, viteza și FCI din clasament', () => {
  const { rows } = readPasted(text);
  assert.equal(rows.length, 13);
  assert.deepEqual(rows[0], {
    place: 1, name: 'Crescator Unu', code: 'VL9001', ring: 'RO-25-276971', country: 'RO', year: 2025, number: '276971',
    sex: 'F', day: 1, time: '10:15:43', distanceKm: 196.608, speed: 1459.42, fci: 0.2,
  });
  assert.equal(rows[1].ring, 'RO-24-101774', 'și cu „*” în coloana E');
  assert.equal(rows[3].name, 'Popa + Marin');
});

test('copiat de pe telefon: tab-urile devenite spații se citesc la fel', () => {
  const spaced = text.replace(/\t/g, '   ');
  assert.deepEqual(readPasted(spaced), readPasted(text));
});

test('doar rândurile omului: după codul de crescător sau după inelele lui; restul nu se păstrează', () => {
  const pasted = readPasted(text);
  assert.deepEqual(ownRows(pasted, 'vl 9001', new Set()).map((r) => r.place), [1, 9, 10]);
  assert.deepEqual(ownRows(pasted, null, new Set([ringKeyOf('RO', 2024, '0101774')])).map((r) => r.place), [2]);
  assert.deepEqual(ownRows(pasted, null, new Set()), [], 'fără cod și fără inele cunoscute: nimic');
});

test('o bucată de clasament (doar rândurile omului, fără antet) se citește și ea', () => {
  const piece = text.split('\n').filter((l) => /VL9001/.test(l)).join('\n');
  const p = readPasted(piece);
  assert.equal(p.rows.length, 3);
  assert.equal(p.race.entered, null);
});

test('categoriile Columba: Demifond, Extrem, Maraton', () => {
  const cat = (c) => readPasted(`CATEGORIA - ${c}`).race.category;
  assert.equal(cat('DEMIFOND'), 'semifond');
  assert.equal(cat('EXTREM'), 'mare-fond');
  assert.equal(cat('MARATON'), 'maraton');
  assert.equal(cat('FOND'), 'fond');
  assert.equal(cat('ALTCEVA'), 'altele');
});
