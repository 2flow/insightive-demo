import raw from './pact.json'
import { formatDate } from './data'
import type { PactActivity, PactDataset, PactRecord, PanListing } from './types'

// ECHA's Public Activities Coordination Tool, matched to substances at build
// time. Two separate things travel in the same export: the activities, and
// membership of hazard lists kept elsewhere — so they get a panel each.

const dataset = raw as PactDataset

export const pactMeta = dataset.meta

export function pactFor(substanceId: string): PactRecord | null {
  return dataset.bySubstance[substanceId] ?? null
}

/**
 * The PACT areas that say something about the substance's hazard profile:
 * substance evaluation, PBT/vPvB, endocrine disruption and SVHC
 * identification. Each is an authority asking whether the molecule itself is a
 * problem.
 *
 * The rest are procedure. A harmonised classification proposal *may* end in a
 * hazard class and an assessment of regulatory needs *may* end in a proposal,
 * but neither activity is a finding about the substance, so they are kept
 * apart and shown neutrally.
 */
const HAZARD_AREAS = new Set(['SEv', 'PBT', 'ED', 'SVHC'])

export function hazardActivities(activities: PactActivity[]): PactActivity[] {
  return activities.filter(a => HAZARD_AREAS.has(a.area))
}

export function otherActivities(activities: PactActivity[]): PactActivity[] {
  return activities.filter(a => !HAZARD_AREAS.has(a.area))
}

/**
 * The areas whose activities become dated records.
 *
 * Wider than the hazard areas by one: an assessment of regulatory needs is
 * shown as procedure, because it decides nothing about the substance, but its
 * conclusions are still dated events on the file — "no EU risk management
 * action needed" among them — and dropping them off the timeline would lose
 * six real records to a change of container.
 */
const RECORDED_AREAS = new Set(['SEv', 'PBT', 'ED', 'SVHC', 'ARN'])

export function recordedActivities(activities: PactActivity[]): PactActivity[] {
  return activities.filter(a => RECORDED_AREAS.has(a.area))
}

/** The distinct areas with something recorded, in the order they appear. */
export function pactAreas(activities: PactActivity[]): string[] {
  return Array.from(new Set(activities.map(a => a.area)))
}

/** Activities grouped by area, newest area first. */
export function byArea(activities: PactActivity[]): { area: string; label: string; items: PactActivity[] }[] {
  const groups = new Map<string, { area: string; label: string; items: PactActivity[] }>()
  for (const a of activities) {
    const group = groups.get(a.area)
    if (group) group.items.push(a)
    else groups.set(a.area, { area: a.area, label: a.areaLabel, items: [a] })
  }
  return Array.from(groups.values())
}

/** The terminal states of an ECHA activity. "Opinion adopted" belongs here:
 *  the committee has reported and ECHA's part is over, even though a Commission
 *  decision may follow. Anything else is still being worked on. */
const FINISHED = ['concluded', 'withdrawn', 'opinion adopted']

export function isLive(status: string): boolean {
  const s = status.trim().toLowerCase()
  return !FINISHED.some(f => s.startsWith(f))
}

/** Words that mean the assessment closed without identifying anything. */
const CLEARED = ['not ', 'inconclusive', 'no eu rrm', 'no hypothesis']

/** True only where an assessment concluded that the criteria *are* met. */
export function identified(status: string): boolean {
  const s = status.trim().toLowerCase()
  if (!s.startsWith('concluded')) return false
  const inside = s.slice('concluded'.length).trim()
  // A bare "Concluded" states no finding either way.
  if (!inside.startsWith('(')) return false
  return !CLEARED.some(word => inside.includes(word))
}


/**
 * True where an assessment concluded that the criteria are *not* met, or that
 * no action is needed — an authority looked and found nothing to act on.
 *
 * Not the same as "inconclusive", a bare "Concluded" or "Withdrawn": those
 * state no finding either way and stay neutral. Only a conclusion that says
 * the substance is not what was asked about counts here.
 */
/**
 * Whether an activity is a potential hazard rather than a closed question.
 *
 * Running, or concluded having identified something. A withdrawn activity, or
 * one that concluded without a finding, is neither — it is on the panel
 * because knowing it happened is worth something, not because it counts
 * against the substance.
 */
export function adverseActivity(status: string): boolean {
  return isLive(status) || identified(status)
}

