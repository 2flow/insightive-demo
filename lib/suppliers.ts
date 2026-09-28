import raw from './suppliers.json'
import type { Supplier, SupplierDataset } from './types'

// The Article 95 list of approved suppliers, compiled by tools/convert_export.py.
// Rows are matched to substances at build time — see resolve_substances() there —
// so this side is a plain lookup by substance id.

const dataset = raw as SupplierDataset

export const supplierMeta = dataset.meta

export function suppliersFor(substanceId: string): Supplier[] {
  return dataset.bySubstance[substanceId] ?? []
}

/** The column already says "supplier", so the value needn't repeat it:
 *  "Substance & Product Supplier" -> "Substance & Product". */
export function supplierType(type: string): string {
  return type.replace(/\s*suppliers?$/i, '')
}

// Legal forms and the generic words that pad a registered name. Stripped only
// to shorten the name for a summary line — the full entity is always one click
// away in the table, so a clumsy shortening costs nothing.
const PADDING =
  /\b(gmbh|ltd|limited|llc|inc|corp|corporation|plc|sas|sprl|sarl|srl|nv|bv|bvba|spa|sa|as|aps|oy|ab|ag|kg|kft|lda|co|cv|holdings?|group|international|chemicals?|chemie|industries|europe|eu|science|sciences|agro|agriculture)\b/gi

/**
 * "Bayer S.A.S" -> "Bayer"; "SC Johnson Europe Sàrl (Acting for …)" -> "SC
 * Johnson". One or two words, for the overview line on a collapsed card.
 */
export function supplierShortName(entity: string): string {
  const words = entity
    .replace(/\s*[([](acting|on behalf).*$/i, '') // the agency clause names someone else
    .replace(/[.,&]/g, ' ')
    .replace(PADDING, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !/^\d+$/.test(w)) // "S.A.S" leaves initials behind
  if (words.length === 0) return entity.split(/[\s(]/)[0] || entity
  // A two-letter tail is a country or a branch ("Sumitomo UK"), not the brand —
  // but a two-letter head is ("SC Johnson").
  return words[1] && words[1].length > 2 ? `${words[0]} ${words[1]}` : words[0]
}

/** The distinct companies behind a substance's suppliers, in list order. */
export function supplierShortNames(suppliers: Supplier[]): string[] {
  return Array.from(new Set(suppliers.map(s => supplierShortName(s.entity))))
}
