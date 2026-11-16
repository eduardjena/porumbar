import Anthropic from '@anthropic-ai/sdk';
import { HttpError, badRequest } from './http.js';
import { insert, one, run as runSql } from './db.js';
import { isAdminEmail } from './subscriptions.js';
import { MAX_GENERATIONS } from './pedigree-import.js';

/*
 * Citirea unui pedigree din poză sau PDF cu Claude (spec §8). Fișierul vine în memorie, se trimite la citire și
 * nu se păstrează nicăieri. Rezultatul NU se salvează: completează ecranul „Pedigree pe hârtie”, unde omul verifică
 * și corectează, apoi salvează el (POST /api/pedigrees/import).
 *
 * Claude primește căsuțele numerotate ca pe foaie (1 = porumbelul, tatăl lui i = 2i, mama = 2i + 1) și întoarce o
 * listă plată (JSON-ul structurat nu acceptă scheme recursive); aici lista devine arbore.
 *
 * Fără ANTHROPIC_API_KEY citirea e oprită (503). Fiecare cont are o limită de citiri pe zi (PEDIGREE_READS_PER_DAY,
 * implicit 20), ca costul să nu scape de sub control.
 */

export const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 12 * 1024 * 1024;
const SLOTS = 2 ** MAX_GENERATIONS - 1; // 31
const MODEL = 'claude-opus-5-5';
// Prețul lui claude-opus-5-5: 4 $ / milion de jetoane intrare, 20 $ / milion ieșire → microdolari pe jeton.
const MICROS_PER_INPUT = 4;
const MICROS_PER_OUTPUT = 20;
const costOf = (usage) => Math.round((Number(usage?.input_tokens) || 0) * MICROS_PER_INPUT + (Number(usage?.output_tokens) || 0) * MICROS_PER_OUTPUT);

const readsPerDay = () => Number(process.env.PEDIGREE_READS_PER_DAY) || 20;

const nullable = (type) => ({ anyOf: [{ type }, { type: 'null' }] });
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['slots', 'rootSex', 'notes'],
  properties: {
    slots: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['slot', 'ring', 'name', 'color', 'text', 'breeder'],
        properties: {
          slot: { type: 'integer' },
          ring: nullable('string'),
          name: nullable('string'),
          color: nullable('string'),
          text: nullable('string'),
          breeder: nullable('string'),
        },
      },
    },
    rootSex: { anyOf: [{ type: 'string', enum: ['M', 'F'] }, { type: 'null' }] },
    notes: { type: 'string' },
  },
};

const INSTRUCTIONS = `Citești pedigree-ul unui porumbel voiajor (columbofilie), dintr-o poză sau un PDF, ca să fie trecut într-un program de evidență. Transcrii exact ce scrie; nu inventezi nimic.

Căsuțele sunt numerotate ca pe foaie: 1 = porumbelul principal; pentru căsuța i, tatăl este 2i și mama 2i + 1. Deci 2 = tatăl, 3 = mama, 4 = tatăl tatălui, 5 = mama tatălui, 6 = tatăl mamei, 7 = mama mamei, 8–15 = străbunicii, 16–31 = răstrăbunicii (cel mult 31 de căsuțe). Pe majoritatea pedigree-urilor tatăl e sus și mama jos; uită-te la semnele de sex (M/F, L/T, ♂/♀) dacă așezarea nu e clară.

Pentru fiecare căsuță în care scrie ceva:
- ring: seria de inel exact cum e scrisă (de ex. „412084/15 RO”, „RO-26-800546 L”, „NL-04-1954746”, „0000/07 RO M” pentru neinelat). null dacă nu are.
- name: numele porumbelului doar dacă e scris clar ca nume (de ex. „FUMUR”, „Diana”); altfel null.
- color: culoarea, cum e scrisă (de ex. „Pestriț”, „Vânăt”, „Solzat p.a.”, „BB”); null dacă nu e.
- breeder: crescătorul de origine, dacă e scris separat (de ex. „Van Heteren”, „Comb. Den Haan”); altfel null.
- text: restul textului din căsuță (rezultate, observații), fără inel, nume, culoare și crescător; null dacă nu rămâne nimic.
Căsuțele goale sau tăiate nu apar în listă. Diacriticele lipsă le lași cum sunt.

rootSex: sexul porumbelului principal dacă e scris, altfel null.
notes: o frază scurtă, în română, despre ce nu s-a putut citi (părți tăiate, scris neclar); șir gol dacă totul e clar. Dacă fișierul nu e un pedigree de porumbel, lași slots gol și spui asta în notes.`;

/** Modelul de citire; testele pun aici unul fals (fără rețea, fără cost). */
let model = null;
export function setPedigreeModel(fn) {
  model = fn;
}

