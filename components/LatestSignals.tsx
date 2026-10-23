'use client'

import { formatPartialDate, shortName } from '@/lib/data'
import { directionTone, recordKey, type DatedRecord } from '@/lib/feeds'
import { isNgo } from '@/lib/ngoSignals'
import { recordSource } from '@/lib/categories'
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
  onOpenSubstance,
  onOpenAll,
}: {
  /** Dated, past records, newest first. */
  latest: DatedRecord[]
  recentCount: number
  recentDays: number
  /** `record` is the clicked record's key, for the page to scroll to. */
  onOpenSubstance: (id: string, record?: string) => void
  onOpenAll: (record?: string) => void
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
        <button type="button" className="latest-all" onClick={() => onOpenAll()}>
          See all signals
          <span aria-hidden="true">→</span>
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="latest-empty">No dated signals yet.</div>
      ) : (
        <ol className="latest-list">
          {rows.map(({ record, substance }, i) => {
            const ngo = isNgo(record)
            const scope = record.ngo?.scope
            const tone = ngo ? 'none' : directionTone(record.signal.direction)
            return (
              <li key={`${substance?.id ?? scope?.slug}-${record.date}-${i}`}>
                <button
                  type="button"
                  className={`latest-row ${ngo ? 'is-ngo' : ''}`}
                  // A class or horizontal item has no one page; it opens the timeline.
                  // Either way the page opens on this record, not at its top.
                  onClick={() =>
                    substance
                      ? onOpenSubstance(substance.id, recordKey(record))
                      : onOpenAll(recordKey(record))
                  }
                  title={substance ? `Open ${substance.name}` : 'Open all signals'}
                >
                  <span className={`latest-tone tone-${tone}`} aria-hidden="true" />
                  <span className="latest-date">
                    {formatPartialDate(record.date, record.datePrecision)}
                  </span>
                  <span className="latest-sub">
                    {substance ? (
                      <>
                        <span className={`pt-tag ${substance.pt.toLowerCase()}`}>{substance.pt}</span>
                        <span className="latest-sub-name">{shortName(substance)}</span>
                      </>
                    ) : (
                      <>
                        <span className={`scope-tag is-${scope?.kind}`}>
                          {scope?.kind === 'horizontal' ? 'ALL' : 'CLASS'}
                        </span>
                        <span className="latest-sub-name">
                          {scope?.kind === 'horizontal' ? 'Horizontal' : scope?.label}
                        </span>
                      </>
                    )}
                  </span>
                  <span className="latest-row-title">{record.title}</span>
                  <span className="latest-src">{recordSource(record)}</span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
