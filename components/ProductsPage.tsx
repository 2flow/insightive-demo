'use client'

import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/data'
import { RECENT_DAYS, isRecent } from '@/lib/feeds'
import { loadProductDetail, productMeta, productsFor, unionNote } from '@/lib/products'
import type {
  ProductAuthorisation,
  ProductChange,
  ProductDetail,
  ProductFamilyDetail,
  ProductTrend,
  Substance,
} from '@/lib/types'
import InfoNote from './InfoNote'
import { ArrowLeftIcon, ExternalIcon } from './icons'
import { useToday } from './useToday'

// Every authorisation for one substance, grouped by family. The rows come from
// public/products/<id>.json, fetched on open rather than bundled — the full set
// across all substances is ~3 MB.

/** Above this many families the page opens as a collapsed index instead. */
const EXPAND_LIMIT = 8

const STATUS_CLASS: Record<string, string> = {
  Authorised: 'live',
  Expired: 'expired',
  Cancelled: 'cancelled',
}

/** How a tile's count moved against an export at least 30 days older —
 *  more reads green, fewer red. */
function Trend({ now, then, since }: { now: number; then: number; since: string }) {
  const delta = now - then
  const tone = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  return (
    <span className={`fp-trend ${tone}`} title={`${then} in the export of ${formatDate(since)}`}>
      {delta > 0 ? `+${delta}` : delta < 0 ? `\u2212${-delta}` : '\u00b10'}
    </span>
  )
}

function trendInfo(trend: ProductTrend): string {
  return (
    `The badge shows how the count moved since ECHA's product export of ` +
    `${formatDate(trend.since)} — the newest export at least ${productMeta.trend.days ?? 30} days ` +
    `older than the current one (${formatDate(productMeta.exportDate)}). Green: more than then; ` +
    `red: fewer; ±0: unchanged. Authorisations counts every authorisation on record, live or ` +
    `not; holder groups and market areas count only those with a live authorisation.`
  )
}

const CHANGE_LABEL: Record<ProductChange['kind'], string> = {
  new: 'New',
  cancelled: 'Cancelled',
  expired: 'Expired',
  authorised: 'Re-authorised',
  status: 'Status changed',
}

/** An authorisation that changed in an export dated within RECENT_DAYS of today. */
function recentChange(p: ProductAuthorisation, today: string | null): ProductChange | null {
  return today && p.change && isRecent(p.change.date, today) ? p.change : null
}

/** The same "past 30 days" marker as the timeline's, saying what changed. */
/** The order the recent-changes list reads in: losses first. */
const CHANGE_ORDER: ProductChange['kind'][] = ['cancelled', 'expired', 'authorised', 'status', 'new']

function ChangeTag({ change }: { change: ProductChange }) {
  return (
    <span
      className={`auth-change ${change.kind}`}
      title={
        `${CHANGE_LABEL[change.kind]}${change.was ? ` (was ${change.was})` : ''} — first shown in ECHA's ` +
        `product export of ${formatDate(change.date)}, not in the one of ${formatDate(change.since)}`
      }
    >
      {CHANGE_LABEL[change.kind]}
      <span className="auth-change-note">past {RECENT_DAYS} days</span>
    </span>
  )
}

function Authorisation({ p, today, family }: { p: ProductAuthorisation; today: string | null; family?: string }) {
  const change = recentChange(p, today)
  return (
    <div className={`auth-row ${change ? 'is-changed' : ''}`}>
      <span className="auth-market">{p.market || '—'}</span>
      <span className={`auth-status ${STATUS_CLASS[p.status] ?? ''}`}>{p.status || '—'}</span>
      <span className="auth-names">
        {change && <ChangeTag change={change} />}
        {p.tradeNames.length > 0 ? p.tradeNames.join(' · ') : '—'}
        {p.holder && <span className="auth-holder">{p.holder}</span>}
        {family && <span className="auth-holder">Family: {family}</span>}
      </span>
      <span className="auth-date">{formatDate(p.start)}</span>
      <span className="auth-date">{formatDate(p.end)}</span>
      <span className="auth-ref">
        {p.nationalNumber || p.asset || '—'}
        {(p.fieldOfUse || p.userCategory) && (
          <span className="auth-use">{[p.fieldOfUse, p.userCategory].filter(Boolean).join(' · ')}</span>
        )}
      </span>
    </div>
  )
}