async function claudeModel({ mime, data }) {
  const client = new Anthropic();
  const b64 = data.toString('base64');
  const file =
    mime === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
      : { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } };
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    // Dacă modelul refuză (rar, de exemplu din greșeală), cererea trece singură pe un model de rezervă.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: [file, { type: 'text', text: INSTRUCTIONS }] }],
  });
  if (response.stop_reason === 'refusal') throw new HttpError(422, 'Fișierul nu a putut fi citit. Încearcă altă poză.');
  if (response.stop_reason === 'max_tokens') throw new HttpError(422, 'Pedigree-ul e prea lung pentru o citire. Încearcă o poză cu mai puține generații.');
  const text = response.content.find((b) => b.type === 'text')?.text ?? '';
  return { ...JSON.parse(text), usage: response.usage };
}

/** Lista plată de căsuțe → arbore { ring, name, color, text, breeder, sex?, father, mother }. */
function toTree(slots, rootSex) {
  const bySlot = new Map();
  for (const s of slots ?? []) {
    const i = Number(s?.slot);
    if (!Number.isInteger(i) || i < 1 || i > SLOTS || bySlot.has(i)) continue;
    const clean = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
    const node = { ring: clean(s.ring, 80), name: clean(s.name, 80), color: clean(s.color, 120), text: clean(s.text, 2000), breeder: clean(s.breeder, 200) };
    if (Object.values(node).some(Boolean)) bySlot.set(i, node);
  }
  const build = (i) => {
    if (i > SLOTS) return null;
    const father = build(2 * i);
    const mother = build(2 * i + 1);
    const n = bySlot.get(i);
    if (!n && !father && !mother) return null;
    return { ...(n ?? { ring: null, name: null, color: null, text: null, breeder: null }), father, mother };
  };
  const root = build(1);
  if (root && (rootSex === 'M' || rootSex === 'F')) root.sex = rootSex;
  return { root, filled: bySlot.size };
}

/** Citește fișierul pentru contul dat. Întoarce { root, filled, notes }. */
export async function readPedigree(accountId, body) {
  const mime = String(body?.mime ?? '');
  if (!MIME_TYPES.includes(mime)) throw badRequest('Trimite o poză (JPG, PNG, WebP) sau un PDF.');
  const data = Buffer.from(String(body?.data ?? ''), 'base64');
  if (!data.length) throw badRequest('Fișierul e gol.');
  if (data.length > MAX_BYTES) throw badRequest('Fișierul e prea mare (cel mult 12 MB).');

  const run = model ?? (process.env.ANTHROPIC_API_KEY ? claudeModel : null);
  if (!run) throw new HttpError(503, 'Citirea din poză nu e pornită încă pe acest server. Completează căsuțele de mână.');

  // Creditul pus de vânzător după plată (adminul citește fără credit).
  const acc = await one('SELECT email, ai_credit_micros FROM accounts WHERE id = ?', accountId);
  const admin = isAdminEmail(acc.email);
  if (!admin && Number(acc.ai_credit_micros) <= 0) {
    throw new HttpError(402, 'Nu mai ai credit pentru citirea pozelor. Poți completa căsuțele de mână (inelele pe care le ai deja se completează singure) sau ceri credit de la cel de la care ai primit programul.');
  }
  const used = await one(`SELECT count(*)::int AS n FROM pedigree_reads WHERE account_id = ? AND created_at > now() - interval '1 day'`, accountId);
  if (used.n >= readsPerDay()) throw new HttpError(429, `Ai folosit cele ${readsPerDay()} citiri de azi. Mai poți citi mâine sau completezi căsuțele de mână.`);
  const readId = await insert('INSERT INTO pedigree_reads (account_id, created_at) VALUES (?, now())', accountId);

  let out;
  try {
    out = await run({ mime, data });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if (e instanceof Anthropic.RateLimitError) throw new HttpError(503, 'Citirea e ocupată acum. Încearcă din nou peste un minut.');
    console.error('[porumbar] Citirea pedigree-ului a eșuat:', e?.message);
    throw new HttpError(502, 'Citirea nu a mers acum. Încearcă din nou sau completează de mână.');
  }
  // Costul real al citirii se scade din credit (nu sub zero) și rămâne lângă citire.
  const cost = costOf(out?.usage);
  await runSql('UPDATE pedigree_reads SET cost_micros = ? WHERE id = ?', cost, readId);
  if (!admin) await runSql('UPDATE accounts SET ai_credit_micros = GREATEST(0, ai_credit_micros - ?) WHERE id = ?', cost, accountId);
  const { root, filled } = toTree(out?.slots, out?.rootSex);
  const notes = typeof out?.notes === 'string' ? out.notes.trim() : '';
  if (!root) throw new HttpError(422, notes || 'Nu am găsit niciun porumbel în fișier. Încearcă o poză mai clară.');
  return { root, filled, notes };
}
