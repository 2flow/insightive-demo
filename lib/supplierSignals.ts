import { formatDate } from './data'
import { supplierMeta, suppliersFor, supplierType } from './suppliers'
import type { FeedRecord, Supplier } from './types'

// Article 95 listings, read as dated signal records.
//
// Every supplier on the list entered it on a stated day, and that entry is a
// fact about who is willing to keep the substance on the EU market. Those are
// derived here rather than written into data/feeds/*.json, so the curated feeds
// stay hand-authored and a new edition of the list can never clobber them.

const LIST_URL = 'https://echa.europa.eu/information-on-chemicals/active-substance-suppliers'

/** The one reason that is *not* a company choosing to join: it was already a
 *  review-programme participant and was carried across when the Article 95 list
 *  was established. Everything else took a dossier or a letter of access. */
const CARRIED_OVER = 'RP Participant'

function isSubmission(reason: string): boolean {
  const r = reason.trim()
  return r !== '' && r !== CARRIED_OVER
}

function names(group: Supplier[]): string {
  return group.map(s => (s.country ? `${s.entity} (${s.country})` : s.entity)).join('; ')
}

function summarise(group: Supplier[]): string {
  const roles = Array.from(new Set(group.map(s => supplierType(s.type).toLowerCase())))
  const who = `${names(group)} — ${roles.join(' / ')} supplier${group.length === 1 ? '' : 's'}.`
  const one = group.length === 1
  return isSubmission(group[0].reason)
    ? `${who} Listed on the basis of "${group[0].reason}": ${one ? 'the company put in its own' : 'each company put in its own'} dossier or letter of access to be entitled to supply the substance in the EU.`
    : `${who} Listed as ${one ? 'a review-programme participant' : 'review-programme participants'} — already supporting the substance when the Article 95 list was drawn up, so the entry records that transfer onto the list.`
}

/** Deliberately weak in both directions. A listing says something about who is
 *  commercially behind the substance; it says nothing about how the evaluation
 *  will go, and the app does not pretend otherwise. */
function rationale(group: Supplier[]): string {
  return isSubmission(group[0].reason)
    ? 'Getting onto the list costs a dossier or a letter of access and a fee, so the entry evidences a company willing to pay for access to this substance. It bears on who might support a renewal, not on how the evaluation will go.'
    : 'The entry carries an existing review-programme participant onto the Article 95 list. It records continuity rather than a new backer, so it points neither way for the renewal.'
}

function toRecord(group: Supplier[]): FeedRecord {
  const submission = isSubmission(group[0].reason)
  return {
    kind: 'supplier',
    date: group[0].listedSupplier,
    datePrecision: 'day',
    dateDerived: false,
    title:
      group.length === 1
        ? `${group[0].entity} entered the Article 95 supplier list`
        : `${group.length} suppliers entered the Article 95 list`,
    summary: summarise(group),
    tags: ['Article 95 list'],
    blockers: [],
    signal: {
      direction: submission ? 'POSITIVE' : 'NEUTRAL',
      strength: 1,
      // A neutral record has no weight to qualify, so it reads "neutral" on its
      // own — the same as the curated ones.
      label: submission ? 'Weak' : '',
      basis: 'documented',
      rationale: rationale(group),
    },
    sources: [
      {
        citation: supplierMeta.listDate
          ? `ECHA — Article 95 list of approved active substance suppliers, edition of ${formatDate(supplierMeta.listDate)}`
          : 'ECHA — Article 95 list of approved active substance suppliers',
        pinpoint: group.length === 1 ? group[0].entity : '',
        tier: 'PRIMARY',
        verified: true,
        url: LIST_URL,
        note: '',
      },
    ],
  }
}

// The list is static, so each substance is folded once and kept.
const cache = new Map<string, FeedRecord[]>()

/** One record per listing *event* — suppliers that entered on the same day for
 *  the same reason are one entry, since that is one event. Newest first. */
export function supplierRecords(substanceId: string): FeedRecord[] {
  const hit = cache.get(substanceId)
  if (hit) return hit

  const groups = new Map<string, Supplier[]>()
  for (const s of suppliersFor(substanceId)) {
    if (!s.listedSupplier) continue
    const key = `${s.listedSupplier}|${s.reason}`
    const group = groups.get(key)
    if (group) group.push(s)
    else groups.set(key, [s])
  }

  const records = Array.from(groups.values())
    .map(toRecord)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  cache.set(substanceId, records)
  return records
}
