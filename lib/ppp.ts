import raw from './ppp.json'
import type { PppDataset, PppRecord } from './types'

// The EU Pesticide Database, matched to substances at build time by
// tools/convert_export.py. Roughly half the substances appear in it; the rest
// were never plant-protection actives, which is why the tile only shows where
// there is a record to show.

const dataset = raw as PppDataset

export const pppMeta = dataset.meta

export function pppFor(substanceId: string): PppRecord | null {
  return dataset.bySubstance[substanceId] ?? null
}

export function pppApproved(record: PppRecord): boolean {
  return record.status.toLowerCase().startsWith('approved')
}

/** Green where the substance survived the PPP regime, red where it did not. */
export function pppTone(record: PppRecord): 'ok' | 'warn' {
  return pppApproved(record) ? 'ok' : 'warn'
}
