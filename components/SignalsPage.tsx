'use client'

import { Fragment, useMemo, useState } from 'react'
import { formatDate, shortName, substances } from '@/lib/data'
import { DEFAULT_ORDER, allRecords, orderRecords, tallyRecords } from '@/lib/feeds'
import { CATEGORIES, categoryOf, topSources } from '@/lib/categories'
import type { CategoryDef, SignalCategory } from '@/lib/categories'
import { classMembers, isNgo } from '@/lib/ngoSignals'
import { classLabel } from '@/lib/classes'
import type { RecordOrder } from '@/lib/feeds'
import type { Substance } from '@/lib/types'
import { ArrowLeftIcon } from './icons'
import InfoNote from './InfoNote'
import RecordCard, { CATEGORY_ICON } from './RecordCard'

// Every signal across every substance on one timeline, oldest first. The
// per-substance pages answer "what has happened to this substance"; this one
// answers "what has been happening", which is a different question — so the
// default order is the one a timeline wants, earliest to latest.

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** The month each record falls in, used to break the run into readable bands.
 *  A few curated records are standing observations rather than dated events. */
const monthOf = (iso: string) => (iso ? iso.slice(0, 7) : 'undated')

function monthLabel(key: string): string {
  if (key === 'undated') return 'Undated'
  const [y, m] = key.split('-')
  return `${MONTHS[Number(m) - 1]} ${y}`
}

/** Behind the ⓘ beside the tally. */
const TALLY_NOTE =
  'Each card’s direction and strength is a reading of that one item — set by the research for researched records, or by a fixed rule for records built from ECHA and EUR-Lex data. These counts just add them up; the app never combines them into an overall verdict.'

/** Class members, the next approval to run out first; undated last. */
function byEndDate(a: Substance, b: Substance): number {
  if (!a.endDate !== !b.endDate) return a.endDate ? -1 : 1
  return a.endDate.localeCompare(b.endDate) || a.name.localeCompare(b.name)
}

/** The filter's two rows: the BPR facts, then everything that bears on them.
 *  The second row mixes EU evidence and context, ordered so like sits by like:
 *  the two hazard findings together. Context chips keep their dashed edge. */
const FILTER_ROWS: { label: string; keys: SignalCategory[] }[] = [
  { label: 'Primary', keys: ['approval', 'renewal', 'supplier', 'industry'] },
  { label: 'Secondary', keys: ['ngo', 'hazard', 'non-eu', 'ppp', 'other-eu'] },
]

