'use client'

import { Fragment, useCallback, useState } from 'react'
import { formatDate, hasBpcRenewalOpinion, isRenewalAtRisk, monthsUntil } from '@/lib/data'
import { INTEREST_LABEL, INTEREST_SHORT, companyNames, interestFor, interestTone } from '@/lib/interest'
import { consultationsFor, openConsultation } from '@/lib/consultations'
import {
  actShort,
  approvalFor,
  approvalMeta,
  recentlyRenewed,
  renewalFor,
  splitConditions,
} from '@/lib/approvals'
import { minorityCount, opinionsFor } from '@/lib/bpcOpinions'
import {
  flagList,
  hazardAreaActivities,
  hazardShown,
  hazardTally,
  isLive,
  otherActivities,
  pactAreas,
  pactFor,
} from '@/lib/pact'
import { postponementCount, postponementsFor } from '@/lib/postponements'
import { pppApproved, pppFor, pppTone } from '@/lib/ppp'
import { suppliersFor, supplierShortNames } from '@/lib/suppliers'
import { productsFor, unionNote } from '@/lib/products'
import { DEFAULT_ORDER, orderRecords, recordsFor, tallyRecords } from '@/lib/feeds'
import { isNgo } from '@/lib/ngoSignals'
import type { RecordOrder } from '@/lib/feeds'
import type { FeedRecord, Substance, SubstanceFeed } from '@/lib/types'
import ConsultationPanel from './ConsultationPanel'
import PanelDialog from './PanelDialog'
import ApprovalDataPanel from './ApprovalDataPanel'
import { PactActivities, PactHazards } from './PactPanel'
import PppPanel from './PppPanel'
import RecordCard from './RecordCard'
import SourceNote, { type Source } from './SourceNote'
import SupplierTable from './SupplierTable'
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  ExpandIcon,
  ExternalIcon,
  SlashCircleIcon,
  XCircleIcon,
} from './icons'

// The renewal-signal feed for one substance, as its own page: one card per
// record, set at reading scale. The list view only ever shows the headline.

/** How many companies the suppliers tile names before it gives up and counts. */
const NAMED_SUPPLIERS = 3

