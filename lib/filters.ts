import { asOf } from './data'
import type { Substance } from './types'

// Multi-select helpers + the sort orders offered above the table.

/** An empty selection means "no filter", not "nothing matches". */
export function setMatches(selected: Set<string>, value: string): boolean {
  return selected.size === 0 || selected.has(value)
}

export function toggleSet<T>(current: Set<T>, value: T): Set<T> {
  const next = new Set(current)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

export function matchesQuery(s: Substance, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    s.name.toLowerCase().includes(q) ||
    s.ec.toLowerCase().includes(q) ||
    s.cas.toLowerCase().includes(q) ||
    s.bas.toLowerCase().includes(q) ||
    s.authority.toLowerCase().includes(q)
  )
}

export type SortKey = 'end-asc' | 'end-desc' | 'start-desc' | 'name-asc' | 'status'

export const SORTS: { value: SortKey; label: string; short: string }[] = [
  { value: 'end-asc', label: 'Approval end — next to expire', short: 'Next to expire' },
  { value: 'end-desc', label: 'Approval end — latest first', short: 'Ends latest' },
  { value: 'start-desc', label: 'Approval start — newest first', short: 'Newest start' },
  { value: 'name-asc', label: 'Substance name — A to Z', short: 'Name A–Z' },
  { value: 'status', label: 'Approval status', short: 'Status' },
]

const STATUS_RANK: Record<string, number> = {
  Approved: 0,
  Pending: 1,
  Expired: 2,
  'Not approved': 3,
  'No longer supported': 4,
}

const byName = (a: Substance, b: Substance) => a.name.localeCompare(b.name)

/** Rows with no date always sort to the bottom, whichever direction is picked —
 *  a blank end date is "not applicable", not "infinitely far away". */
function byDate(field: 'startDate' | 'endDate', dir: 1 | -1) {
  return (a: Substance, b: Substance) => {
    const av = a[field]
    const bv = b[field]
    if (!av && !bv) return byName(a, b)
    if (!av) return 1
    if (!bv) return -1
    return av === bv ? byName(a, b) : (av < bv ? -1 : 1) * dir
  }
}

/** "Next to expire": approvals still in force, soonest first — then the lapsed
 *  ones (most recent first), then records that never carried an end date. A
 *  plain ascending sort would bury the live renewal window under 17 expiries. */
function byNextToExpire(a: Substance, b: Substance): number {
  const rank = (s: Substance) => (!s.endDate ? 2 : s.endDate < asOf ? 1 : 0)
  const d = rank(a) - rank(b)
  if (d !== 0) return d
  return rank(a) === 1 ? byDate('endDate', -1)(a, b) : byDate('endDate', 1)(a, b)
}

export function sortSubstances(rows: Substance[], key: SortKey): Substance[] {
  const sorted = [...rows]
  switch (key) {
    case 'end-asc':
      return sorted.sort(byNextToExpire)
    case 'end-desc':
      return sorted.sort(byDate('endDate', -1))
    case 'start-desc':
      return sorted.sort(byDate('startDate', -1))
    case 'status':
      return sorted.sort((a, b) => {
        const d = (STATUS_RANK[a.approvalStatus] ?? 9) - (STATUS_RANK[b.approvalStatus] ?? 9)
        return d !== 0 ? d : byNextToExpire(a, b)
      })
    default:
      return sorted.sort(byName)
  }
}
