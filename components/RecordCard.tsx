'use client'

import { useId, useState } from 'react'
import { formatPartialDate, shortName } from '@/lib/data'
import { RECENT_DAYS, directionTone, isRecent, recordKey, signalLabel } from '@/lib/feeds'
import { EVIDENCE_LABEL, EVIDENCE_NOTE, categoryOf, evidenceOf } from '@/lib/categories'
import type { Evidence, SignalCategory } from '@/lib/categories'
import { classMembers, memberLabel, namesSubstance } from '@/lib/ngoSignals'
import type { FeedRecord, FeedSource, NgoScope, Substance } from '@/lib/types'
import AiTag from './AiTag'
import InfoNote from './InfoNote'
import { useToday } from './useToday'
import {
  CertificateIcon,
  ExternalIcon,
  FactoryIcon,
  FileTextIcon,
  FlaskIcon,
  GlobeIcon,
  MegaphoneIcon,
  RefreshIcon,
  ScaleIcon,
  SparkleIcon,
  UserSearchIcon,
} from './icons'

// One signal record, set at reading scale. Shared by the per-substance page and
// the all-substances timeline — the only difference is that the timeline names
// the substance the record belongs to.

/** |strength| 1–3 as three pips, so weight reads without parsing the label. */
function StrengthPips({ strength }: { strength: number }) {
  const filled = Math.min(3, Math.abs(strength))
  return (
    <span className="sig-pips" aria-hidden="true">
      {[0, 1, 2].map(i => (
        <i key={i} className={i < filled ? 'on' : ''} />
      ))}
    </span>
  )
}

function Source({ src }: { src: FeedSource }) {
  const label = src.pinpoint ? `${src.citation} — ${src.pinpoint}` : src.citation
  return (
    <div className="feed-src">
      {src.tier && <span className={`tier-badge ${src.tier.toLowerCase()}`}>{src.tier}</span>}
      {src.url ? (
        <a href={src.url} target="_blank" rel="noopener noreferrer">
          {label}
          <ExternalIcon />
        </a>
      ) : (
        <span className="feed-src-text">{label}</span>
      )}
      {src.note && <span className="feed-src-note">{src.note}</span>}
    </div>
  )
}

/** Tags that are a finding rather than a filing category, and so carry the
 *  amber the rest of the app gives a finding. The tag still says what it says;
 *  the colour only stops it reading as a filing label. */
const MARKED_TAGS = new Set(['candidate for substitution'])

/** …and the ones that carry a count, so the exact string cannot be listed. */
const MARKED_PATTERN = /minority position/

function isMarked(tag: string): boolean {
  return MARKED_TAGS.has(tag) || MARKED_PATTERN.test(tag)
}

export const CATEGORY_ICON: Record<SignalCategory, (p: { className?: string }) => JSX.Element> = {
  approval: CertificateIcon,
  renewal: RefreshIcon,
  industry: FactoryIcon,
  hazard: FlaskIcon,
  'other-eu': ScaleIcon,
  'non-eu': GlobeIcon,
  ngo: MegaphoneIcon,
}

const EVIDENCE_ICON: Record<Evidence, (p: { className?: string }) => JSX.Element> = {
  documented: FileTextIcon,
  derived: SparkleIcon,
  researched: UserSearchIcon,
}

/** What the record is about, first on every card. */
function CategoryTag({ r }: { r: FeedRecord }) {
  const c = categoryOf(r)
  const Icon = CATEGORY_ICON[c.key]
  return (
    <span className={`feed-cat band-${c.band}`} title={`${c.label} — ${c.covers}`}>
      <Icon />
      {c.label}
    </span>
  )
}

/** How the record is known. The record's own basis, where it says more than the
 *  bucket does ("absence", "inference"), rides along in the tooltip. */
