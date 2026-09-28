import raw from './bpcOpinions.json'
import type { BpcOpinion, BpcOpinionDataset } from './types'

// BPC opinions matched to substances at build time, by name then EC/CAS then a
// token overlap — always within the same product type, since the committee
// opines on a substance × PT pair and the file covers every type.

const dataset = raw as BpcOpinionDataset

export const bpcOpinionMeta = dataset.meta

/** Newest first. */
export function opinionsFor(substanceId: string): BpcOpinion[] {
  return dataset.bySubstance[substanceId] ?? []
}

/** Every recorded dissent across a substance's opinions. */
export function minorityCount(opinions: BpcOpinion[]): number {
  return opinions.reduce((n, o) => n + o.minority.length, 0)
}
