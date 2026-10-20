import raw from './changes.json'
import type { ChangeDataset, ExportChange, ExportChangeKind } from './types'

// What moved between consecutive ECHA exports, worked out at build time by
// tools/convert_export.py from every dated copy under data/. Oldest first per
// substance. lib/changeSignals.ts turns some of it into signals; the renewal
// helpers in lib/approvals.ts read the rest as status.

const dataset = raw as ChangeDataset

export const changeMeta = dataset.meta

export function changesFor(substanceId: string): ExportChange[] {
  return dataset.bySubstance[substanceId] ?? []
}

/** The most recent change of one kind on a substance, if any. */
export function latestChange(substanceId: string, kind: ExportChangeKind): ExportChange | null {
  const found = changesFor(substanceId).filter(c => c.kinds.includes(kind))
  return found[found.length - 1] ?? null
}
