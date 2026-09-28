'use client'

import { useEffect, useState } from 'react'
import { ChevronDownIcon, CloseIcon, SearchIcon, SortIcon, StarIcon } from './icons'

// Grouped filter controls: every filter group is shown up front as a pill
// (icon + name + selected value(s), or "All"). Clicking a pill opens its value
// checklist. Sort is the same pill, single-select.

export interface FilterOption {
  value: string
  label: string
  short?: string // compact label for the pill (e.g. "≤12 mo")
}
export interface FilterProperty {
  key: string
  label: string
  icon: React.ReactNode
  selected: Set<string>
  toggle: (value: string) => void
  clear: () => void
  options: FilterOption[]
}

function summarize(p: FilterProperty): string {
  const labels = Array.from(p.selected).map(v => {
    const o = p.options.find(o => o.value === v)
    return o?.short ?? o?.label ?? v
  })
  if (labels.length === 0) return 'All'
  if (labels.length <= 2) return labels.join(', ')
  return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`
}

function Popover({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  // Escape closes it, like the click-away layer does.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute left-0 top-full z-40 mt-1.5 min-w-[210px] max-w-[320px] rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
        {children}
      </div>
    </>
  )
}

function ValueEditor({ p }: { p: FilterProperty }) {
  return (
    <div className="py-0.5">
      {p.options.map(o => {
        const on = p.selected.has(o.value)
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => p.toggle(o.value)}
            className="flex w-full items-start gap-2 rounded px-2.5 py-1.5 text-left text-[12px] leading-snug text-gray-700 hover:bg-gray-50"
          >
            <span
              className={`mt-px flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px] leading-none ${
                on ? 'border-accent bg-accent text-white' : 'border-gray-300 text-transparent'
              }`}
            >
              ✓
            </span>
            {o.label}
          </button>
        )
      })}
      {p.selected.size > 0 && (
        <button
          type="button"
          onClick={p.clear}
          className="mt-1 w-full border-t border-gray-100 px-2.5 pb-1 pt-1.5 text-left text-[11px] text-gray-400 hover:text-gray-700"
        >
          Clear
        </button>
      )}
    </div>
  )
}

export default function FilterBar({
  properties,
  sorts,
  sortKey,
  onSort,
  query,
  onQuery,
  watchOn,
  onToggleWatch,
  watchCount,
  count,
  total,
  onReset,
}: {
  properties: FilterProperty[]
  sorts: { value: string; label: string; short: string }[]
  sortKey: string
  onSort: (value: string) => void
  query: string
  onQuery: (value: string) => void
  watchOn: boolean
  onToggleWatch: () => void
  watchCount: number
  count: number
  total: number
  onReset: () => void
}) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const toggleOpen = (k: string) => setOpenKey(cur => (cur === k ? null : k))
  const close = () => setOpenKey(null)
  const anyActive = properties.some(p => p.selected.size > 0) || query.trim() !== ''
  const activeSort = sorts.find(s => s.value === sortKey)

  return (
    <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-6 py-2.5">
      {/* Search — name, EC / CAS / BAS number, evaluating authority */}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={query}
          onChange={e => onQuery(e.target.value)}
          placeholder="Search substance, EC / CAS, authority"
          aria-label="Search substances"
          className="w-[248px] rounded-full border border-gray-300 bg-white py-1 pl-8 pr-7 text-[12px] text-ink placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQuery('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
          >
            <CloseIcon className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Watchlist — show only the substances you starred */}
      <button
        type="button"
        onClick={onToggleWatch}
        aria-pressed={watchOn}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
          watchOn
            ? 'border-amber-400 bg-amber-500 text-white'
            : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
        }`}
      >
        <StarIcon filled={watchOn} className="h-3.5 w-3.5" />
        Watchlist{watchCount ? ` · ${watchCount}` : ''}
      </button>

      <span className="mx-0.5 h-5 w-px bg-gray-200" />

      {/* One pill per filter group */}
      {properties.map(p => {
        const on = p.selected.size > 0
        return (
          <div key={p.key} className="relative">
            <button
              type="button"
              onClick={() => toggleOpen(p.key)}
              aria-expanded={openKey === p.key}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] transition-colors ${
                on
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className={`flex h-3.5 w-3.5 items-center justify-center ${on ? 'text-blue-500' : 'text-gray-400'}`}>
                {p.icon}
              </span>
              <span className="font-medium">{p.label}:</span>
              <span className={on ? 'font-semibold' : 'font-normal text-gray-500'}>{summarize(p)}</span>
              <ChevronDownIcon className="h-3 w-3 opacity-60" />
            </button>
            {openKey === p.key && (
              <Popover onClose={close}>
                <ValueEditor p={p} />
              </Popover>
            )}
          </div>
        )
      })}

      {/* Sort — same pill, single-select */}
      <div className="relative">
        <button
          type="button"
          onClick={() => toggleOpen('sort')}
          aria-expanded={openKey === 'sort'}
          className="flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1 text-[12px] text-gray-600 transition-colors hover:bg-gray-50"
        >
          <span className="flex h-3.5 w-3.5 items-center justify-center text-gray-400">
            <SortIcon className="h-3.5 w-3.5" />
          </span>
          <span className="font-medium">Sort:</span>
          <span className="font-semibold">{activeSort?.short}</span>
          <ChevronDownIcon className="h-3 w-3 opacity-60" />
        </button>
        {openKey === 'sort' && (
          <Popover onClose={close}>
            <div className="py-0.5">
              {sorts.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => {
                    onSort(s.value)
                    close()
                  }}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[12px] text-gray-700 hover:bg-gray-50"
                >
                  <span
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border text-[9px] leading-none ${
                      s.value === sortKey ? 'border-accent bg-accent text-white' : 'border-gray-300 text-transparent'
                    }`}
                  >
                    ✓
                  </span>
                  {s.label}
                </button>
              ))}
            </div>
          </Popover>
        )}
      </div>

      {/* Result count + clear */}
      <div className="ml-auto flex items-center gap-3">
        {anyActive && (
          <button
            onClick={() => {
              onReset()
              close()
            }}
            className="text-[11.5px] font-medium text-accent underline-offset-2 hover:underline"
          >
            Clear
          </button>
        )}
        <span className="font-mono text-[11px] text-gray-400">
          {count} / {total}
        </span>
      </div>
    </div>
  )
}
