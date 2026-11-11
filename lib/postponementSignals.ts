import { formatDate } from './data'
import { postponementsFor, reasonTags } from './postponements'
import type { FeedRecord, Postponement, Substance } from './types'

// Each Article 14(5) postponement, as a dated record.
//
// A postponement is read as neutral. It keeps the approval alive — the
// substance does not lapse while the evaluation runs on — and at the same time
// records that the evaluation is late and the question still open. Neither
// half outweighs the other, and deciding that it does would be the app forming
// a view the documents do not state. What the reader can weigh is on the card:
// how many times it has happened, how long was granted, and the recital's own
// words about why. So these records carry no reading of their own: no "why this
// reading", and no inference block. The reason chip is the one client judgement
// on the card, and it says so. The inference text stays in
// lib/postponements.json if it is ever wanted somewhere quieter.

function title(p: Postponement): string {
  const to = p.expiryTo ? formatDate(p.expiryTo) : 'a later date'
  const ordinal = p.sequence.replace(/ and only$/, '')
  return p.sequence.startsWith('1st')
    ? `Approval expiry postponed to ${to}`
    : `${ordinal} postponement — expiry moved to ${to}`
}

function summary(p: Postponement, s: Substance): string {
  const act = p.decision ? `Commission Implementing Decision ${p.decision}` : 'A Commission decision'
  const from = p.expiryFrom ? ` from ${formatDate(p.expiryFrom)}` : ''
  const to = p.expiryTo ? ` to ${formatDate(p.expiryTo)}` : ''
  const by = p.extension ? `, an extension of ${p.extension}` : ''
  const who = p.authority ? ` The evaluating authority is ${p.authority}.` : ''
  const quote = p.recitalQuote
    ? ` ${p.recitalRef || 'The decision'} states: “${p.recitalQuote}”`
    : ''
  // Where the act itself was never read, say so here rather than leaving the
  // dates looking as well-attested as the rest.
  const gap = p.retrieved
    ? ''
    : ' The decision text was not retrieved; these dates come from a later decision’s recital.'
  return `${act} moved the expiry of the ${s.pt} approval${from}${to}${by}.${who}${quote}${gap}`
}

export function postponementRecords(s: Substance): FeedRecord[] {
  const held = postponementsFor(s.id)
  if (!held) return []

  return held.postponements
    .filter(p => p.adopted)
    .map(p => ({
      kind: 'postponement',
      ai: 'postponements',
      date: p.adopted,
      datePrecision: p.adoptedPrecision,
      // Year-only entries were read off a later decision rather than their own.
      dateDerived: !p.retrieved,
      title: title(p),
      summary: summary(p, s),
      tags: ['postponement', ...reasonTags(p)],
      blockers: [],
      signal: {
        direction: 'NEUTRAL',
        strength: 1,
        label: '',
        basis: p.retrieved ? 'documented' : 'inference',
        // No "why this reading" here: the card carries the decision, the dates
        // and the recital's own words, which is the whole of it.
        rationale: '',
      },
      sources: p.decisionUrl
        ? [
            {
              citation: `Commission Implementing Decision (EU) ${p.decision}`,
              pinpoint: p.recitalRef,
              tier: 'PRIMARY',
              verified: true,
              url: p.decisionUrl,
              note: '',
            },
          ]
        : [],
    }))
}