function Family({
  family,
  startOpen,
  today,
}: {
  family: ProductFamilyDetail
  startOpen: boolean
  today: string | null
}) {
  const changed = family.products.filter(p => recentChange(p, today)).length
  const [open, setOpen] = useState(startOpen)
  // Today is only known after mount; a family with a recent change opens then.
  useEffect(() => {
    if (changed > 0) setOpen(true)
  }, [changed])
  return (
    <section className={`auth-family ${family.state === 'dead' ? 'is-dead' : ''}`}>
      <button type="button" className="auth-family-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="auth-family-main">
          <span className="auth-family-name">{family.name}</span>
          <span className="auth-family-sub">
            {family.reference}
            {family.holder && ` · ${family.holder}`}
          </span>
        </span>
        {changed > 0 && (
          <span className="auth-change" title={`Authorisations changed within the past ${RECENT_DAYS} days`}>
            {changed} changed
            <span className="auth-change-note">past {RECENT_DAYS} days</span>
          </span>
        )}
        <span className={`fam-kind ${family.kind.toLowerCase()}`}>{family.kind}</span>
        <span className="auth-family-count">
          {family.products.length} authorisation{family.products.length === 1 ? '' : 's'}
        </span>
        <span className="auth-family-toggle">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="auth-table">
          <div className="auth-row auth-row-head">
            <span>Market</span>
            <span>Status</span>
            <span>Trade names · holder</span>
            <span>Granted</span>
            <span>Ends</span>
            <span>Authorisation no.</span>
          </div>
          {family.products.map(p => (
            <Authorisation key={p.asset} p={p} today={today} />
          ))}
        </div>
      )}
    </section>
  )
}

