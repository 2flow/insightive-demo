import raw from './productChanges.json'
import { formatDate } from './data'
import { productsFor } from './products'
import type { FeedRecord, ProductChangeDataset, Substance } from './types'

// Product authorisations cancelled between two product exports, as records —
// the only signal raised from product updates, and only for approved
// substances. One record per substance per
// update, however many were cancelled: a batch is one event on the timeline,
// and the record lists what went.
//
// Negative but weak by default: a cancellation is a holder giving up one route
// to market, not a finding on the substance. Strong when it leaves the
// substance with no live authorisation at all.

const dataset = raw as ProductChangeDataset

const ECHA_PRODUCTS = 'https://echa.europa.eu/information-on-chemicals/biocidal-products'
const LISTED = 5

export function cancellationRecords(s: Substance): FeedRecord[] {
  // Only while the approval stands: once it has expired (or was never granted)
  // products are expected to go, and their cancellation says nothing new.
  // The cancellations stay in lib/productChanges.json either way.
  if (s.approvalStatus !== 'Approved') return []
  const updates = dataset.bySubstance[s.id] ?? []
  const noneLive = (productsFor(s.id)?.marketAreasLive ?? 0) === 0

  return updates.map(u => {
    const n = u.products.length
    const named = u.products
      .slice(0, LISTED)
      .map(p => `${p.name}${p.market ? ` (${p.market})` : ''}`)
      .join('; ')
    const more = n > LISTED ? `; and ${n - LISTED} more` : ''
    const holders = new Set(u.products.map(p => p.holder).filter(Boolean)).size

    return {
      kind: 'cancellation',
      date: u.date,
      datePrecision: 'day',
      dateDerived: false,
      dateNote: 'First recorded date',
      dateNoteInfo:
        `The date of the first ECHA product export to show these cancelled — ` +
        `${formatDate(u.date)}. The export of ${formatDate(u.since)} did not, so they were ` +
        `cancelled between the two.`,
      title: n === 1 ? '1 product authorisation cancelled' : `${n} product authorisations cancelled`,
      summary:
        `Between ECHA's product exports of ${formatDate(u.since)} and ${formatDate(u.date)}, ` +
        `${n === 1 ? 'one authorisation' : `${n} authorisations`}` +
        `${holders > 1 ? ` across ${holders} holders` : ''} containing this substance ` +
        `${n === 1 ? 'was' : 'were'} cancelled: ${named}${more}.` +
        (noneLive ? ' No live authorisation remains.' : ''),
      tags: ['products', 'cancellation'],
      blockers: [],
      signal: {
        direction: 'NEGATIVE',
        strength: noneLive ? 2 : 1,
        label: noneLive ? 'Strong' : 'Weak',
        basis: 'documented',
        rationale: '',
      },
      sources: [
        {
          citation: `ECHA — biocidal products export of ${formatDate(u.date)}`,
          pinpoint: 'authorisation status',
          tier: 'PRIMARY',
          verified: true,
          url: ECHA_PRODUCTS,
          note: `compared with the export of ${formatDate(u.since)}`,
        },
      ],
    }
  })
}
