import raw from './approvals.json'
import { latestChange } from './changes'
import { daysUntil } from './data'
import type { ApprovalCondition, ApprovalDataset, ApprovalMethod, ApprovalRecord } from './types'

// The act that approved each substance, read off EUR-Lex: the candidate-for-
// substitution finding and the REACH Annex XIII properties quoted from its
// recitals, and the conditions its Annex attaches to product authorisations.
//
// 61 of the 99 substance–product type pairs have an act. Of those, 8 state a
// candidate-for-substitution finding; the rest either say nothing about it or
// predate the concept.

const dataset = raw as ApprovalDataset

export const approvalMeta = dataset.meta

export function approvalFor(substanceId: string): ApprovalRecord | null {
  return dataset.bySubstance[substanceId] ?? null
}

/** Whether the act itself states the substance is a candidate for substitution. */
/**
 * Whether the act on record is a renewal that has already been granted.
 *
 * Known two ways (see renewalFor): from the act — `renewed` agrees with the
 * anchor act being a Renewal (BPR) on every row — or from a renewal seen
 * between two ECHA exports. Where it is true the
 * latest act is the approval, and anything still describing the substance as
 * awaiting a decision is out of date — ECHA's expressions-of-interest list
 * among them, which goes on reading "submitted" because it records the
 * application rather than what became of it.
 *
 * The other 41 substances with a list status keep it: nothing supersedes them.
 */
export function renewalGranted(substanceId: string): boolean {
  return renewalFor(substanceId) !== null
}

/** How long a renewal reads as "Recently renewed" before it settles into
 *  "Renewal granted": a year, long enough to be seen across a few updates. */
export const RECENTLY_RENEWED_DAYS = 365

export interface Renewal {
  /** "Implementing Regulation (EU) 2026/2247" */
  act: string
  url: string
  /** The act's adoption date where known; otherwise the date of the first
   *  ECHA export to show the renewal (`firstSeen`). */
  date: string
  firstSeen: boolean
}

/** "COMMISSION IMPLEMENTING REGULATION (EU) 2026/2247" -> "Implementing Regulation (EU) 2026/2247" */
export function actName(raw: string): string {
  const m = raw.match(/(implementing\s+)?(regulation|decision)\s*\(eu\)\s*(?:no\s*)?(\d{4}\/\d+)/i)
  if (!m) return raw
  const kind = m[2][0].toUpperCase() + m[2].slice(1).toLowerCase()
  return `${m[1] ? 'Implementing ' : ''}${kind} (EU) ${m[3]}`
}

/**
 * The renewal behind the approval in force, from whichever record is later:
 * the EUR-Lex act (approvals.json) or a renewal seen between two ECHA exports
 * (changes.json) — the export usually shows a renewal before the act is
 * retrieved here.
 */
export function renewalFor(substanceId: string): Renewal | null {
  const record = approvalFor(substanceId)
  const fromAct: Renewal | null =
    record?.renewed && record.act
      ? { act: record.act.name, url: record.act.url, date: record.act.date, firstSeen: false }
      : null
  const change = latestChange(substanceId, 'renewal')
  const fromExport: Renewal | null = change
    ? { act: actName(change.legalAct), url: change.legalActUrl, date: change.date, firstSeen: true }
    : null
  if (!fromAct || !fromExport) return fromAct ?? fromExport
  return fromExport.date > fromAct.date ? fromExport : fromAct
}

/** Renewed within RECENTLY_RENEWED_DAYS of the data's own date. */
export function recentlyRenewed(substanceId: string): boolean {
  const renewal = renewalFor(substanceId)
  return !!renewal && -daysUntil(renewal.date) <= RECENTLY_RENEWED_DAYS
}

export function statesCfs(record: ApprovalRecord): boolean {
  return record.cfs.inAct === 'Yes'
}

/**
 * Whether ECHA flags the substance as a candidate for substitution while the
 * act does not say so.
 *
 * Seven substances are in this position, and the panel reports both records
 * rather than picking one. The workbook's method note observes that acts
 * predating the candidate-for-substitution mechanism carry no such recital,
 * which is as far as anything we hold goes — where ECHA's flag actually comes
 * from is not documented in any source here, so neither the panel nor this
 * comment claims to know.
 */
export function cfsOnlyAtEcha(record: ApprovalRecord): boolean {
  return record.echaCfs === 'Yes' && record.cfs.inAct !== 'Yes'
}

