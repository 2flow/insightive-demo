import raw from './postponements.json'
import type { Postponement, PostponementDataset, PostponementRecord } from './types'

// Commission decisions moving an approval's expiry date, matched to substances
// at build time. Every row's stated current expiry agrees with the substance
// export's end date, which is what confirms the matching.

const dataset = raw as PostponementDataset

export const postponementMeta = dataset.meta

export function postponementsFor(substanceId: string): PostponementRecord | null {
  return dataset.bySubstance[substanceId] ?? null
}

/** How many times the expiry has moved. */
export function postponementCount(substanceId: string): number {
  return postponementsFor(substanceId)?.postponements.length ?? 0
}

/**
 * The reason, as tags.
 *
 * Every state gets one, including the two that say nothing: a decision giving
 * no cause, and a decision whose text was never retrieved, are different facts
 * and the reader should be able to tell them apart. The reading is the client's,
 * not the Commission's; the card's "AI" tag says so for the whole record,
 * which AI read out of the decision. "reason not retrieved" is a gap in the
 * sources rather than a view taken of them.
 */
export function reasonTags(p: Postponement): string[] {
  const raw = p.reason.trim()
  if (!raw || raw.toLowerCase() === 'not retrieved') return ['reason not retrieved']
  return raw
    .split(';')
    .map(part => part.trim().toLowerCase())
    .filter(Boolean)
    .map(part => `reason — ${part}`)
}