function EvidenceChip({ r }: { r: FeedRecord }) {
  const e = evidenceOf(r)
  const Icon = EVIDENCE_ICON[e]
  const extra = [
    r.dateDerived && 'date worked out from context',
    r.signal.basis && r.signal.basis !== 'documented' && `basis: ${r.signal.basis}`,
  ].filter(Boolean)
  return (
    <span
      className={`feed-evidence ev-${e}`}
      title={EVIDENCE_NOTE[e] + (extra.length ? ` (${extra.join('; ')})` : '')}
    >
      <Icon />
      {EVIDENCE_LABEL[e]}
    </span>
  )
}

/** Whose record it is, on the all-substances timeline — under the header, so
 *  the category leads the card. */
function SubstanceLine({ substance, onOpen }: { substance?: Substance; onOpen?: (id: string) => void }) {
  if (!substance) return null
  return (
    <button
      type="button"
      className="feed-card-sub"
      onClick={() => onOpen?.(substance.id)}
      title={`Open ${substance.name}`}
    >
      <span className="feed-card-sub-name">{shortName(substance)}</span>
      <span className="feed-card-sub-pt">{substance.pt}</span>
    </button>
  )
}

/** A class's members, one per substance — the PT18 and PT19 rows of the same
 *  substance would otherwise list it twice. */
