import { renewalGranted } from './approvals'
import { formatDate } from './data'
import { interestFor, interestMeta } from './interest'
import { postponementsFor } from './postponements'
import type { FeedRecord, Substance } from './types'

// The renewal application itself, as a dated record.
//
// Positive, and substantively so: an application is a dossier paid for and
// filed, the clearest evidence that someone intends to keep the substance on
// the market. It sits below the BPC opinion — filing is a commitment, an
// opinion is a judgement on the merits.
//
// Two kinds, because there are two kinds of evidence for it.
//
// Where a postponement Decision exists, its recitals state the filing date in
// as many words ("On 27 February 2024, an application was submitted in
// accordance with Article 13(1)"). 16 substances are in that position, and
// their records carry a real date.
//
// The rest are known to have filed only because ECHA's expressions-of-interest
// list says so. That list carries no date for the entry — only a date for
// itself — so those records are dated the day the list was prepared and say
// so, the same way the expression-of-interest record does. What can be pinned
// down is the other end: Article 13(1) requires the application at least 550
// days before expiry, so it was filed on or before the AS-RNL deadline, which
// the list does give. The record states that bound rather than implying the
// list's date is the filing date.

const AS_RNL = 'https://echa.europa.eu/documents/d/guest/as-rnl_expressions_of_interest_public_en'

/** Filed on a date a Commission Decision states. */
function datedFiling(s: Substance): FeedRecord[] {
  const held = postponementsFor(s.id)
  if (!held?.applicationSubmittedIso) return []

  // Two applications filed on consecutive days is common — the verbatim string
  // keeps both where the ISO date can only carry the first.
  const both = held.applicationSubmitted.includes('+')

  return [
    {
      kind: 'filing',
      date: held.applicationSubmittedIso,
      datePrecision: 'day',
      dateDerived: false,
      title: both ? 'Renewal applications submitted' : 'Renewal application submitted',
      summary:
        `An application for renewal of the ${s.pt} approval was submitted under ` +
        `Article 13(1) on ${held.applicationSubmitted}` +
        `${both ? ' — two applications, filed on consecutive days' : ''}. ` +
        `The evaluating authority is ${held.authority}.`,
      tags: ['renewal', 'application'],
      blockers: [],
      signal: {
        direction: 'POSITIVE',
        strength: 2,
        label: 'Strong',
        basis: 'documented',
        rationale: '',
      },
      sources: held.postponements
        .filter(p => p.decisionUrl)
        .slice(0, 1)
        .map(p => ({
          citation: `Commission Implementing Decision (EU) ${p.decision}`,
          pinpoint: 'the recital stating when the application was submitted',
          tier: 'PRIMARY',
          verified: true,
          url: p.decisionUrl,
          note: '',
        })),
    },
  ]
}

/** Filed on a date nothing published states — only that it had been, by the
 *  time ECHA drew up its list. */
function firstRecordedFiling(s: Substance): FeedRecord[] {
  const interest = interestFor(s.id)
  if (interest?.state !== 'submitted' || !interestMeta.preparedAs) return []

  // A renewal that has been granted settles the question the list was asked.
  // ECHA's entry still reads "submitted" — it records the application, not
  // what became of it — and the act that granted the renewal is the later word
  // on the same thing, so the list is not used to raise a signal here.
  if (renewalGranted(s.id)) return []

  // A substance with postponement Decisions has a renewal already running, and
  // the Decisions themselves are dated records of it — the earliest sits years
  // before this list was drawn up. Where the recitals stating the filing date
  // were retrieved, datedFiling has already answered; where they were not, a
  // 2026 "first recorded" entry would put the application after postponements
  // granted because it was under evaluation. Two substances are in that
  // position: Indoxacarb and hexaflumuron.
  if ((postponementsFor(s.id)?.postponements.length ?? 0) > 0) return []

  const asOfList = formatDate(interestMeta.preparedAs)
  const by = interest.deadline
    ? ` Article 13(1) requires the application at least 550 days before expiry, so it was filed ` +
      `on or before ${formatDate(interest.deadline)}.`
    : ''

  return [
    {
      kind: 'filing',
      date: interestMeta.preparedAs,
      // Shown to the month: the day belongs to the list, not to the filing, so
      // printing it claims a precision the record does not have. The ISO date
      // keeps the full value, so ordering is unaffected.
      datePrecision: 'month',
      // The list states this date for itself, so it is not worked out from
      // context — it simply is not the day the application was filed.
      dateDerived: false,
      dateNote: 'First recorded date',
      dateNoteInfo:
        `The date is the one ECHA's expressions-of-interest list gives for itself — prepared ` +
        `as of ${asOfList}. The list records that an application has been submitted but gives ` +
        `no date for the entry, and no published source states the filing date for this ` +
        `substance, so this is when the information was first on the record rather than when ` +
        `it happened.`,
      title: 'Renewal application submitted',
      summary:
        `ECHA's expressions-of-interest list records that an application for renewal of the ` +
        `${s.pt} approval has been submitted. First recorded with the list prepared as of ` +
        `${asOfList}; the list gives no date for the entry itself.${by}`,
      tags: ['renewal', 'application'],
      blockers: [],
      signal: {
        // The same fact as the dated record, and weighted the same: what is
        // missing is the date, not the evidence that it was filed.
        direction: 'POSITIVE',
        strength: 2,
        label: 'Strong',
        basis: 'documented',
        rationale: '',
      },
      sources: [
        {
          citation: `ECHA — expressions of interest in renewal (AS-RNL), prepared as of ${asOfList}`,
          // No pinpoint: the list is one document covering every substance, so
          // naming this one adds nothing the card has not already said.
          pinpoint: '',
          tier: 'PRIMARY',
          verified: true,
          url: AS_RNL,
          note: '',
        },
      ],
    },
  ]
}

export function filingRecords(s: Substance): FeedRecord[] {
  const dated = datedFiling(s)
  return dated.length > 0 ? dated : firstRecordedFiling(s)
}
