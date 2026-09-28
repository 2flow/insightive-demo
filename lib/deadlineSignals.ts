import { RENEWAL_RISK_WINDOW_DAYS, formatDate, isRenewalAtRisk, meta } from './data'
import { interestFor } from './interest'
import type { FeedRecord, Substance } from './types'

// The Article 13(1) filing deadline, read as a dated record.
//
// An approval running down with no renewal application against it is an event
// with a date — the day the statutory window closed — so it belongs on the
// timeline alongside everything else, not only as a chip in the list. Derived
// at runtime for the same reason the Article 95 records are: nothing to
// maintain, and it can never drift from the dates it is computed from.

const BPR_URL = 'https://eur-lex.europa.eu/eli/reg/2012/528/oj'
const DAY = 86_400_000

/** The approval end date less the 550-day window, as an ISO date. */
function deadlineDate(endIso: string): string {
  const [y, m, d] = endIso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) - RENEWAL_RISK_WINDOW_DAYS * DAY).toISOString().slice(0, 10)
}

/**
 * One record, or none. Fires on exactly the condition behind the list's
 * "Filing deadline passed" chip — `isRenewalAtRisk()` — so the chip and the
 * record can never disagree, and the chip is always traceable to an entry.
 */
export function deadlineRecords(s: Substance): FeedRecord[] {
  if (!isRenewalAtRisk(s)) return []

  const date = deadlineDate(s.endDate)
  const stated = interestFor(s.id)?.deadline
  // ECHA publishes its own AS-RNL deadline, anchored to the expiry at the time
  // the list was drawn up. Where it agrees, say so; where it does not, show
  // both rather than picking one.
  const echa = stated
    ? stated === date
      ? ` ECHA's own published deadline for this substance is the same day.`
      : ` ECHA's own published deadline is ${formatDate(stated)}, anchored to an earlier expiry date.`
    : ''

  return [
    {
      kind: 'deadline',
      date,
      datePrecision: 'day',
      dateDerived: true,
      title: 'Filing deadline for renewal passed with nothing on record',
      summary:
        `The approval ends ${formatDate(s.endDate)}. Article 13(1) requires a renewal ` +
        `application at least ${RENEWAL_RISK_WINDOW_DAYS} days before that — ${formatDate(date)} — ` +
        `and neither ECHA's assessment status field nor its expressions-of-interest list ` +
        `records one.${echa}`,
      tags: ['Article 13(1)'],
      blockers: [],
      signal: {
        direction: 'NEGATIVE',
        strength: 2,
        label: 'Strong',
        basis: 'absence',
        rationale:
          'Read from an absence rather than a statement: ECHA records no application on ' +
          'either source, and a published dataset can lag. What is documented is that the ' +
          'statutory window for filing has closed, which is why this is weighted below an ' +
          'act on the file.',
      },
      sources: [
        {
          citation: 'Regulation (EU) No 528/2012 (BPR), Article 13(1)',
          pinpoint: 'first subparagraph',
          tier: 'PRIMARY',
          verified: true,
          url: BPR_URL,
          note: `Sets the ${RENEWAL_RISK_WINDOW_DAYS}-day filing deadline.`,
        },
        {
          citation: `ECHA — biocidal active substances export of ${formatDate(meta.exportDate)}`,
          pinpoint: 'approval end date and assessment status',
          tier: 'PRIMARY',
          verified: true,
          url: s.factsheetUrl,
          note: '',
        },
      ],
    },
  ]
}
