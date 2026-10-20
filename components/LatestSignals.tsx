'use client'

import { formatPartialDate } from '@/lib/data'
import { directionTone, type DatedRecord } from '@/lib/feeds'
import { isNgo } from '@/lib/ngoSignals'
import { PulseIcon } from './icons'

// The head of the all-signals timeline, on the home page. Keeping up with what
// has changed is the main reason to open the app, so the newest records lead
// the page rather than sitting behind a link. One line per record; the full
// card is a click away on the substance's own page.

const SHOWN = 6

export default function LatestSignals({
  latest,
  recentCount,
  recentDays,
  total,
  onOpenSubstance,
  onOpenAll,
}: {
  /** Dated, past records, newest first. */
  latest: DatedRecord[]
  recentCount: number
  recentDays: number
  total: number
  onOpenSubstance: (id: string) => void
  onOpenAll: () => void
}) {
  const rows = latest.slice(0, SHOWN)

  return (
    <section className="latest" aria-labelledby="latest-title">
      <div className="latest-head">
        <span className="latest-icon">
          <PulseIcon />
        </span>
        <h2 className="latest-title" id="latest-title">
          Latest signals
        </h2>
        <span className={`latest-new ${recentCount > 0 ? 'has-new' : ''}`}>
          <b>{recentCount}</b> in the last {recentDays} days
        </span>
        <button type="button" className="latest-all" onClick={onOpenAll}>
          See all {total} signals
          <span aria-hidden="true">→</span>
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="latest-empty">No dated signals yet.</div>
      ) : (
        <ol className="latest-list">
          {rows.map(({ record, substance }, i) => {
            const ngo = isNgo(record)
            const tone = ngo ? 'none' : directionTone(record.signal.direction)
            return (
              <li key={`${substance.id}-${record.date}-${i}`}>
                <button
                  type="button"
                  className={`latest-row ${ngo ? 'is-ngo' : ''}`}
                  onClick={() => onOpenSubstance(substance.id)}
                  title={`Open ${substance.name}`}
                >
                  <span className={`latest-tone tone-${tone}`} aria-hidden="true" />
                  <span className="latest-date">
                    {formatPartialDate(record.date, record.datePrecision)}
                  </span>
                  <span className="latest-sub">
                    <span className={`pt-tag ${substance.pt.toLowerCase()}`}>{substance.pt}</span>
                    <span className="latest-sub-name">{substance.name}</span>
                  </span>
                  <span className="latest-row-title">{record.title}</span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
