/*
 * Citirile pedigree-urilor din poze, incluse în abonament (docs/superpowers/specs/2026-11-18-citiri-incluse-design.md):
 * PEDIGREE_READS_PER_YEAR pe an de abonament (implicit 100), plus citirile în plus date de vânzător pentru anul curent.
 * Anul începe la data de început a abonamentului; se numără toate citirile (și cele nereușite se plătesc).
 * În primele 14 zile ale fiecărui abonament (cât ține dreptul de retragere) doar PEDIGREE_READS_FIRST_DAYS (implicit 3),
 * ca nimeni să nu poată plăti, citi 100 de fișe și apoi să se retragă (iar și iar, cu alt cont). În proba de 30 de zile
 * (fără abonament): PEDIGREE_READS_TRIAL în total (implicit 3), numărate de la confirmarea emailului.
 */
import { one } from './db.js';
import { isoDate } from './subscriptions.js';

export const readsPerYear = () => Number(process.env.PEDIGREE_READS_PER_YEAR) || 100;
export const FIRST_DAYS = 14;
export const readsFirstDays = () => {
  const v = Number(process.env.PEDIGREE_READS_FIRST_DAYS);
  return process.env.PEDIGREE_READS_FIRST_DAYS?.trim() && Number.isInteger(v) && v >= 0 ? v : 3;
};
/** Citirile din proba de 30 de zile: PEDIGREE_READS_TRIAL în total (implicit 3), numărate de la confirmarea emailului. */
export const readsTrial = () => {
  const v = Number(process.env.PEDIGREE_READS_TRIAL);
  return process.env.PEDIGREE_READS_TRIAL?.trim() && Number.isInteger(v) && v >= 0 ? v : 3;
};
/** Ziua de la care abonamentul care a început la `start` are toate citirile (start + 14 zile). */
const fullReadsFrom = (start) => new Date(Date.parse(`${start}T00:00:00Z`) + FIRST_DAYS * 86_400_000).toISOString().slice(0, 10);
/**
 * Plafonul de bani pe an de abonament, pe crescător (PEDIGREE_BUDGET_USD, implicit 3 $): peste el citirea se oprește.
 * O citire pe Sonnet costă ~2,5–3 cenți, deci 100 de citiri încap de obicei sub plafon.
 */
export const budgetUsd = () => {
  const v = Number(process.env.PEDIGREE_BUDGET_USD);
  return Number.isFinite(v) && v > 0 ? v : 3;
};

/** SQL pentru citirile din anul curent de abonament ale contului `a` (folosit și în lista din consolă). */
// Cu abonament: de la ziua plății (paid_on, plata prin Polar; la activarea de mână e NULL, deci de la începutul
// abonamentului). Plata din probă deblochează citirile pe loc, deși anul plătit începe la sfârșitul probei.
// Fără abonament (în probă): de la confirmarea emailului.
export const YEAR_READS_WHERE = `r.account_id = a.id AND r.created_at >=
  CASE WHEN a.subscription_end IS NOT NULL THEN COALESCE(a.paid_on, a.subscription_start) ELSE a.email_confirmed_at END`;

/**
 * Rândul din consolă / Cont: { used, allowed, perYear, costUsd, fullFrom } din coloanele reads_year, cost_year,
 * extra_reads, subscription_start. `fullFrom` = ziua de la care are toate citirile (null după primele 14 zile).
 */
export function readsOfRow(a, now = new Date()) {
  const paid = !!a.subscription_end;
  const start = a.paid_on ?? a.subscription_start;
  const from = paid && start ? fullReadsFrom(start) : null;
  // Doar când limita din primele zile chiar e mai mică decât cea pe an.
  const firstDays = !!from && isoDate(now) < from && readsFirstDays() < readsPerYear();
  const base = !paid ? readsTrial() : firstDays ? readsFirstDays() : readsPerYear();
  return {
    used: Number(a.reads_year ?? 0),
    allowed: base + Number(a.extra_reads ?? 0),
    perYear: readsPerYear(),
    costUsd: Math.round(Number(a.cost_year ?? 0) / 1e4) / 100,
    fullFrom: firstDays ? from : null,
  };
}

export async function readsOf(accountId) {
  const a = await one(
    `SELECT a.extra_reads, a.subscription_start, a.subscription_end, a.paid_on, a.email_confirmed_at,
            (SELECT count(*) FROM pedigree_reads r WHERE ${YEAR_READS_WHERE}) AS reads_year,
            (SELECT coalesce(sum(r.cost_micros), 0) FROM pedigree_reads r WHERE ${YEAR_READS_WHERE}) AS cost_year
       FROM accounts a WHERE a.id = ?`,
    accountId,
  );
  return readsOfRow(a ?? {});
}
