import { formatDate, shortName } from './data'
import { cleared, exclusionRelevant, identified, isLive, pactMeta, shortClass } from './pact'
import type { FeedRecord, PactActivity, PactFlagChange, PactPastActivity, PactRecord, Substance } from './types'

// ECHA PACT activities as dated records — which of them are signals, and how
// strong. Decided 07.11.26; README "PACT signals" has the table.
//
//   A  SEv, PBT, ED          every status. Strong where something was
//                            identified, weak otherwise (an open question
//                            against, a "not ED" for, the rest neutral).
//   B  ARN                   opened, or concluded proposing action — weak.
//                            "No EU RRM action needed" is not a signal.
//   C  SVHC, Recom, Restr.   every status. Intention, submission, listing,
//                            recommendation, opinion, adoption are strong;
//                            the steps between are weak; withdrawal is weak
//                            and positive.
//   D  CLH                   only a proposal that adds a class able to trigger
//                            a BPR exclusion criterion (CMR 1A/1B, ED cat. 1,
//                            PBT/vPvB, or such a hazard named without its
//                            category yet): when it was filed, and when RAC
//                            adopted its opinion. Weak. Everything else about
//                            CLH stays on the panel.
//   E  DEv                   every status, weak and neutral.
//   F  EPA carcinogen and ED-list values that moved between exports: added or
//                            moved to List I strong, removed weak.
//
// Every status an activity has had stays on the timeline — the converter keeps
// the earlier ones in `past` — and a status ECHA gives no date for is dated to
// the first export that shows it, and says so.

const HAZARD = new Set(['SEv', 'PBT', 'ED'])
const MEASURE = new Set(['SVHC', 'Recom', 'Restriction'])
/** REACH procedure rather than hazard identification: other EU law. */
const REACH = new Set(['DEv', 'Recom', 'Restriction'])

const ED_LISTS = 'https://edlists.org/the-ed-lists'
const NPIC_CARCINOGEN = 'https://npic.orst.edu/chemicals_evaluated.pdf'

type Dating = Pick<FeedRecord, 'date' | 'datePrecision' | 'dateDerived' | 'dateNote' | 'dateNoteInfo'>

function firstRecorded(date: string, since: string): Dating {
  return {
    date,
    datePrecision: 'day',
    dateDerived: false,
    dateNote: 'First recorded date',
    dateNoteInfo: since
      ? `ECHA gives no date for this. ${formatDate(date)} is the first PACT export to show it; the ` +
        `export of ${formatDate(since)} did not, so it happened between the two.`
      : `ECHA gives no date for this. ${formatDate(date)} is the date of the first PACT export on ` +
        `file, which already showed it.`,
  }
}

function dated(date: string, a: PactActivity): Dating {
  if (date) return { date, datePrecision: 'day', dateDerived: false }
  return firstRecorded(a.firstSeen || exportDate(), a.since || '')
}

function exportDate(): string {
  const exports = pactMeta.exports ?? []
  return exports.length ? exports[exports.length - 1].date : ''
}

function weight(direction: FeedRecord['signal']['direction'], strong: boolean): FeedRecord['signal'] {
  return { direction, strength: strong ? 2 : 1, label: strong ? 'Strong' : 'Weak', basis: 'documented', rationale: '' }
}

function source(a: PactActivity): FeedRecord['sources'] {
  return a.url
    ? [{ citation: `ECHA — ${a.areaLabel}`, pinpoint: '', tier: 'PRIMARY', verified: true, url: a.url, note: '' }]
    : []
}

/** C: how far a REACH measure has got. */
function measureWeight(status: string): FeedRecord['signal'] {
  const s = status.trim().toLowerCase()
  if (s.startsWith('withdrawn')) return weight('POSITIVE', false)
  const decisive = [
    'intention',
    'submitted',
    'candidate list',
    'included',
    'inclusion',
    'recommended',
    'recommendation',
    'opinion adopted',
    'adopted',
    'concluded',
  ]
  return weight('NEGATIVE', decisive.some(d => s.startsWith(d)))
}

/** The reading of one status, or null where it is not a signal. */
function statusSignal(a: PactActivity): FeedRecord['signal'] | null {
  const open = isLive(a.status)
  if (HAZARD.has(a.area)) {
    if (identified(a.status)) return weight('NEGATIVE', true)
    if (open) return weight('NEGATIVE', false)
    return weight(cleared(a.status) ? 'POSITIVE' : 'NEUTRAL', false)
  }
  if (a.area === 'ARN') return open || identified(a.status) ? weight('NEGATIVE', false) : null
  if (MEASURE.has(a.area)) return measureWeight(a.status)
  if (a.area === 'DEv') return weight('NEUTRAL', false)
  return null
}

function statusRecord(a: PactActivity | PactPastActivity, s: Substance): FeedRecord | null {
  const signal = statusSignal(a)
  if (!signal) return null
  const past = 'until' in a
  const gone = past && (a as PactPastActivity).dropped
  const reach = REACH.has(a.area)
  return {
    kind: reach ? 'reach' : 'hazard',
    category: reach ? 'other-eu' : 'hazard',
    ...dated(a.updated || a.intention, a),
    title: `${a.areaLabel}: ${a.status}`,
    summary:
      `ECHA's Public Activities Coordination Tool records a ${a.areaLabel.toLowerCase()} for ` +
      `${shortName(s)}, with the status “${a.status}”.` +
      (past
        ? gone
          ? ` The PACT export of ${formatDate((a as PactPastActivity).until)} no longer lists it.`
          : ` By the PACT export of ${formatDate((a as PactPastActivity).until)} it had moved on.`
        : ''),
    tags: [reach ? 'REACH' : 'hazard assessment', a.area],
    blockers: [],
    signal,
    sources: source(a),
  }
}