export default function ProductsPage({
  substance,
  onBack,
}: {
  substance: Substance
  onBack: () => void
}) {
  const summary = productsFor(substance.id)
  const trend = summary?.trend ?? null
  const today = useToday()
  const [detail, setDetail] = useState<ProductDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setDetail(null)
    setError(null)
    loadProductDetail(substance.id)
      .then(d => live && setDetail(d))
      .catch(e => live && setError(String(e.message ?? e)))
    return () => {
      live = false
    }
  }, [substance.id])

  // Every authorisation that changed recently, cancellations first, so a single
  // change is not lost inside a family named after a different trade name.
  const recent = (detail?.families ?? [])
    .flatMap(f => f.products.map(p => ({ p, family: f.name })))
    .filter(({ p }) => recentChange(p, today))
    .sort((a, b) => CHANGE_ORDER.indexOf(a.p.change!.kind) - CHANGE_ORDER.indexOf(b.p.change!.kind))

  return (
    <div className="feed-page">
      <button type="button" className="feed-back" onClick={onBack}>
        <ArrowLeftIcon />
        All substances
      </button>

      <header className="feed-page-head">
        <div className="feed-page-eyebrow">Product authorisations</div>
        <h1 className="feed-page-title">{substance.name}</h1>
        <div className="feed-page-meta">
          <span className={`pt-tag ${substance.pt.toLowerCase()}`}>{substance.pt}</span>
          <span className={`status-pill ${substance.approvalStatus.toLowerCase().replace(/\s+/g, '-')}`}>
            {substance.approvalStatus}
          </span>
          <span className="sep" />
          {summary && (
            <>
              <span className="ident">
                <span className="k">Authorisations</span>
                {summary.products}
              </span>
              <span className="ident">
                <span className="k">Families</span>
                {summary.families}
              </span>
              <span className="ident">
                <span className="k">Markets</span>
                {summary.marketAreas}
              </span>
            </>
          )}
          {productMeta.exportDate && (
            <span className="ident">
              <span className="k">Export</span>
              {formatDate(productMeta.exportDate)}
            </span>
          )}
        </div>
      </header>

      {/* The overview the expanded row used to carry. It belongs with the
          authorisations it describes, not in a list of substances. Holder and
          market counts are of *live* authorisations, since a holder or a market
          whose last one lapsed is not a current route to market. Where the
          all-time figure is higher it sits alongside as "of N". */}
      {summary && (
        <div className="fp-dash">
          <div className="fp-tile">
            <div className="fp-tile-label">
              Authorisations
              {trend && <InfoNote label="Trend" text={trendInfo(trend)} />}
            </div>
            <div className="fp-tile-value">
              {summary.products}
              {trend && <Trend now={summary.products} then={trend.products} since={trend.since} />}
            </div>
            <div className="fp-tile-note">
              {unionNote(summary)}
              {summary.newestGrant ? ` · newest grant ${summary.newestGrant}` : ''}
            </div>
          </div>

          <div className="fp-tile">
            <div className="fp-tile-label">
              Holder groups
              {trend && <InfoNote label="Trend" text={trendInfo(trend)} />}
            </div>
            <div className={`fp-tile-value ${summary.holderGroups === 0 ? 'warn' : ''}`}>
              {summary.holderGroups}
              {summary.holderGroupsEver > summary.holderGroups && (
                <span className="fp-tile-of">of {summary.holderGroupsEver}</span>
              )}
              {trend && <Trend now={summary.holderGroups} then={trend.holderGroups} since={trend.since} />}
            </div>
            <div className="fp-tile-note">holding a live authorisation</div>
          </div>

          <div className="fp-tile">
            <div className="fp-tile-label">
              Market areas
              {trend && <InfoNote label="Trend" text={trendInfo(trend)} />}
            </div>
            <div className={`fp-tile-value ${summary.marketAreasLive === 0 ? 'warn' : ''}`}>
              {summary.marketAreasLive}
              {summary.marketAreas > summary.marketAreasLive && (
                <span className="fp-tile-of">of {summary.marketAreas}</span>
              )}
              {trend && <Trend now={summary.marketAreasLive} then={trend.marketAreasLive} since={trend.since} />}
            </div>
            <div className="fp-tile-note">with a live authorisation</div>
          </div>

          {/* Green: products still authorised beyond the substance approval are
              market presence, not a hazard. */}
          <div className="fp-tile">
            <div className="fp-tile-label">Past expiry</div>
            <div className={`fp-tile-value ${summary.pastExpiry.total > 0 ? 'ok' : ''}`}>
              {summary.pastExpiry.total}
              <span className="fp-tile-of">of {summary.products}</span>
            </div>
            <div className="fp-tile-note">
              {summary.pastExpiry.total > 0
                ? `${summary.pastExpiry.national} national · ${summary.pastExpiry.union} union`
                : 'none outlive the approval'}
            </div>
          </div>
        </div>
      )}

      {error && <p className="auth-note">Could not load the authorisation detail — {error}</p>}
      {!detail && !error && <p className="auth-note">Loading authorisations…</p>}

      {detail && recent.length > 0 && (
        <>
          <div className="feed-section-head">
            <span className="feed-section-title">Changed in the past {RECENT_DAYS} days</span>
            <span className="feed-section-count">
              {recent.length} authorisation{recent.length === 1 ? '' : 's'} · new or changed status
            </span>
          </div>
          <div className="auth-family">
            <div className="auth-table">
              <div className="auth-row auth-row-head">
                <span>Market</span>
                <span>Status</span>
                <span>Trade names · holder</span>
                <span>Granted</span>
                <span>Ends</span>
                <span>Authorisation no.</span>
              </div>
              {recent.map(({ p, family }) => (
                <Authorisation key={`${family}-${p.asset}`} p={p} today={today} family={family} />
              ))}
            </div>
          </div>
        </>
      )}

      {detail && (
        <>
          <div className="feed-section-head">
            <span className="feed-section-title">Families</span>
            <span className="feed-section-count">
              {detail.families.length > EXPAND_LIMIT
                ? 'live first · open a family to see its authorisations'
                : 'live first · grouped by reference authorisation'}
            </span>
          </div>
          {detail.families.map(family => (
            <Family
              key={family.reference}
              family={family}
              today={today}
              // With a few families the page reads best fully open; with a
              // couple of hundred it has to stay an index you can scan.
              startOpen={detail.families.length <= EXPAND_LIMIT && family.state === 'live'}
            />
          ))}
        </>
      )}

      <p className="auth-source">
        <a
          href="https://echa.europa.eu/information-on-chemicals/biocidal-products"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalIcon />
          ECHA biocidal products database
        </a>
      </p>
    </div>
  )
}
