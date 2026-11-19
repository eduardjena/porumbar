/*
 * Citirile pedigree-urilor din poze, incluse în abonament (docs/superpowers/specs/2026-11-18-citiri-incluse-design.md):
 * PEDIGREE_READS_PER_YEAR pe an de abonament (implicit 100), plus citirile în plus date de vânzător pentru anul curent.
 * Anul începe la data de început a abonamentului; se numără toate citirile (și cele nereușite se plătesc).
 */
import { one } from './db.js';

export const readsPerYear = () => Number(process.env.PEDIGREE_READS_PER_YEAR) || 100;
/**
 * Plafonul de bani pe an de abonament, pe crescător (PEDIGREE_BUDGET_USD, implicit 3 $): peste el citirea se oprește.
 * O citire pe Sonnet costă ~2,5–3 cenți, deci 100 de citiri încap de obicei sub plafon.
 */
export const budgetUsd = () => {
  const v = Number(process.env.PEDIGREE_BUDGET_USD);
  return Number.isFinite(v) && v > 0 ? v : 3;
};

/** SQL pentru citirile din anul curent de abonament ale contului `a` (folosit și în lista din consolă). */
export const YEAR_READS_WHERE = 'r.account_id = a.id AND a.subscription_start IS NOT NULL AND r.created_at >= a.subscription_start';

/** Rândul din consolă / Cont: { used, allowed, perYear, costUsd } din coloanele reads_year, cost_year, extra_reads. */
export const readsOfRow = (a) => ({
  used: Number(a.reads_year ?? 0),
  allowed: readsPerYear() + Number(a.extra_reads ?? 0),
  perYear: readsPerYear(),
  costUsd: Math.round(Number(a.cost_year ?? 0) / 1e4) / 100,
});

export async function readsOf(accountId) {
  const a = await one(
    `SELECT a.extra_reads,
            (SELECT count(*) FROM pedigree_reads r WHERE ${YEAR_READS_WHERE}) AS reads_year,
            (SELECT coalesce(sum(r.cost_micros), 0) FROM pedigree_reads r WHERE ${YEAR_READS_WHERE}) AS cost_year
       FROM accounts a WHERE a.id = ?`,
    accountId,
  );
  return readsOfRow(a ?? {});
}
