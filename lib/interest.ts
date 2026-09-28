import raw from './interest.json'
import { supplierShortName } from './suppliers'
import type { InterestDataset, InterestState, RenewalInterest } from './types'

// ECHA's list of companies that have expressed interest in renewing an active
// substance, matched to substances at build time by tools/convert_export.py.
// It also carries ECHA's own AS-RNL filing deadline, which is authoritative —
// better than deriving 550 days from the expiry date ourselves.

const dataset = raw as InterestDataset

export const interestMeta = dataset.meta

export function interestFor(substanceId: string): RenewalInterest | null {
  return dataset.bySubstance[substanceId] ?? null
}

/** How each state reads on screen. */
export const INTEREST_LABEL: Record<Exclude<InterestState, ''>, string> = {
  submitted: 'Renewal application submitted',
  interested: 'Interest in renewal',
  'no-interest': 'No interest in renewal so far',
  'none-received': 'No application received by deadline',
}

/** The same state in the few words a dashboard tile has room for. ECHA's own
 *  deadline sits in the note directly beneath, so "by deadline" need not be
 *  repeated here. */
export const INTEREST_SHORT: Record<Exclude<InterestState, ''>, string> = {
  submitted: 'Submitted',
  interested: 'Interest expressed',
  'no-interest': 'No interest so far',
  'none-received': 'No application received',
}

/** Whether the state already answers "is an application on file?" — in which
 *  case saying "No renewal recorded" beside it only repeats it. Three of the
 *  four do. `interested` does not: a company stating it intends to apply is
 *  not an application, so there the two lines say different things. */
export function statesFiling(state: InterestState): boolean {
  return state === 'submitted' || state === 'none-received' || state === 'no-interest'
}

/** Green where the renewal is moving, red where it is not. */
export function interestTone(state: InterestState): 'ok' | 'warn' | '' {
  if (state === 'submitted' || state === 'interested') return 'ok'
  if (state === 'no-interest' || state === 'none-received') return 'warn'
  return ''
}

/** The companies in as few words as a chip can hold: "Biofa", "Arysta
 *  Lifescience · Tagros Chemicals". The full names stay in the tooltip. */
export function companyShortNames(interest: RenewalInterest): string {
  return interest.companies
    .map(c => supplierShortName(c.name.replace(/\s*\([^()]*\)/g, ' ')))
    .join(' · ')
}

export function companyNames(interest: RenewalInterest): string {
  return interest.companies.map(c => (c.country ? `${c.name} (${c.country})` : c.name)).join(' · ')
}