/** The order the buckets read in: what the act concluded, then what it limits,
 *  then what it asks of every authorisation. */
const BUCKET_ORDER = [
  'CfS statement',
  'Scope limitation',
  'Assessed scope',
  'Risk mitigation',
  'Product-assessment focus',
  'Standing requirement',
]

export interface ConditionGroup {
  bucket: string
  items: ApprovalCondition[]
}

export function byBucket(conditions: ApprovalCondition[]): ConditionGroup[] {
  const groups = new Map<string, ApprovalCondition[]>()
  for (const c of conditions) {
    const key = c.bucket || 'Other'
    const list = groups.get(key)
    if (list) list.push(c)
    else groups.set(key, [c])
  }
  return Array.from(groups, ([bucket, items]) => ({ bucket, items }))
    .sort((a, b) => {
      const ai = BUCKET_ORDER.indexOf(a.bucket)
      const bi = BUCKET_ORDER.indexOf(b.bucket)
      return (ai < 0 ? BUCKET_ORDER.length : ai) - (bi < 0 ? BUCKET_ORDER.length : bi)
    })
}

/**
 * The conditions of the act in force, apart from those of the act it replaced.
 *
 * Only two substances have been renewed, and for those the workbook carries
 * both acts' conditions. Showing them in one list would put conditions that
 * no longer govern beside the ones that do, so they are split by the act they
 * come from and the earlier set sits under "Previous approval".
 */
export function splitConditions(record: ApprovalRecord): {
  current: ApprovalCondition[]
  previous: ApprovalCondition[]
} {
  const earlier = record.initial?.celex
  if (!earlier) return { current: record.conditions, previous: [] }
  return {
    current: record.conditions.filter(c => c.celex !== earlier),
    previous: record.conditions.filter(c => c.celex === earlier),
  }
}

/**
 * What the act is, in the few words a tile has room for.
 *
 * Dated by when the approval *began*, not when the act was adopted: the acts
 * set a future start date, and on 60 of the 61 they fall in different years —
 * typically 18 months to 2 years apart. The start is the year that matters to
 * a reader working out where a substance is in its cycle.
 *
 * A renewed approval leads with the renewal, dated by the renewing act: the
 * tile describes the act in force, whose conditions and findings fill the
 * panel. The original approval stays in the panel and on the timeline.
 */
export function actShort(record: ApprovalRecord): string {
  const { act, initial } = record
  if (!act) return ''

  if (initial) {
    const renewed = act.date.slice(0, 4)
    return renewed ? `Renewed ${renewed}` : 'Renewed'
  }

  const began = (record.approvalIso || act.date).slice(0, 4)

  const kind = act.type.startsWith('Annex I') ? 'Annex I inclusion' : 'Initial approval'
  return began ? `${kind}, ${began}` : kind
}

/**
 * How the approval stands against the methodologies in force today.
 *
 * A method marked "-" does not apply to the substance at all — the PT18
 * emission scenarios are PT18-only, and two others are recorded as not yet
 * collected for PT19 — so it is left out of both the fraction and the count of
 * what the assessment predates. Saying a PT19 substance "predates" guidance
 * written for PT18 would be counting a gap that does not exist.
 *
 * "partial" sits in neither total: it is applicable, and it is neither a clean
 * yes nor a clean no.
 */
export function methodTally(methods: ApprovalMethod[]): {
  covered: number
  predates: number
  applicable: number
} {
  const applies = methods.filter(m => m.state !== '-')
  return {
    covered: applies.filter(m => m.state === 'covered').length,
    predates: applies.filter(m => m.state === 'not covered').length,
    applicable: applies.length,
  }
}

/** "2018-06" -> "Jun 2018", for the segment's tooltip. */
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export function methodSince(since: string): string {
  const [y, m] = since.split('-')
  const name = MONTHS[Number(m) - 1]
  return name && y ? `${name} ${y}` : since
}

/** How each state reads in the tooltip, and the colour it carries. */
export const METHOD_STATE: Record<string, { label: string; tone: string }> = {
  covered: { label: 'Assessed under it', tone: 'ok' },
  'not covered': { label: 'Not covered', tone: 'gap' },
  partial: { label: 'Partly covered', tone: 'part' },
  '-': { label: 'Does not apply', tone: 'na' },
}
