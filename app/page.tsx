'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  END_BUCKETS,
  approvalStatuses,
  formatDate,
  meta,
  productTypes,
  subStatuses,
  substances,
} from '@/lib/data'
import { RECENT_DAYS, allRecords, feedFor, isRecent, latestRecords } from '@/lib/feeds'
import { SORTS, type SortKey, matchesQuery, setMatches, sortSubstances, toggleSet } from '@/lib/filters'
import ExpiringSubstances from '@/components/ExpiringSubstances'
import FeedPage from '@/components/FeedPage'
import LatestSignals from '@/components/LatestSignals'
import ProductsPage from '@/components/ProductsPage'
import SignalsPage from '@/components/SignalsPage'
import FilterBar, { type FilterProperty } from '@/components/FilterBar'
import StatRow from '@/components/StatRow'
import SubstanceTable from '@/components/SubstanceTable'
import { useToday } from '@/components/useToday'
import { useWatchlist } from '@/components/useWatchlist'
import { CalendarIcon, ClockIcon, InfoIcon, LayersIcon, PulseIcon, ShieldIcon } from '@/components/icons'

const PT_NAME: Record<string, string> = Object.fromEntries(
  substances.map(s => [s.pt, s.ptName]),
)

/** The app's release, shown in the header beside the export date. Bump it with each release. */
const APP_VERSION = 'v2'

/** The latest date any source was updated or checked, shown in the header. Bump it with each data update. */
const LATEST_UPDATE = '2026-11-10'