export function cleared(status: string): boolean {
  const s = status.trim().toLowerCase()
  if (!s.startsWith('concluded')) return false
  const inside = s.slice('concluded'.length).trim()
  if (!inside.startsWith('(')) return false
  return inside.includes('not ') || inside.includes('no eu rrm')
}

/** Where each list is published. */
const NPIC_CARCINOGEN = 'https://npic.orst.edu/chemicals_evaluated.pdf'
const ED_LISTS = 'https://edlists.org/the-ed-lists'
const ECHA_ED_ASSESSMENT = 'https://chem.echa.europa.eu/activity-lists/edAssessment'
const EPA_EDSP =
  'https://www.epa.gov/endocrine-disruption/endocrine-disruptor-screening-program-tier-1-screening-determinations-and'

/** The EDSP tags, and what each is short for on the tile. "No Tier 1 ED
 *  indication" is EPA having looked and found nothing — shown, not counted. */
const EDSP_SHORT: Record<string, string> = {
  'Potential ED': 'EPA potential ED',
  Unresolved: 'EPA ED unresolved',
  'No Tier 1 ED indication': 'No EPA ED indication',
}

const PAN_HHP = 'https://pan-international.org/wp-content/uploads/PAN_HHP_List.pdf'

/** "January 2009 (original list)" with the inference said out loud. */
export function panAddedText(l: PanListing): string {
  return l.added.inferred ? `${l.added.text}, assumed` : l.added.text
}

/**
 * The publications behind the criteria a substance meets on the PAN list,
 * each noting which of its criteria it supplies. The PAN list itself and the
 * ECHA export are general sources, named on the tile instead. Read from the workbook's Sources
 * sheet, so a source PAN uses for a criterion this substance does not meet is
 * left out.
 */
export function panSources(listings: PanListing[]): { label: string; url: string; note?: string }[] {
  const all = dataset.meta.pan?.sources ?? []
  const supplies = new Map<number, string[]>()
  for (const l of listings)
    for (const c of l.criteria)
      for (const i of c.sources) {
        const labels = supplies.get(i) ?? []
        if (!labels.includes(c.label)) labels.push(c.label)
        supplies.set(i, labels)
      }
  return Array.from(supplies.keys())
    .sort((a, b) => a - b)
    .map(i => ({
      label: all[i].source,
      url: all[i].url,
      note: [all[i].version, `for: ${supplies.get(i)!.join(', ')}`].filter(Boolean).join(' · '),
    }))
}

export function edspAdverse(tag: string): boolean {
  return !!tag && tag !== 'No Tier 1 ED indication'
}

/**
 * ECHA's own endocrine-disruptor assessment, where the row carries one.
 *
 * The export holds endocrine-disruptor information twice: as a PACT activity
 * in the ED columns, and as a compiled entry in the endocrine-disruptor list
 * columns at the far right. Where the first is present it is the one to use —
 * it is ECHA's activity record, with its own status and dates — so the list
 * entry is not shown as well and the same finding is not counted twice.
 *
 * Every row that carries any ED column carries a status, so the activity is a
 * faithful test of "the ED columns say something".
 */
export function edAssessment(record: PactRecord): PactActivity | null {
  return record.activities.find(a => a.area === 'ED') ?? null
}

export function hasEdAssessment(record: PactRecord): boolean {
  return edAssessment(record) !== null
}

/** A hazard list the substance is on, or an assessment asking whether it
 *  belongs on one. Both are shown the same way: the publication on top, what
 *  it says beneath. */
export interface HazardFlag {
  /** The publication, which is also the card's heading. */
  label: string
  /** The same in the two or three words a tile note has room for. */
  short: string
  value: string
  note: string
  /** Where the value can be checked. */
  url: string
  /** The publication's own conclusion, verbatim, where it gives one. */
  quote?: string
  /** Set where AI read the entry out of the publication. */
  ai?: import('./types').AiSource
  /** The individual criteria behind the listing, where it is met on several
   *  grounds — PAN's "Highly toxic to bees", "Fatal if inhaled" … */
  criteria?: string[]
  /** The publications those criteria are read from, for the ⓘ on the card. */
  sources?: { label: string; url: string; note?: string }[]
  /** Amber for a listing or an open question; plain where an assessment
   *  concluded without identifying anything, because colouring that as a
   *  hazard would invert what it reports. Nine of the sixteen endocrine
   *  assessments concluded "not ED" or "inconclusive". */
  adverse: boolean
}

