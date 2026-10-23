import { approvalRecords } from './approvalSignals'
import { bpcMeetingRecords } from './bpcMeetingSignals'
import { bpcRecords } from './bpcSignals'
import { changeRecords } from './changeSignals'
import { cancellationRecords } from './productSignals'
import { deadlineRecords } from './deadlineSignals'
import { expiryRecords } from './expirySignals'
import { filingRecords } from './filingSignals'
import { interestRecords } from './interestSignals'
import { isNgo, ngoRecords, ngoSharedRecords, ngoSubstanceRecords } from './ngoSignals'
import { hazardRecords } from './hazardSignals'
import { postponementRecords } from './postponementSignals'
import { pppRecords } from './pppSignals'
import { supplierRecords } from './supplierSignals'
import type { FeedRecord, SubstanceFeed, Substance } from './types'

// ─────────────────────────────────────────────────────────────
// Renewal-signal feeds — read straight from data/feeds/*.json.
//
// There is NO build step for feeds and no generated copy. Edit the JSON in
// data/feeds/ and the change is live on the next page load. Drop a new file in
// and it is picked up automatically; the filename doesn't matter, the EC/CAS
// numbers inside it do.
//
// (The .xlsx datasets still need tools/convert_export.py, because a browser
// can't read Excel. These are already JSON, so they don't.)
// ─────────────────────────────────────────────────────────────

/** The raw shape as written in data/feeds/*.json — snake_case, as the research
 *  output produces it. Mapped to the app's camelCase types below. */
interface RawFeedFile {
  substance?: { name?: string; ec_list_no?: string; cas_no?: string }
  renewal?: {
    started?: string | null
    track?: string | null
    postponements?: number | null
  }
  records?: {
    /** Optional — one of the keys in lib/categories.ts. Without it the record
     *  is placed from its tags. */
    category?: string
    date?: string
    date_precision?: string
    date_derived?: boolean
    date_note?: string
    title?: string
    summary?: string
    tags?: string[]
    blockers?: string[]
    signal?: {
      direction?: string
      strength?: number
      label?: string
      basis?: string
      rationale?: string
    }
    sources?: {
      citation?: string
      pinpoint?: string | null
      tier?: string
      verified?: boolean
      url?: string | null
      note?: string | null
    }[]
  }[]
}

// webpack resolves this at build time, so every file in data/feeds/ is bundled
// without needing an index or an import line per feed.
const context = (require as unknown as {
  context: (dir: string, deep: boolean, filter: RegExp) => {
    keys: () => string[]
    (id: string): RawFeedFile
  }
}).context('../data/feeds', false, /\.json$/)

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

function toFeed(raw: RawFeedFile, sourceFile: string): SubstanceFeed {
  const records: FeedRecord[] = (raw.records ?? []).map(r => ({
    // Everything in a feed file is hand-researched; the derived modules stamp
    // their own kind.
    kind: 'research',
    category: (text(r.category) || undefined) as FeedRecord['category'],
    date: text(r.date),
    datePrecision: text(r.date_precision) || 'day',
    dateDerived: Boolean(r.date_derived),
    dateNote: text(r.date_note),
    title: text(r.title),
    summary: text(r.summary),
    tags: (r.tags ?? []).map(text).filter(Boolean),
    blockers: (r.blockers ?? []).map(text).filter(Boolean),
    signal: {
      direction: (text(r.signal?.direction).toUpperCase() || 'NEUTRAL') as FeedRecord['signal']['direction'],
      strength: Number(r.signal?.strength ?? 0),
      label: text(r.signal?.label),
      basis: text(r.signal?.basis),
      rationale: text(r.signal?.rationale),
    },
    sources: (r.sources ?? []).map(s => ({
      citation: text(s.citation),
      pinpoint: text(s.pinpoint),
      tier: text(s.tier).toUpperCase(),
      verified: Boolean(s.verified),
      url: text(s.url),
      note: text(s.note),
    })),
  }))

  // Newest first, so the order records sit in the file doesn't matter.
  records.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  const r = raw.renewal
  return {
    name: text(raw.substance?.name),
    ec: text(raw.substance?.ec_list_no),
    cas: text(raw.substance?.cas_no),
    sourceFile,
    renewal: r
      ? {
          started: text(r.started),
          track: text(r.track),
          postponements: Number(r.postponements ?? 0),
        }
      : null,
    records,
  }
}

