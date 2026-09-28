'use client'

import { useEffect, useRef, useState } from 'react'
import { ExternalIcon, InfoIcon } from './icons'

// Where a column's values come from, next to the column that shows them.
//
// A tooltip can't hold a link, so this is a small popover: click the ⓘ, get the
// publication the column is read from. Two columns draw on two sources, and
// naming both is the point — the renewal status disagrees with itself often
// enough that knowing which publication said what matters.

export interface Source {
  label: string
  /** Empty where the publication has no page we have been able to verify — the
   *  source is still named, it just isn't a link. */
  url: string
  /** What this source supplies, where a column draws on more than one. */
  note?: string
}

export default function SourceNote({
  label,
  sources,
  intro,
}: {
  label: string
  sources: Source[]
  /** A sentence before the links, where the list of them needs explaining —
   *  what was checked, rather than only what it returned. */
  intro?: string
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLSpanElement>(null)

  // Click anywhere else, or press Escape, and it closes.
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  return (
    <span className="src-note" ref={box}>
      <button
        type="button"
        className={`src-note-btn ${open ? 'is-open' : ''}`}
        aria-expanded={open}
        aria-label={`Where "${label}" comes from`}
        title={`Where "${label}" comes from`}
        onClick={e => {
          e.stopPropagation()
          setOpen(v => !v)
        }}
      >
        <InfoIcon />
      </button>

      {open && (
        <span className="src-note-pop" role="dialog" aria-label={`Sources for ${label}`}>
          <span className="src-note-head">
            {sources.length === 1 ? 'Source' : `Sources · ${sources.length}`}
          </span>
          {intro && <span className="src-note-text">{intro}</span>}
          {sources.map((s, i) =>
            s.url ? (
              <a
                key={s.url}
                className="src-note-link"
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="src-note-label">
                  {s.label}
                  <ExternalIcon />
                </span>
                {s.note && <span className="src-note-sub">{s.note}</span>}
              </a>
            ) : (
              <span className="src-note-link is-plain" key={`${s.label}-${i}`}>
                <span className="src-note-label">{s.label}</span>
                {s.note && <span className="src-note-sub">{s.note}</span>}
              </span>
            )
          )}
        </span>
      )}
    </span>
  )
}
