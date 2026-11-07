'use client'

import {
  endCountdown,
  formatDate,
  hasBpcRenewalOpinion,
  isRenewalAtRisk,
  isSubstitutionCandidate,
  shortName,
} from '@/lib/data'
import { directionTone, recordsFor, tallyRecords } from '@/lib/feeds'
import {
  INTEREST_LABEL,
  companyNames,
  companyShortNames,
  interestFor,
  interestTone,
  statesFiling,
} from '@/lib/interest'
import { BPC_MEETINGS_URL, bpcMeetingFor } from '@/lib/bpcMeetingSignals'
import { isNgo } from '@/lib/ngoSignals'
import { hasHazardCue } from '@/lib/hazardSignals'
import { hazardTally, pactFor } from '@/lib/pact'
import { recentlyRenewed, renewalFor, renewalGranted } from '@/lib/approvals'
import { pppApproved, pppFor } from '@/lib/ppp'
import { suppliersFor } from '@/lib/suppliers'
import type { FeedRecord, Substance } from '@/lib/types'
import AiTag from './AiTag'
import SubstanceDetail from './SubstanceDetail'
import { AlertTriangleIcon, ArrowRightIcon, CheckCircleIcon, ChevronDownIcon, PulseIcon } from './icons'
import { WatchButton, useWatchlist } from './useWatchlist'

// One substance = one row aligned to the table's columns, expanding in place to
// reveal the rest of its ECHA record. Open state is controlled by the parent so
// Expand all / Collapse all works. The star doesn't toggle the row.

/** "No longer supported" -> "no-longer-supported" (the pill's modifier class). */
const statusClass = (status: string) => status.toLowerCase().replace(/\s+/g, '-')

/** Status column: the approval itself, nothing else. Where the renewal stands
 *  moved to its own column. */
function ApprovalCell({ s }: { s: Substance }) {
  return <span className={`status-pill ${statusClass(s.approvalStatus)}`}>{s.approvalStatus}</span>
}

// Two columns, two questions. Renewal status: where the renewal actually
// stands in ECHA's record. Renewal prospects: what bears on how it may go.
// A row can carry any combination, or none. Only the links and the feed button
// stop the click, so tapping anywhere else still expands the row.

/** Where the renewal stands on the record: ECHA's own assessment status and
 *  sub-status, or — when there is none and the clock is running down — the
 *  fact that nothing is on file. The two are mutually exclusive by
 *  construction, since isRenewalAtRisk() requires a blank assessment status. */
export function RenewalStatusChips({ s }: { s: Substance }) {
  const interest = interestFor(s.id)
  // A renewal already granted answers this column outright, and outranks the
  // interest list, which still reads "submitted" for the two it applies to.
  const renewal = renewalFor(s.id)
  const renewed = !!renewal
  // An approval still in force with nothing recorded against it is worth
  // stating — but only where nothing else already says so. Where the interest
  // list answers the filing question itself, in ECHA's own words, this line
  // would either repeat it or contradict it.
  const noneRecorded =
    !renewed &&
    !s.assessmentStatus &&
    s.approvalStatus === 'Approved' &&
    !(interest && statesFiling(interest.state))
  // "Submitted" only adds something when ECHA's own status field doesn't
  // already say a renewal is under way — where it disagrees, that is worth
  // seeing. The other states always add something.
  // Named companies moved to the prospects column, where they are a cue about
  // how the renewal may go rather than a statement of where it stands. What is
  // left here is the interest list's own verdict on whether anything is filed.
  const showInterest =
    !renewed &&
    interest?.state &&
    interest.companies.length === 0 &&
    !(interest.state === 'submitted' && s.assessmentStatus === 'Renewal in progress')
  if (!renewed && !s.assessmentStatus && !noneRecorded && !showInterest) return null

  return (
    <div className="alert-row">
      {renewed ? (
        <span
          className="substatus renewed"
          title={
            renewal.firstSeen
              ? `Renewed by ${renewal.act} — first shown in ECHA's export of ${formatDate(renewal.date)}`
              : `Renewed by ${renewal.act}, adopted ${formatDate(renewal.date)}`
          }
        >
          <span className="dot" />
          {recentlyRenewed(s.id) ? 'Recently renewed' : 'Renewal granted'}
        </span>
      ) : s.assessmentStatus ? (
        <span className={`substatus ${s.assessmentStatus.startsWith('Renewal') ? 'renewal' : ''}`}>
          <span className="dot" />
          {s.assessmentStatus}
          {s.assessmentSubStatus && s.assessmentSubStatus !== '-' && (
            <span className="substatus-sub">{s.assessmentSubStatus}</span>
          )}
        </span>
      ) : (
        noneRecorded && (
          <span className="substatus none" title="ECHA records no assessment against this approval">
            <span className="dot" />
            No renewal recorded
          </span>
        )
      )}

      {showInterest && interest && (
        <span
          className={`interest ${interestTone(interest.state)}`}
          title={
            `ECHA expressions-of-interest list` +
            (interest.deadline ? ` · filing deadline ${interest.deadline}` : '')
          }
        >
          {INTEREST_LABEL[interest.state as Exclude<typeof interest.state, ''>]}
        </span>
      )}
    </div>
  )
}

