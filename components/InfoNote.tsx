'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { InfoIcon } from './icons'

// A sentence of explanation behind an ⓘ, for a value that needs one.
//
// The same popover as SourceNote, which answers "where does this come from?"
// with links. This one answers "what does this date stand for?" with prose, so
// the explanation sits beside the thing it explains instead of lengthening
// every card that carries it.

export default function InfoNote({
  label,
  text,
  children,
}: {
  label: string
  text?: string
  /** Richer content under the text — a list, links. */
  children?: ReactNode
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
        aria-label={`What “${label}” means`}
        title={`What “${label}” means`}
        onClick={e => {
          e.stopPropagation()
          setOpen(v => !v)
        }}
      >
        <InfoIcon />
      </button>

      {open && (
        <span className="src-note-pop" role="dialog" aria-label={label}>
          <span className="src-note-head">{label}</span>
          {text && <span className="src-note-text">{text}</span>}
          {children}
        </span>
      )}
    </span>
  )
}