export function flagList(record: PactRecord): HazardFlag[] {
  const { flags } = record
  const out: HazardFlag[] = []

  if (flags.carcinogen) {
    out.push({
      label: 'US EPA carcinogen list',
      short: 'Carcinogen',
      value: flags.carcinogen,
      note: flags.carcinogenYear ? `classified ${flags.carcinogenYear}` : '',
      url: NPIC_CARCINOGEN,
      adverse: true,
    })
  }

  // ECHA's assessment where there is one, the compiled lists otherwise — and
  // the source named on the card is whichever of the two it came from.
  const ed = edAssessment(record)
  if (ed) {
    const open = adverseActivity(ed.status)
    out.push({
      label: 'ECHA endocrine disruptor assessment',
      // Where it concluded without finding anything, the outcome is the useful
      // thing to put on the tile — "ED assessment" alone would read as an open
      // question. The brackets are ECHA's; flattening them keeps it one line.
      short: open ? 'ED assessment' : ed.status.replace(/[()]/g, '').trim(),
      value: ed.status,
      note: [
        ed.intention ? `intention ${formatDate(ed.intention)}` : '',
        ed.updated ? `updated ${formatDate(ed.updated)}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
      // The activity's own page where the export gives one, the list it sits
      // on otherwise. Same publisher either way.
      url: ed.url || ECHA_ED_ASSESSMENT,
      adverse: open,
    })
  } else if (flags.edList) {
    out.push({
      label: 'Endocrine disruptor lists',
      short: 'Endocrine disruptor',
      value: flags.edList,
      note: [flags.edStatus, flags.edEffects].filter(Boolean).join(' · '),
      url: ED_LISTS,
      adverse: true,
    })
  }

  // A different authority from ECHA's assessment, so it stands beside it rather
  // than replacing it.
  if (flags.edspTag) {
    out.push({
      label: 'US EPA EDSP Tier 1 screening',
      short: EDSP_SHORT[flags.edspTag] ?? `EPA: ${flags.edspTag}`,
      value: flags.edspTag,
      note: 'weight-of-evidence conclusion, 2015 · tag read against the EU ED criteria',
      url: EPA_EDSP,
      quote: flags.edspConclusion,
      adverse: edspAdverse(flags.edspTag),
      ai: 'epa-ed',
    })
  }

  // An NGO list rather than an authority's, but a published one with stated
  // criteria. One card however many PAN entries name the substance — it is one
  // list — with every criterion met across them.
  const pan = record.pan ?? []
  if (pan.length) {
    const criteria = Array.from(new Set(pan.flatMap(l => l.criteria.map(c => c.label))))
    const overall = dataset.meta.pan?.sources.find(s => s.group === 'Overall' && s.columns === 'All')
    out.push({
      label: 'PAN International HHP list',
      short: 'PAN HHP',
      value: 'Highly Hazardous Pesticide',
      note: [
        pan.length === 1
          ? `added ${panAddedText(pan[0])}`
          : pan.map(l => `as ${l.panName}, added ${panAddedText(l)}`).join(' · '),
        dataset.meta.pan?.edition ? `list of ${dataset.meta.pan.edition}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
      url: overall?.url || PAN_HHP,
      // PAN's footnote, where the entry has one — pyrethrins came off the list
      // in 2013 and went back on in 2019. Written lower-case after the name.
      quote:
        pan
          .map(l => l.note && l.note[0].toUpperCase() + l.note.slice(1))
          .filter(Boolean)
          .join(' ') || undefined,
      criteria,
      sources: panSources(pan),
      adverse: true,
    })
  }

  return out
}

/**
 * How many potential hazards the substance actually has.
 *
 * Not the number of cards and rows on the panel: an assessment that concluded
 * the substance is not an endocrine disruptor is shown, because knowing it was
 * checked is worth something, but it is not a potential hazard and does not
 * count as one.
 */
export function hazardTally(record: PactRecord): number {
  return (
    flagList(record).filter(f => f.adverse).length +
    hazardAreaActivities(record).filter(a => adverseActivity(a.status)).length
  )
}

/** Whether the panel has anything at all to show — including the assessments
 *  that count for nothing. */
export function hazardShown(record: PactRecord): number {
  return flagList(record).length + hazardAreaActivities(record).length
}

/** The hazard assessments still shown as rows — everything flagList has not
 *  already lifted onto a card. */
export function hazardAreaActivities(record: PactRecord): PactActivity[] {
  const lifted = hasEdAssessment(record)
  return hazardActivities(record.activities).filter(a => !(lifted && a.area === 'ED'))
}
