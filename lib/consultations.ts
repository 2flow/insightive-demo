import raw from './consultations.json'
import type { Consultation, ConsultationDataset } from './types'

// ECHA's public consultations on candidates for substitution and on derogation
// conditions, matched to substances at build time. Most rows in the export are
// other product types — different molecules — so only 16 substances carry one.

const dataset = raw as ConsultationDataset

export const consultationMeta = dataset.meta

/** Newest first. Empty for the substances never consulted on. */
export function consultationsFor(substanceId: string): Consultation[] {
  return dataset.bySubstance[substanceId] ?? []
}

/** The one still taking comments, if there is one. */
export function openConsultation(list: Consultation[]): Consultation | null {
  return list.find(c => c.state === 'open') ?? null
}

/** "CfS" is ECHA's shorthand; spell it out where there is room. */
export function scopeLabel(scope: string): string {
  return scope
    .replace(/\bCfS\b/g, 'Candidate for substitution')
    .replace(/\bDerogation\b/g, 'derogation')
}
