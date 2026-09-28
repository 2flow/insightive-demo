'use client'

import { Fragment, useMemo, useState } from 'react'
import { formatDate, substances } from '@/lib/data'
import { DEFAULT_ORDER, RECORD_KINDS, allRecords, orderRecords, tallyRecords } from '@/lib/feeds'
import type { RecordOrder } from '@/lib/feeds'
import RecordCard from './RecordCard'
import { ArrowLeftIcon } from './icons'

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

export default function SignalsPage({
  onBack,
  onOpenSubstance,
}: {
  onBack: () => void
  onOpenSubstance: (id: string) => void
}) {
  const [order, setOrder] = useState<RecordOrder>(DEFAULT_ORDER)
  // Empty means everything. Selecting kinds narrows to those; the chips carry
  // their own counts so the reader can see what filtering would cost.
  const [kinds, setKinds] = useState<Set<string>>(new Set())

  const all = useMemo(() => allRecords(substances), [])

  const perKind = useMemo(() => {
    const n = new Map<string, number>()
    for (const r of all) n.set(r.record.kind ?? 'research', (n.get(r.record.kind ?? 'research') ?? 0) + 1)
    return n
  }, [all])

  const shown = useMemo(
    () => (kinds.size === 0 ? all : all.filter(r => kinds.has(r.record.kind ?? 'research'))),
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
  const first = dated[0]
  const last = dated[dated.length - 1]
  const subjects = new Set(shown.map(r => r.substance.id)).size

  return (
    <div className="feed-page">
      <button type="button" className="feed-back" onClick={onBack}>
        <ArrowLeftIcon />
        All substances
      </button>

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
        {RECORD_KINDS.filter(k => perKind.get(k.kind)).map(k => (
          <button
            type="button"
            key={k.kind}
            className={`sig-chip ${kinds.has(k.kind) ? 'is-on' : ''}`}
            aria-pressed={kinds.has(k.kind)}
            onClick={() => toggle(k.kind)}
          >
            {k.label}
            <span className="sig-chip-n">{perKind.get(k.kind)}</span>
          </button>
        ))}
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
        <div className="feed-outlook-main">
          <span className="feed-outlook-label">How the records are tagged (AI)</span>
          <span className="feed-outlook-note">
            Each record carries an AI reading of that item alone — the research&apos;s, or
            the rule stated on the record. They are not combined, here or anywhere else.
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
            <Fragment key={`${substance.id}-${record.date}-${i}`}>
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
