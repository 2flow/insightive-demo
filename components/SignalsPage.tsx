'use client'

import { Fragment, useMemo, useState } from 'react'
import { formatDate, substances } from '@/lib/data'
import { DEFAULT_ORDER, allRecords, orderRecords, tallyRecords } from '@/lib/feeds'
import { BANDS, CATEGORIES, categoryOf, topSources } from '@/lib/categories'
import { isNgo } from '@/lib/ngoSignals'
import type { RecordOrder } from '@/lib/feeds'
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

export default function SignalsPage({
  onOpenSubstance,
}: {
  onOpenSubstance: (id: string) => void
}) {
  const [order, setOrder] = useState<RecordOrder>(DEFAULT_ORDER)
  // Empty means everything. Selecting categories narrows to those; the chips carry
  // their own counts so the reader can see what filtering would cost.
  const [kinds, setKinds] = useState<Set<string>>(new Set())

  const all = useMemo(() => allRecords(substances), [])

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

  return (
    <div className="feed-page">
      <header className="feed-page-head">
        <div className="feed-page-eyebrow">Renewal signals</div>
        <h1 className="feed-page-title">All signals</h1>
        <p className="feed-page-systematic">
          Every record held against every substance, on one timeline.
        </p>

        <div className="feed-page-meta">
          <span className="ident">
            <span className="k">RECORDS</span>
            {shown.length}
            {kinds.size > 0 && <span className="ident-of">of {all.length}</span>}
          </span>
          <span className="ident">
            <span className="k">SUBSTANCES</span>
            {subjects}
          </span>
          {first && last && (
            <span className="ident">
              <span className="k">SPAN</span>
              {formatDate(first)} — {formatDate(last)}
            </span>
          )}
        </div>
      </header>

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
        {BANDS.map(b => {
          const cats = CATEGORIES.filter(c => c.band === b.band && perKind.get(c.key))
          if (cats.length === 0) return null
          return (
            <span className={`sig-filter-band band-${b.band}`} key={b.band} title={b.note}>
              <span className="sig-filter-band-label">{b.label}</span>
              {cats.map(c => {
                const Icon = CATEGORY_ICON[c.key]
                return (
                  <button
                    type="button"
                    key={c.key}
                    className={`sig-chip ${kinds.has(c.key) ? 'is-on' : ''}`}
                    aria-pressed={kinds.has(c.key)}
                    title={c.covers}
                    onClick={() => toggle(c.key)}
                  >
                    <Icon className="sig-chip-icon" />
                    {c.label}
                    <span className="sig-chip-n">{perKind.get(c.key)}</span>
                    {!!sources.get(c.key)?.length && (
                      <span
                        className="sig-chip-src"
                        title="Main sources only, not an exhaustive list"
                      >
                        incl. {sources.get(c.key)!.join(' · ')}
                      </span>
                    )}
                  </button>
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
          {kinds.size > 0 && ` of ${all.length}`} · {order === 'asc' ? 'earliest first' : 'newest first'}
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
