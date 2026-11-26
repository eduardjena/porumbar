import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';

const KEYS = ['SMTP_URL', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const k of KEYS) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
});
const clear = () => KEYS.forEach((k) => delete process.env[k]);

test('fără server de email: nimic de trimis, expeditorul implicit pe pigeonrama.com', () => {
  clear();
  assert.equal(config.smtp, null);
  assert.equal(config.mailFrom, 'Pigeonrama <nu-raspunde@pigeonrama.com>');
});

test('SMTP_URL într-un rând are întâietate', () => {
  clear();
  process.env.SMTP_URL = 'smtps://u:p@mail.example.test:465';
  process.env.SMTP_HOST = 'altul.example.test';
  assert.equal(config.smtp, 'smtps://u:p@mail.example.test:465');
});

test('setări separate: parola se ia exact cum e (cu semne speciale), 465 = SSL/TLS', () => {
  clear();
  Object.assign(process.env, { SMTP_HOST: 'mail.example.test', SMTP_USER: 'contact@example.test', SMTP_PASS: 'a@b#c%d:e/f' });
  assert.deepEqual(config.smtp, { host: 'mail.example.test', port: 465, secure: true, auth: { user: 'contact@example.test', pass: 'a@b#c%d:e/f' } });
  assert.equal(config.mailFrom, 'Pigeonrama <contact@example.test>');
});

test('portul 587 merge cu STARTTLS (secure: false); MAIL_FROM are întâietate la expeditor', () => {
  clear();
  Object.assign(process.env, { SMTP_HOST: 'mail.example.test', SMTP_PORT: '587', SMTP_USER: 'u@example.test', SMTP_PASS: 'x', MAIL_FROM: 'Pigeonrama <alt@example.test>' });
  assert.equal(config.smtp.port, 587);
  assert.equal(config.smtp.secure, false);
  assert.equal(config.mailFrom, 'Pigeonrama <alt@example.test>');
});
