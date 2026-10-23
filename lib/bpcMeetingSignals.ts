import type { FeedRecord, Substance } from './types'

// The BPC meeting notes — what the Biocidal Products Committee adopted,
// published as each meeting closes and weeks before either the opinion
// document or ECHA's substance export reflect it. Hand-maintained: one entry
// per adopted opinion, matched by substance id. The matching sub-status
// overrides live in tools/convert_export.py, against the same source.
//
// An adopted opinion is the most favourable thing on a substance's file short
// of the decision itself — the committee that advises the Commission has
// settled its view and the dossier moves on. Weighted at the top of the
// positive scale, like the published-opinion signal in bpcSignals.ts; the
// opinion document itself follows separately and is linked once on file.

export const BPC_MEETINGS_URL =
  'https://echa.europa.eu/about-us/who-we-are/biocidal-products-committee/meetings-of-the-biocidal-products-committee/2026'

export interface BpcMeetingAdoption {
  substanceId: string
  meeting: string // e.g. 'BPC-59'
  date: string // the meeting date, ISO
  kind: 'approval' | 'renewal' // which opinion the committee adopted
}

const ADOPTIONS: BpcMeetingAdoption[] = [
  // BPC-59: approval opinion on peanut butter (PT19) adopted.
  { substanceId: '2503-PT19', meeting: 'BPC-59', date: '2026-05-28', kind: 'approval' },
  // BPC-60: renewal opinion on Hexaflumuron (PT18) adopted.
  { substanceId: '1314-PT18', meeting: 'BPC-60', date: '2026-09-10', kind: 'renewal' },
]

const byId = new Map(ADOPTIONS.map(a => [a.substanceId, a]))

/** The meeting adoption on a substance's file, when the notes record one. */
export function bpcMeetingFor(s: Substance): BpcMeetingAdoption | null {
  return byId.get(s.id) ?? null
}

export function bpcMeetingRecords(s: Substance): FeedRecord[] {
  const adoption = byId.get(s.id)
  if (!adoption) return []
  const what = adoption.kind === 'renewal' ? 'renewal opinion' : 'approval opinion'
  return [
    {
      kind: 'bpc',
      ai: 'bpc-meeting',
      date: adoption.date,
      datePrecision: 'day',
      dateDerived: false,
      title: `BPC ${what} adopted (${adoption.meeting})`,
      summary:
        `The Biocidal Products Committee adopted its ${what} on this substance at its ` +
        `${adoption.meeting} meeting. The meeting notes record the adoption; the opinion ` +
        `document itself is published separately and is not yet on this file.`,
      tags: ['BPC opinion'],
      blockers: [],
      signal: {
        direction: 'POSITIVE',
        strength: 3,
        label: 'Strong',
        basis: 'documented',
        rationale:
          'The committee that advises the Commission has adopted its opinion: the most ' +
          'favourable milestone on the file short of the decision itself. The published ' +
          'opinion document follows separately and is not yet on this file.',
      },
      sources: [
        {
          citation: `BPC meeting notes — ${adoption.meeting}, Biocidal Products Committee meetings 2026`,
          pinpoint: '',
          tier: 'PRIMARY',
          verified: true,
          url: BPC_MEETINGS_URL,
          note: '',
        },
      ],
    },
  ]
}
