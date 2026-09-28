import { opinionsFor } from './bpcOpinions'
import { formatDate, hasBpcRenewalOpinion } from './data'
import type { BpcOpinion, FeedRecord, FeedSource, Substance } from './types'

// The Biocidal Products Committee's published opinion, as a record.
//
// The most favourable thing on a substance's file short of the renewal itself:
// the committee that advises the Commission has said the approval may be
// renewed. So it is weighted at the top of the positive scale and left at that
// — no reading, no rationale. The opinion is the whole of it, and the PDF is
// one click away.
//
// The date comes from ECHA's own opinions file, which states when each opinion
// was adopted. The substance export publishes the opinion and a link to it but
// never the date, so the two are matched on the document itself where they
// agree on it, and on the product type otherwise.

/**
 * The opinion this record is about.
 *
 * Preferring the document the substance export links means the date provably
 * belongs to the document on the record. Three of the four match that way. The
 * fourth is a row where ECHA's export carries the PT18 opinion's link on the
 * PT19 row; there the product-type match is the right one, and both opinions
 * were adopted on the same day in any case.
 */
function opinionFor(s: Substance): BpcOpinion | null {
  const opinions = opinionsFor(s.id)
  if (opinions.length === 0) return null
  const linked = opinions.find(o => o.opinion?.url && o.opinion.url === s.bpcOpinionUrl)
  // opinionsFor is newest first and scoped to this product type.
  return linked ?? opinions[0]
}

function sourcesFor(s: Substance, opinion: BpcOpinion | null): FeedSource[] {
  const matched = opinion?.opinion
  const out: FeedSource[] = []

  if (matched) {
    out.push({
      citation: `BPC opinion — ${s.pt}${opinion?.date ? `, adopted ${formatDate(opinion.date)}` : ''}`,
      pinpoint: matched.label,
      tier: 'PRIMARY',
      verified: true,
      url: matched.url,
      note: '',
    })
  }

  // ECHA's export links its own document. Kept where it is a different one, so
  // the record never quietly drops a link the source published.
  if (s.bpcOpinionUrl && s.bpcOpinionUrl !== matched?.url) {
    out.push({
      citation: `BPC opinion — ${s.name}`,
      pinpoint: '',
      tier: 'PRIMARY',
      verified: true,
      url: s.bpcOpinionUrl,
      note: matched ? 'the document linked from the substance export' : '',
    })
  }

  return out
}

export function bpcRecords(s: Substance): FeedRecord[] {
  if (!hasBpcRenewalOpinion(s)) return []

  // Every opinion on file today reads "May be renewed", but quote it rather
  // than restate it — and on a substance awaiting a *first* approval there is
  // no renewal to recommend, so the title says only what the record says.
  const renewable = s.approvalStatus !== 'Pending'
  const opinion = opinionFor(s)

  return [
    {
      kind: 'bpc',
      date: opinion?.date ?? '',
      datePrecision: 'day',
      dateDerived: false,
      title: renewable ? 'Renewal recommended by BPC' : `BPC opinion: ${s.bpcOpinion}`,
      summary:
        `The Biocidal Products Committee's published opinion is “${s.bpcOpinion}”.` +
        (opinion?.stage ? ` Adopted at the ${opinion.stage.toLowerCase()} stage.` : ''),
      tags: ['BPC opinion'],
      blockers: [],
      signal: {
        direction: 'POSITIVE',
        strength: 3,
        label: 'Strong',
        basis: 'documented',
        rationale: '',
      },
      sources: sourcesFor(s, opinion),
    },
  ]
}
