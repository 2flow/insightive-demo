import { classesFor } from './classes'
import { shortName, substances } from './data'
import type { FeedRecord, FeedSource, NgoScope, Substance } from './types'

// ─────────────────────────────────────────────────────────────
// NGO watch reports — read straight from data/reports/.
//
//   <slug>/<slug>_NGO_combined.md              one per substance
//   _classes/<class>/<class>_class_combined.md one per chemical class, plus
//                                              _classes/horizontal for EU
//                                              policy that hits every substance
//
// Each file is rebuilt by the watch after every run, baseline and updates
// merged. Only the Tier A–C (1–3) items under "## 2." become records; the
// summary, lower-relevance items, outlook and method notes stay in the report.
//
// Three scopes, each shown once where it belongs:
//   substance  — on that substance's page and on the all-signals timeline;
//   class      — once on the timeline, and on the page of every class member;
//   horizontal — on the timeline only.
// A substance file repeats, marked `via class`, any class item that names the
// substance; those copies are skipped, since the class item already reaches
// every member's page. Its section 3 (class items that do not name it) is a
// digest of the class files and is not read either.
//
// These are deliberately second-class: what NGOs say about a substance is
// indirect, and mostly about other regimes. They are their own kind ('ngo'),
// drawn lighter than the rest of the record, and left out of the tallies.
//
// Like data/feeds/, there is no build step: drop a new report in and it is
// picked up on the next load. next.config.mjs bundles .md files as text.
// ─────────────────────────────────────────────────────────────

const context = (require as unknown as {
  context: (dir: string, deep: boolean, filter: RegExp) => {
    keys: () => string[]
    (id: string): string | { default: string }
  }
}).context('../data/reports', true, /_(?:NGO|class)_combined\.md$/i)

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

const slugify = (v: string) =>
  v.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const casKey = (v: string) => v.replace(/[\s"'-]/g, '').toLowerCase()

interface NgoReport {
  slug: string
  cas: string
  runDate: string
  /** Class slugs the report puts the substance in, besides "horizontal". */
  classes: string[]
  records: FeedRecord[]
}

interface ClassReport {
  scope: NgoScope
  records: FeedRecord[]
}

function frontmatter(md: string): Record<string, string> {
  const m = md.match(/^---\n([\s\S]*?)\n---/)
  const out: Record<string, string> = {}
  if (!m) return out
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':')
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, '')
  }
  return out
}

/** The date an item opens with, in whichever of the reports' spellings, and
 *  the title that follows it. Where an item lists several dates the first —
 *  the newest — stands for it. */