export default function SignalsPage({
  classSlug,
  onOpenSubstance,
}: {
  /** Narrows the timeline to one chemical class: its members' records and the
   *  class's own NGO items. */
  classSlug?: string
  onOpenSubstance: (id: string) => void
}) {
  const [order, setOrder] = useState<RecordOrder>(DEFAULT_ORDER)
  // Empty means everything. Selecting categories narrows to those; the chips carry
  // their own counts so the reader can see what filtering would cost.
  const [kinds, setKinds] = useState<Set<string>>(new Set())
  // Class mode only: one member picked from the strip.
  const [member, setMember] = useState<string | null>(null)

  const label = classSlug ? classLabel(classSlug) : ''
  const members = useMemo(
    () => (classSlug ? classMembers(classSlug).slice().sort(byEndDate) : null),
    [classSlug],
  )

  const classAll = useMemo(() => {
    if (!members) return allRecords(substances)
    // allRecords adds every class's shared NGO items, and the EU-wide ones
    // that reach every class alike; keep only this class's.
    return allRecords(members).filter(
      ({ record, substance }) => !!substance || record.ngo?.scope?.slug === classSlug,
    )
  }, [members, classSlug])

  const all = useMemo(
    () => (member ? classAll.filter(r => r.substance?.id === member) : classAll),
    [classAll, member],
  )

  const perMember = useMemo(() => {
    const n = new Map<string, number>()
    for (const r of classAll) if (r.substance) n.set(r.substance.id, (n.get(r.substance.id) ?? 0) + 1)
    return n
  }, [classAll])

  const perKind = useMemo(() => {
    const n = new Map<string, number>()
    for (const r of all) {
      const c = categoryOf(r.record).key
      n.set(c, (n.get(c) ?? 0) + 1)
    }
    return n
  }, [all])

  // Over every record, not the filtered few, so a chip's sources stay put.
  const sources = useMemo(() => topSources(all.map(r => r.record)), [all])

  const shown = useMemo(
    () => (kinds.size === 0 ? all : all.filter(r => kinds.has(categoryOf(r.record).key))),
    [all, kinds],
  )
  const rows = useMemo(() => orderRecords(shown, r => r.record.date, order), [shown, order])
  const dated = useMemo(
    () => shown.filter(r => r.record.date).map(r => r.record.date).sort(),
    [shown],
  )

  const toggle = (kind: string) =>
    setKinds(prev => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })

  const counts = tallyRecords(shown.map(r => r.record))
  const ngoCount = shown.filter(r => isNgo(r.record)).length
  const first = dated[0]
  const last = dated[dated.length - 1]
  const subjects = new Set(shown.flatMap(r => (r.substance ? [r.substance.id] : []))).size

  if (classSlug && (!label || !members?.length)) {
    return (
      <div className="feed-page">
        <header className="feed-page-head">
          <div className="feed-page-eyebrow">Class signals</div>
          <h1 className="feed-page-title">Unknown class</h1>
          <p className="feed-page-systematic">No chemical class is filed under “{classSlug}”.</p>
        </header>
      </div>
    )
  }

  const title = label ? label.charAt(0).toUpperCase() + label.slice(1) : 'All signals'

  return (
    <div className="feed-page">
      {members && (
        <a className="feed-back" href="#signals">
          <ArrowLeftIcon />
          All signals
        </a>
      )}

      <header className="feed-page-head">
        <div className="feed-page-eyebrow">{members ? 'Class signals' : 'Renewal signals'}</div>
        <h1 className="feed-page-title">{title}</h1>
        <p className="feed-page-systematic">
          {members
            ? `Every record held against the ${members.length} substance${members.length === 1 ? '' : 's'} in the class, with the class’s own NGO watch items, on one timeline.`
            : 'Every record held against every substance, on one timeline.'}
        </p>

        <div className="feed-page-meta">
          <span className="ident">
            <span className="k">RECORDS</span>
            {shown.length}
            {(kinds.size > 0 || member) && (
              <span className="ident-of">of {classAll.length}</span>
            )}
          </span>
          <span className="ident">
            <span className="k">{members ? 'MEMBERS' : 'SUBSTANCES'}</span>
            {members ? members.length : subjects}
          </span>
          {first && last && (
            <span className="ident">
              <span className="k">SPAN</span>
              {formatDate(first)} — {formatDate(last)}
            </span>
          )}
        </div>
      </header>

      {/* The members, next to run out first: where each stands, and how much
          of the timeline is theirs. Picking one narrows the timeline to it. */}
      {members && (
        <div className="cls-members" role="group" aria-label="Class members">
          {members.map(s => {
            const on = member === s.id
            return (
              <button
                type="button"
                key={s.id}
                className={`cls-member ${on ? 'is-on' : ''}`}
                aria-pressed={on}
                title={on ? 'Show every member again' : `Show only ${s.name}`}
                onClick={() => setMember(on ? null : s.id)}
              >
                <span className="cls-member-name">
                  {shortName(s)}
                  <span className="cls-member-pt">{s.pt}</span>
                </span>
                <span className="cls-member-meta">
                  <span className={`cls-member-status st-${s.approvalStatus.toLowerCase().replace(/\s+/g, '-')}`}>
                    {s.approvalStatus || '—'}
                  </span>
                  {s.endDate && <span>to {formatDate(s.endDate)}</span>}
                </span>
                <span className="cls-member-n">
                  {perMember.get(s.id) ?? 0} signal{perMember.get(s.id) === 1 ? '' : 's'}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="sig-filters" role="group" aria-label="Filter by signal">
        <span className="sig-filters-label">Show</span>
        <button
          type="button"
          className={`sig-chip ${kinds.size === 0 ? 'is-on' : ''}`}
          aria-pressed={kinds.size === 0}
          onClick={() => setKinds(new Set())}
        >
          Everything
          <span className="sig-chip-n">{all.length}</span>
        </button>
        {FILTER_ROWS.map(row => {
          const cats = row.keys
            .map(k => CATEGORIES.find(c => c.key === k))
            .filter((c): c is CategoryDef => !!c && !!perKind.get(c.key))
          if (cats.length === 0) return null
          return (
            <span className="sig-filter-band" key={row.label}>
              <span className="sig-filter-band-label">{row.label}</span>
              {cats.map(c => {
                const Icon = CATEGORY_ICON[c.key]
                const src = sources.get(c.key) ?? []
                // What the category covers and where its records come from, in
                // an overlay on hover or focus, so the chip itself stays short.
                return (
                  <span className="sig-chip-wrap" key={c.key}>
                    <button
                      type="button"
                      className={`sig-chip band-${c.band} ${kinds.has(c.key) ? 'is-on' : ''}`}
                      aria-pressed={kinds.has(c.key)}
                      aria-describedby={`sig-pop-${c.key}`}
                      onClick={() => toggle(c.key)}
                    >
                      <Icon className="sig-chip-icon" />
                      {c.label}
                      <span className="sig-chip-n">{perKind.get(c.key)}</span>
                    </button>
                    <span className="sig-chip-pop" role="tooltip" id={`sig-pop-${c.key}`}>
                      <span className="sig-chip-pop-key">Covers</span>
                      {c.covers}
                      {src.length > 0 && (
                        <>
                          <span className="sig-chip-pop-key">Sources</span>
                          {src.join(' · ')}
                          <span className="sig-chip-pop-note">Main sources only, not an exhaustive list.</span>
                        </>
                      )}
                    </span>
                  </span>
                )
              })}
            </span>
          )
        })}
      </div>

      <div className="feed-section-head">
        <span className="feed-section-title">The record</span>
        <span className="feed-section-count">
          {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
          {(kinds.size > 0 || member) && ` of ${classAll.length}`} · {order === 'asc' ? 'earliest first' : 'newest first'}
        </span>
        <button
          type="button"
          className="sig-order"
          onClick={() => setOrder(o => (o === 'asc' ? 'desc' : 'asc'))}
        >
          {order === 'asc' ? 'Newest first ↓' : 'Earliest first ↑'}
        </button>
      </div>

      {/* At the head of the list it describes, and styled apart from the cards
          so it cannot be mistaken for one of them. */}
      <div className="feed-outlook">
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
              title="Items from NGO watch reports — indirect context, not tagged"
            >
              <b>{ngoCount}</b> NGO
            </span>
          )}
          <InfoNote label="How the records are tagged" text={TALLY_NOTE} />
        </div>
      </div>

      <ol className="feed-cards">
        {rows.map(({ record, substance }, i) => {
          // A month marker each time the month turns — in whichever direction
          // the list happens to be running.
          const prev = rows[i - 1]
          const month = monthOf(record.date)
          const turned = !prev || monthOf(prev.record.date) !== month
          return (
            <Fragment key={`${substance?.id ?? record.ngo?.scope?.slug}-${record.date}-${i}`}>
              {turned && (
                <li className="sig-month">
                  <span className="sig-month-label">{monthLabel(month)}</span>
                  <span className="sig-month-rule" />
                </li>
              )}
              <RecordCard r={record} substance={substance} onOpen={onOpenSubstance} />
            </Fragment>
          )
        })}
      </ol>
    </div>
  )
}
