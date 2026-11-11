'use client'

import { useSyncExternalStore } from 'react'
import { StarIcon } from './icons'

// A localStorage-backed set of watched substance ids (BAS number + product type).
// Same store shape as the follow list in the Market Intelligence app.

const KEY = 'substance-watch:watchlist'
const EMPTY: string[] = []
const listeners = new Set<() => void>()
let cache: string[] | null = null

function read(): string[] {
  if (cache) return cache
  if (typeof window === 'undefined') return (cache = [])
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || '[]')
    cache = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
  } catch {
    cache = []
  }
  return cache
}

function commit(next: string[]) {
  cache = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* ignore quota / privacy-mode errors */
  }
  listeners.forEach(l => l())
}

export function toggleWatch(id: string) {
  const cur = read()
  commit(cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id])
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function useWatchlist(): string[] {
  return useSyncExternalStore(
    subscribe,
    () => read(),
    () => EMPTY,
  )
}

export function WatchButton({ id, name }: { id: string; name: string }) {
  const watched = useWatchlist()
  const on = watched.includes(id)
  return (
    <button
      type="button"
      className={`star-btn ${on ? 'is-on' : ''}`}
      aria-pressed={on}
      title={on ? `Watching ${name} — click to stop watching` : `Watch ${name}`}
      onClick={e => {
        e.preventDefault()
        e.stopPropagation()
        toggleWatch(id)
      }}
    >
      <StarIcon filled={on} className="" />
    </button>
  )
}
