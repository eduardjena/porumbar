// Amintirile tratamentelor și ale cuibului: verificarea de pe oră (fixarea tratamentelor începute, notificările pe
// telefon și rezumatul de seară pe email). Tratamentele și cuiburile pleacă împreună: o singură notificare pe cont și
// moment, un singur email pe cont și seară (cuiburile: nest-reminders.js). Fiecare amintire se „rezervă” în bază
// înainte de trimitere (INSERT … ON CONFLICT DO NOTHING RETURNING): pleacă doar ce a rezervat rularea aceasta, deci
// două rulări simultane (o publicare nouă pornită peste cea veche) nu trimit de două ori. Nimic nu se reîncearcă: mai bine o amintire pierdută decât spam.
// Fiecare cont trăiește pe ora țării lui (zona după limbă, src/zones.js): verificarea face pașii o dată pe zonă, cu
// „azi” și seara zonei, doar pentru conturile ei.
import { all, one } from './db.js';
import { config } from './config.js';
import { t, ref, localeOf } from './i18n.js';
import { pushToAccount } from './push.js';
import { sendMail } from './mail.js';
import { addDays, freezeTreatment, recipientIds, treatmentLabel } from './treatments.js';
import { dueMoments } from './treatment-schedule.js';
import { claimNestNotices, groupNestItems, inZone, nestDueItems, nestEveningLines } from './nest-reminders.js';
import { ACCOUNT_ZONES, atLocal, todayIn } from './zones.js';

const HOUR = 3600e3;
const WINDOW = 3 * HOUR; // ca în treatment-schedule.js: un moment ratat se mai trimite cel mult 3 ore
const EVENING = 19;
const KIND_ORDER = { inainte: 0, ultima_zi: 1, ultima_zi_maine: 1, repetare: 2 };