function splitDate(heading: string): { date: string; precision: string; title: string } {
  // Drop a rank — "1. ", or "2.1 " in combined files — but not the day of
  // "24 June 2026".
  let h = heading.replace(/^\d+(?:\.\d+)+\s+|^\d+\.\s+/, '').trim()
  let date = ''
  let precision = 'day'

  const iso = h.match(/^(\d{4}-\d{2}-\d{2})/)
  const ym = h.match(/^(\d{4})-(\d{2})(?!-?\d)/)
  // Ranges — "20–22 May 2025", "17 Jun – 20 Jul 2026" — stand at their end,
  // the newest day they cover.
  const dRange = h.match(/^\d{1,2}\s*[–-]\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/)
  const dmRange = h.match(/^\d{1,2}\s+[A-Za-z]+\s*[–-]\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/)
  const dmy = dRange ?? dmRange ?? h.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/)
  const my = h.match(/^([A-Za-z]+)\s+(\d{4})/)
  const mon = (name: string) => MONTHS.findIndex(m => m.startsWith(name.toLowerCase().slice(0, 3))) + 1

  if (iso) date = iso[1]
  else if (ym) {
    date = `${ym[1]}-${ym[2]}-01`
    precision = 'month'
  } else if (dmy && mon(dmy[2])) {
    date = `${dmy[3]}-${String(mon(dmy[2])).padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  } else if (my && mon(my[1])) {
    date = `${my[2]}-${String(mon(my[1])).padStart(2, '0')}-01`
    precision = 'month'
  } else if (/^\d{4}\b/.test(h)) {
    // A year alone — "2026 (undated page update …)".
    date = `${h.slice(0, 4)}-01-01`
    precision = 'year'
  }

  // Drop the date and whatever trails it (other dates, "(page update)") up to
  // the separator the report used: ":", "—" or ".".
  if (date) h = h.replace(/^.*?(?::|\s—|\.)\s+/, '')
  return { date, precision, title: h.trim() }
}

/** Inline Markdown out of prose: emphasis and links, keeping the words. */
const plain = (v: string) =>
  v
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|[\s(])\*(\S[^*]*?)\*(?=[\s).,;:]|$)/g, '$1$2')
    .trim()

const URL_RE = /\[([^\]]+)\]\((https?:[^)\s]+)\)|(https?:\/\/[^\s;,)]+[^\s;,.)])/g

/** "NGO: PAN Europe and BeeLife. Letter: https://… ; BeeLife page: https://…"
 *  The organisation is what precedes the first link, up to the first break;
 *  each link is labelled with whatever text sits just before it. */
function parseNgoLine(line: string): { org: string; sources: FeedSource[] } {
  const first = line.search(/\[|https?:/)
  const prefix = first < 0 ? line : line.slice(0, first)
  const org = prefix.split(/\.\s|\s[—–]|,\s|:\s|:$/)[0].trim().replace(/[.,:;—–\s]+$/, '')
  const sources: FeedSource[] = []
  let last = org.length
  for (const m of Array.from(line.matchAll(URL_RE))) {
    const before = line
      .slice(last, m.index)
      .trim()
      .replace(/^[.,;:—(\s]+|[.,:;—(\s]+$/g, '')
      .replace(/^and\s+/, '')
      .trim()
    const label = m[1] ?? before
    sources.push({
      citation: label ? `${org} — ${label}` : org,
      pinpoint: '',
      tier: 'NGO',
      verified: false,
      url: m[2] ?? m[3],
      note: '',
    })
    last = (m.index ?? 0) + m[0].length
  }
  return { org, sources }
}

/** "deltamethrin, cypermethrin (… note)" → the names; "none (…)" → none. */
function namedList(v: string): string[] {
  const list = plain(v).replace(/\s*\(.*$/, '').trim()
  if (!list || /^none\b/i.test(list)) return []
  return list.split(/\s*,\s*/).filter(Boolean)
}

/** "- Also: [BeeLife post: …](https://…) ; [factsheet PDF](https://…)" — the
 *  supporting material under an item's main source. Each link keeps its own
 *  text as its label, or its host when it has none. */
function parseAlsoLine(line: string): FeedSource[] {
  return Array.from(line.matchAll(URL_RE), m => {
    const url = m[2] ?? m[3]
    let label = m[1]?.trim() ?? ''
    if (!label) {
      try {
        label = new URL(url).hostname.replace(/^www\./, '')
      } catch {
        label = url
      }
    }
    return { citation: label, pinpoint: '', tier: 'NGO', verified: false, url, note: '' }
  })
}

function parseReport(md: string, runDate: string, scope?: NgoScope): FeedRecord[] {
  const section = md.match(/^## 2\.[^\n]*\n([\s\S]*?)(?=^## )/m)?.[1] ?? ''
  const records: FeedRecord[] = []

  let tier: number | null = null
  let tierName = ''
  let tierLabel = ''
  type Item = { heading: string; fields: Record<string, string>; tags: string[]; provenance: string }
  let item: Item | null = null
  let field = ''
  // The `[baseline 2026-10-06]` / `[via class: pyrethroid · …]` line that
  // stands above each item in a combined file — where the item came from.
  let provenance = ''

  const flush = () => {
    if (!item) return
    // A class item copied into a member's file: the class record covers it.
    if (/^via class/i.test(item.provenance)) {
      item = null
      return
    }
    // v1 reports put date and title in one bold heading; v2 reports give
    // each its own "**Date:**" / "**Title:**" field.
    const fromHeading = splitDate(item.fields.date ?? item.heading)
    const { date, precision } = fromHeading
    const title = item.fields.title ?? fromHeading.title
    // The lowest tier (C, or 3) — indirect, use-specific items — is dropped
    // unless it bears on the BPR itself: tagged BPR or direct, or, in a report
    // without tags, about biocides.
    if (tier === 3) {
      const text = `${title} ${item.fields.summary ?? ''}`
      const bpr = item.tags.length
        ? item.tags.some(tag => /^(bpr|direct)$/i.test(tag))
        : /biocid|\bBPR\b|\bPT ?1[89]\b/i.test(text)
      if (!bpr) {
        item = null
        return
      }
    }
    const { org, sources } = parseNgoLine(item.fields.ngo ?? '')
    const extra = parseAlsoLine(item.fields.also ?? '')
    records.push({
      kind: 'ngo',
      ai: 'ngo',
      date,
      datePrecision: precision,
      dateDerived: false,
      title: plain(title),
      summary: plain(item.fields.summary ?? ''),
      tags: item.tags,
      blockers: [],
      signal: {
        direction: 'NEUTRAL',
        strength: 0,
        label: '',
        basis: '',
        rationale: plain(item.fields.why ?? ''),
      },
      sources,
      ngo: {
        tier,
        tierName,
        tierLabel,
        rank: records.length + 1,
        org,
        runDate,
        ...(extra.length ? { extra } : {}),
        ...(scope && { scope, named: namedList(item.fields.named ?? '') }),
      },
    })
    item = null
  }

  for (const raw of section.split('\n')) {
    const line = raw.trim()
    // "### Tier 1: …", "**Tier 2: …**", "### Tier A: …" — letters rank like
    // numbers (A = 1), and the report's own name is kept for display.
    const tierHead = line.match(/^(?:#{3,}\s*|\*\*)Tier\s*(\d|[A-Z])\b\s*[:.]?\s*(.*?)(?:\*\*.*)?$/i)
    if (tierHead) {
      flush()
      provenance = ''
      const t = tierHead[1].toUpperCase()
      tier = /\d/.test(t) ? Number(t) : t.charCodeAt(0) - 64
      tierName = t
      tierLabel = tierHead[2].replace(/\*+/g, '').replace(/[.:]$/, '').trim()
      continue
    }
    const prov = line.match(/^`\[([^\]]*)\]`/)
    if (prov) {
      flush()
      provenance = prov[1]
      continue
    }
    // The item's tag line: `PPP` · `EU` · `indirect–hazard` · `litigation`
    // — regime, geography, carry-over to the BPR, kind of action.
    if (item && /^`[^`]+`(?:\s*[·,]\s*`[^`]+`)*$/.test(line)) {
      item.tags = Array.from(line.matchAll(/`([^`]+)`/g), m => m[1].trim()).filter(Boolean)
      field = ''
      continue
    }
    // A labelled field: "- Summary: …", "- **Why it matters for BPR:** …",
    // "**NGO / link:** …", "1. **Date:** 2026-07-10". Checked before the bold
    // heading, which a bold label followed by text would otherwise match.
    const f =
      line.match(/^(?:\d+\.\s*|-\s*)?\*\*([A-Za-zÀ-ɏ][A-Za-zÀ-ɏ\d /+&'.()-]{1,60}?):\*\*\s*(.*)$/) ??
      line.match(/^-\s*([A-Za-zÀ-ɏ][A-Za-zÀ-ɏ\d /+&'.()-]{1,60}?):\s*(.*)$/)
    if (f) {
      const name = f[1].toLowerCase()
      // In v2 reports "Date" opens each item.
      if (name === 'date') {
        flush()
        item = { heading: '', fields: {}, tags: [], provenance }
        provenance = ''
      }
      if (!item) continue
      field = name.startsWith('why')
        ? 'why'
        : name.startsWith('ngo')
          ? 'ngo'
          : name.startsWith('named')
            ? 'named'
            : name
      // Combined files give the source as "- Beyond Pesticides: https://…" —
      // the organisation as the label. Read it as an NGO line.
      if (!['summary', 'why', 'ngo', 'also', 'named', 'date', 'title'].includes(field) && /https?:/.test(f[2])) {
        const src = `${f[1]}: ${f[2]}`
        item.fields.ngo = item.fields.ngo ? `${item.fields.ngo} ; ${src}` : src
        field = 'ngo'
        continue
      }
      item.fields[field] = f[2]
      continue
    }
    // A bare source line: "- PAN Europe — https://…".
    if (item && /^-\s/.test(line) && /https?:/.test(line)) {
      const src = line.replace(/^-\s*/, '')
      item.fields.ngo = item.fields.ngo ? `${item.fields.ngo} ; ${src}` : src
      field = 'ngo'
      continue
    }
    // An item heading: "**2025-09-30: …**", "**1. 24 June 2026: …**", or, in
    // reports ranked without tiers, "### 1. 2026-06-24 — …" / "### 2.1 …".
    const head =
      // A trailing note after the bold — "(TOP SIGNAL)" — is dropped.
      line.match(/^(?:\d+\.\s*)?\*\*(.+?)\*\*\s*(?:\([^()]*\))?\s*$/) ??
      line.match(/^#{3,4}\s+(?:\d+(?:\.\d+)*\.?\s+)?(\d.*)$/)
    if (head) {
      // A date on a bold line of its own, the title on the next:
      // "**2024-12 (edition date …)**" then "**PAN International keeps …**".
      if (item && !item.tags.length && !Object.keys(item.fields).length) {
        item.heading = `${item.heading} — ${head[1]}`
        continue
      }
      flush()
      item = { heading: head[1], fields: {}, tags: [], provenance }
      provenance = ''
      field = ''
      continue
    }
    if (!item) continue
    if (field && line && !line.startsWith('#')) {
      item.fields[field] += ' ' + line
    }
  }
  flush()
  return records
}

const read = (key: string) => {
  const mod = context(key)
  return (typeof mod === 'string' ? mod : mod.default).replace(/\r\n/g, '\n')
}

const isClassKey = (key: string) => /^\.\/_classes\//.test(key)

/** One combined file per substance folder. */
const reports: NgoReport[] = context
  .keys()
  .filter(key => !isClassKey(key))
  .map(key => {
    const md = read(key)
    const fm = frontmatter(md)
    const slug = fm.slug || key.replace(/^\.\//, '').split('/')[0]
    const runDate = fm.last_run || fm.combined_on || ''
    const classes = (fm.classes ?? '')
      .split(/\s*,\s*/)
      .map(slugify)
      .filter(c => c && c !== 'horizontal')
    return { slug, cas: fm.cas || '', runDate, classes, records: parseReport(md, runDate) }
  })

/** One combined file per class, horizontal among them. */
const classReports: ClassReport[] = context
  .keys()
  .filter(isClassKey)
  .map(key => {
    const md = read(key)
    const fm = frontmatter(md)
    const slug = fm.class_slug || key.split('/')[2]
    const scope: NgoScope = {
      kind: slug === 'horizontal' ? 'horizontal' : 'class',
      slug,
      label: fm.class || slug,
    }
    return { scope, records: parseReport(md, fm.last_run || fm.combined_on || '', scope) }
  })

const byCas = new Map(
  reports.filter(r => casKey(r.cas) && /\d/.test(r.cas)).map(r => [casKey(r.cas), r]),
)
const bySlug = new Map(reports.map(r => [r.slug, r]))
const classBySlug = new Map(classReports.map(c => [c.scope.slug, c]))

/** CAS first; the folder slug against the ECHA name for the ones with none
 *  (micro-organisms, mostly). */
function reportFor(s: Substance): NgoReport | null {
  return (s.cas && byCas.get(casKey(s.cas))) || bySlug.get(slugify(s.name)) || null
}

/** The classes a substance sits in — data/classes.json by CAS, and whatever
 *  its own report adds. Horizontal is not a class anyone belongs to. */
function classSlugsFor(s: Substance): string[] {
  const out = new Set(classesFor(s.cas).map(slugify))
  for (const c of reportFor(s)?.classes ?? []) out.add(c)
  out.delete('horizontal')
  return Array.from(out)
}

/** Every substance row in a class, PT18 and PT19 rows alike. */
export function classMembers(slug: string): Substance[] {
  return substances.filter(s => classSlugsFor(s).includes(slug))
}

/** A member's name as the class lists it — "Cypermethrin" rather than ECHA's
 *  systematic name — else the common name ECHA gives in brackets. */
export function memberLabel(s: Substance): string {
  return shortName(s)
}

/** Whether a class or horizontal item names this substance outright. The
 *  reports name members by their folder slug, or now and then by name. */
export function namesSubstance(r: FeedRecord, s: Substance): boolean {
  const named = (r.ngo?.named ?? []).map(slugify)
  if (!named.length) return false
  const own = [reportFor(s)?.slug, slugify(s.name), slugify(memberLabel(s))]
  return own.some(k => !!k && named.includes(k))
}

/** Items about this substance alone. */
export function ngoSubstanceRecords(s: Substance): FeedRecord[] {
  return reportFor(s)?.records ?? []
}

/** What a substance's own page shows: its items, and its classes' items. */
export function ngoRecords(s: Substance): FeedRecord[] {
  const own = ngoSubstanceRecords(s)
  const shared = classSlugsFor(s).flatMap(c => classBySlug.get(c)?.records ?? [])
  return shared.length ? [...own, ...shared] : own
}

/** Class and horizontal items, once each — for the all-signals timeline. */
export const ngoSharedRecords: FeedRecord[] = classReports.flatMap(c => c.records)

export const isNgo = (r: FeedRecord) => r.kind === 'ngo'