// Where each tile is read from, named on the tile. Only the two publications
// whose URLs are confirmed are wired up; the rest of the tiles are annotated in
// the README pending their source links.
const ECHA_DATABASE: Source = {
  label: 'ECHA — Biocidal active substances',
  url: 'https://echa.europa.eu/information-on-chemicals/biocidal-active-substances',
}
const ECHA_INTEREST: Source = {
  label: 'ECHA — Expressions of interest in renewal (AS-RNL)',
  url: 'https://echa.europa.eu/documents/d/guest/as-rnl_expressions_of_interest_public_en',
}
const ECHA_SUPPLIERS: Source = {
  label: 'ECHA — Article 95 list of active substance suppliers',
  url: 'https://echa.europa.eu/information-on-chemicals/active-substance-suppliers',
}
const ECHA_PRODUCTS: Source = {
  label: 'ECHA — Biocidal products',
  url: 'https://echa.europa.eu/information-on-chemicals/biocidal-products',
}
const EU_PESTICIDES: Source = {
  label: 'EU Pesticides Database — active substances',
  url: 'https://ec.europa.eu/food/plant/pesticides/eu-pesticides-database/start/screen/active-substances',
}
// The renewal track and the postponement count are read out of the Commission's
// postponement Decisions, which have no register of their own — this search is
// how you find them. Checked: 45 results, the first being the Decision named on
// imidacloprid in the substance export.
const BPC_OPINIONS: Source = {
  label: 'ECHA — Biocidal Products Committee opinions',
  url: '',
  note: 'each opinion and minority position links to its own document',
}
// The publications behind the Potential hazard lists tile. All but one were
// checked and answer; the PACT link is the one the client supplied and could
// not be checked, because the old ECHA host returns 403 to any automated
// request. The newer chem.echa.europa.eu host does answer.
const EPA_CARCINOGEN: Source = {
  label: 'NPIC — Chemicals Evaluated for Carcinogenic Potential (US EPA)',
  url: 'https://npic.orst.edu/chemicals_evaluated.pdf',
  note: 'the EPA classification and the year it was given',
}
const ED_LISTS: Source = {
  label: 'The ED Lists — endocrine disruptor lists',
  url: 'https://edlists.org/the-ed-lists',
  note: 'which list the substance appears on, and on what grounds',
}
const ECHA_ED_ASSESSMENT: Source = {
  label: 'ECHA — Endocrine disruptor assessment list',
  url: 'https://chem.echa.europa.eu/activity-lists/edAssessment',
  note: 'whether an ED assessment is running, and what it concluded',
}
const EPA_EDSP: Source = {
  label: 'US EPA — EDSP Tier 1 screening determinations',
  url:
    'https://www.epa.gov/endocrine-disruption/' +
    'endocrine-disruptor-screening-program-tier-1-screening-determinations-and',
  note: 'the Tier 1 weight-of-evidence conclusion, read against the EU ED criteria',
}
const PAN_HHP: Source = {
  label: 'PAN International — List of Highly Hazardous Pesticides',
  url: 'https://pan-international.org/wp-content/uploads/PAN_HHP_List.pdf',
  note:
    'December 2024 edition: whether the pesticide is listed, on which criteria, and since ' +
    'when — each card names the publications behind its criteria',
}
const ECHA_PACT: Source = {
  label: 'ECHA — Public Activities Coordination Tool (PACT)',
  url:
    'https://echa.europa.eu/pact?p_p_id=disspact_WAR_disspactportlet&p_p_lifecycle=0' +
    '&p_p_state=normal&p_p_mode=view&_disspact_WAR_disspactportlet_DISLIST_PBT_diss_update_dateFrom=' +
    '&_disspact_WAR_disspactportlet_DISLIST_PBT_diss_concern=&_disspact_WAR_disspactportlet_cur=1' +
    '&_disspact_WAR_disspactportlet_substance_identifier_field_key=' +
    '&_disspact_WAR_disspactportlet_delta=50&_disspact_WAR_disspactportlet_deltaParamValue=50' +
    '&_disspact_WAR_disspactportlet_DISLIST_PBT_diss_update_dateTo=' +
    '&_disspact_WAR_disspactportlet_proccessNameprocesses=&_disspact_WAR_disspactportlet_doSearch=' +
    '&_disspact_WAR_disspactportlet_multiValueSearchOperatorprocesses=AND' +
    '&_disspact_WAR_disspactportlet_orderByCol=DISLIST_ARN' +
    '&_disspact_WAR_disspactportlet_orderByType=asc',
  note: 'the hazard assessments: substance evaluation, PBT, ED, regulatory needs',
}
const EURLEX_APPROVAL: Source = {
  label: 'EUR-Lex — the act that approved the substance',
  url: '',
  note: 'recitals and Annex conditions extracted by AI; every block links to the act',
}
const EURLEX_POSTPONEMENTS: Source = {
  label: 'EUR-Lex — Decisions postponing an approval expiry (PT18)',
  url:
    'https://eur-lex.europa.eu/search.html?scope=EURLEX&text=%22postponing+the+expiry+date+of+the' +
    '+approval+of%22+%22product-type+18%22&type=quick&lang=en',
  note: 'search: "postponing the expiry date of the approval of" + "product-type 18"',
}

/** The icon each approval status carries, so the badge reads before the word
 *  does. Five states, and the data holds no others. */
const STATUS_ICON: Record<string, (p: { className?: string }) => JSX.Element> = {
  Approved: CheckCircleIcon,
  Pending: ClockIcon,
  Expired: AlertTriangleIcon,
  'Not approved': XCircleIcon,
  'No longer supported': SlashCircleIcon,
}

/** A tile whose whole face is a control.
 *
 *  The hit area is a button laid over the tile rather than wrapped around it,
 *  because a button cannot contain another button and the source note is one.
 *  The note sits above the overlay so both stay clickable and separately
 *  reachable by keyboard. */
