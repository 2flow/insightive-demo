import { formatDate } from './data'
import { pppApproved, pppFor } from './ppp'
import type { FeedRecord, Substance } from './types'

// A plant-protection approval that ended, as a dated record.
//
// Only where one actually ran out: of the 29 substances the EU Pesticides
// Database records as not approved, 9 held an approval that then expired. The
// other 20 were never included — "no dossier submitted", "never applied for" —
// and nothing ended, so there is no date for a record to sit on. Their status
// is on the Plant-protection tile, where it belongs.
//
// Weighted **weak** negative on purpose. It happened under Regulation (EC) No
// 1107/2009, a separate regime with different uses, different exposure and a
// different dossier — a precedent worth reading, not a finding about the
// biocidal approval. The same reasoning makes the list chip slate rather than
// red. The reasons vary enormously, from a withdrawal over bee risk to a
// registration quietly not renewed, and the panel carries that detail where it
// is labelled as analysis.

const EU_PESTICIDES =
  'https://ec.europa.eu/food/plant/pesticides/eu-pesticides-database/start/screen/active-substances'

export function pppRecords(s: Substance): FeedRecord[] {
  const record = pppFor(s.id)
  if (!record || pppApproved(record) || !record.expiryDate) return []

  const ran = record.approvalDate
    ? ` It had run from ${formatDate(record.approvalDate)}.`
    : ''

  return [
    {
      kind: 'ppp',
      date: record.expiryDate,
      datePrecision: 'day',
      dateDerived: false,
      title: 'Plant-protection approval ended',
      summary:
        `The approval of ${record.name} under Regulation (EC) No 1107/2009 ended on ` +
        `${formatDate(record.expiryDate)}, and the EU Pesticides Database now records the ` +
        `status as “${record.status}”.${ran} A separate regime from the BPR.`,
      tags: ['plant protection', 'approval'],
      blockers: [],
      signal: {
        direction: 'NEGATIVE',
        strength: 1,
        label: 'Weak',
        basis: 'documented',
        rationale: '',
      },
      sources: [
        {
          citation: 'EU Pesticides Database — active substances',
          pinpoint: record.euId ? `${record.name}, ID ${record.euId}` : record.name,
          tier: 'PRIMARY',
          verified: true,
          url: EU_PESTICIDES,
          note: '',
        },
      ],
    },
  ]
}
