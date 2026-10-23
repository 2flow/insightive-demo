'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { InfoIcon } from './icons'

// A sentence of explanation behind an ⓘ, for a value that needs one. Opens on
// hover; a click keeps it open.
//
// The same popover as SourceNote, which answers "where does this come from?"
// with links. This one answers "what does this date stand for?" with prose, so
// the explanation sits beside the thing it explains instead of lengthening
// every card that carries it.

export default function InfoNote({
  label,
  text,
  children,
  trigger,
  className = '',
}: {
  label: string
  text?: string
  /** Shown in place of the ⓘ — e.g. an "AI" tag that opens its own note. */
  trigger?: ReactNode
  className?: string
  /** Richer content under the text — a list, links. */
  children?: ReactNode
}) {
  // Hovering shows it; a click pins it open, for touch and for reading the
  // links inside without keeping the pointer still.
  const [pinned, setPinned] = useState(false)
  const [hover, setHover] = useState(false)
  const open = pinned || hover
  const box = useRef<HTMLSpanElement>(null)
  const pop = useRef<HTMLSpanElement>(null)
  // How far the popover is nudged sideways to stay inside the window — it
  // opens to the right of the ⓘ, which near the right edge would cut it off.
  const [shift, setShift] = useState(0)
  const leaving = useRef<ReturnType<typeof setTimeout>>()

  const enter = () => {
    clearTimeout(leaving.current)
    setHover(true)
  }
  // A short grace period, so the pointer can cross the gap to the popover.
  const leave = () => {
    clearTimeout(leaving.current)
    leaving.current = setTimeout(() => setHover(false), 150)
  }
  useEffect(() => () => clearTimeout(leaving.current), [])

  useLayoutEffect(() => {
    if (!open) {
      setShift(0)
      return
    }
    const el = pop.current
    if (!el) return
    const margin = 12
    const r = el.getBoundingClientRect()
    const left = r.left - shift
    const right = r.right - shift
    const width = document.documentElement.clientWidth
    let next = 0
    if (right > width - margin) next = width - margin - right
    if (left + next < margin) next = margin - left
    if (next !== shift) setShift(next)
    // Measured once per opening; the content does not change while it is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Click anywhere else, or press Escape, and it closes.
  useEffect(() => {
    if (!open) return
    const close = () => {
      setPinned(false)
      setHover(false)
    }
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) close()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  return (
    <span className="src-note" ref={box} onMouseEnter={enter} onMouseLeave={leave}>
      <button
        type="button"
        className={`src-note-btn ${className} ${open ? 'is-open' : ''}`}
        aria-expanded={open}
        aria-label={`What “${label}” means`}
        onClick={e => {
          e.stopPropagation()
          setPinned(v => !v)
        }}
      >
        {trigger ?? <InfoIcon />}
      </button>

      {open && (
        <span
          className="src-note-pop"
          role="dialog"
          aria-label={label}
          ref={pop}
          style={shift ? { transform: `translateX(${shift}px)` } : undefined}
        >
          <span className="src-note-head">{label}</span>
          {text && <span className="src-note-text">{text}</span>}
          {children}
        </span>
      )}
    </span>
  )
}