function ActionTile({
  label,
  sources,
  sourcesIntro,
  open,
  leaves,
  onActivate,
  hint,
  children,
}: {
  label: string
  sources?: Source[]
  sourcesIntro?: string
  open?: boolean
  /** True when it opens another page rather than unfolding in place. */
  leaves?: boolean
  onActivate: () => void
  hint: string
  children: React.ReactNode
}) {
  return (
    <div className={`fp-tile is-action ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="fp-tile-hit"
        aria-expanded={leaves ? undefined : !!open}
        aria-label={hint}
        title={hint}
        onClick={onActivate}
      />
      <div className="fp-tile-label">
        {label}
        {sources && <SourceNote label={label} sources={sources} intro={sourcesIntro} />}
        <span className="fp-tile-go" aria-hidden="true">
          {leaves ? <ArrowRightIcon /> : <ExpandIcon />}
        </span>
      </div>
      {children}
    </div>
  )
}

/** The standing facts a reader needs before reading the record: how long is
 *  left, whether substitution is in play, and how much of the product estate
 *  outlives the approval it depends on. All read straight from ECHA's data —
 *  none of it is derived from the feed. */
function Dashboard({
  substance,
  feed,
  onOpenProducts,
}: {
  substance: Substance
  feed: SubstanceFeed | null
  onOpenProducts: (id: string) => void
}) {
  // One panel at a time, shown over the page. Holding the name rather than six
  // booleans means opening one closes whatever was open, which is what a modal
  // has to do anyway.
  type Panel = 'suppliers' | 'ppp' | 'cons' | 'pact' | 'flags' | 'opinions'
  const [panel, setPanel] = useState<Panel | null>(null)
  const toggle = (name: Panel) => setPanel(p => (p === name ? null : name))
  const close = useCallback(() => setPanel(null), [])
  const months = monthsUntil(substance.endDate)
  const products = productsFor(substance.id)
  const suppliers = suppliersFor(substance.id)
  const names = supplierShortNames(suppliers)
  const shownNames = names.slice(0, NAMED_SUPPLIERS)
  const restNames = names.length - shownNames.length
  // Roughly half the substances were never plant-protection actives, so this
  // tile appears only where the pesticide database has something to say.
  const ppp = pppFor(substance.id)
  // The consultations behind the substitution field: the grounds ECHA put out
  // for comment. They belong on that tile rather than a tile of their own —
  // they are the evidence for it, not a separate fact.
  const consultations = consultationsFor(substance.id)
  const openCons = openConsultation(consultations)
  // What is happening to the substance elsewhere in the regulatory system, and
  // which hazard lists it sits on. Two different kinds of fact in one export,
  // so a tile and a panel each.
  const pact = pactFor(substance.id)
  // Split by what an activity means: an authority asking whether the molecule
  // is a problem, against a step in a classification or dossier procedure.
  const hazards = pact ? hazardAreaActivities(pact) : []
  const activities = pact ? otherActivities(pact.activities) : []
  const liveActivities = activities.filter(a => isLive(a.status)).length
  const flags = pact ? flagList(pact) : []
  // What the tile counts, against what the panel has to show: an assessment
  // that concluded the substance is not an endocrine disruptor appears on the
  // panel but is not a potential hazard, so the tile reads 0.
  const hazardCount = pact ? hazardTally(pact) : 0
  const hazardAny = pact ? hazardShown(pact) : 0
  // What the approving act said, and what the committee opined.
  const opinions = opinionsFor(substance.id)
  const dissent = minorityCount(opinions)
  const approval = approvalFor(substance.id)
  const approvalAct = approval?.act ?? null
  const cfsStated = approval?.cfs.inAct === 'Yes'
  const actFlags = approval?.hazard.flags ?? []
  // The conditions of the act in force. The two renewed substances also carry
  // the conditions of the act they replaced, which the tile should not count.
  const actConditions = approval ? splitConditions(approval).current.length : 0
  // The act is a second source for the substitution field, and for seven
  // substances it says something different — so the tile names it too.
  const actAsCfsSource: Source[] = approvalAct
    ? [
        {
          label: `EUR-Lex — ${approvalAct.name}`,
          url: approvalAct.url,
          note: cfsStated
            ? 'the act states the finding, with its reasons'
            : 'the act itself states no such finding',
        },
      ]
    : []
  // What the box holds, for the note line under the tile — in the order that
  // matters, and only the first two: the tile is 196px wide and the panel
  // below carries the rest. The opinion count is left out: a substance that
  // reached approval has one, so saying so distinguishes nothing. A minority
  // position filed against it does.
  const approvalParts = [
    cfsStated && approval?.cfs.criterion ? `CfS Art. ${approval.cfs.criterion}` : '',
    dissent > 0 ? `${dissent} minority position${dissent === 1 ? '' : 's'}` : '',
    actConditions > 0 ? `${actConditions} condition${actConditions === 1 ? '' : 's'}` : '',
  ]
    .filter(Boolean)
    .slice(0, 2)
  // Two tiles are the feed's to answer. Without one they read "—", which is
  // the honest answer: nobody has researched it, not "there is none".
  const renewal = feed?.renewal
  // A renewal granted starts a new approval period: the track and the
  // postponements belonged to the one it replaced, so both tiles clear. The
  // postponements stay in the record as history.
  const granted = renewalFor(substance.id)
  const renewed = !!granted
  // The decisions themselves, where we hold them. They outrank the count a feed
  // carries by hand — Indoxacarb's feed says 0 where the register shows 3.
  const moved = renewed ? null : postponementsFor(substance.id)
  const postponements = renewed
    ? undefined
    : moved
      ? postponementCount(substance.id)
      : renewal?.postponements
  // The decisions state the evaluation route; a curated feed may too. The
  // decisions win, being the document rather than a note about it.
  const track = renewed ? '' : moved?.track || renewal?.track || ''
  // When the renewal was filed. The postponement decisions state it in their
  // recitals, which is the better source; a curated feed may also carry it.
  const filedIso = moved?.applicationSubmittedIso || renewal?.started || ''
  // Verbatim where the decision gave two dates ("27+28 Apr 2021"), so neither
  // is dropped.
  const filedLabel = moved?.applicationSubmittedIso
    ? moved.applicationSubmitted
    : formatDate(filedIso)
  const elapsed = filedIso ? monthsUntil(filedIso) : NaN
  const filed = !Number.isNaN(elapsed)
  // Fewer than 550 days to expiry — the Article 13(1) filing deadline — with no
  // renewal recorded against the approval, on the status field or the interest
  // list. An application on the list rules this out, so the two never disagree.
  const deadlinePassed = isRenewalAtRisk(substance)
  const interest = interestFor(substance.id)
  // ECHA's interest list is the better witness to whether an application is in:
  // it states the position in its own words and carries its own deadline. Where
  // it speaks and the feed has no filing date of its own, it *is* the tile. Our
  // derived reading only fills the gap where the list is silent.
  // ...unless the renewal has already been decided. ECHA's list still reads
  // "submitted" for a substance whose renewal was granted — the entry records
  // the application, not what became of it — and the act that granted it is
  // the later and better word on the same question.
  const stated = !filed && !renewed && interest?.state ? interest.state : ''
  // Which leaves the line below to do the one thing the tile cannot: name the
  // companies. Everywhere else it repeats what the value or the note already
  // says — except where it contradicts a filing we can date, which is worth
  // seeing.
  const showInterest =
    !renewed &&
    !!interest?.state &&
    (interest.companies.length > 0 || (filed && interest.state !== 'submitted'))
  // The BPC's published opinion — the one body whose view carries weight in the
  // decision itself, so it belongs on this tile rather than among the signals.
  // Once the renewal is granted the recommendation has been acted on.
  const bpc = hasBpcRenewalOpinion(substance) && !renewed
  // No approval has ever been granted — ECHA leaves the status blank while a
  // first application runs, which the converter writes as "Pending". Nothing
  // about renewal applies yet: no filing deadline, no evaluation track, no
  // postponements. The tile carries where the first approval stands instead.
  const firstApproval = substance.approvalStatus === 'Pending'

  // Only a settled "No" is reassuring; "Under assessment" is an open question
  // that can still land on the substance.
  const substitutionTone = substance.substitution === 'No' ? 'ok' : 'warn'

  return (
    <>
      {/* Grouped by what each fact is about, rather than by where it came
          from. The three at the foot are deliberately left unlabelled: they
          are what other authorities are doing, and naming them as a group
          would imply they bear on the renewal in the way the bands above do. */}
      <div className="fp-band">
        <span className="fp-band-label">Approval</span>
        <div className="fp-dash fp-dash-wide fp-dash-fill">
        <div className="fp-tile">
          <div className="fp-tile-label">
            Approval ends
            <SourceNote label="Approval ends" sources={[ECHA_DATABASE]} />
          </div>
          <div className={`fp-tile-value ${months < 12 ? 'warn' : ''}`}>
            {Number.isNaN(months) ? '—' : months < 0 ? 'Expired' : `${months} mo`}
          </div>
          <div className="fp-tile-note">{formatDate(substance.endDate)}</div>
        </div>

        {consultations.length > 0 ? (
          <ActionTile
            label="Candidate for substitution"
            open={panel === 'cons'}
            onActivate={() => toggle('cons')}
            hint={panel === 'cons' ? 'Hide the consultation' : 'Show the consultation'}
            sources={[
                { ...ECHA_DATABASE, note: 'the status, once it has been decided' },
                ...(openCons?.link
                  ? [
                      {
                        label: 'ECHA — this substance\u2019s open consultation',
                        url: openCons.link,
                        note: 'the grounds, while it is under consultation',
                      },
                    ]
                  : []),
                ...actAsCfsSource,
            ]}
          >
            <div className={`fp-tile-value sm ${substitutionTone ?? ''}`}>
              {substance.substitution || '—'}
            </div>
            <div className={`fp-tile-note ${openCons ? 'warn' : ''}`}>
              {openCons
                ? `consultation open to ${formatDate(openCons.deadline)}`
                : `${consultations.length} consultation${consultations.length === 1 ? '' : 's'}` +
                  ` · last ${consultations[0].start.slice(0, 4)}`}
            </div>
          </ActionTile>
        ) : (
          <div className="fp-tile">
            <div className="fp-tile-label">
              Candidate for substitution
              <SourceNote
                label="Candidate for substitution"
                sources={[
                  { ...ECHA_DATABASE, note: 'the status, once it has been decided' },
                  ...actAsCfsSource,
                ]}
              />
            </div>
            <div className={`fp-tile-value sm ${substitutionTone ?? ''}`}>
              {substance.substitution || '—'}
            </div>
            <div className="fp-tile-note">ECHA substitution field</div>
          </div>
        )}

        {(opinions.length > 0 || approvalAct) && (
          <ActionTile
            label="Approval data"
            sources={[EURLEX_APPROVAL, BPC_OPINIONS]}
            open={panel === 'opinions'}
            onActivate={() => toggle('opinions')}
            hint={panel === 'opinions' ? 'Hide the approval data' : 'Show the approval data'}
          >
            {/* The properties the act names, where it names any: they are
                the reason for the substitution finding, and the shortest
                true thing the tile can say. */}
            <div className={`fp-tile-value sm ${actFlags.length > 0 ? 'mixed' : ''}`}>
              {actFlags.length > 0
                ? actFlags.join(' · ')
                : approval
                  ? actShort(approval) || '—'
                  : '—'}
            </div>
            <div className="fp-tile-note">{approvalParts.join(' · ') || 'no act on record'}</div>
          </ActionTile>
        )}

        </div>
      </div>

      <div className="fp-band">
        <span className="fp-band-label">Renewal</span>
        <div className="fp-dash fp-dash-wide fp-dash-fill">
        <div className="fp-tile">
          <div className="fp-tile-label">
            {firstApproval ? 'Status' : 'Renewal status'}
            <SourceNote
              label={firstApproval ? 'Status' : 'Renewal status'}
              sources={
                firstApproval
                  ? [{ ...ECHA_DATABASE, note: 'assessment status and sub-status' }]
                  : [
                      { ...ECHA_DATABASE, note: 'assessment status and sub-status' },
                      { ...ECHA_INTEREST, note: 'who has applied, and the filing deadline' },
                    ]
              }
            />
          </div>

          {firstApproval ? (
            <>
              <div className="fp-tile-value sm">
                {substance.assessmentStatus || 'Not yet approved'}
              </div>
              <div className="fp-tile-note">
                {substance.assessmentSubStatus && substance.assessmentSubStatus !== '-'
                  ? substance.assessmentSubStatus
                  : 'no approval granted yet'}
              </div>
            </>
          ) : (
            <>
              <div
                className={`fp-tile-value ${renewed ? `ok ${recentlyRenewed(substance.id) ? 'sm' : ''}` : stated ? `${INTEREST_SHORT[stated].length > 10 ? 'sm ' : ''}${interestTone(stated)}` : deadlinePassed ? 'warn' : ''}`}
              >
                {renewed
                  ? recentlyRenewed(substance.id)
                    ? 'Recently renewed'
                    : 'Renewed'
                  : filed
                    ? `${Math.abs(Math.round(elapsed / 12))} yr`
                    : stated
                      ? INTEREST_SHORT[stated]
                      : 'Not filed'}
              </div>
              {/* The AS-RNL deadline is anchored to the expiry at the time the
                  list was published, so where the expiry has since moved it no
                  longer lines up with anything else on the tile. The note names
                  the source instead; the deadline still drives the Article
                  13(1) signal, which says what it is measuring. */}
              <div className={`fp-tile-note ${!stated && !renewed && deadlinePassed ? 'warn' : ''}`}>
                {renewed
                  ? granted.act || 'renewal granted'
                  : stated
                    ? 'ECHA interest list'
                    : deadlinePassed
                      ? 'filing deadline passed'
                      : filedIso
                        ? `filed ${filedLabel}`
                        : 'no application on record'}
              </div>
            </>
          )}
          {/* ECHA's own assessment status. The value above says how long the
              renewal has been running and the note when it was filed, but
              neither says that it *is* running — and on this tile that is the
              thing a reader came for. */}
          {!firstApproval && substance.assessmentStatus && (
            <div className="fp-tile-state">
              {substance.assessmentStatus}
              {substance.assessmentSubStatus && substance.assessmentSubStatus !== '-' && (
                <span className="fp-tile-substate">{substance.assessmentSubStatus}</span>
              )}
            </div>
          )}

          {showInterest && interest && (
            <div className={`fp-tile-interest ${interestTone(interest.state)}`}>
              {interest.companies.length > 0
                ? `Company interested in renewal: ${companyNames(interest)}`
                : INTEREST_LABEL[interest.state as Exclude<typeof interest.state, ''>]}
            </div>
          )}

          {bpc &&
            (substance.bpcOpinionUrl ? (
              <a
                className="fp-tile-bpc"
                href={substance.bpcOpinionUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={`BPC opinion: ${substance.bpcOpinion} — opens the PDF`}
              >
                <CheckCircleIcon />
                Renewal recommended by BPC
                <ExternalIcon />
              </a>
            ) : (
              <span className="fp-tile-bpc" title={`BPC opinion: ${substance.bpcOpinion}`}>
                <CheckCircleIcon />
                Renewal recommended by BPC
              </span>
            ))}
        </div>

        {/* Both of these are renewal-only. Before a first approval there is
            nothing for them to measure, so they are stood down rather than
            removed — the reader can see the question was asked. */}
        <div className={`fp-tile ${firstApproval ? 'is-muted' : ''}`}>
          <div className="fp-tile-label">
            Renewal track
            <SourceNote label="Renewal track" sources={[EURLEX_POSTPONEMENTS]} />
          </div>
          <div className={`fp-tile-value ${track ? 'sm' : ''}`}>{track || '—'}</div>
          <div className="fp-tile-note">
            {firstApproval
              ? 'not applicable before first approval'
              : renewed
                ? 'cleared by the renewal'
                : track
                  ? 'route the eCA is taking'
                  : 'no evaluation route recorded'}
          </div>
        </div>

        <div className={`fp-tile ${firstApproval ? 'is-muted' : ''}`}>
          <div className="fp-tile-label">
            Postponements
            <SourceNote label="Postponements" sources={[EURLEX_POSTPONEMENTS]} />
          </div>
          <div
            className={`fp-tile-value ${!firstApproval && postponements ? 'warn' : ''}`}
          >
            {postponements ?? '—'}
          </div>
          <div className="fp-tile-note">
            {firstApproval
              ? 'not applicable before first approval'
              : renewed
                ? 'cleared by the renewal'
                : moved && moved.postponements.length > 0
                ? `latest ${moved.postponements[moved.postponements.length - 1].decision}` +
                  ` · now to ${formatDate(moved.currentExpiry)}`
                : 'times the expiry has moved'}
          </div>
        </div>
        </div>
      </div>

      <div className="fp-band">
        <span className="fp-band-label">Market position</span>
        <div className="fp-dash fp-dash-wide fp-dash-fill">
        {/* Opens in place: there is no Article 95 page to send the reader to,
            and the table is only as long as the substance has suppliers. */}
        <ActionTile
          label="Suppliers (Article 95)"
          sources={[ECHA_SUPPLIERS]}
          open={panel === 'suppliers'}
          onActivate={() => toggle('suppliers')}
          hint={panel === 'suppliers' ? 'Hide the supplier list' : 'Show the supplier list'}
        >
          <div className={`fp-tile-value ${suppliers.length === 0 ? 'warn' : ''}`}>
            {suppliers.length}
          </div>
          <div className="fp-tile-note">
            {names.length > 0
              ? shownNames.join(' · ') + (restNames > 0 ? ` +${restNames}` : '')
              : 'none on the list'}
          </div>
        </ActionTile>

        {/* Every authorisation, live or not — the past-expiry share sits on the
            products page itself. The detail is a page of its own, so this
            opens it rather than unfolding here. */}
        <ActionTile
          label="Product authorisations"
          sources={[ECHA_PRODUCTS]}
          leaves
          onActivate={() => onOpenProducts(substance.id)}
          hint="Opens every authorisation for this substance"
        >
          <div className="fp-tile-value">{products ? products.products : '—'}</div>
          <div className="fp-tile-note">
            {products
              ? unionNote(products) +
                (products.newestGrant ? ` · newest grant ${products.newestGrant}` : '')
              : 'no authorised products'}
          </div>
        </ActionTile>
        </div>
      </div>

      {(!!ppp || hazardAny > 0 || activities.length > 0) && (
        <div className="fp-band">
          <span className="fp-band-label">Other</span>
          <div className="fp-dash fp-dash-wide fp-dash-fill">
        {/* The same molecule under the plant-protection regulation. A separate
            regime, so this is a precedent rather than a verdict — which is why
            the reasoning sits behind a click rather than on the tile. */}
        {ppp && (
          <ActionTile
            label="Plant-protection status"
            sources={[EU_PESTICIDES]}
            open={panel === 'ppp'}
            onActivate={() => toggle('ppp')}
            hint={panel === 'ppp' ? 'Hide the plant-protection record' : 'Show the plant-protection record'}
          >
            <div className={`fp-tile-value sm ${pppTone(ppp)}`}>{ppp.status}</div>
            <div className="fp-tile-note">
              {ppp.expiryDate
                ? `${pppApproved(ppp) ? 'expires' : 'approval expired'} ${formatDate(ppp.expiryDate)}`
                : ppp.approvalDate
                  ? `approved ${formatDate(ppp.approvalDate)}`
                  : 'no approval dates on record'}
            </div>
          </ActionTile>
        )}

        {hazardAny > 0 && (
          <ActionTile
            label="Potential hazard lists"
            /* All three, on every substance — the reader needs to know what
               was searched, not only what it returned. */
            sources={[EPA_CARCINOGEN, ED_LISTS, ECHA_ED_ASSESSMENT, EPA_EDSP, PAN_HHP, ECHA_PACT]}
            sourcesIntro={
              'Every PT18 and PT19 substance is checked against each of the lists below. ' +
              'What the panel shows is what came back for this one; a list not named there ' +
              'was searched and returned nothing.'
            }
            open={panel === 'flags'}
            onActivate={() => toggle('flags')}
            hint={panel === 'flags' ? 'Hide the hazard lists' : 'Show the hazard lists'}
          >
            {/* Red only when there is something to be red about: a zero here means
                the lists were checked and nothing was found. */}
            <div className={`fp-tile-value ${hazardCount > 0 ? 'warn' : ''}`}>{hazardCount}</div>
            <div className="fp-tile-note">
              {[...flags.map(f => f.short), ...pactAreas(hazards)].join(' · ')}
            </div>
          </ActionTile>
        )}


        {activities.length > 0 && (
          <ActionTile
            label="Other regulatory activity"
            open={panel === 'pact'}
            onActivate={() => toggle('pact')}
            hint={panel === 'pact' ? 'Hide the PACT activities' : 'Show the PACT activities'}
          >
            <div className="fp-tile-value">{activities.length}</div>
            <div className="fp-tile-note">
              {pactAreas(activities).join(' · ')}
              {liveActivities > 0 && ` · ${liveActivities} running`}
            </div>
          </ActionTile>
        )}
          </div>
        </div>
      )}

      {panel === 'suppliers' && (
        <PanelDialog label="Suppliers (Article 95)" onClose={close}>
          <SupplierTable suppliers={suppliers} />
        </PanelDialog>
      )}

      {panel === 'flags' && pact && hazardAny > 0 && (
        <PanelDialog label="Potential hazard lists" onClose={close}>
          <PactHazards record={pact} />
        </PanelDialog>
      )}

      {panel === 'opinions' && (opinions.length > 0 || approvalAct) && (
        <PanelDialog label="Approval data" onClose={close}>
          <ApprovalDataPanel
            record={approval}
            opinions={opinions}
            retrieved={approvalMeta.retrieved}
          />
        </PanelDialog>
      )}

      {panel === 'pact' && pact && activities.length > 0 && (
        <PanelDialog label="Other regulatory activity" onClose={close}>
          <PactActivities record={pact} />
        </PanelDialog>
      )}

      {panel === 'cons' && consultations.length > 0 && (
        <PanelDialog label="Candidate for substitution" onClose={close}>
          <ConsultationPanel list={consultations} />
        </PanelDialog>
      )}

      {panel === 'ppp' && ppp && (
        <PanelDialog label="Plant-protection status" onClose={close}>
          <PppPanel record={ppp} />
        </PanelDialog>
      )}
    </>
  )
}

export default function FeedPage({
  substance,
  feed,
  onBack,
  onOpenProducts,
}: {
  substance: Substance
  /** Null for the substances no feed has been researched for yet — most of
   *  them. The standing facts above the record do not depend on it. */
  feed: SubstanceFeed | null
  onBack: () => void
  onOpenProducts: (id: string) => void
}) {
  // Newest first — DEFAULT_ORDER, shared with the all-substances page. The
  // button in the section head flips it.
  const [order, setOrder] = useState<RecordOrder>(DEFAULT_ORDER)
  // The curated feed's records and the ones derived from the Article 95 list
  // and the filing deadline, interleaved by date. A substance can have the
  // derived ones without a curated feed at all.
  const records = orderRecords(recordsFor(substance), r => r.date, order)
  const counts = tallyRecords(records)
  const ngoCount = records.filter(isNgo).length
  // The feed carries the common name; ECHA carries the systematic one. Show
  // both only when they actually differ.
  const showSystematic = feed?.name && feed.name !== substance.name

  return (
    <div className="feed-page">
      <button type="button" className="feed-back" onClick={onBack}>
        <ArrowLeftIcon />
        All substances
      </button>

      <header className="feed-page-head">
        <div className="feed-page-eyebrow">Renewal signals</div>
        <h1 className="feed-page-title">{feed?.name || substance.name}</h1>
        {showSystematic && <p className="feed-page-systematic">{substance.name}</p>}

        <div className="feed-page-meta">
          <span className={`fp-badge pt ${substance.pt.toLowerCase()}`}>{substance.pt}</span>
          {substance.approvalStatus && (
            <span
              className={`fp-badge status ${substance.approvalStatus.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {(() => {
                const Icon = STATUS_ICON[substance.approvalStatus]
                return Icon ? <Icon /> : null
              })()}
              {substance.approvalStatus}
            </span>
          )}
          <span className="sep" />
          <span className="ident">
            <span className="k">EC</span>
            {substance.ec || '—'}
          </span>
          <span className="ident">
            <span className="k">CAS</span>
            {substance.cas || '—'}
          </span>
          <span className="ident">
            <span className="k">CA</span>
            {substance.authority || '—'}
          </span>
        </div>
      </header>

      <Dashboard substance={substance} feed={feed} onOpenProducts={onOpenProducts} />

      {records.length > 0 ? (
        <>
          <div className="feed-section-head">
            <span className="feed-section-title">The record</span>
            <span className="feed-section-count">
              {records.length} entr{records.length === 1 ? 'y' : 'ies'} ·{' '}
              {order === 'asc' ? 'earliest first' : 'newest first'}
            </span>
            {records.length > 1 && (
              <button
                type="button"
                className="sig-order"
                onClick={() => setOrder(o => (o === 'asc' ? 'desc' : 'asc'))}
              >
                {order === 'asc' ? 'Newest first ↓' : 'Earliest first ↑'}
              </button>
            )}
          </div>

          {/* Every record carries its own reading; the counts are a tally of
              those, not a score. It sits at the head of the list it describes,
              and is styled apart from the cards so it cannot be mistaken for
              one of them. */}
        <div className="feed-outlook">
          <div className="feed-outlook-main">
            <span className="feed-outlook-label">How the records are tagged (AI)</span>
            <span className="feed-outlook-note">
              Each record carries an AI reading of that item alone — the research&apos;s, or
              the rule stated on the record. They are not combined into an overall
              assessment.
            </span>
          </div>

          <div className="feed-tally">
            {counts.negative > 0 && (
              <span className="feed-tally-item tone-negative">
                <b>{counts.negative}</b> negative
              </span>
            )}
            {counts.positive > 0 && (
              <span className="feed-tally-item tone-positive">
                <b>{counts.positive}</b> positive
              </span>
            )}
            {counts.neutral > 0 && (
              <span className="feed-tally-item tone-neutral">
                <b>{counts.neutral}</b> neutral
              </span>
            )}
            {/* NGO report items carry no reading, so they sit outside the tally. */}
            {ngoCount > 0 && (
              <span
                className="feed-tally-item feed-outlook-ngo"
                title="Items from NGO watch reports — indirect context, shown lighter and not tagged"
              >
                <b>{ngoCount}</b> NGO
              </span>
            )}
          </div>
        </div>

          <ol className="feed-cards">
            {records.map((r, i) => {
              // A year marker each time the year turns, in whichever direction
              // the list is running. Undated records lead the list.
              const year = r.date ? r.date.slice(0, 4) : 'Undated'
              const prev = records[i - 1]
              const turned = !prev || (prev.date ? prev.date.slice(0, 4) : 'Undated') !== year
              return (
                <Fragment key={`${r.date}-${i}`}>
                  {turned && (
                    <li className="sig-month">
                      <span className="sig-month-label">{year}</span>
                      <span className="sig-month-rule" />
                    </li>
                  )}
                  <RecordCard r={r} />
                </Fragment>
              )
            })}
          </ol>
        </>
      ) : (
        /* Said plainly, in the same words the list uses, rather than ending the
           page without explanation. */
        <div className="feed-empty">
          <span className="feed-empty-title">Signals coming soon</span>
          <span className="feed-empty-note">
            No renewal-signal research has been published for this substance yet. The
            standing facts above come from the ECHA exports and are current.
          </span>
        </div>
      )}
    </div>
  )
}