const lowerFirst = (s, lang) => s.charAt(0).toLocaleLowerCase(localeOf(lang)) + s.slice(1);
const upperFirst = (s, lang) => s.charAt(0).toLocaleUpperCase(localeOf(lang)) + s.slice(1);
const weekday = (iso, lang) => upperFirst(new Intl.DateTimeFormat(localeOf(lang), { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`)), lang);

/** Un rând de amintire, în limba contului. `kind`: inainte | ultima_zi | ultima_zi_maine | repetare. */
function line(kind, tr, count, lang) {
  const nume = treatmentLabel(tr.name, lang);
  const mod = lowerFirst(t(lang, `catalog.tratament_mod.${tr.method}`), lang);
  const porumbei = ref('amintire.porumbei', { count });
  if (kind === 'inainte') return t(lang, 'amintire.inainte', { nume, porumbei, mod });
  if (kind === 'repetare') return t(lang, 'amintire.repetare', { zi: weekday(tr.start_date, lang), nume, porumbei, mod });
  return t(lang, `amintire.${kind}`, { nume });
}

const byKindAndText = (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.text.localeCompare(b.text);

function groupBy(rows, key) {
  const out = new Map();
  for (const r of rows) {
    if (!out.has(r[key])) out.set(r[key], []);
    out.get(r[key]).push(r);
  }
  return out;
}

// ---- Coada emailurilor: cel mult `reminderEmailsPerMinute` pe minut, ca să nu treacă de limita căsuței. ----

/** Ce se scrie în jurnalul serverului când un email nu pleacă: doar codurile, nu mesajul (poate avea adresa omului). */
export function mailErrorText(e) {
  const parts = [e?.code, e?.responseCode].filter((x) => x != null && x !== '');
  return parts.length ? parts.join(' ') : 'eroare SMTP'; // i18n: ro
}

let mailQueue = Promise.resolve();
let lastMailAt = 0;

function enqueueMail(mail, gapMs) {
  mailQueue = mailQueue.then(async () => {
    const wait = lastMailAt + gapMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastMailAt = Date.now();
    try {
      await sendMail(mail);
    } catch (e) {
      console.error('[porumbar] Rezumatul de seară nu a plecat:', mailErrorText(e)); // i18n: ro
    }
  });
}

let warnedNoSmtp = false;
/** În producție, fără server de email (SMTP_HOST sau SMTP_URL) nu se trimite nimic (și conținutul nu ajunge în jurnalul serverului). */
function mailAllowed() {
  if (process.env.NODE_ENV !== 'production' || config.smtp) return true;
  if (!warnedNoSmtp) console.warn('[porumbar] Rezumatul de seară pe email e oprit: lipsește SMTP_HOST (sau SMTP_URL).'); // i18n: ro
  warnedNoSmtp = true;
  return false;
}

// ---- Pașii verificării ----

/** 1. Tratamentele începute (până azi) și încă nefixate se fixează; așa continuă și lanțul repetărilor. */
async function freezeStarted(today, zone) {
  const z = inZone(zone, 'a.lang');
  const rows = await all(
    `SELECT t.id, a.lang FROM treatments t JOIN accounts a ON a.id = t.account_id
      WHERE t.frozen_at IS NULL AND t.cancelled_on IS NULL AND t.start_date <= ?::date AND ${z.sql} ORDER BY t.id`,
    today, z.param,
  );
  let frozen = 0;
  for (const r of rows) {
    try {
      if (await freezeTreatment(r, r.lang, { today })) frozen += 1;
    } catch (e) {
      console.error(`[porumbar] Tratamentul ${r.id} nu s-a putut fixa:`, e.message); // i18n: ro
    }
  }
  return frozen;
}

/** Rezervă momentele unui cont; întoarce doar rândurile inserate acum (ordinea fixă: rulările simultane nu se împart). */
async function claimNotices(items) {
  items.sort((a, b) => a.tr.id - b.tr.id || a.kind.localeCompare(b.kind) || a.onDate.localeCompare(b.onDate));
  const rows = await all(
    `INSERT INTO treatment_notices (treatment_id, kind, on_date, sent_at)
     SELECT u.id, u.kind, u.on_date, now() FROM unnest(?::bigint[], ?::text[], ?::date[]) AS u(id, kind, on_date)
     ON CONFLICT DO NOTHING RETURNING treatment_id, kind, on_date`,
    items.map((i) => i.tr.id), items.map((i) => i.kind), items.map((i) => i.onDate),
  );
  const won = new Set(rows.map((r) => `${r.treatment_id}|${r.kind}|${r.on_date}`));
  return items.filter((i) => won.has(`${i.tr.id}|${i.kind}|${i.onDate}`));
}

/** 2. Momentele tratamentelor sosite, rezervate, pe cont: `{ lang, lines, ids }` (ids = tratamentele din rânduri). */
async function dueTreatmentLines(now, today, zone) {
  const z = inZone(zone, 'a.lang');
  const rows = await all(
    `SELECT t.*, a.lang FROM treatments t JOIN accounts a ON a.id = t.account_id
      WHERE t.cancelled_on IS NULL AND ${z.sql}
        AND (t.start_date BETWEEN ?::date - 1 AND ?::date + 4 OR t.start_date + t.days - 1 BETWEEN ?::date - 1 AND ?::date + 1)
      ORDER BY t.account_id, t.id`,
    z.param, today, today, today, today,
  );
  const out = new Map();
  for (const [accountId, list] of groupBy(rows, 'account_id')) {
    try {
      const items = [];
      for (const tr of list) {
        const plan = { startDate: tr.start_date, days: tr.days, cancelledOn: tr.cancelled_on, parentId: tr.parent_id };
        const due = dueMoments(plan, now, new Date(tr.updated_at), zone);
        if (!due.length) continue;
        const count = (await recipientIds(tr)).length;
        if (!count) continue; // fără porumbei, fără amintiri
        for (const m of due) items.push({ tr, kind: m.kind, onDate: m.onDate, count });
      }
      if (!items.length) continue;
      const claimed = await claimNotices(items);
      if (!claimed.length) continue;
      const lang = list[0].lang;
      out.set(accountId, {
        lang,
        lines: claimed.map((i) => ({ kind: i.kind, text: line(i.kind, i.tr, i.count, lang) })).sort(byKindAndText),
        ids: new Set(claimed.map((i) => i.tr.id)),
      });
    } catch (e) {
      console.error(`[porumbar] Amintirile contului ${accountId} nu au rulat:`, e.message); // i18n: ro
    }
  }
  return out;
}

/** 3. Momentele cuibului sosite, rezervate, pe cont: rândurile lor. */
async function dueNestLines(now, today, zone) {
  const out = new Map();
  let due;
  try {
    due = await nestDueItems(now, today, zone);
  } catch (e) {
    console.error('[porumbar] Amintirile cuibului nu au rulat:', e.message); // i18n: ro
    return out;
  }
  for (const [accountId, items] of due) {
    try {
      const claimed = await claimNestNotices(items);
      if (claimed.length) out.set(accountId, groupNestItems(claimed, claimed[0].lang));
    } catch (e) {
      console.error(`[porumbar] Amintirile de cuib ale contului ${accountId} nu au rulat:`, e.message); // i18n: ro
    }
  }
  return out;
}

/** Datele conturilor `ids` de care au nevoie notificarea și emailul (limba, adresa, numele, emailul pornit). */
async function accountInfo(ids) {
  if (!ids.length) return new Map();
  const rows = await all('SELECT id, lang, email, name, reminder_email FROM accounts WHERE id = ANY(?::bigint[])', ids);
  return new Map(rows.map((r) => [r.id, r]));
}

/**
 * 2–3. Momentele sosite (tratamente și cuiburi) pleacă într-o singură notificare pe cont; linkul: tratamentul, când e
 * unul singur și nimic de la cuiburi, altfel Panoul. Întoarce rezultatele pe cont.
 */
async function sendDuePushes(now, today, zone) {
  const treatments = await dueTreatmentLines(now, today, zone);
  const nests = await dueNestLines(now, today, zone);
  const info = await accountInfo([...nests.keys()].filter((id) => !treatments.has(id)));
  const results = new Map();
  for (const accountId of new Set([...treatments.keys(), ...nests.keys()])) {
    try {
      const tr = treatments.get(accountId);
      const nest = nests.get(accountId) ?? [];
      const lang = tr?.lang ?? info.get(accountId)?.lang;
      const lines = [...(tr?.lines ?? []), ...nest];
      const payload = {
        title: t(lang, 'push.titlu'),
        body: lines.map((l) => l.text).join('\n'),
        url: !nest.length && tr.ids.size === 1 ? `/tratamente/${[...tr.ids][0]}` : '/panou',
      };
      let result;
      try {
        result = await pushToAccount(accountId, payload);
      } catch (e) {
        console.error(`[porumbar] Amintirea pentru contul ${accountId} nu a plecat:`, e.message); // i18n: ro
        result = { sent: 0, failed: 0, devices: 0 };
      }
      results.set(accountId, result);
    } catch (e) {
      console.error(`[porumbar] Amintirile contului ${accountId} nu au rulat:`, e.message); // i18n: ro
    }
  }
  return results;
}

/**
 * 4. Rezumatul de seară: conturile cu ceva pentru mâine (început, ultima zi, un moment al cuibului) sau o repetare peste
 * 3 zile, cu emailul pornit și fără dispozitiv care să fi primit notificarea serii. Tratamentele și cuiburile într-un
 * singur email. `pushResults`: notificările trimise de rularea asta (în fereastra serii toate sunt ale serii: momentele
 * de 07:00 nu pot fi sosite atunci).
 */
async function sendEveningEmails(today, evening, zone, pushResults, gapMs) {
  const tomorrow = addDays(today, 1);
  const z = inZone(zone, 'a.lang');
  const rows = await all(
    `SELECT t.*, a.lang FROM treatments t JOIN accounts a ON a.id = t.account_id
      WHERE a.reminder_email AND ${z.sql} AND t.cancelled_on IS NULL AND t.updated_at <= ?
        AND (t.start_date = ?::date OR (t.days >= 2 AND t.start_date + t.days - 1 = ?::date)
             OR (t.parent_id IS NOT NULL AND t.start_date = ?::date))
      ORDER BY t.account_id, t.id`,
    z.param, evening.toISOString(), tomorrow, tomorrow, addDays(today, 3),
  );
  const treatments = groupBy(rows, 'account_id');
  let nests = new Map();
  try {
    nests = await nestEveningLines(today, evening, zone);
  } catch (e) {
    console.error('[porumbar] Rândurile de cuib ale rezumatului de seară nu au rulat:', e.message); // i18n: ro
  }
  const accountIds = [...new Set([...treatments.keys(), ...nests.keys()])];
  const info = await accountInfo(accountIds);
  let emails = 0;
  for (const accountId of accountIds) {
    try {
      const acc = info.get(accountId);
      if (!acc?.reminder_email) continue;
      const push = pushResults.get(accountId);
      if (push ? push.sent > 0 : (await one('SELECT count(*) AS n FROM push_subscriptions WHERE account_id = ?', accountId)).n > 0) continue;
      const lang = acc.lang;
      const lines = [];
      for (const tr of treatments.get(accountId) ?? []) {
        const count = (await recipientIds(tr)).length;
        if (!count) continue;
        const kind = tr.start_date === tomorrow ? 'inainte' : tr.start_date === addDays(today, 3) ? 'repetare' : 'ultima_zi_maine';
        lines.push({ kind, text: line(kind, tr, count, lang) });
      }
      lines.sort(byKindAndText);
      const nest = nests.get(accountId) ?? [];
      if (!lines.length && !nest.length) continue;
      const claimed = await one(
        'INSERT INTO email_digests (account_id, on_date, sent_at) VALUES (?, ?, now()) ON CONFLICT DO NOTHING RETURNING account_id',
        accountId, today,
      );
      if (!claimed) continue;
      const lista = [...lines, ...nest].map((l) => `- ${l.text}`).join('\n');
      // Doar tratamente: emailul de până acum; cu cuiburi: subiectul spune ce are și linkul duce la Panou.
      const mail = !nest.length
        ? { subject: t(lang, 'amintire.email_subiect'), text: t(lang, 'amintire.email_text', { nume: acc.name, lista, link: `${config.publicBaseUrl}/tratamente` }) }
        : {
          subject: t(lang, lines.length ? 'amintire.email_subiect_toate' : 'amintire.email_subiect_cuiburi'),
          text: t(lang, 'amintire.email_text_cuib', { nume: acc.name, lista, link: `${config.publicBaseUrl}/panou` }),
        };
      enqueueMail({ to: acc.email, ...mail }, gapMs);
      emails += 1;
    } catch (e) {
      console.error(`[porumbar] Rezumatul de seară al contului ${accountId} nu a rulat:`, e.message); // i18n: ro
    }
  }
  return emails;
}

/** Pașii 1–4 pentru conturile din zona `zone`, cu ziua, ora și seara de acolo. */
async function runZone(now, zone, emailDelayMs) {
  const today = todayIn(zone, now);
  const frozen = await freezeStarted(today, zone);
  const pushResults = await sendDuePushes(now, today, zone);
  let emails = 0;
  const evening = atLocal(today, EVENING, zone);
  if (now >= evening && now - evening <= WINDOW && mailAllowed()) {
    const gapMs = emailDelayMs ?? Math.ceil(60_000 / config.reminderEmailsPerMinute);
    emails = await sendEveningEmails(today, evening, zone, pushResults, gapMs);
  }
  return { frozen, pushed: pushResults.size, emails };
}

/**
 * O verificare: pașii, o dată pe zonă (București întâi). `now` hotărăște tot (ziua, ora, momentele), nu ceasul.
 * Emailurile intră într-o coadă care nu oprește verificarea; cu `emailDelayMs: 0` (teste) coada nu așteaptă între
 * emailuri, iar funcția se întoarce după ce s-a golit.
 * @returns {Promise<{ frozen: number, pushed: number, emails: number }>}
 */
export async function runTreatmentReminders(now = new Date(), { emailDelayMs } = {}) {
  const total = { frozen: 0, pushed: 0, emails: 0 };
  for (const zone of ACCOUNT_ZONES) {
    const r = await runZone(now, zone, emailDelayMs);
    for (const k of Object.keys(total)) total[k] += r[k];
  }
  if (emailDelayMs === 0) await mailQueue;
  return total;
}

const TICK_AT = 30_000; // verificarea orară: la hh:00:30

/** Cât până la următoarea verificare orară (hh:00:30), dar cel puțin o secundă (un ceas care sună puțin mai devreme nu rulează de două ori). */
export function msUntilNextTick(now = new Date()) {
  const since = (((now.getTime() - TICK_AT) % HOUR) + HOUR) % HOUR;
  const wait = HOUR - since;
  return wait < 1000 ? wait + HOUR : wait;
}

/**
 * Verificarea la 15 s după pornire, apoi la fiecare oră fixă (hh:00:30), ca momentele de la 07:00 și 19:00 să plece
 * imediat, nu cu până la o oră întârziere (fiecare moment e văzut de cel puțin 3 verificări).
 */
export function startTreatmentReminders() {
  const tick = () => runTreatmentReminders().catch((e) => console.error('[porumbar] Amintirile tratamentelor nu au rulat:', e.message)); // i18n: ro
  const hourly = () => {
    tick();
    setTimeout(hourly, msUntilNextTick()).unref();
  };
  setTimeout(tick, 15_000).unref();
  setTimeout(hourly, msUntilNextTick()).unref();
}
