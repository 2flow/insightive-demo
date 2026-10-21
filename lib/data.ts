import { classNameFor } from './classes'
import { interestFor } from './interest'
import raw from './substances.json'
import type { ApprovalStatus, Dataset, EndBucket, Substance } from './types'

// The whole dataset is compiled into the bundle — there is no backend. Regenerate
// lib/substances.json with tools/convert_export.py after a fresh ECHA export.
const dataset = raw as Dataset

export const meta = dataset.meta
export const substances: Substance[] = dataset.substances

/** "Today" for every date calculation: the day the export was pulled, so the
 *  numbers on screen always match the data rather than the reader's clock. */
export const asOf = meta.exportDate

// ── Display helpers ───────────────────────────────────────────

/** The name to show. ECHA often lists the systematic name with the common one
 *  in brackets at the end — "(RS)-α-cyano-3-phenoxybenzyl-… (Cypermethrin)" —
 *  so that bracket is used when it reads as a name (has a capital, no digits
 *  or ratios: not "(nano)" or "(enantiomeric reaction mass S:R 75:25)").
 *  Failing that, a long name falls back to data/classes.json's common name.
 *  Short names, and long ones with neither, are shown as ECHA gives them. */
export function shortName(s: { name: string; cas?: string }): string {
  const name = s.name.trim()
  const bracket = name.match(/\(([^()]+)\)\s*$/)?.[1]?.trim() ?? ''
  if (bracket && /[A-Z]/.test(bracket) && !/[\d:]/.test(bracket) && bracket.length <= 40) {
    return bracket
  }
  if (name.length > 40) return classNameFor(s.cas) || name
  return name
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** ISO -> "01 Jun 2023". Returns "—" for the blank dates ECHA leaves on
 *  substances that were never approved. */
export function formatDate(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`
}

/** Like formatDate, but only shows the part of the date that is actually known
 *  — a feed record dated to the month renders "Jun 2026", not "01 Jun 2026". */
export function formatPartialDate(iso: string, precision: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  if (precision === 'year') return y
  if (precision === 'month') return `${MONTHS[Number(m) - 1]} ${y}`
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`
}

/** Whole months between two ISO dates (negative when `iso` is in the past). */
export function monthsUntil(iso: string, from: string = asOf): number {
  if (!iso) return NaN
  const [ay, am, ad] = from.split('-').map(Number)
  const [by, bm, bd] = iso.split('-').map(Number)
  return (by - ay) * 12 + (bm - am) - (bd < ad ? 1 : 0)
}

/** Whole days between two ISO dates (negative when `iso` is in the past). */
export function daysUntil(iso: string, from: string = asOf): number {
  if (!iso) return NaN
  const toUTC = (d: string) => {
    const [y, m, day] = d.split('-').map(Number)
    return Date.UTC(y, m - 1, day)
  }
  return Math.round((toUTC(iso) - toUTC(from)) / 86_400_000)
}

/** The short "how long left" cue next to an approval end date. The thresholds
 *  match the endBucket bands, so the cue and the filter never disagree. */
export function endCountdown(iso: string): { text: string; tone: 'critical' | 'warning' | 'neutral' } | null {
  if (!iso) return null
  const months = monthsUntil(iso)
  if (months < 0) return { text: 'expired', tone: 'critical' }
  if (months < 1) return { text: 'this month', tone: 'critical' }
  if (months <= 12) return { text: `${months} mo left`, tone: 'critical' }
  if (months <= 24) return { text: `${months} mo left`, tone: 'warning' }
  return { text: `${Math.floor(months / 12)} yr left`, tone: 'neutral' }
}

// ── Vocabularies (derived, so a new export can't leave a dead filter) ──

/** Fixed order: the approval lifecycle, not alphabetical. */
const STATUS_ORDER: ApprovalStatus[] = [
  'Approved',
  'Pending',
  'Expired',
  'Not approved',
  'No longer supported',
]

export function approvalStatuses(rows: Substance[] = substances): string[] {
  const present = new Set(rows.map(s => s.approvalStatus))
  return STATUS_ORDER.filter(s => present.has(s))
}

export function subStatuses(rows: Substance[] = substances): string[] {
  return Array.from(new Set(rows.map(s => s.assessmentSubStatus).filter(Boolean))).sort()
}

export function productTypes(rows: Substance[] = substances): string[] {
  return Array.from(new Set(rows.map(s => s.pt))).sort()
}

export const END_BUCKETS: { value: EndBucket; label: string; short: string }[] = [
  { value: 'expired', label: 'Already expired', short: 'Expired' },
  { value: '12m', label: 'Within 12 months', short: '≤12 mo' },
  { value: '24m', label: 'Within 24 months', short: '≤24 mo' },
  { value: '60m', label: 'Within 5 years', short: '≤5 yr' },
  { value: 'beyond', label: 'More than 5 years', short: '>5 yr' },
  { value: 'none', label: 'No approval end date', short: 'None' },
]

// ── Row-level alerts ─────────────────────────────────────────
// Three independent risk cues shown on a substance row, each backed by its own
// rule. A row can carry any combination of them.

/** How close to the approval end date counts as "at risk" when no renewal
 *  application is yet on file. Pelsis-specified; a placeholder pending
 *  confirmation — tune it here if the window should be shorter or longer. */
export const RENEWAL_RISK_WINDOW_DAYS = 550

/** True when an approval is still in force, ends inside the risk window, and
 *  no renewal is on record — the substance could lapse with nothing filed.
 *
 *  Two records can say a renewal is under way, and either one settles it: the
 *  assessment status field, and ECHA's expressions-of-interest list. The list
 *  is often ahead of the status field, so reading only the latter would flag a
 *  filed renewal as missing. */
export function isRenewalAtRisk(s: Substance): boolean {
  if (s.approvalStatus !== 'Approved' || !s.endDate) return false
  if (s.assessmentStatus === 'Renewal in progress') return false
  if (interestFor(s.id)?.state === 'submitted') return false
  return daysUntil(s.endDate) < RENEWAL_RISK_WINDOW_DAYS
}

export function isSubstitutionCandidate(s: Substance): boolean {
  return s.substitution === 'Yes'
}

/** True whenever the BPC has published an opinion — today that's always the
 *  positive "May be renewed", so any non-blank opinion reads as a green cue. */
export function hasBpcRenewalOpinion(s: Substance): boolean {
  return s.bpcOpinion.trim() !== ''
}
