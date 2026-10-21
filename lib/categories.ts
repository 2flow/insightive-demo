import type { FeedRecord } from './types'

// ─────────────────────────────────────────────────────────────
// Signal categories — what a record is *about*, in three bands of decreasing
// weight on the BPR renewal:
//
//   1. BPR renewal  — official BPR facts that decide the renewal
//   2. EU evidence  — official EU findings that can change it
//   3. Context      — outside views, read against the EU status
//
// Every record resolves to exactly one category. The derived modules map by
// their kind; a record can name its own (`category`, which a curated feed file
// may also set); curated research without one is placed from its tags.
// ─────────────────────────────────────────────────────────────

export type SignalCategory =
  | 'approval'
  | 'renewal'
  | 'industry'
  | 'hazard'
  | 'other-eu'
  | 'non-eu'
  | 'ngo'

export type SignalBand = 1 | 2 | 3

export interface CategoryDef {
  key: SignalCategory
  band: SignalBand
  label: string
  /** What it covers, for the tooltip and the filter. */
  covers: string
}

export const BANDS: { band: SignalBand; label: string; note: string }[] = [
  { band: 1, label: 'BPR renewal', note: 'Official BPR facts that decide the renewal' },
  { band: 2, label: 'EU evidence', note: 'Official EU findings that can change it' },
  { band: 3, label: 'Context', note: 'Outside views, shown against the EU status' },
]

export const CATEGORIES: CategoryDef[] = [
  {
    key: 'approval',
    band: 1,
    label: 'Approval status',
    covers: 'Approved, renewed, expiry, postponement, candidate for substitution, exclusion criteria met',
  },
  {
    key: 'renewal',
    band: 1,
    label: 'Renewal progress',
    covers: 'Interest in renewal, application submitted, renewal started, filing deadline passed, BPC opinion',
  },
  {
    key: 'industry',
    band: 1,
    label: 'Industry',
    covers: 'Article 95 suppliers joining or leaving, product authorisations granted or cancelled',
  },
  {
    key: 'hazard',
    band: 2,
    label: 'EU hazard findings',
    covers: 'CLH opinions, ED assessments and lists, PBT — graded by the BPR criterion hit',
  },
  {
    key: 'other-eu',
    band: 2,
    label: 'Other EU laws',
    covers: 'Plant-protection approval, REACH restrictions, other EU frameworks covering the same substance',
  },
  {
    key: 'non-eu',
    band: 3,
    label: 'Non-EU authorities',
    covers: "US EPA, IARC, other countries' bans or classifications",
  },
  {
    key: 'ngo',
    band: 3,
    label: 'NGO reports',
    covers: 'NGO campaigns and analyses, ranked by tier',
  },
]

const BY_KEY = new Map(CATEGORIES.map(c => [c.key, c]))

const BY_KIND: Record<string, SignalCategory> = {
  approval: 'approval',
  expiry: 'approval',
  postponement: 'approval',
  renewal: 'approval',
  interest: 'renewal',
  filing: 'renewal',
  'renewal-start': 'renewal',
  deadline: 'renewal',
  bpc: 'renewal',
  supplier: 'industry',
  cancellation: 'industry',
  hazard: 'hazard',
  ppp: 'other-eu',
  ngo: 'ngo',
}

/** Curated research carries free tags rather than a kind; place it from those. */
function researchCategory(r: FeedRecord): SignalCategory {
  const tags = new Set(r.tags.map(t => t.toLowerCase()))
  const title = r.title.toLowerCase()
  if (tags.has('ppp') || tags.has('reach')) return 'other-eu'
  if (['gb', 'uk', 'us', 'epa', 'iarc', 'international'].some(t => tags.has(t))) return 'non-eu'
  if (tags.has('market') || /\bauthoris|supplier|article 95/.test(title)) return 'industry'
  if (tags.has('renewal')) return 'renewal'
  if (['endocrine', 'hazard', 'clh', 'pbt'].some(t => tags.has(t))) return 'hazard'
  return 'approval'
}

export function categoryOf(r: FeedRecord): CategoryDef {
  const key =
    (r.category && BY_KEY.has(r.category) ? r.category : undefined) ??
    BY_KIND[r.kind ?? ''] ??
    researchCategory(r)
  return BY_KEY.get(key)!
}