function distinctMembers(scope: NgoScope): Substance[] {
  const seen = new Set<string>()
  return classMembers(scope.slug).filter(s => {
    const k = s.cas || s.name
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** Says, on the card itself, that an NGO item is about a class or about every
 *  substance — so it is not read as news about the one in hand. One line; the
 *  detail, and the class's members, sit behind the ⓘ. `viewing` is the
 *  substance whose page the card is on; absent on the timeline. */
function ScopeBox({
  r,
  viewing,
  onOpen,
}: {
  r: FeedRecord
  viewing?: Substance
  onOpen?: (id: string) => void
}) {
  const scope = r.ngo?.scope
  if (!scope) return null
  const named = r.ngo?.named ?? []

  if (scope.kind === 'horizontal') {
    return (
      <div className="ngo-scope is-horizontal">
        <span className="ngo-scope-kind">Horizontal</span>
        <span className="ngo-scope-name">All substances</span>
        <InfoNote
          label="Horizontal signal"
          text="EU policy that reaches every active substance at once, rather than one substance or class. Shown on the all-signals timeline only, not on substance pages."
        >
          {named.length > 0 && (
            <span className="src-note-text">
              <b>Named in the item:</b> {named.join(', ')}
            </span>
          )}
        </InfoNote>
      </div>
    )
  }

  const members = distinctMembers(scope)
  const namesThis = viewing && namesSubstance(r, viewing)
  return (
    <div className="ngo-scope is-class">
      <span className="ngo-scope-kind">Class</span>
      <span className="ngo-scope-name">{scope.label.charAt(0).toUpperCase() + scope.label.slice(1)}</span>
      <span className="ngo-scope-text">
        {members.length} {members.length === 1 ? 'substance' : 'substances'}
        {namesThis && ` · names ${memberLabel(viewing!)}`}
      </span>
      <InfoNote
        label={`Class signal · ${scope.label}`}
        text={`About the ${scope.label} class as a whole, not one substance. Shown once on the all-signals timeline and on the page of each substance in the class.`}
      >
        {members.length > 0 && (
          <span className="ngo-scope-members">
            {members.map(m => {
              const isNamed = namesSubstance(r, m)
              const here = viewing && (viewing.cas ? viewing.cas === m.cas : viewing.id === m.id)
              return (
                <button
                  type="button"
                  key={m.id}
                  className={`${isNamed ? 'is-named' : ''} ${here ? 'is-here' : ''}`}
                  disabled={!onOpen || here}
                  onClick={() => onOpen?.(m.id)}
                  title={isNamed ? `Named in the item · ${m.name}` : m.name}
                >
                  {memberLabel(m)}
                </button>
              )
            })}
          </span>
        )}
        {named.length > 0 && (
          <span className="src-note-sub">In bold: named in the item.</span>
        )}
      </InfoNote>
    </div>
  )
}

/** Marks a record dated in the last RECENT_DAYS, at the top right of the card,
 *  so what is new stands out while reading down the timeline. */
function NewTag({ r }: { r: FeedRecord }) {
  const today = useToday()
  if (!today || !isRecent(r.date, today)) return null
  return (
    <span className="feed-new" title={`Dated within the past ${RECENT_DAYS} days`}>
      New
      <span className="feed-new-note">past {RECENT_DAYS} days</span>
    </span>
  )
}

/** The summary, collapsed to its first line with a fade until opened, so the
 *  list reads as a run of headlines. Header, title and sources stay visible. */
function Summary({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className={`feed-card-summary-wrap ${open ? 'is-open' : ''}`}>
      <p className="feed-card-summary" id={id}>
        {text}
      </p>
      <button
        type="button"
        className="feed-card-more"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(o => !o)}
      >
        {open ? 'Show less' : 'Show more'}
      </button>
    </div>
  )
}

/**
 * An item from an NGO watch report. Drawn as a lighter, smaller card than a
 * regulatory record: what campaigners say is indirect and mostly about other
 * regimes, so it is context to the record rather than part of it. It carries no
 * reading of its own — the report's "why it matters" sits behind the tier chip
 * where the reading would be.
 */
function NgoLink({ s }: { s: FeedSource }) {
  return s.url ? (
    <a href={s.url} target="_blank" rel="noopener noreferrer" title={s.citation}>
      {s.citation}
      <ExternalIcon />
    </a>
  ) : (
    <span>{s.citation}</span>
  )
}

function NgoCard({
  r,
  substance,
  viewing,
  onOpen,
}: {
  r: FeedRecord
  substance?: Substance
  viewing?: Substance
  onOpen?: (id: string) => void
}) {
  const whyId = useId()
  const ngo = r.ngo!
  const extra = ngo.extra ?? []
  const [showExtra, setShowExtra] = useState(false)
  // Reports ranked without tiers give each item its place in the list instead.
  const tierChip = ngo.tier ? `Tier ${ngo.tierName || ngo.tier}` : `#${ngo.rank}`
  return (
    <li className={`feed-card is-ngo ${ngo.tier ? `ngo-t${ngo.tier}` : ''}`} data-record-key={recordKey(r)}>
      <div className="feed-card-head">
        <CategoryTag r={r} />
        <span className="feed-card-date">{formatPartialDate(r.date, r.datePrecision)}</span>
        {r.signal.rationale ? (
          <span className="feed-why">
            <button type="button" className="ngo-chip is-why" aria-describedby={whyId}>
              {tierChip}
            </button>
            <span className="feed-why-pop" role="tooltip" id={whyId}>
              <span className="feed-why-key">
                {ngo.tier
                  ? ngo.tierLabel
                    ? `${tierChip} — ${ngo.tierLabel}`
                    : tierChip
                  : `${tierChip} in the report's ranking`}
              </span>
              <span className="feed-why-key">Why it matters (AI)</span>
              {r.signal.rationale}
            </span>
          </span>
        ) : (
          <span className="ngo-chip" title={ngo.tier ? ngo.tierLabel : 'Rank in the report'}>
            {tierChip}
          </span>
        )}
        <EvidenceChip r={r} />
        {ngo.org && <span className="ngo-org">{ngo.org}</span>}
        {r.ai && <AiTag source={r.ai} />}
        <NewTag r={r} />
      </div>
      {/* The report's own tags. The two that put an item squarely on the BPR
          file — the regime itself, or a direct carry-over — are marked. */}
      {r.tags.length > 0 && (
        <div className="ngo-tags">
          {r.tags.map(tag => (
            <span className={`ngo-tag ${/^(bpr|direct)$/i.test(tag) ? 'is-marked' : ''}`} key={tag}>
              {tag}
            </span>
          ))}
        </div>
      )}
      <SubstanceLine substance={substance} onOpen={onOpen} />
      <ScopeBox r={r} viewing={viewing} onOpen={onOpen} />

      <h3 className="feed-card-title">{r.title}</h3>
      {r.summary && <Summary text={r.summary} />}

      {(r.sources.length > 0 || extra.length > 0) && (
        <div className="ngo-sources">
          {r.sources.map((s, i) => (
            <NgoLink s={s} key={i} />
          ))}
          {/* Supporting material stays folded away: the main source is what
              the item rests on; these back it up. */}
          {extra.length > 0 && (
            <button
              type="button"
              className="ngo-extra-toggle"
              aria-expanded={showExtra}
              onClick={() => setShowExtra(v => !v)}
            >
              {showExtra ? 'Hide supporting' : `+${extra.length} supporting`}
            </button>
          )}
        </div>
      )}
      {showExtra && (
        <div className="ngo-sources ngo-extra">
          <span className="ngo-extra-label">Supporting material</span>
          {extra.map((s, i) => (
            <NgoLink s={s} key={i} />
          ))}
        </div>
      )}
    </li>
  )
}

export default function RecordCard({
  r,
  substance,
  viewing,
  onOpen,
}: {
  r: FeedRecord
  /** Set on the all-substances timeline, where a record needs to say whose it
   *  is. Omitted on a substance's own page, where that is already the title. */
  substance?: Substance
  /** The substance whose own page the card is on. */
  viewing?: Substance
  onOpen?: (id: string) => void
}) {
  const tone = directionTone(r.signal.direction)
  const whyId = useId()
  if (r.ngo) return <NgoCard r={r} substance={substance} viewing={viewing} onOpen={onOpen} />
  return (
    <li className={`feed-card tone-${tone}`} data-record-key={recordKey(r)}>
      <div className="feed-card-head">
        <CategoryTag r={r} />
        {/* Where the date is not the day the thing happened, the emphasis
            swaps: the date recedes and the note that says what it stands for
            carries the weight. */}
        <span className={`feed-card-date ${r.dateNote ? 'is-approx' : ''}`}>
          {r.dateNote && '~ '}
          {formatPartialDate(r.date, r.datePrecision)}
        </span>
        {r.dateNote && (
          <span className="feed-card-datenote">
            ({r.dateNote})
            {r.dateNoteInfo && <InfoNote label={r.dateNote} text={r.dateNoteInfo} />}
          </span>
        )}
        {/* The reading sits on the badge that states it: hover or focus the
            signal and the reasoning comes up over the card, instead of a block
            of AI prose between every record and its sources. */}
        {r.signal.rationale ? (
          <span className="feed-why">
            <button
              type="button"
              className={`feed-signal tone-${tone} is-why`}
              aria-describedby={whyId}
            >
              <StrengthPips strength={r.signal.strength} />
              {signalLabel(r)}
            </button>
            <span className="feed-why-pop" role="tooltip" id={whyId}>
              <span className="feed-why-key">Why this reading (AI)</span>
              {r.signal.rationale}
            </span>
          </span>
        ) : (
          <span className={`feed-signal tone-${tone}`}>
            <StrengthPips strength={r.signal.strength} />
            {signalLabel(r)}
          </span>
        )}
        {r.blockers.map(bl => (
          <span className="feed-chip blocker" key={bl} title="A finding or open question that could block or slow the renewal">
            {bl}
          </span>
        ))}
        <EvidenceChip r={r} />
        {r.ai && <AiTag source={r.ai} />}
        {r.tags.map(t => (
          <span className={`feed-chip tag ${isMarked(t) ? 'is-marked' : ''}`} key={t}>
            {t}
          </span>
        ))}
        <NewTag r={r} />
      </div>
      <SubstanceLine substance={substance} onOpen={onOpen} />

      <h3 className="feed-card-title">{r.title}</h3>
      {r.summary && <Summary text={r.summary} />}

      {r.sources.length > 0 && (
        <div className="feed-card-sources">
          <div className="feed-sources-label">
            {r.sources.length === 1 ? 'Source' : `Sources · ${r.sources.length}`}
          </div>
          {r.sources.map((s, i) => (
            <Source src={s} key={i} />
          ))}
        </div>
      )}
    </li>
  )
}
