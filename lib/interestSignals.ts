import { formatDate } from './data'
import { companyNames, interestFor, interestMeta } from './interest'
import type { FeedRecord, Substance } from './types'

// A company saying it intends to apply for renewal, as a dated record.
//
// Positive, but weighted below the application itself: an expression of
// interest is an intention, and a filing is a dossier paid for. Five substances
// carry one.
//
// The date is the one the list gives for itself — "Prepared as of 30/June/2026"
// in its title block. It is not when the company said so, and the record says
// as much: what it supports is that the interest was on the record by then. The
// list carries no per-entry date to do better with.

export function interestRecords(s: Substance): FeedRecord[] {
  const interest = interestFor(s.id)
  if (!interest || interest.state !== 'interested' || interest.companies.length === 0) return []
  if (!interestMeta.preparedAs) return []

  const many = interest.companies.length > 1
  const asOfList = formatDate(interestMeta.preparedAs)

  return [
    {
      kind: 'interest',
      date: interestMeta.preparedAs,
      // Shown to the month: the day is the list's own, not the event's, so
      // printing it to the day would claim a precision the record lacks.
      // The ISO date keeps the full value, so ordering is unaffected.
      datePrecision: 'month',
      // The list states this date for itself, so it is not worked out from
      // context — it simply is not the day the interest was expressed. The
      // note beside it says which.
      dateDerived: false,
      dateNote: 'First recorded date',
      dateNoteInfo:
        `The date is the one ECHA's expressions-of-interest list gives for itself — prepared ` +
        `as of ${asOfList}. The list gives no date for the entry, so this is when the interest ` +
        `was first on the record rather than when the company expressed it.`,
      title: many ? 'Companies interested in renewal' : 'Company interested in renewal',
      summary:
        `${companyNames(interest)} ${many ? 'are' : 'is'} recorded as interested in renewing ` +
        `the ${s.pt} approval. First recorded with the expressions-of-interest list prepared ` +
        `as of ${asOfList}; the list gives no date for the entry itself, so the interest was ` +
        `on the record by then rather than on that day.`,
      tags: ['renewal', 'interest'],
      blockers: [],
      signal: {
        // An intention, not a commitment — the filing record is the commitment,
        // and is weighted above this.
        direction: 'POSITIVE',
        strength: 1,
        label: 'Weak',
        basis: 'documented',
        rationale: '',
      },
      sources: [
        {
          citation: `ECHA — expressions of interest in renewal (AS-RNL), prepared as of ${asOfList}`,
          // No pinpoint: the list is one document covering every substance, so
          // naming this one adds nothing the card has not already said.
          pinpoint: '',
          tier: 'PRIMARY',
          verified: true,
          url: 'https://echa.europa.eu/documents/d/guest/as-rnl_expressions_of_interest_public_en',
          note: '',
        },
      ],
    },
  ]
}
