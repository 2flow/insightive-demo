'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './icons'

// The panels a dashboard tile opens, shown over the page rather than under it.
//
// They used to unfold below the tiles, which put the answer several hundred
// pixels from the question and pushed the record down the page — and with four
// bands of tiles, a panel could open two bands away from the tile that asked
// for it. Over the page the two stay together.
//
// Rendered through a portal so the overlay is a child of <body>: a fixed
// element inside a transformed ancestor is positioned against that ancestor
// instead of the viewport, and the page has several.

export default function PanelDialog({
  label,
  onClose,
  children,
}: {
  /** Names the dialog for assistive technology. The panel inside carries its
   *  own visible heading, so this is not repeated on screen. */
  label: string
  onClose: () => void
  children: React.ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const closer = useRef<HTMLButtonElement>(null)

  useEffect(() => setMounted(true), [])

  // Escape closes it, focus starts on the close button, and the page behind
  // stops scrolling while it is open.
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', key)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closer.current?.focus()
    return () => {
      document.removeEventListener('keydown', key)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  if (!mounted) return null

  return createPortal(
    <div
      className="fp-modal-back"
      onMouseDown={e => {
        // Only a click on the backdrop itself — not one that started inside
        // the panel and drifted out while selecting text.
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="fp-modal" role="dialog" aria-modal="true" aria-label={label} ref={box}>
        <button
          type="button"
          className="fp-modal-close"
          onClick={onClose}
          aria-label="Close"
          title="Close"
          ref={closer}
        >
          <CloseIcon />
        </button>
        <div className="report-surface fp-modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
