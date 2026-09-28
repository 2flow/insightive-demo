import { cleared, hasEdAssessment, hazardActivities, identified, isLive, pactFor, recordedActivities } from './pact'
import type { FeedRecord, PactActivity, PactRecord, Substance } from './types'

// Hazard listings and hazard assessments, as dated records.
//
// Kept plain: the listing or the status, the date, the link. No rationale, no
// analysis — the entry is the whole of it.
//
// The direction is not uniform, and cannot be. Being on a carcinogen list is
// adverse. An assessment still running is an open question that can land on a
// renewal while it is being evaluated. But an assessment that *concluded the
// substance does not meet the criteria* is the opposite of a hazard finding,
// and eleven of the twenty-three say exactly that — colouring those red would
// invert what they report.

/** The list itself: one PDF covering every chemical EPA has evaluated, which
 *  is where the classification and its year are read from. Checked — it
 *  answers and serves the PDF. */
const NPIC_CARCINOGEN = 'https://npic.orst.edu/chemicals_evaluated.pdf'

function activityRecord(a: PactActivity, s: Substance): FeedRecord {
  const open = isLive(a.status)
  const adverse = identified(a.status)
  // An authority asked whether the substance meets the criteria and concluded
  // that it does not. Weak, and positive: it closes a question that was open
  // against the substance, without being an argument for renewal by itself.
  const found_nothing = !open && !adverse && cleared(a.status)
  return {
    kind: 'hazard',
    date: a.updated || a.intention,
    datePrecision: 'day',
    dateDerived: false,
    title: `${a.areaLabel}: ${a.status}`,
    summary:
      `ECHA's Public Activities Coordination Tool records a ${a.areaLabel.toLowerCase()} ` +
      `for ${s.name}, with the status “${a.status}”.`,
    tags: ['hazard assessment', a.area],
    blockers: [],
    signal: {
      // Adverse where something was identified; a live question weighs less
      // than a finding; a conclusion that the criteria are not met is a point
      // in the substance's favour; anything inconclusive weighs neither way.
      direction: adverse || open ? 'NEGATIVE' : found_nothing ? 'POSITIVE' : 'NEUTRAL',
      strength: adverse ? 2 : 1,
      label: adverse ? 'Strong' : found_nothing ? 'Weak' : '',
      basis: 'documented',
      rationale: '',
    },
    sources: a.url
      ? [{ citation: `ECHA — ${a.areaLabel}`, pinpoint: '', tier: 'PRIMARY', verified: true, url: a.url, note: '' }]
      : [],
  }
}

/** The EPA listing, dated by the year it was classified. The endocrine-disruptor
 *  lists carry no date field — only a year inside free text about something
 *  else — so they stay on the panel rather than becoming records. */
function carcinogenRecord(record: PactRecord, s: Substance): FeedRecord[] {
  const { carcinogen, carcinogenYear } = record.flags
  if (!carcinogen || !/^\d{4}$/.test(carcinogenYear)) return []

  return [
    {
      kind: 'hazard',
      date: `${carcinogenYear}-01-01`,
      datePrecision: 'year',
      dateDerived: false,
      title: `US EPA carcinogen list: ${carcinogen}`,
      summary: `${s.name} carries the US EPA classification “${carcinogen}”, given in ${carcinogenYear}.`,
      tags: ['hazard list', 'carcinogen'],
      blockers: [],
      signal: {
        direction: 'NEGATIVE',
        strength: 2,
        label: 'Strong',
        basis: 'documented',
        rationale: '',
      },
      sources: [
        {
          citation: 'NPIC — Chemicals Evaluated for Carcinogenic Potential (US EPA)',
          // No pinpoint: one document listing every chemical evaluated, so
          // naming this one adds nothing the card has not already said.
          pinpoint: '',
          tier: 'PRIMARY',
          verified: true,
          url: NPIC_CARCINOGEN,
          note: '',
        },
      ],
    },
  ]
}

export function hazardRecords(s: Substance): FeedRecord[] {
  const record = pactFor(s.id)
  if (!record) return []
  return [
    ...carcinogenRecord(record, s),
    ...recordedActivities(record.activities)
      .filter(a => a.updated || a.intention)
      .map(a => activityRecord(a, s)),
  ]
}

/**
 * Whether the list row should carry a "Potential hazard list" cue.
 *
 * A listing, or a question still open. An assessment that closed having found
 * nothing is not a potential hazard — it is the record of one ruled out.
 */
export function hasHazardCue(s: Substance): boolean {
  const record = pactFor(s.id)
  if (!record) return false
  // The ED list entry is not shown where ECHA's own ED assessment is on the
  // row, so it cannot raise the cue there either — the assessment below does.
  if (record.flags.carcinogen) return true
  if (record.flags.edList && !hasEdAssessment(record)) return true
  return hazardActivities(record.activities).some(a => isLive(a.status) || identified(a.status))
}
