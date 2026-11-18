import Anthropic from '@anthropic-ai/sdk';
import { readsOf } from './reads.js';
import { currentLang } from './i18n.js';
import { HttpError, badRequest } from './http.js';
import { insert, one, run as runSql } from './db.js';
import { isAdminEmail } from './subscriptions.js';
import { MAX_GENERATIONS } from './pedigree-import.js';

/*
 * Citirea unui pedigree din poză sau PDF cu Claude (spec §8). Fișierul vine în memorie, se trimite la citire și
 * nu se păstrează nicăieri. Rezultatul NU se salvează: completează ecranul „Importă pedigree”, unde omul verifică
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
/*
 * Modelul și prețul lui se pot schimba din variabilele serverului (Railway), fără cod:
 * PEDIGREE_MODEL (implicit claude-opus-5-5), PEDIGREE_PRICE_INPUT / PEDIGREE_PRICE_OUTPUT în dolari pe milion de
 * jetoane (implicit prețul lui claude-opus-5-5: 4 $ intrare, 20 $ ieșire). Prețul doar socotește costul din consolă.
 */
export const readerModel = () => process.env.PEDIGREE_MODEL?.trim() || 'claude-opus-5-5';
const pricePerMillion = (name, fallback) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};
/** Costul unei citiri, în microdolari (1 $ pe milion de jetoane = 1 microdolar pe jeton). */
export const costOf = (usage) =>
  Math.round(
    (Number(usage?.input_tokens) || 0) * pricePerMillion('PEDIGREE_PRICE_INPUT', 4) +
      (Number(usage?.output_tokens) || 0) * pricePerMillion('PEDIGREE_PRICE_OUTPUT', 20),
  );

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
Căsuțele goale sau tăiate nu apar în listă. Diacriticele lipsă le lași cum sunt. Fișa poate fi scrisă și în maghiară („SZÁRMAZÁSI LAP”, apa / anya, culori ca „kék kovácsolt”, sexul H / T după inel): transcrii la fel, exact cum e scris.

rootSex: sexul porumbelului principal dacă e scris, altfel null.
notes: o frază scurtă, {LIMBA_NOTEI}, despre ce nu s-a putut citi (părți tăiate, scris neclar); șir gol dacă totul e clar. Dacă fișierul nu e un pedigree de porumbel, lași slots gol și spui asta în notes.`;

// Nota („ce nu s-a putut citi”) vine în limba omului.
const NOTE_LANG = { ro: 'în română', hu: 'în maghiară' };
const instructionsFor = (lang) => INSTRUCTIONS.replace('{LIMBA_NOTEI}', NOTE_LANG[lang] ?? NOTE_LANG.ro);

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
    model: readerModel(),
    max_tokens: 16000,
    // Dacă modelul refuză (rar, de exemplu din greșeală), cererea trece singură pe un model de rezervă.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: [file, { type: 'text', text: instructionsFor(currentLang()) }] }],
  });
  // Și o citire nereușită se plătește: costul ei pleacă împreună cu eroarea, ca să fie trecut lângă citire.
  const fail = (message) => Object.assign(new HttpError(422, message), { usage: response.usage });
  if (response.stop_reason === 'refusal') throw fail('eroare.citire_refuzata');
  if (response.stop_reason === 'max_tokens') throw fail('eroare.citire_prea_lung');
  const text = response.content.find((b) => b.type === 'text')?.text ?? '';
  try {
    return { ...JSON.parse(text), usage: response.usage };
  } catch {
    throw fail('eroare.citire_nereusita');
  }
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
  if (!MIME_TYPES.includes(mime)) throw badRequest('eroare.citire_tip_fisier');
  if (typeof body?.data !== 'string' || !/^[A-Za-z0-9+/\s]*={0,2}\s*$/.test(body.data)) throw badRequest('eroare.citire_fisier_rupt');
  const data = Buffer.from(body.data, 'base64');
  if (!data.length) throw badRequest('eroare.citire_fisier_gol');
  if (data.length > MAX_BYTES) throw badRequest('eroare.citire_fisier_mare');

  const run = model ?? (process.env.ANTHROPIC_API_KEY ? claudeModel : null);
  if (!run) throw new HttpError(503, 'eroare.citire_oprita');

  // O singură citire odată pe cont: cererile trimise deodată nu pot trece toate de credit și de limita pe zi
  // (serverul rulează o singură instanță, deci ajunge o listă în memorie).
  if (reading.has(accountId)) throw new HttpError(429, 'eroare.citire_in_curs');
  reading.add(accountId);
  try {
    return await readLocked(accountId, mime, data, run);
  } finally {
    reading.delete(accountId);
  }
}

const reading = new Set();

async function readLocked(accountId, mime, data, run) {
  // Citirile incluse în abonament (adminul citește fără limită pe an).
  const acc = await one('SELECT email FROM accounts WHERE id = ?', accountId);
  const admin = isAdminEmail(acc.email);
  if (!admin) {
    const reads = await readsOf(accountId);
    if (reads.used >= reads.allowed) throw new HttpError(402, 'eroare.citire_epuizate', { numar: reads.allowed });
  }
  const used = await one(`SELECT count(*)::int AS n FROM pedigree_reads WHERE account_id = ? AND created_at > now() - interval '1 day'`, accountId);
  if (used.n >= readsPerDay()) throw new HttpError(429, 'eroare.citire_limita_zi', { numar: readsPerDay() });
  const readId = await insert('INSERT INTO pedigree_reads (account_id, created_at) VALUES (?, now())', accountId);

  const charge = async (usage) => {
    const cost = costOf(usage);
    await runSql('UPDATE pedigree_reads SET cost_micros = ? WHERE id = ?', cost, readId);
  };
  let out;
  try {
    out = await run({ mime, data });
  } catch (e) {
    if (e?.usage) await charge(e.usage);
    if (e instanceof HttpError) throw e;
    if (e instanceof Anthropic.RateLimitError) throw new HttpError(503, 'eroare.citire_ocupata');
    console.error('[porumbar] Citirea pedigree-ului a eșuat:', e?.message);
    throw new HttpError(502, 'eroare.citire_esuata');
  }
  // Costul real al citirii rămâne lângă citire (îl vede vânzătorul în consolă).
  await charge(out?.usage);
  const { root, filled } = toTree(out?.slots, out?.rootSex);
  const notes = typeof out?.notes === 'string' ? out.notes.trim() : '';
  if (!root) throw new HttpError(422, notes || 'eroare.citire_niciun_porumbel');
  return { root, filled, notes };
}