export default function Page() {
  const [query, setQuery] = useState('')
  const [statuses, setStatuses] = useState<Set<string>>(new Set())
  const [subs, setSubs] = useState<Set<string>>(new Set())
  const [ends, setEnds] = useState<Set<string>>(new Set())
  const [pts, setPts] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey>('end-asc')
  const [watchOnly, setWatchOnly] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [route, setRoute] = useState<{ view: 'feed' | 'products'; id: string } | null>(null)
  // The three top-level views. Overview is the default — what has changed and
  // what is running out — with the full list and the timeline a tab away.
  const [section, setSection] = useState<'overview' | 'substances' | 'signals'>('overview')
  // #signals/class/<slug>: the timeline narrowed to one chemical class.
  const [signalsClass, setSignalsClass] = useState<string | null>(null)
  const watched = useWatchlist()
  const today = useToday()

  const records = useMemo(() => allRecords(substances), [])
  const latest = useMemo(() => (today ? latestRecords(records, today) : []), [records, today])
  const recentCount = useMemo(() => {
    if (!today) return 0
    return latest.filter(r => isRecent(r.record.date, today)).length
  }, [latest, today])

  // Sub-views live at #feed/<id> and #products/<id>. Hash routing rather than
  // real Next routes so the list keeps its filters, sort and open rows while you
  // read one and come back — and so the static export stays a single page.
  useEffect(() => {
    const read = () => {
      const hash = window.location.hash.replace(/^#/, '')
      const [view, ...rest] = hash.split('/')
      const id = decodeURIComponent(rest.join('/'))
      // #signals and #substances are the views without a substance of their
      // own; no hash at all is the Overview.
      setSection(view === 'signals' ? 'signals' : view === 'substances' ? 'substances' : 'overview')
      setRoute(id && (view === 'feed' || view === 'products') ? { view, id } : null)
      setSignalsClass(view === 'signals' && rest[0] === 'class' && rest[1] ? decodeURIComponent(rest[1]) : null)
    }
    read()
    // hashchange covers in-app links and the back button; popstate covers the
    // pushState we use to drop the hash on close.
    window.addEventListener('hashchange', read)
    window.addEventListener('popstate', read)
    return () => {
      window.removeEventListener('hashchange', read)
      window.removeEventListener('popstate', read)
    }
  }, [])

  // A class feed is reached by a plain link (#signals/class/<slug>), so it
  // starts at the top like every other page.
  useEffect(() => {
    if (signalsClass) window.scrollTo({ top: 0 })
  }, [signalsClass])

  // A record to bring into view once the page it opens has rendered — set when
  // a Latest signals row is clicked, so the reader lands on that card rather
  // than at the top of the page.
  const [focusRecord, setFocusRecord] = useState<string | null>(null)

  const open = useCallback((view: 'feed' | 'products', id: string, record?: string) => {
    window.location.hash = `${view}/${encodeURIComponent(id)}`
    window.scrollTo({ top: 0 })
    setFocusRecord(record ?? null)
  }, [])

  const openFeed = useCallback(
    (id: string, record?: string) => open('feed', id, record),
    [open],
  )
  const openProducts = useCallback((id: string) => open('products', id), [open])
  const openAllSignals = useCallback((record?: string) => {
    window.location.hash = 'signals'
    window.scrollTo({ top: 0 })
    setFocusRecord(record ?? null)
  }, [])

  // Find the card, centre it and mark it briefly. The page may take a frame
  // or two to render after the route changes, so it looks a few times.
  useEffect(() => {
    if (!focusRecord) return
    let tries = 0
    let frame = 0
    const find = () => {
      const el = document.querySelector<HTMLElement>(
        `[data-record-key="${CSS.escape(focusRecord)}"]`,
      )
      if (el) {
        el.scrollIntoView({ block: 'center' })
        el.classList.add('is-focus')
        // Not cleared with the effect: clearing focusRecord below re-runs it.
        setTimeout(() => el.classList.remove('is-focus'), 1800)
        setFocusRecord(null)
      } else if (tries++ < 20) {
        frame = requestAnimationFrame(find)
      } else {
        setFocusRecord(null)
      }
    }
    frame = requestAnimationFrame(find)
    return () => cancelAnimationFrame(frame)
  }, [focusRecord, route, section])

  // Back from a substance's page, its products or the timeline: to the list.
  const closeSubView = useCallback(() => {
    window.location.hash = 'substances'
    window.scrollTo({ top: 0 })
  }, [])

  const openOverview = useCallback(() => {
    window.history.pushState(null, '', window.location.pathname + window.location.search)
    setRoute(null)
    setSection('overview')
    window.scrollTo({ top: 0 })
  }, [])

  const routeSubstance = route ? substances.find(s => s.id === route.id) ?? null : null
  // Every substance has a signals page — the standing facts are drawn from the
  // ECHA exports, which cover all of them. The curated feed is the part that
  // may be missing, and the page renders without it.
  const openedSignals = route?.view === 'feed' ? routeSubstance : null
  const openedProducts = route?.view === 'products' ? routeSubstance : null
  const allSignals = !route && section === 'signals'
  const overview = !route && section === 'overview'
  const substancesTab = !!route || section === 'substances'
  const subView = openedSignals || openedProducts || allSignals || overview

  // Vocabularies come from the data, so a new export can't leave a dead filter.
  const STATUS_OPTIONS = useMemo(() => approvalStatuses(), [])
  const SUB_OPTIONS = useMemo(() => subStatuses(), [])
  const PT_OPTIONS = useMemo(() => productTypes(), [])

  const filtered = useMemo(() => {
    const rows = substances.filter(
      s =>
        matchesQuery(s, query) &&
        setMatches(statuses, s.approvalStatus) &&
        setMatches(subs, s.assessmentSubStatus) &&
        setMatches(ends, s.endBucket) &&
        setMatches(pts, s.pt) &&
        (!watchOnly || watched.includes(s.id)),
    )
    return sortSubstances(rows, sortKey)
  }, [query, statuses, subs, ends, pts, sortKey, watchOnly, watched])

  const groups = PT_OPTIONS.map(pt => ({ pt, rows: filtered.filter(s => s.pt === pt) })).filter(
    g => g.rows.length > 0,
  )

  const properties: FilterProperty[] = [
    {
      key: 'status',
      label: 'Approval status',
      icon: <ShieldIcon className="h-3.5 w-3.5" />,
      selected: statuses,
      toggle: v => setStatuses(s => toggleSet(s, v)),
      clear: () => setStatuses(new Set()),
      options: STATUS_OPTIONS.map(s => ({ value: s, label: s })),
    },
    {
      key: 'substatus',
      label: 'Assessment sub-status',
      icon: <LayersIcon className="h-3.5 w-3.5" />,
      selected: subs,
      toggle: v => setSubs(s => toggleSet(s, v)),
      clear: () => setSubs(new Set()),
      options: SUB_OPTIONS.map(s => ({
        value: s,
        label: s,
        short: s.length > 22 ? `${s.slice(0, 20)}…` : s,
      })),
    },
    {
      key: 'end',
      label: 'Approval ends',
      icon: <ClockIcon className="h-3.5 w-3.5" />,
      selected: ends,
      toggle: v => setEnds(s => toggleSet(s, v)),
      clear: () => setEnds(new Set()),
      options: END_BUCKETS.map(b => ({ value: b.value, label: b.label, short: b.short })),
    },
    {
      key: 'pt',
      label: 'Product type',
      icon: <CalendarIcon className="h-3.5 w-3.5" />,
      selected: pts,
      toggle: v => setPts(s => toggleSet(s, v)),
      clear: () => setPts(new Set()),
      options: PT_OPTIONS.map(p => ({ value: p, label: `${p} — ${PT_NAME[p]}`, short: p })),
    },
  ]

  function resetFilters() {
    setQuery('')
    setStatuses(new Set())
    setSubs(new Set())
    setEnds(new Set())
    setPts(new Set())
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* ── Brand header ───────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-3">
          <Image src="/insightive_logo_light.png" alt="Insightive" width={28} height={28} className="shrink-0" />
          <span className="hidden text-sm font-semibold tracking-tight text-ink sm:inline">Insightive</span>
          <span className="hidden h-4 w-px shrink-0 bg-gray-200 sm:block" />
          <span className="hidden text-sm font-medium text-gray-500 md:block">
            Substance Watch
          </span>

          {/* The two ways into the data, as peers: where each substance stands,
              and what has been happening. A substance's own page sits under
              Substances, since that is where it is reached from. */}
          <nav className="app-tabs" aria-label="Views">
            <button
              type="button"
              className={`app-tab ${overview ? 'is-on' : ''}`}
              aria-current={overview ? 'page' : undefined}
              onClick={openOverview}
            >
              Overview
            </button>
            <button
              type="button"
              className={`app-tab ${substancesTab ? 'is-on' : ''}`}
              aria-current={substancesTab ? 'page' : undefined}
              onClick={closeSubView}
            >
              Substances
            </button>
            <button
              type="button"
              className={`app-tab ${allSignals ? 'is-on' : ''}`}
              aria-current={allSignals ? 'page' : undefined}
              onClick={() => openAllSignals()}
            >
              <PulseIcon />
              Signals
              {recentCount > 0 && (
                <span className="app-tab-badge" title={`${recentCount} in the last ${RECENT_DAYS} days`}>
                  {recentCount} new
                </span>
              )}
            </button>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span
              className="hidden font-mono text-[10.5px] uppercase tracking-wider text-gray-400 sm:block"
              title="The date every source — ECHA, EUR-Lex, the EU Pesticides Database, NGO reports and the rest — was last updated or checked"
            >
              {APP_VERSION} · Latest update: {formatDate(LATEST_UPDATE)}
            </span>
          </div>
        </div>
        <div className="brand-hairline" />
      </header>

      {/* ── Filter + sort bar. Hidden on the feed page, which has nothing to
             filter. Sticky only from lg up: on a phone the pills wrap to three
             rows and would eat most of the viewport. ─────────────────────── */}
      <div
        className={`static z-10 border-b border-gray-200 bg-white/95 backdrop-blur lg:sticky lg:top-[53px] ${
          subView ? 'hidden' : ''
        }`}
      >
        <FilterBar
          properties={properties}
          sorts={SORTS}
          sortKey={sortKey}
          onSort={v => setSortKey(v as SortKey)}
          query={query}
          onQuery={setQuery}
          watchOn={watchOnly}
          onToggleWatch={() => setWatchOnly(v => !v)}
          watchCount={watched.length}
          count={filtered.length}
          total={substances.length}
          onReset={resetFilters}
        />
      </div>

      {/* ── Sub-views — replace the list while open ──────────── */}
      {allSignals ? (
        <main className="mx-auto max-w-4xl px-6 py-7">
          <SignalsPage
            key={signalsClass ?? 'all'}
            classSlug={signalsClass ?? undefined}
            onOpenSubstance={openFeed}
          />
        </main>
      ) : openedSignals ? (
        <main className="mx-auto max-w-4xl px-6 py-7">
          <FeedPage
            substance={openedSignals}
            feed={feedFor(openedSignals)}
            onBack={closeSubView}
            onOpenProducts={openProducts}
          />
        </main>
      ) : openedProducts ? (
        <main className="mx-auto max-w-6xl px-6 py-7">
          <ProductsPage substance={openedProducts} onBack={closeSubView} />
        </main>
      ) : overview ? (
        /* ── Overview: what changed, then what is running out ── */
        <main className="mx-auto max-w-7xl space-y-5 px-6 py-6">
          {/* Held back until the reader's date is known (see `today`). */}
          {today && (
            <LatestSignals
              latest={latest}
              recentCount={recentCount}
              recentDays={RECENT_DAYS}
              onOpenSubstance={openFeed}
              onOpenAll={openAllSignals}
            />
          )}
          <ExpiringSubstances onOpenSubstance={id => openFeed(id)} onOpenAll={closeSubView} />
        </main>
      ) : (

      /* ── The list ─────────────────────────────────────────── */
      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-5">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-ink">Active substances · PT18 &amp; PT19</h1>
            {/* What this list is and how to read it — about the substance list, so it sits on its heading. */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setInfoOpen(o => !o)}
                aria-label="About this list"
                aria-expanded={infoOpen}
                className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                  infoOpen
                    ? 'border-accent text-accent'
                    : 'border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                }`}
              >
                <InfoIcon className="h-4 w-4" />
              </button>
              {infoOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setInfoOpen(false)} />
                  <div className="absolute left-0 top-full z-40 mt-2 w-[480px] max-w-[88vw] rounded-xl border border-gray-200 bg-white p-5 shadow-lg">
                    <p className="text-[12.5px] leading-relaxed text-body">
                      Every PT18 and PT19 active substance in ECHA&apos;s biocidal active substance
                      database, one row per substance × product type. Click a row for the full
                      record: identifiers, evaluating competent authority, legal act, programme
                      flags and links back to ECHA.
                    </p>
                    <p className="mt-2.5 text-[12.5px] leading-relaxed text-body">
                      ECHA leaves <strong>approval status</strong> blank while a first application is
                      still running; those records are shown here as{' '}
                      <span className="font-semibold">Pending</span>. Time-to-expiry is counted from
                      the export date, not today&apos;s date.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 font-mono text-[10px] uppercase tracking-wider text-gray-400">
                      <span>{meta.source}</span>
                      <span>Export {formatDate(meta.exportDate)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <p className="mt-0.5 max-w-3xl text-[13px] leading-snug text-gray-500">
            Approval status and assessment stage for every insecticide/acaricide (PT18) and
            repellent/attractant (PT19) active substance in the EU biocides review programme.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
              <ShieldIcon className="h-3.5 w-3.5" />
              ECHA biocidal active substances
            </span>
            <span className="font-mono text-[11px] text-accent">{substances.length} records</span>
            <span className="font-mono text-[11px] text-gray-400">
              database last updated {formatDate(meta.lastUpdated)}
            </span>
          </div>
        </div>

        <div className="mb-5">
          <StatRow />
        </div>

        {groups.length === 0 ? (
          <div className="report-surface">
            <div className="report-empty">No substances match the current filters.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(g => (
              <SubstanceTable
                key={g.pt}
                pt={g.pt}
                ptName={PT_NAME[g.pt]}
                rows={g.rows}
                onOpenFeed={openFeed}
                onOpenProducts={openProducts}
              />
            ))}
          </div>
        )}
      </main>
      )}
    </div>
  )
}
