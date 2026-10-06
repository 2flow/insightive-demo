import {
  cleared,
  edspAdverse,
  hasEdAssessment,
  hazardActivities,
  identified,
  isLive,
  pactFor,
  pactMeta,
  recordedActivities,
} from './pact'
import type { FeedRecord, PactActivity, PactRecord, PanListing, Substance } from './types'

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

  // The EPA's tentative tiers — "Possible Human Carcinogen" (Group C) and its
  // successor wording "Suggestive Evidence of Carcinogenic Potential" — state
  // an open possibility, not a finding, and read as weak. A "Probable",
  // "Likely" or "Known/Human" classification would read as strong.
  const tentative = /possible human carcinogen|suggestive evidence/i.test(carcinogen)

  return [
    {
      kind: 'hazard',
      // A US classification: context, not an EU finding.
      category: 'non-eu',
      date: `${carcinogenYear}-01-01`,
      datePrecision: 'year',
      dateDerived: false,
      title: `US EPA carcinogen list: ${carcinogen}`,
      summary: `${s.name} carries the US EPA classification “${carcinogen}”, given in ${carcinogenYear}.`,
      tags: ['hazard list', 'carcinogen'],
      blockers: [],
      signal: {
        direction: 'NEGATIVE',
        strength: tentative ? 1 : 2,
        label: tentative ? 'Weak' : 'Strong',
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

const PAN_HHP = 'https://pan-international.org/wp-content/uploads/PAN_HHP_List.pdf'

/**
 * The date the pesticide went onto PAN International's list of Highly
 * Hazardous Pesticides.
 *
 * An NGO's list, so it sits with the other outside views — but a published
 * list with stated criteria, not a report's reading, so it is documented
 * rather than researched. Weak: being on it changes nothing in the BPR file.
 *
 * Most entries are not on PAN's list of additions since January 2009 and are
 * taken to have been on the original list. That date is an inference, and the
 * card says so.
 */
function panRecord(l: PanListing, s: Substance): FeedRecord[] {
  if (!l.added.date) return []
  const criteria = l.criteria.map(c => c.label)
  const edition = pactMeta.pan?.edition
  return [
    {
      kind: 'hazard',
      category: 'ngo',
      date: l.added.date,
      datePrecision: l.added.precision,
      dateDerived: l.added.inferred || l.added.range,
      ...(l.added.inferred
        ? {
            dateNote: 'Assumed: original list',
            dateNoteInfo:
              'Not on PAN’s list of pesticides added since January 2009, so taken to have ' +
              'been on the original January 2009 list.',
          }
        : l.added.range
          ? {
              dateNote: `Added ${l.added.text}`,
              dateNoteInfo:
                'PAN gives only the span of years. The record is dated at its end, the latest ' +
                'the pesticide can have been added.',
            }
          : {}),
      title: `Added to the PAN Highly Hazardous Pesticides list`,
      summary:
        `PAN International lists ${l.panName} as a Highly Hazardous Pesticide` +
        (criteria.length ? `, on ${criteria.length === 1 ? 'the criterion' : 'the criteria'}: ${criteria.join('; ')}.` : '.') +
        (l.note ? ` ${l.note[0].toUpperCase()}${l.note.slice(1)}` : ''),
      tags: ['hazard list', 'PAN HHP'],
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
          citation: `PAN International — List of Highly Hazardous Pesticides${edition ? `, ${edition}` : ''}`,
          pinpoint: '',
          tier: 'PRIMARY',
          verified: true,
          url: PAN_HHP,
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
    ...(record.pan ?? []).flatMap(l => panRecord(l, s)),
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
  if (edspAdverse(record.flags.edspTag)) return true
  if (record.pan?.length) return true
  return hazardActivities(record.activities).some(a => isLive(a.status) || identified(a.status))
}
