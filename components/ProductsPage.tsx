'use client'

import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/data'
import { loadProductDetail, productMeta, productsFor, unionNote } from '@/lib/products'
import type { ProductAuthorisation, ProductDetail, ProductFamilyDetail, Substance } from '@/lib/types'
import { ArrowLeftIcon, ExternalIcon } from './icons'

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

function Authorisation({ p }: { p: ProductAuthorisation }) {
  return (
    <div className="auth-row">
      <span className="auth-market">{p.market || '—'}</span>
      <span className={`auth-status ${STATUS_CLASS[p.status] ?? ''}`}>{p.status || '—'}</span>
      <span className="auth-names">
        {p.tradeNames.length > 0 ? p.tradeNames.join(' · ') : '—'}
        {p.holder && <span className="auth-holder">{p.holder}</span>}
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

function Family({ family, startOpen }: { family: ProductFamilyDetail; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen)
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
            <Authorisation key={p.asset} p={p} />
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
            <div className="fp-tile-label">Authorisations</div>
            <div className="fp-tile-value">{summary.products}</div>
            <div className="fp-tile-note">
              {unionNote(summary)}
              {summary.newestGrant ? ` · newest grant ${summary.newestGrant}` : ''}
            </div>
          </div>

          <div className="fp-tile">
            <div className="fp-tile-label">Holder groups</div>
            <div className={`fp-tile-value ${summary.holderGroups === 0 ? 'warn' : ''}`}>
              {summary.holderGroups}
              {summary.holderGroupsEver > summary.holderGroups && (
                <span className="fp-tile-of">of {summary.holderGroupsEver}</span>
              )}
            </div>
            <div className="fp-tile-note">holding a live authorisation</div>
          </div>

          <div className="fp-tile">
            <div className="fp-tile-label">Market areas</div>
            <div className={`fp-tile-value ${summary.marketAreasLive === 0 ? 'warn' : ''}`}>
              {summary.marketAreasLive}
              {summary.marketAreas > summary.marketAreasLive && (
                <span className="fp-tile-of">of {summary.marketAreas}</span>
              )}
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