export const feeds: SubstanceFeed[] = context
  .keys()
  .map(key => toFeed(context(key), key.replace(/^\.\//, '')))
  .sort((a, b) => a.name.localeCompare(b.name))

export const feedMeta = {
  count: feeds.length,
  recordCount: feeds.reduce((n, f) => n + f.records.length, 0),
}

/** Identifiers are written inconsistently across sources — compare them loosely. */
const key = (v: string) => v.replace(/[\s-]/g, '').toLowerCase()

const byEc = new Map(feeds.filter(f => f.ec).map(f => [key(f.ec), f]))
const byCas = new Map(feeds.filter(f => f.cas).map(f => [key(f.cas), f]))

/** EC number first, CAS as the fallback — some ECHA rows carry no EC number. */
export function feedFor(s: Substance): SubstanceFeed | null {
  return (s.ec && byEc.get(key(s.ec))) || (s.cas && byCas.get(key(s.cas))) || null
}

/**
 * Every record for one substance, newest first: the curated feed's, plus the
 * ones derived from the Article 95 list, the Article 13(1) deadline, the
 * approval's own expiry, each Article 14(5) postponement, a renewal granted or
 * started between two ECHA exports, product authorisations cancelled, the BPC opinion and
 * the hazard listings and assessments, and a plant-protection approval that
 * ended.
 *
 * The feed is matched by EC/CAS and so is shared by a substance's PT18 and PT19
 * rows; the Article 95 listings are per substance × product type. Taking the
 * substance rather than the feed is what keeps those two straight.
 */
export function recordsFor(s: Substance): FeedRecord[] {
  const curated = feedFor(s)?.records ?? []
  const derived = [
    ...supplierRecords(s.id),
    ...deadlineRecords(s),
    ...expiryRecords(s),
    ...postponementRecords(s),
    ...bpcRecords(s),
    ...bpcMeetingRecords(s),
    ...hazardRecords(s),
    ...pppRecords(s),
    ...filingRecords(s),
    ...interestRecords(s),
    ...approvalRecords(s),
    ...changeRecords(s),
    ...cancellationRecords(s),
    ...ngoRecords(s),
  ]
  if (derived.length === 0) return curated
  return [...curated, ...derived].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

export type RecordOrder = 'asc' | 'desc'

/**
 * How every signal list opens: the most recent record first.
 *
 * Set here and nowhere else. Both the substance's own page and the
 * all-substances timeline read it, so the two can never drift apart, and the
 * bar strip in the list runs the same way — leftmost bar is the newest record,
 * which is the first card on the page it opens.
 */
/**
 * What each signal is, for the timeline's filter.
 *
 * Ordered the way a renewal runs — the approval, then what has happened to it,
 * then what is being said about the substance elsewhere — rather than
 * alphabetically, so the filter row reads as a sequence.
 */
export const RECORD_KINDS: { kind: string; label: string }[] = [
  { kind: 'approval', label: 'Approved' },
  { kind: 'interest', label: 'Interest in renewal' },
  { kind: 'filing', label: 'Renewal application submitted' },
  { kind: 'renewal-start', label: 'Renewal started' },
  { kind: 'deadline', label: 'Filing deadline passed' },
  { kind: 'postponement', label: 'Expiry postponed' },
  { kind: 'bpc', label: 'BPC opinion' },
  { kind: 'renewal', label: 'Approval renewed' },
  { kind: 'expiry', label: 'Approval expired' },
  { kind: 'supplier', label: 'Article 95 supplier' },
  { kind: 'cancellation', label: 'Products cancelled' },
  { kind: 'hazard', label: 'Hazard list or assessment' },
  { kind: 'ppp', label: 'Plant-protection approval ended' },
  { kind: 'research', label: 'Researched record' },
  { kind: 'ngo', label: 'NGO report' },
]

const KIND_LABEL = new Map(RECORD_KINDS.map(k => [k.kind, k.label]))

export function kindLabel(kind: string): string {
  return KIND_LABEL.get(kind) ?? 'Other'
}

export const DEFAULT_ORDER: RecordOrder = 'desc'

/**
 * Order records for reading, in either direction.
 *
 * Some records carry no date at all — the BPC opinion, and a few curated
 * standing observations. They are not events, so they have no place *in* the
 * run of dates; they lead it. Holding them out of the sort also stops a
 * reversal from shuffling them about, so they sit in the same place whichever
 * way the list runs.
 */
export function orderRecords<T>(
  items: T[],
  dateOf: (item: T) => string,
  order: RecordOrder,
): T[] {
  const dated = items.filter(i => dateOf(i))
  const undated = items.filter(i => !dateOf(i))
  const sign = order === 'asc' ? 1 : -1
  dated.sort((a, b) => (dateOf(a) < dateOf(b) ? -sign : dateOf(a) > dateOf(b) ? sign : 0))
  return [...undated, ...dated]
}

/** A record together with the substance row it belongs to. Absent for NGO
 *  class and horizontal items, which belong to a group rather than one row. */
export interface DatedRecord {
  record: FeedRecord
  substance?: Substance
}

/**
 * Every record across every substance, oldest first.
 *
 * A curated feed is matched by EC/CAS, so one feed can serve a substance's PT18
 * and PT19 rows. Here that would show the same research twice, so a feed's own
 * records are attributed once — to the first row that resolves it — while the
 * Article 95 records, which really are per product type, are not deduplicated.
 */
export function allRecords(substances: Substance[]): DatedRecord[] {
  const seenFeeds = new Set<SubstanceFeed>()
  const out: DatedRecord[] = []

  for (const substance of substances) {
    const feed = feedFor(substance)
    if (feed && !seenFeeds.has(feed)) {
      seenFeeds.add(feed)
      for (const record of feed.records) out.push({ record, substance })
    }
    for (const record of supplierRecords(substance.id)) out.push({ record, substance })
    for (const record of deadlineRecords(substance)) out.push({ record, substance })
    for (const record of expiryRecords(substance)) out.push({ record, substance })
    for (const record of postponementRecords(substance)) out.push({ record, substance })
    for (const record of bpcRecords(substance)) out.push({ record, substance })
    for (const record of bpcMeetingRecords(substance)) out.push({ record, substance })
    for (const record of hazardRecords(substance)) out.push({ record, substance })
    for (const record of pppRecords(substance)) out.push({ record, substance })
    for (const record of filingRecords(substance)) out.push({ record, substance })
    for (const record of interestRecords(substance)) out.push({ record, substance })
    for (const record of approvalRecords(substance)) out.push({ record, substance })
    for (const record of changeRecords(substance)) out.push({ record, substance })
    for (const record of cancellationRecords(substance)) out.push({ record, substance })
    for (const record of ngoSubstanceRecords(substance)) out.push({ record, substance })
  }
  // Class and horizontal NGO items once each, not once per member.
  for (const record of ngoSharedRecords) out.push({ record })

  return out.sort((a, b) =>
    a.record.date < b.record.date ? -1 : a.record.date > b.record.date ? 1 : 0,
  )
}

/** A record's identity across views — the same item on the home page and on
 *  the page it opens, so the page can scroll to it. */
export function recordKey(r: FeedRecord): string {
  return `${r.kind ?? ''}|${r.date}|${r.title}`
}

/** How far back "recent" reaches on the home page. */
export const RECENT_DAYS = 30

/**
 * What has actually happened, newest first, as of `today` (ISO).
 *
 * Undated records are standing observations, not news, so they are left out.
 * So are dates still ahead — a filing deadline worked out from an expiry can
 * fall in the future, and it would otherwise sit at the top of "the newest".
 */
export function latestRecords(records: DatedRecord[], today: string): DatedRecord[] {
  return records
    .filter(r => r.record.date && r.record.date <= today)
    .sort((a, b) => (a.record.date < b.record.date ? 1 : a.record.date > b.record.date ? -1 : 0))
}

/** Whether a record is dated within the last RECENT_DAYS, up to `today`. */
export function isRecent(date: string, today: string): boolean {
  return !!date && date <= today && date > daysBefore(today, RECENT_DAYS)
}

/** The ISO date `days` before `today`. */
export function daysBefore(today: string, days: number): string {
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/**
 * The single most weighty record in a feed.
 *
 * Deliberately *not* a sum of strengths: adding weak signals together would
 * manufacture a confidence the underlying records never claim. Ties go to the
 * newest record, since `records` is sorted newest-first.
 */
export function strongestSignal(feed: SubstanceFeed): FeedRecord | null {
  if (feed.records.length === 0) return null
  return feed.records.reduce((best, r) =>
    Math.abs(r.signal.strength) > Math.abs(best.signal.strength) ? r : best,
  )
}

export type SignalTone = 'negative' | 'positive' | 'neutral'

export function directionTone(direction: string): SignalTone {
  if (direction === 'NEGATIVE') return 'negative'
  if (direction === 'POSITIVE') return 'positive'
  return 'neutral'
}

/**
 * A plain count per direction — a tally, not a score.
 *
 * Classifies through directionTone() rather than matching the three canonical
 * strings, so a record tagged with something off-vocabulary ("MIXED", say) is
 * counted the same way it is coloured. Otherwise the tally quietly loses it.
 */
export function tallyRecords(records: FeedRecord[]): Record<SignalTone, number> {
  const out: Record<SignalTone, number> = { negative: 0, positive: 0, neutral: 0 }
  // NGO items carry no reading of their own — they are context, not signal.
  for (const r of records) if (!isNgo(r)) out[directionTone(r.signal.direction)]++
  return out
}


/** "Decisive negative" — the reading's own label plus the direction, so the
 *  reading never rests on colour alone. A record carrying no weight labels
 *  itself "None", which would read as "None neutral"; there the direction
 *  stands alone. */
export function signalLabel(record: FeedRecord): string {
  const { label, direction } = record.signal
  const dir = direction.toLowerCase()
  if (!label || label.toLowerCase() === 'none') return dir
  return `${label} ${dir}`
}
