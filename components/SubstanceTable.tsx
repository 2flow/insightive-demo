'use client'

import { useState } from 'react'
import type { Substance } from '@/lib/types'
import SourceNote, { type Source } from './SourceNote'
import SubstanceRow from './SubstanceRow'
import { BugIcon, ChevronDownIcon, LeafIcon } from './icons'

// One product type = one card: a band with an Expand all / Collapse all control,
// a table-header strip, then its substances as rows aligned to those columns.

// The product type isn't a column — the card's band already declares it.
// Approval start isn't either: it lives in the expanded record.
// The publications each column is read from, named on the column itself. The
// database carries the substance record; the expressions-of-interest list is a
// second, separate publication, and the renewal status draws on both — which is
// worth stating, since the two can disagree.
const ECHA_DATABASE: Source = {
  label: 'ECHA — Biocidal active substances',
  url: 'https://echa.europa.eu/information-on-chemicals/biocidal-active-substances',
}
const ECHA_INTEREST: Source = {
  label: 'ECHA — Expressions of interest in renewal (AS-RNL)',
  url: 'https://echa.europa.eu/documents/d/guest/as-rnl_expressions_of_interest_public_en',
}

const COLUMNS: { key: string; label: string; sources?: Source[] }[] = [
  { key: 'name', label: 'Substance', sources: [ECHA_DATABASE] },
  { key: 'status', label: 'Status', sources: [ECHA_DATABASE] },
  { key: 'end', label: 'Approval end', sources: [ECHA_DATABASE] },
  {
    key: 'alerts',
    label: 'Renewal status',
    sources: [
      { ...ECHA_DATABASE, note: 'assessment status and sub-status' },
      { ...ECHA_INTEREST, note: 'who has applied, and the filing deadline' },
    ],
  },
  { key: 'prospects', label: 'Renewal prospects' },
]

const PT_ICON: Record<string, React.ReactNode> = {
  PT18: <BugIcon className="" />,
  PT19: <LeafIcon className="" />,
}

export default function SubstanceTable({
  pt,
  ptName,
  rows,
  onOpenFeed,
  onOpenProducts,
}: {
  pt: string
  ptName: string
  rows: Substance[]
  onOpenFeed: (id: string) => void
  onOpenProducts: (id: string) => void
}) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const allOpen = rows.length > 0 && rows.every(r => openIds.has(r.id))

  const toggleOne = (id: string) =>
    setOpenIds(cur => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleAll = () => setOpenIds(allOpen ? new Set() : new Set(rows.map(r => r.id)))

  return (
    <div className="report-surface cat-card">
      <div className="cust-band">
        <span className={`cust-band-icon ${pt.toLowerCase()}`}>{PT_ICON[pt]}</span>
        <span className="cust-band-label">{pt}</span>
        <span className="cust-band-sub">{ptName}</span>
        <span className="cust-band-count">
          {rows.length} substance{rows.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          className={`cat-expand-all ${allOpen ? 'is-open' : ''}`}
          onClick={toggleAll}
          aria-expanded={allOpen}
        >
          {allOpen ? 'Collapse all' : 'Expand all'}
          <ChevronDownIcon className="cat-expand-all-chev" />
        </button>
      </div>

      <div className="sub-grid">
        <div className="sub-grid-head">
          <span />
          {COLUMNS.map(col => (
            <span className="sub-grid-hcell" key={col.key}>
              {col.label}
              {col.sources && <SourceNote label={col.label} sources={col.sources} />}
            </span>
          ))}
          <span />
        </div>

        {rows.map(s => (
          <SubstanceRow
            key={s.id}
            s={s}
            open={openIds.has(s.id)}
            onToggle={() => toggleOne(s.id)}
            onOpenFeed={onOpenFeed}
            onOpenProducts={onOpenProducts}
          />
        ))}
      </div>
    </div>
  )
}