/** One bar per signal, in time order: the oldest on the left, the newest on
 *  the right, so the strip reads as a timeline. Undated records stand at the
 *  far left, before the run of dates. Hue carries the direction each record
 *  was tagged with, depth carries its strength. It shows the shape and volume
 *  of the evidence: not a score, and nothing is summed. */
const MAX_BARS = 16

function SignalStrip({ records }: { records: FeedRecord[] }) {
  const ordered = [...records].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  // Where there are too many, the newest are kept and the older ones counted
  // at the left, where they would have stood.
  const shown = ordered.slice(-MAX_BARS)
  const older = ordered.length - shown.length
  return (
    <span className="sig-strip" aria-hidden="true">
      {older > 0 && <i className="sig-more">+{older}</i>}
      {shown.map((r, i) => (
        <i
          key={i}
          className={`sig-bar tone-${directionTone(r.signal.direction)} w${Math.min(3, Math.abs(r.signal.strength))}`}
        />
      ))}
    </span>
  )
}

/** What bears on how the renewal may go.
 *
 *  The signals box states how much evidence exists and what shape it has, then
 *  opens it. It does not reduce the feed to a verdict — reaching a view is the
 *  reader's job, from the record. */
function RenewalProspectChips({ s, onOpenFeed }: { s: Substance; onOpenFeed: (id: string) => void }) {
  const substitution = isSubstitutionCandidate(s)
  const risk = isRenewalAtRisk(s)
  // Once the renewal is granted, the opinion recommending it has been acted on:
  // it stays in the record as history but is no longer a prospect.
  const renewed = renewalGranted(s.id)
  const bpc = hasBpcRenewalOpinion(s) && !renewed
  // An opinion adopted at a BPC meeting, known from the meeting notes before
  // the opinion document or ECHA's export carry it.
  const adopted = bpcMeetingFor(s)
  const meeting = adopted && !(renewed && adopted.kind === 'renewal') ? adopted : null
  // The same molecule refused, withdrawn or never included under the
  // plant-protection regulation. A separate regime, so it is a precedent and
  // not a verdict — which is why the chip says which regime it is about, and
  // why the reasoning stays on the signals page.
  const ppp = pppFor(s.id)
  const pppFailed = !!ppp && !pppApproved(ppp)
  // On a hazard list, or with a hazard question still open. An assessment that
  // closed having found nothing is not a potential hazard.
  const hazard = hasHazardCue(s)
  // The same count as the hazard-lists tile on the substance's page.
  const pact = pactFor(s.id)
  const hazardCount = pact ? hazardTally(pact) : 0
  // A company on the record as intending to apply. Only where the list names
  // one — a bare "submitted" is the renewal's state, not a prospect.
  const interest = interestFor(s.id)
  const interested =
    interest?.state === 'interested' && interest.companies.length > 0 ? interest : null
  // Curated research plus the Article 95 listings, which are records in their
  // own right — so a substance nobody has researched can still have signals.
  // NGO report items are counted apart and kept off the strip: they are
  // indirect context, and a run of them should not look like a busy file.
  const all = recordsFor(s)
  const records = all.filter(r => !isNgo(r))
  const ngoCount = all.length - records.length
  const counts = tallyRecords(records)

  // A renewal under way, repeated from the status column as a cue — until the
  // BPC has adopted its renewal opinion, which says more and replaces it.
  const renewing =
    s.assessmentStatus === 'Renewal in progress' && !bpc && !(meeting && meeting.kind === 'renewal')

  const chips = substitution || risk || hazard || pppFailed || interested || renewing || bpc || meeting
  const hasRecords = all.length > 0

  // One box for the whole column: the signal count and strip at the top, the
  // top-signal chips beneath. The hit area is an overlay button rather than a
  // wrapper, because the BPC chip is a link and a button cannot contain one.
  return (
    <div className={`sig-box ${hasRecords ? '' : 'is-empty'}`}>
      <button
        type="button"
        className="sig-box-hit"
        title={
          hasRecords
            ? `${records.length} signals, oldest to newest — ` +
              [
                counts.negative && `${counts.negative} negative`,
                counts.positive && `${counts.positive} positive`,
                counts.neutral && `${counts.neutral} neutral`,
              ]
                .filter(Boolean)
                .join(', ') +
              (ngoCount ? `, plus ${ngoCount} NGO report item${ngoCount === 1 ? '' : 's'}` : '') +
              '. Opens the full record for this substance.'
            : "No renewal-signal research published yet — opens the substance's standing facts"
        }
        aria-label={`Open the record for ${s.name}`}
        onClick={e => {
          e.stopPropagation()
          onOpenFeed(s.id)
        }}
      />

      <span className="sig-box-head">
        {hasRecords ? (
          <>
            <PulseIcon />
            Signals
            <b>{records.length}</b>
            {ngoCount > 0 && <span className="sig-box-ngo">+{ngoCount} NGO</span>}
          </>
        ) : (
          'Signals coming soon'
        )}
        <span className="sig-box-go">
          Open
          <ArrowRightIcon />
        </span>
      </span>

      {records.length > 0 && <SignalStrip records={records} />}

      {/* The chips keep their own pointer events, so their tooltips still work;
          the click is forwarded to the same place the box goes. The BPC chip is
          a link and stops the event itself. */}
      {chips && (
        <div
          className="sig-box-chips"
          onClick={e => {
            e.stopPropagation()
            onOpenFeed(s.id)
          }}
        >
          <span className="prospect-label">Top signals:</span>
            {substitution && (
              <span
                className="alert-chip substitution"
                title="ECHA lists this substance as a candidate for substitution"
              >
                <AlertTriangleIcon />
                Candidate for substitution
              </span>
            )}
            {risk && (
              <span
                className="alert-chip risk"
                title="Fewer than 550 days to expiry — the Article 13(1) renewal filing deadline — with no renewal recorded"
              >
                <AlertTriangleIcon />
                Filing deadline passed
              </span>
            )}
            {hazard && (
              <span
                className="alert-chip hazard"
                title={
                  `${hazardCount || 'On a'} hazard list${hazardCount === 1 ? '' : 's'} or open ` +
                  "hazard assessment — see the substance's page"
                }
              >
                <AlertTriangleIcon />
                Potential hazard list{hazardCount === 1 ? '' : 's'}
                {hazardCount > 0 && <span className="alert-chip-count">{hazardCount}</span>}
              </span>
            )}
            {pppFailed && ppp && (
              <span
                className="alert-chip ppp"
                title={
                  'Not approved as a plant-protection active under Reg. (EC) No 1107/2009 — ' +
                  'a separate regime from the BPR. ' +
                  (ppp.expiryDate
                    ? `That approval expired ${formatDate(ppp.expiryDate)}.`
                    : 'It was never approved there.') +
                  ' Why, on the signals page.'
                }
              >
                <AlertTriangleIcon />
                Not approved as plant protection
              </span>
            )}
            {interested && (
              <span
                className="alert-chip interested"
                title={`On ECHA's expressions-of-interest list: ${companyNames(interested)}`}
              >
                <CheckCircleIcon />
                {interested.companies.length > 1 ? 'Companies' : 'Company'} interested in renewal:{' '}
                {companyShortNames(interested)}
              </span>
            )}
            {renewing && (
              <span
                className="alert-chip renewing"
                title={
                  'ECHA records a renewal in progress' +
                  (s.assessmentSubStatus && s.assessmentSubStatus !== '-' ? ` — ${s.assessmentSubStatus}` : '')
                }
              >
                <CheckCircleIcon />
                Renewal in progress
              </span>
            )}
            {bpc &&
              (s.bpcOpinionUrl ? (
                <a
                  className="alert-chip bpc"
                  href={s.bpcOpinionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`BPC opinion: ${s.bpcOpinion}`}
                  onClick={e => e.stopPropagation()}
                >
                  <CheckCircleIcon />
                  Renewal recommended by BPC
                </a>
              ) : (
                <span className="alert-chip bpc" title={`BPC opinion: ${s.bpcOpinion}`}>
                  <CheckCircleIcon />
                  Renewal recommended by BPC
                </span>
              ))}
            {meeting && (
              <a
                className="alert-chip bpc"
                href={BPC_MEETINGS_URL}
                target="_blank"
                rel="noopener noreferrer"
                title={
                  `Adopted at ${meeting.meeting} on ${formatDate(meeting.date)} — from the BPC ` +
                  'meeting notes. The opinion document is published separately and is not yet on this file.'
                }
                onClick={e => e.stopPropagation()}
              >
                <CheckCircleIcon />
                {meeting.kind === 'renewal' ? 'Renewal' : 'Approval'} opinion adopted ({meeting.meeting})
              </a>
            )}
            {meeting && <AiTag source="bpc-meeting" />}
        </div>
      )}
    </div>
  )
}

