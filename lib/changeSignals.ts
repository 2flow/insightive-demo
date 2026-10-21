import { actName, approvalFor } from './approvals'
import { changesFor } from './changes'
import { formatDate, shortName } from './data'
import { filingRecords } from './filingSignals'
import type { ExportChange, FeedRecord, Substance } from './types'

// What moved between two ECHA exports, as dated records. Derived at runtime
// from lib/changes.json, so a new export in data/updates/ raises them with no
// further step.
//
// Two kinds become signals here: a renewal granted and a renewal started —
// the latter only where no "Renewal application submitted" record
// (filingSignals.ts) already covers the same renewal.
// An expiry needs nothing extra — expirySignals.ts raises it from the end date
// as soon as an export shows the date has passed. The rest (sub-status moves,
// end dates moved by postponement) stays in the change log as status.
//
// ECHA gives no date for a change, so each record is dated to the first export
// that shows it and says so: it happened between that export and the one
// before.

const ECHA_DATABASE = 'https://echa.europa.eu/information-on-chemicals/biocidal-active-substances'

function firstSeen(c: ExportChange): Pick<FeedRecord, 'date' | 'datePrecision' | 'dateDerived' | 'dateNote' | 'dateNoteInfo'> {
  return {
    date: c.date,
    datePrecision: 'day',
    dateDerived: false,
    dateNote: 'First recorded date',
    dateNoteInfo:
      `The date of the first ECHA export to show this — ${formatDate(c.date)}. The export of ` +
      `${formatDate(c.since)} did not, so it happened between the two.`,
  }
}

function exportSource(s: Substance, c: ExportChange, pinpoint: string): FeedRecord['sources'][number] {
  return {
    citation: `ECHA — biocidal active substances export of ${formatDate(c.date)}`,
    pinpoint: `${shortName(s)} — ${pinpoint}`,
    tier: 'PRIMARY',
    verified: true,
    url: s.factsheetUrl || ECHA_DATABASE,
    note: `compared with the export of ${formatDate(c.since)}`,
  }
}

function renewalRecord(s: Substance, c: ExportChange): FeedRecord | null {
  // The act itself is already on file as the approval record; one record of
  // the renewal is enough.
  const celex = approvalFor(s.id)?.act?.celex
  if (approvalFor(s.id)?.renewed && celex && c.legalActUrl.includes(celex)) return null

  const act = actName(c.legalAct)
  const [oldEnd, newEnd] = c.fields.endDate ?? ['', s.endDate]
  return {
    kind: 'renewal',
    ...firstSeen(c),
    title: 'Approval renewed',
    summary:
      `The ${s.pt} approval was renewed${act ? ` by ${act}` : ''}. ECHA's substance record now ` +
      `runs it to ${formatDate(newEnd)}` +
      (oldEnd ? `, where the previous export had it ending ${formatDate(oldEnd)}.` : '.'),
    tags: ['renewal', 'approval'],
    blockers: [],
    signal: {
      direction: 'POSITIVE',
      strength: 3,
      label: 'Strong',
      basis: 'documented',
      rationale: '',
    },
    sources: [
      ...(act && c.legalActUrl
        ? [{ citation: act, pinpoint: 'the act renewing the approval', tier: 'PRIMARY', verified: true, url: c.legalActUrl, note: '' }]
        : []),
      exportSource(s, c, 'approval end date and legal act'),
    ],
  }
}

function renewalStartRecord(s: Substance, c: ExportChange): FeedRecord {
  const [before] = c.fields.assessmentStatus ?? ['']
  const sub = c.fields.assessmentSubStatus?.[1] || ''
  return {
    kind: 'renewal-start',
    ...firstSeen(c),
    title: 'Renewal started',
    summary:
      `ECHA's substance record now shows the ${s.pt} approval as "Renewal in progress"` +
      (sub ? ` (${sub})` : '') +
      `, where the previous export showed ${before ? `"${before}"` : 'no assessment under way'}.`,
    tags: ['renewal'],
    blockers: [],
    signal: {
      // The same weight as the application itself: the evaluation it starts
      // is the next step on the same commitment.
      direction: 'POSITIVE',
      strength: 2,
      label: 'Strong',
      basis: 'documented',
      rationale: '',
    },
    sources: [exportSource(s, c, 'assessment status')],
  }
}

export function changeRecords(s: Substance): FeedRecord[] {
  const out: FeedRecord[] = []
  for (const c of changesFor(s.id)) {
    if (c.kinds.includes('renewal')) {
      const record = renewalRecord(s, c)
      if (record) out.push(record)
    }
    // One signal per renewal: where the application is already on the record
    // (the expressions-of-interest list, or a postponement Decision's recitals),
    // the status change only confirms it and stays as status.
    if (c.kinds.includes('renewal-start') && filingRecords(s).length === 0) {
      out.push(renewalStartRecord(s, c))
    }
  }
  return out
}
