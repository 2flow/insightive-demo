import { approvalFor } from './approvals'
import { opinionsFor } from './bpcOpinions'
import { formatDate, shortName } from './data'
import type { ApprovalRecord, FeedRecord, Substance } from './types'

// The approval itself, as a dated record — the event the rest of the timeline
// hangs off.
//
// It is the *first* approval that is recorded, not the latest act. For 59 of
// the 61 substances with an act those are the same document. For the two that
// have since been renewed they are not, and the first one is still the right
// one to date: both acts state the same date of approval, and so does ECHA's
// own export, because a renewal extends the approval rather than starting a
// new one. All 61 dates agree across the two sources, with no exceptions.
//
// Every finding in the record is read off the act being described. That
// matters for the renewed pair: epsilon-metofluthrin's 2010 inclusion states
// no candidate-for-substitution finding and its 2025 renewal does, so quoting
// the later act on the earlier record would put a 2025 finding in 2011.
//
// NEUTRAL where the act only approved the substance: an approval granted is
// the baseline fact, not an argument either way about the renewal.
//
// Weak NEGATIVE on the eight where the act also found the substance a
// candidate for substitution. That finding carries consequences the approval
// itself does not — a shortened approval period under Article 10(4), and
// comparative assessment of every product under Article 23, both quoted
// verbatim in the recitals this record links to. Weak, because it constrains
// the terms of a renewal rather than deciding whether one is granted.

/**
 * Minority positions filed against the opinion behind *this* approval.
 *
 * Scoped to the first-approval stage, because that is what this record is.
 * Dinotefuran is why: Sweden dissented on its 2024 renewal opinion, and
 * hanging that off the 2015 approval record would attribute a 2024
 * disagreement to a decision taken nine years earlier.
 */
function firstApprovalDissent(substanceId: string): number {
  return opinionsFor(substanceId)
    .filter(o => o.stage === 'First approval')
    .reduce((n, o) => n + o.minority.length, 0)
}

/** What the act on the record said, whichever act that is. */
interface Approving {
  name: string
  type: string
  url: string
  /** Expiry as that act set it, verbatim. */
  expiry: string
  cfs: string
  criterion: string
  properties: string
  /** Set only where the act's conditions are a subset of the record's. */
  celex: string
}

function firstApproval(record: ApprovalRecord): Approving | null {
  const { initial, act } = record
  if (initial) {
    return {
      name: initial.name,
      type: initial.type,
      url: initial.url,
      expiry: initial.expiry,
      cfs: initial.cfsInAct,
      criterion: initial.cfsCriterion,
      properties: initial.hazardVerbatim,
      celex: initial.celex,
    }
  }
  if (!act) return null
  return {
    name: act.name,
    type: act.type,
    url: act.url,
    expiry: record.expiryInAct,
    cfs: record.cfs.inAct,
    criterion: record.cfs.criterion,
    properties: record.hazard.verbatim,
    celex: act.celex,
  }
}

/** The sentence about substitution, which is the part a reader looks for. */
function substitutionLine(record: ApprovalRecord, first: Approving, name: string): string {
  if (first.cfs === 'Yes') {
    const properties = first.properties ? ` — ${first.properties}` : ''
    return ` The act finds ${name} a candidate for substitution under Article ${first.criterion}${properties}.`
  }

  // Not stated here. Where a later act, or ECHA's field, says otherwise, say
  // which — without implying the earlier act got it wrong.
  const later =
    record.initial && record.cfs.inAct === 'Yes'
      ? ` The renewal act has since found it a candidate for substitution under Article ${record.cfs.criterion}.`
      : record.echaCfs === 'Yes'
        ? ` ECHA’s substitution field now reads “Yes”, which this act does not state.`
        : ''
  return ` The act states no candidate-for-substitution finding.${later}`
}

export function approvalRecords(s: Substance): FeedRecord[] {
  const record = approvalFor(s.id)
  if (!record?.act) return []

  const first = firstApproval(record)
  const date = record.initial?.approvalIso || record.approvalIso
  if (!first || !date) return []

  const included = first.type.startsWith('Annex I')
  const stated = first.cfs === 'Yes'
  const conditions = record.conditions.filter(c => c.celex === first.celex).length
  const dissent = firstApprovalDissent(s.id)

  const until = first.expiry ? `, to ${first.expiry}` : ''
  const assessedBy = record.authority ? ` Evaluated by ${record.authority}.` : ''
  const conditionLine = conditions
    ? ` The Annex attaches ${conditions} condition${conditions === 1 ? '' : 's'} to every product authorisation.`
    : ''
  const renewedBy = record.initial
    ? ` The approval has since been renewed by ${record.act.name}, to ${record.expiryInAct}.`
    : ''
  // Every one of these opinions was adopted 6 to 13 months before its act, so
  // "preceded it" is the sequence the dates show, not an inference.
  const dissentLine = dissent
    ? dissent === 1
      ? ' A member state filed a minority position against the BPC opinion that preceded it.'
      : ` ${dissent} minority positions were filed against the BPC opinion that preceded it.`
    : ''

  return [
    {
      kind: 'approval',
      date,
      datePrecision: 'day',
      dateDerived: false,
      // The substitution finding belongs in the title: the approval was
      // granted, but on terms Article 10(4) and Article 23 attach to it, and a
      // reader scanning titles should not have to open the card to learn that.
      title:
        (included
          ? `Included in Annex I to Directive 98/8/EC for ${s.pt}`
          : `Approved as an active substance for ${s.pt}`) +
        (stated ? ', as a candidate for substitution' : ''),
      summary:
        `${first.name} ${included ? 'included' : 'approved'} ${shortName(s)} for ${s.pt} from ` +
        `${formatDate(date)}${until}.${assessedBy}` +
        substitutionLine(record, first, shortName(s)) +
        conditionLine +
        dissentLine +
        renewedBy,
      tags: [
        'approval',
        included ? 'Annex I inclusion' : 'BPR approval',
        ...(stated ? ['candidate for substitution'] : []),
        ...(dissent ? [`${dissent} minority position${dissent === 1 ? '' : 's'}`] : []),
      ],
      blockers: [],
      signal: {
        direction: stated ? 'NEGATIVE' : 'NEUTRAL',
        strength: 1,
        label: stated ? 'Weak' : '',
        basis: 'documented',
        rationale: stated
          ? 'A candidate-for-substitution finding shortens the approval period ' +
            '(Article 10(4)) and puts every product containing the substance through ' +
            'comparative assessment at authorisation (Article 23). Weak rather than ' +
            'strong: it constrains the terms of a renewal without deciding whether one ' +
            'is granted.'
          : '',
      },
      sources: first.url
        ? [
            {
              citation: `EUR-Lex — ${first.name}`,
              pinpoint: stated ? 'recitals and Annex' : 'Annex',
              tier: 'PRIMARY',
              verified: true,
              url: first.url,
              note: 'located and extracted by AI; the act is the text that governs',
            },
          ]
        : [],
    },
  ]
}