function DateCell({ iso, countdown }: { iso: string; countdown?: boolean }) {
  const left = countdown ? endCountdown(iso) : null
  return (
    <>
      <span className={`date-val${iso ? '' : ' none'}`}>{formatDate(iso)}</span>
      {left && <span className={`countdown ${left.tone}`}>{left.text}</span>}
    </>
  )
}

export default function SubstanceRow({
  s,
  open,
  onToggle,
  onOpenFeed,
  onOpenProducts,
}: {
  s: Substance
  open: boolean
  onToggle: () => void
  onOpenFeed: (id: string) => void
  onOpenProducts: (id: string) => void
}) {
  const watched = useWatchlist().includes(s.id)
  const supplierCount = suppliersFor(s.id).length

  const keyToggle = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggle()
    }
  }

  return (
    <div className={`sub-row ${open ? 'is-open' : ''} ${watched ? 'is-watched' : ''}`} id={`sub-${s.id}`}>
      <div
        className="sub-row-head"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`${s.name} — ${s.pt}, ${s.approvalStatus}`}
        onClick={onToggle}
        onKeyDown={keyToggle}
      >
        <ChevronDownIcon className="sub-chev" />

        <div className="gc gc-name">
          <div className="sub-name" title={s.name}>
            {shortName(s)}
          </div>
          <div className="sub-idents">
            <span>
              <span className="k">EC</span> {s.ec || '—'}
            </span>
            <span>
              <span className="k">CAS</span> {s.cas || '—'}
            </span>
            <span>
              <span className="k">CA</span> {s.authority || '—'}
            </span>
            {supplierCount > 0 && (
              <span title={`${supplierCount} Article 95 approved supplier${supplierCount === 1 ? '' : 's'}`}>
                <span className="k">A95</span> {supplierCount}
              </span>
            )}
          </div>
        </div>

        <div className="gc gc-status">
          <ApprovalCell s={s} />
        </div>

        {/* Approval start lives in the expanded record only — the list is
            about what happens next, not when it began. The countdown is
            suppressed once the status pill already says "Expired". */}
        <div className="gc gc-end">
          <DateCell iso={s.endDate} countdown={s.approvalStatus !== 'Expired'} />
        </div>

        <div className="gc gc-alerts">
          <RenewalStatusChips s={s} />
        </div>

        <div className="gc gc-prospects">
          <RenewalProspectChips s={s} onOpenFeed={onOpenFeed} />
        </div>

        <span className="gc gc-actions" onClick={e => e.stopPropagation()}>
          <WatchButton id={s.id} name={s.name} />
        </span>
      </div>

      {open && <SubstanceDetail s={s} onOpenFeed={onOpenFeed} onOpenProducts={onOpenProducts} />}
    </div>
  )
}
