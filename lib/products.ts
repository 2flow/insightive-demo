import raw from './products.json'
import type { ProductDataset, ProductDetail, ProductFamily, ProductSummary } from './types'

// Authorised products, compiled by tools/convert_export.py. Only the summaries
// are bundled — the full per-product rows are ~3 MB, so they live as one static
// file per substance and are fetched when a reader opens the product page.

const dataset = raw as ProductDataset

export const productMeta = dataset.meta

export function productsFor(substanceId: string): ProductSummary | null {
  return dataset.bySubstance[substanceId] ?? null
}

/** How a family's markets read on one line: "Italy only" beats "1 market". */
export function marketLabel(family: ProductFamily): string {
  if (family.markets.length === 0) return 'no market listed'
  if (family.markets.length === 1) return `${family.markets[0]} only`
  return `${family.markets.length} markets`
}

/** The status chip: live families count up, dead ones say how they ended. */
export function statusLabel(family: ProductFamily): string {
  const parts: string[] = []
  if (family.live) parts.push(`${family.live} live`)
  if (family.expired) parts.push(`${family.expired} expired`)
  if (family.cancelled) parts.push(`${family.cancelled} cancelled`)
  // A family that ended one way only reads better as a plain word.
  if (family.state === 'dead' && parts.length === 1) {
    if (family.expired) return 'Expired'
    if (family.cancelled) return 'Cancelled'
  }
  return parts.join(' · ') || '—'
}

/** Union (EU-wide) authorisations on one line: how many, and how many still live. */
export function unionNote(summary: ProductSummary): string {
  if (summary.unionTotal === 0) return 'no union auth.'
  return `${summary.unionTotal} union (${summary.unionLive} live)`
}

const cache = new Map<string, Promise<ProductDetail>>()

/**
 * Fetch one substance's full authorisation list.
 *
 * The path is relative on purpose: it resolves correctly whether the export is
 * hosted at a domain root or under a sub-path, without needing basePath here.
 */
export function loadProductDetail(substanceId: string): Promise<ProductDetail> {
  const hit = cache.get(substanceId)
  if (hit) return hit

  const request = fetch(`products/${encodeURIComponent(substanceId)}.json`)
    .then(response => {
      if (!response.ok) throw new Error(`No product detail for ${substanceId} (${response.status})`)
      return response.json() as Promise<ProductDetail>
    })
    .catch(error => {
      cache.delete(substanceId) // let a later attempt retry rather than cache the failure
      throw error
    })

  cache.set(substanceId, request)
  return request
}