// ── Main sources ────────────────────────────────────────────
// Who publishes the records in a category, for the filter chips — read from
// the sources' links, so a new data drop updates it without a list to keep.

/** Publisher by link host. A host not listed reads as itself, minus "www." */
const PUBLISHER: [RegExp, string][] = [
  [/(^|\.)eur-lex\.europa\.eu$|^data\.europa\.eu$/, 'EUR-Lex'],
  [/(^|\.)echa\.europa\.eu$/, 'ECHA'],
  [/(^|\.)efsa\./, 'EFSA'],
  [/^ec\.europa\.eu$|^food\.ec\.europa\.eu$/, 'European Commission'],
  [/(^|\.)npic\.orst\.edu$/, 'NPIC'],
  [/(^|\.)hse\.gov\.uk$/, 'HSE'],
  [/(^|\.)epa\.gov$/, 'US EPA'],
  [/(^|\.)iarc\./, 'IARC'],
  [/(^|\.)pan-europe\.info$/, 'PAN Europe'],
  [/(^|\.)pan-international\.org$/, 'PAN International'],
  [/(^|\.)pan-germany\.org$/, 'PAN Germany'],
  [/(^|\.)pan-netherlands\.org$/, 'PAN Netherlands'],
  [/(^|\.)generations-futures\.fr$/, 'Générations Futures'],
  [/(^|\.)beyondpesticides\.org$/, 'Beyond Pesticides'],
  [/(^|\.)duh\.de$/, 'DUH'],
  [/(^|\.)greenpeace\./, 'Greenpeace'],
]

function publisherOf(url: string): string {
  let host = ''
  try {
    host = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
  return PUBLISHER.find(([re]) => re.test(host))?.[1] ?? host
}

/** Who a record comes from, in a word — its first source's publisher. NGO
 *  items say so, since the NGO's name alone may not read as one. */
export function recordSource(r: FeedRecord): string {
  const pub = r.sources.map(s => publisherOf(s.url)).find(Boolean) ?? ''
  // An unlisted host ("eu.boell.org") reads worse than the report's own name
  // for the NGO.
  if (r.kind === 'ngo') {
    const known = pub && !pub.includes('.')
    return `NGO · ${(known ? pub : r.ngo?.org || pub) || 'report'}`
  }
  return pub
}

/** The main publishers behind each category's records: counted once per
 *  record however many links it carries, kept if they back at least a tenth
 *  of the category, at most `max` of them, most frequent first. */
export function topSources(records: FeedRecord[], max = 3): Map<SignalCategory, string[]> {
  const counts = new Map<SignalCategory, { n: number; by: Map<string, number> }>()
  for (const r of records) {
    const key = categoryOf(r).key
    const c = counts.get(key) ?? { n: 0, by: new Map<string, number>() }
    c.n++
    const pubs = new Set(r.sources.map(s => publisherOf(s.url)).filter(Boolean))
    pubs.forEach(p => c.by.set(p, (c.by.get(p) ?? 0) + 1))
    counts.set(key, c)
  }
  const out = new Map<SignalCategory, string[]>()
  counts.forEach(({ n, by }, key) => {
    out.set(
      key,
      Array.from(by.entries())
        .filter(([, k]) => k >= n / 10)
        .sort((a, b) => b[1] - a[1])
        .slice(0, max)
        .map(([p]) => p),
    )
  })
  return out
}

// ── Evidence ────────────────────────────────────────────────
// How the record is known, on every card:
//   Documented — a source states it
//   Derived    — worked out by a rule from documented facts (a date counted
//                back, an absence, an inference)
//   Researched — gathered and summarised by research, not an official record

export type Evidence = 'documented' | 'derived' | 'researched'

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  documented: 'Documented',
  derived: 'Derived',
  researched: 'Researched',
}

export const EVIDENCE_NOTE: Record<Evidence, string> = {
  documented: 'Stated by the cited source',
  derived: 'Worked out by a rule from documented facts — not stated outright by a source',
  researched: 'Gathered and summarised by research, not taken from an official record',
}

export function evidenceOf(r: FeedRecord): Evidence {
  if (r.kind === 'research' || r.kind === 'ngo') return 'researched'
  if (r.dateDerived || r.signal.basis === 'inference' || r.signal.basis === 'absence') return 'derived'
  return 'documented'
}