// ── D: classification proposals reaching the BPR exclusion criteria ──


function classPhrase(a: PactActivity): string {
  const { exclusion, exclusionPending } = a.clh!
  return [...exclusion.map(shortClass), ...exclusionPending.map(c => `${shortClass(c).toLowerCase()} (category not yet given)`)].join(', ')
}

function clhRecords(a: PactActivity, record: PactRecord, s: Substance): FeedRecord[] {
  if (!exclusionRelevant(a)) return []
  const p = a.clh!
  const classes = classPhrase(a)
  const by = p.submitter ? `${p.submitter} ` : ''
  const why =
    'These are classes that can trigger a BPR exclusion criterion (Article 5(1)): carcinogenic, ' +
    'mutagenic or toxic for reproduction in category 1A/1B, endocrine disruptor, PBT or vPvB.' +
    (p.exclusionPending.length
      ? ' The proposal names the hazard without its category yet; it would only exclude at 1A/1B.'
      : '')
  // When the proposal first appeared, for a filing ECHA gives no date for.
  const earliest = [a, ...(record.past ?? []).filter(x => x.key === a.key)]
    .map(x => x.firstSeen || '')
    .filter(Boolean)
    .sort()[0]
  const firstSince = (record.past ?? []).find(x => x.key === a.key && x.firstSeen === earliest)?.since ?? a.since ?? ''
  const out: FeedRecord[] = [
    {
      kind: 'hazard',
      category: 'hazard',
      ...(a.intention
        ? { date: a.intention, datePrecision: 'day', dateDerived: false }
        : firstRecorded(earliest || a.firstSeen || exportDate(), earliest ? firstSince : a.since || '')),
      title: `Classification proposal: ${classes}`,
      summary:
        `${by}${a.intention ? 'registered' : 'has filed'} a harmonised classification proposal` +
        `${p.process ? ` (${p.process})` : ''} for ${shortName(s)} that adds ${classes}. ` +
        `${why} It now stands at “${a.status}”.`,
      tags: ['hazard classification', 'CLH'],
      blockers: [],
      signal: weight('NEGATIVE', false),
      sources: source(a),
    },
  ]
  const adopted = p.opinionDate || (a.status.toLowerCase().startsWith('opinion adopted') ? a.updated : '')
  if (adopted || a.status.toLowerCase().startsWith('opinion adopted')) {
    out.push({
      kind: 'hazard',
      category: 'hazard',
      ...dated(adopted, a),
      title: `RAC opinion adopted: ${classes}`,
      summary:
        `ECHA's Committee for Risk Assessment adopted its opinion on the harmonised classification ` +
        `proposal${p.process ? ` (${p.process})` : ''} for ${shortName(s)}, which adds ${classes}. ${why}`,
      tags: ['hazard classification', 'CLH'],
      blockers: [],
      signal: weight('NEGATIVE', false),
      sources: source(a),
    })
  }
  return out
}

// ── F: hazard-list values that moved ──

function flagRecord(c: PactFlagChange, s: Substance): FeedRecord {
  const epa = c.field === 'carcinogen'
  const list = epa ? 'US EPA carcinogen list' : 'Endocrine disruptor lists'
  let title: string
  let signal: FeedRecord['signal']
  if (!c.after) {
    title = `Removed from the ${list}`
    signal = weight('POSITIVE', false)
  } else if (!c.before) {
    title = `${list}: ${c.after}`
    signal = weight('NEGATIVE', true)
  } else {
    title = `${list}: ${c.before} → ${c.after}`
    // An ED list move counts as strong only into List I (identified ED).
    const strong = epa || /\bList I\b(?!I)/.test(c.after)
    signal = weight(strong ? 'NEGATIVE' : 'NEUTRAL', strong)
  }
  return {
    kind: 'hazard',
    category: epa ? 'non-eu' : 'hazard',
    ...firstRecorded(c.date, c.since),
    title,
    summary: c.after
      ? `${shortName(s)} now reads “${c.after}” on the ${list}` +
        (c.before ? `, where the PACT export of ${formatDate(c.since)} read “${c.before}”.` : '.')
      : `${shortName(s)} no longer appears on the ${list}, where the PACT export of ` +
        `${formatDate(c.since)} read “${c.before}”.`,
    tags: ['hazard list', epa ? 'carcinogen' : 'endocrine'],
    blockers: [],
    signal,
    sources: [
      {
        citation: epa ? 'NPIC — Chemicals Evaluated for Carcinogenic Potential (US EPA)' : 'The ED Lists',
        pinpoint: '',
        tier: 'PRIMARY',
        verified: true,
        url: epa ? NPIC_CARCINOGEN : ED_LISTS,
        note: `compared with the PACT export of ${formatDate(c.since)}`,
      },
    ],
  }
}

export function pactRecords(record: PactRecord, s: Substance): FeedRecord[] {
  const statuses: (PactActivity | PactPastActivity)[] = [...record.activities, ...(record.past ?? [])]
  return [
    ...statuses.map(a => statusRecord(a, s)).filter((r): r is FeedRecord => r !== null),
    ...record.activities.flatMap(a => clhRecords(a, record, s)),
    ...(record.flagChanges ?? []).map(c => flagRecord(c, s)),
  ]
}
