'use client'

import { daysUntil, endCountdown, formatDate, shortName, substances } from '@/lib/data'
import type { Substance } from '@/lib/types'
import { RenewalStatusChips } from './SubstanceRow'
import { BugIcon, ClockIcon, LeafIcon } from './icons'

// The Overview's second card, beside Latest signals: the approvals running out
// soonest. 550 days is the BPR's own horizon — a renewal application is due at
// least 550 days before the approval expires (Article 13(1)) — so anything
// inside it is a file where the renewal question is live now. One block per
// product type, soonest first; the full list is a click away.

const WINDOW_DAYS = 550

const PT_ICON: Record<string, JSX.Element> = { PT18: <BugIcon />, PT19: <LeafIcon /> }

/** Still running, and ending within the window. Expired approvals have no
 *  time left to show and sit in the full list. */
const expiring = substances
  .filter(s => {
    if (!s.endDate || s.approvalStatus === 'Expired') return false
    const d = daysUntil(s.endDate)
    return d >= 0 && d < WINDOW_DAYS
  })
  .sort((a, b) => (a.endDate < b.endDate ? -1 : a.endDate > b.endDate ? 1 : 0))

const groups = Array.from(new Set(substances.map(s => s.pt)))
  .sort()
  .map(pt => ({
    pt,
    ptName: substances.find(s => s.pt === pt)?.ptName ?? '',
    rows: expiring.filter(s => s.pt === pt),
  }))

export default function ExpiringSubstances({
  onOpenSubstance,
  onOpenAll,
}: {
  onOpenSubstance: (id: string) => void
  onOpenAll: () => void
}) {
  return (
    <section className="latest expiring report-surface" aria-labelledby="expiring-title">
      <div className="latest-head">
        <span className="latest-icon is-warn">
          <ClockIcon />
        </span>
        <h2 className="latest-title" id="expiring-title">
          Substance approvals ending soon
        </h2>
        <span className="latest-new">
          <b>{expiring.length}</b> within {WINDOW_DAYS} days
        </span>
        <button type="button" className="latest-all" onClick={onOpenAll}>
          See all substances
          <span aria-hidden="true">→</span>
        </button>
      </div>

      {groups.map(g => (
        <div className="exp-group" key={g.pt}>
          <div className="exp-group-head">
            <span className={`cust-band-icon ${g.pt.toLowerCase()}`}>{PT_ICON[g.pt]}</span>
            <span className="exp-group-pt">{g.pt}</span>
            <span className="exp-group-name">{g.ptName}</span>
            <span className="exp-group-count">{g.rows.length}</span>
          </div>
          {g.rows.length === 0 ? (
            <div className="latest-empty">No approval ends within {WINDOW_DAYS} days.</div>
          ) : (
            <ol className="latest-list exp-list">
              {g.rows.map(s => (
                <li key={s.id}>
                  <ExpiringRow s={s} onOpen={onOpenSubstance} />
                </li>
              ))}
            </ol>
          )}
        </div>
      ))}
    </section>
  )
}

function ExpiringRow({ s, onOpen }: { s: Substance; onOpen: (id: string) => void }) {
  const left = endCountdown(s.endDate)
  return (
    // A div rather than a button: the status chips are block content, which a
    // button may not hold.
    <div
      role="button"
      tabIndex={0}
      className="exp-row"
      onClick={() => onOpen(s.id)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(s.id)
        }
      }}
      title={`Open ${s.name}`}
    >
      <span className="exp-name">{shortName(s)}</span>
      <span className="exp-end">
        <span className="date-val">{formatDate(s.endDate)}</span>
        {left && <span className={`countdown ${left.tone}`}>{left.text}</span>}
      </span>
      <div className="exp-status">
        <RenewalStatusChips s={s} />
      </div>
    </div>
  )
}
