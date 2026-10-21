import { asOf, formatDate, meta, shortName } from './data'
import type { FeedRecord, Substance } from './types'

// An approval that has run out, as a dated record.
//
// Only the ones that actually expired. A future expiry is a date in the diary
// rather than something that happened, and the dashboard tile and the list's
// countdown already carry it — putting a decade of scheduled dates into "the
// record" would make the timeline part forecast.

/** The substance record's own page, where the approval dates are published. */
const ECHA_DATABASE = 'https://echa.europa.eu/information-on-chemicals/biocidal-active-substances'

export function expiryRecords(s: Substance): FeedRecord[] {
  if (!s.endDate || s.endDate >= asOf) return []

  const sources: FeedRecord['sources'] = [
    {
      citation: `ECHA — biocidal active substances export of ${formatDate(meta.exportDate)}`,
      pinpoint: `${shortName(s)} — approval end date`,
      tier: 'PRIMARY',
      verified: true,
      url: s.factsheetUrl || ECHA_DATABASE,
      note: '',
    },
  ]
  // The act that set the date, where ECHA names one.
  if (s.legalAct && s.legalActUrl) {
    sources.push({
      citation: s.legalAct,
      pinpoint: 'the act setting the approval period',
      tier: 'PRIMARY',
      verified: true,
      url: s.legalActUrl,
      note: '',
    })
  }

  return [
    {
      kind: 'expiry',
      date: s.endDate,
      datePrecision: 'day',
      dateDerived: false,
      title: 'Approval expired',
      summary:
        `The approval for ${s.pt} ran out on ${formatDate(s.endDate)}, and ECHA's ` +
        `substance record carries the approval status as "${s.approvalStatus}".`,
      tags: ['approval'],
      blockers: [],
      signal: {
        direction: 'NEGATIVE',
        strength: 2,
        label: 'Strong',
        basis: 'documented',
        rationale:
          'The approval period ended on the date ECHA publishes, and the status field ' +
          'agrees. What followed — a renewal, a lapse, or products running down under ' +
          'Article 52 — is not stated here.',
      },
      sources,
    },
  ]
}
