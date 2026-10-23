// The data contract for lib/substances.json — one record per
// active substance × product type, as ECHA publishes them.

/** Approval status. ECHA leaves the field blank while a first application is
 *  still running; the converter writes that state as "Pending". */
export type ApprovalStatus =
  | 'Approved'
  | 'Pending'
  | 'Expired'
  | 'Not approved'
  | 'No longer supported'

/** Coarse band for the approval end date, computed against the export date. */
export type EndBucket = 'expired' | '12m' | '24m' | '60m' | 'beyond' | 'none'

export interface Substance {
  /** BAS number + product type, e.g. "1299-PT18". */
  id: string
  name: string
  /** "PT18" | "PT19" */
  pt: string
  /** The product type spelled out, e.g. "Repellents and attractants". */
  ptName: string

  // Identifiers
  ec: string
  cas: string
  bas: string
  rml: string

  // Approval
  /** ISO date, or "" when no approval has been granted. */
  startDate: string
  endDate: string
  endBucket: EndBucket
  approvalStatus: ApprovalStatus

  // Assessment
  authority: string
  assessmentStatus: string
  assessmentSubStatus: string

  // Regulatory detail
  legalAct: string
  legalActUrl: string
  r4bp: string
  /** "Yes" | "No" | "Under assessment" */
  substitution: string
  reviewProgramme: boolean
  newActiveSubstance: boolean
  annexI: boolean
  inclusionCategory: number
  products: number

  // Links back to ECHA
  factsheetUrl: string
  substanceUrl: string

  // Added by Pelsis alongside the ECHA export
  /** The BPC's most recent published opinion, e.g. "May be renewed". Empty
   *  when none has been published yet. */
  bpcOpinion: string
  bpcOpinionUrl: string
  /** The approval runs longer than the statutory maximum (10 years, or 7 for a
   *  candidate for substitution), implying the expiry date was moved. */
  expiryPostponed: boolean
}

export interface DatasetMeta {
  source: string
  sourceFile: string
  /** ISO date the export was pulled. */
  exportDate: string
  /** ISO date ECHA last updated the database. */
  lastUpdated: string
  productTypes: string[]
  count: number
}

export interface Dataset {
  meta: DatasetMeta
  substances: Substance[]
}

// ── Article 95 suppliers ─────────────────────────────────────
// The suppliers ECHA lists as entitled to place this active substance, or
// products containing it, on the EU market. Listed per substance × product
// type; the substance identity columns of the source are dropped, since the
// app already holds them.

export interface Supplier {
  /** The listed entity, often "X (Acting for Y)". */
  entity: string
  country: string
  /** "Substance Supplier" | "Product Supplier" | "Substance & Product Supplier" */
  type: string
  /** Why they are on the list — e.g. "RP Participant", "Art. 95 submission". */
  reason: string
  /** ISO date the substance–product type pair entered the list. */
  listedAsPt: string
  /** ISO date this supplier entered the list. */
  listedSupplier: string
}

export interface SupplierDataset {
  meta: {
    source: string
    sourceFile: string
    /** ISO date of the list edition, read from the source filename. */
    listDate: string
    count: number
    supplierCount: number
    unmatchedGroups: number
  }
  /** Keyed by substance id — matching is resolved at build time. */
  bySubstance: Record<string, Supplier[]>
}

// ── Expressions of interest in renewal ───────────────────────
// ECHA's courtesy list of who intends to apply for renewal of an active
// substance, and the statutory deadline for doing so.

/** ECHA states the outcome in the same column as the company name. */
export type InterestState =
  | 'submitted'      // a renewal application has been filed
  | 'interested'     // a company has expressed interest; see `companies`
  | 'no-interest'    // nobody has expressed interest so far
  | 'none-received'  // the deadline passed with no application
  | ''               // the substance is not on the list

export interface InterestCompany {
  name: string
  country: string
}

export interface RenewalInterest {
  state: InterestState
  /** ISO date — ECHA's own stated AS-RNL filing deadline. */
  deadline: string
  companies: InterestCompany[]
}

export interface InterestDataset {
  meta: {
    source: string
    sourceFile: string
    /** ISO date the list itself states it was prepared as of. */
    preparedAs: string
    count: number
    unmatched: number
  }
  bySubstance: Record<string, RenewalInterest>
}

// ── Authorised biocidal products ─────────────────────────────
// Products are grouped into "families" by their reference authorisation number:
// one dossier authorised across many national markets. Summaries are bundled;
// the per-product detail is fetched on demand from public/products/<id>.json.

/** Live while any authorisation in the family still stands. */
export type FamilyState = 'live' | 'dead'

export interface ProductFamily {
  /** Reference authorisation number, e.g. "BE-0017141-0000". */
  reference: string
  /** The trade name most of the family's authorisations carry. */
  name: string
  /** Parent brand, with national subsidiaries folded in. */
  holder: string
  markets: string[]
  /** "National" | "Union" | "Simplified" */
  kind: string
  live: number
  expired: number
  cancelled: number
  state: FamilyState
  /** ISO date of the family's latest authorisation end. */
  end: string
}

export interface ProductSummary {
  products: number
  families: number
  /** Parent companies holding at least one *live* authorisation. */
  holderGroups: number
  /** Parent companies that have ever held one, live or not. */
  holderGroupsEver: number
  marketAreas: number
  /** Markets with at least one live authorisation. */
  marketAreasLive: number
  unionLive: number
  unionTotal: number
  /** Year of the most recent authorisation grant, 0 when none. */
  newestGrant: number
  /** Authorisations whose own end date outlives the substance approval. */
  pastExpiry: { total: number; national: number; union: number; other: number }
  /** The same counts in the export the trend compares against (meta.trend);
   *  absent when there is no export old enough. */
  trend?: ProductTrend
  list: ProductFamily[]
}

export interface ProductTrend {
  /** Export date of the export compared against. */
  since: string
  products: number
  holderGroups: number
  marketAreasLive: number
}

export interface ProductDataset {
  meta: {
    source: string
    sourceFile: string
    exportDate: string
    substanceCount: number
    productCount: number
    /** Which export the trends compare against; empty when none is old enough. */
    trend: { since?: string; sourceFile?: string; days?: number }
  }
  bySubstance: Record<string, ProductSummary>
}

/** One authorisation in one market — only in the on-demand detail files. */
export interface ProductAuthorisation {
  tradeNames: string[]
  market: string
  holder: string
  /** "Authorised" | "Expired" | "Cancelled" */
  status: string
  kind: string
  start: string
  end: string
  asset: string
  nationalNumber: string
  reference: string
  fieldOfUse: string
  userCategory: string
  /** The latest change between two consecutive product exports, if any. */
  change?: ProductChange
}

export interface ProductChange {
  kind: 'new' | 'cancelled' | 'expired' | 'authorised' | 'status'
  /** The status in the earlier export; empty for a new authorisation. */
  was: string
  /** Export date of the first export to show the change. */
  date: string
  /** Export date of the one before. */
  since: string
}

export interface ProductFamilyDetail {
  reference: string
  name: string
  holder: string
  kind: string
  state: FamilyState
  products: ProductAuthorisation[]
}

export interface ProductDetail {
  families: ProductFamilyDetail[]
}

// ── Renewal-signal feeds ─────────────────────────────────────
// One curated feed per substance (not per product type): dated records, each
// carrying a judgement about what it implies for the substance's renewal.

/** Which way a record points for the substance's renewal prospects. */
export type SignalDirection = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'

/** Whether the reading is stated by the source or drawn from it. */
export type SignalBasis = 'documented' | 'inference'

export interface FeedSignal {
  direction: SignalDirection
  /** −3…+3. Sign repeats `direction`; the magnitude is the weight. */
  strength: number
  /** "Decisive" | "Strong" | "Weak" — the analyst's own wording. */
  label: string
  basis: SignalBasis | string
  /** Why this record was read the way it was — shown alongside the summary. */
  rationale: string
}

export interface FeedSource {
  citation: string
  /** e.g. "recital 2". Empty when the whole document is the reference. */
  pinpoint: string
  /** "PRIMARY" | "SECONDARY" … */
  tier: string
  /** False when the citation hasn't been checked against the document. */
  verified: boolean
  url: string
  note: string
}

export interface FeedRecord {
  /** ISO date. */
  date: string
  /** How much of the date is known: "day" | "month" | "year". */
  datePrecision: string
  /** True when the date was worked out rather than stated by a source. */
  dateDerived: boolean
  /** What the date stands for, where it is not simply when the thing happened
   *  — e.g. "First recorded date". Shown beside it. */
  dateNote?: string
  /** What that note means, in a sentence, behind an ⓘ beside it. */
  dateNoteInfo?: string
  /** Which signal produced the record — the axis the timeline filters on.
   *  See RECORD_KINDS in lib/feeds.ts for the set and how each one reads. */
  kind?: string
  /** What the record is about, where its kind does not settle it — e.g. a US
   *  EPA listing, which is a hazard record from a non-EU authority. See
   *  lib/categories.ts. */
  category?: import('./categories').SignalCategory
  title: string
  summary: string
  tags: string[]
  /** Findings in this record that could block or slow the renewal, e.g.
   *  "Endocrine disruption". The dashboard's blocker strip is the union of
   *  these across the feed, so every chip is traceable to its record. */
  blockers: string[]
  signal: FeedSignal
  sources: FeedSource[]
  /** Set where the record was read or written by AI rather than taken from
   *  a datasheet export — which source, for the "AI" tag's note. */
  ai?: AiSource
  /** Set on records taken from an NGO watch report (kind 'ngo'). These are
   *  indirect, so they are drawn lighter and kept out of the tallies. */
  ngo?: NgoMeta
}

export interface NgoMeta {
  /** 1 = direct to the BPR file … 3 = weakest carry-over. Null when the report
   *  ranked its items without tiers. */
  tier: number | null
  /** The tier as the report names it — "1" or "A". */
  tierName: string
  /** Position in the report's ranked list, 1 = most likely to matter. */
  rank: number
  /** The report's own heading for the tier, e.g. "Direct to the BPR file". */
  tierLabel: string
  /** The NGO(s) behind the item. */
  org: string
  /** Supporting material — the report's "Also:" links. The record's own
   *  sources are the main ones; these sit behind a toggle on the card. */
  extra?: FeedSource[]
  /** ISO date the report was run. */
  runDate: string
  /** Set on items from a class watch, or the horizontal one: they are about a
   *  group, not one substance. Absent on substance-specific items. */
  scope?: NgoScope
  /** The substances a class or horizontal item names outright, as the report
   *  spells them. Empty when it names none. */
  named?: string[]
}

/** What AI did, by where the data came from. See components/AiTag.tsx. */
export type AiSource =
  | 'ngo'
  | 'postponements'
  | 'bpc-meeting'
  | 'approval-act'
  | 'ppp'
  | 'epa-ed'

export interface NgoScope {
  /** 'class': a chemical class, shown on each member's page. 'horizontal':
   *  EU policy reaching every substance, shown on the all-signals timeline only. */
  kind: 'class' | 'horizontal'
  /** "pyrethroid", "juvenile-hormone-analogue", "horizontal". */
  slug: string
  /** The class as the report names it, e.g. "PFAS". */
  label: string
}

/** Standing facts about the renewal, carried on the feed rather than derived
 *  from the records — a single record can document three postponements, so a
 *  count of tagged records would be wrong. Hand-maintained alongside the
 *  research; every value should be traceable to a record in the same file. */
export interface FeedRenewal {
  /** ISO date the renewal application was filed. Empty when none has been. */
  started: string
  /** How the evaluation is being run, e.g. "Full Article 14(1) evaluation". */
  track: string
  /** How many times the expiry date has been postponed. */
  postponements: number
}

export interface SubstanceFeed {
  name: string
  ec: string
  cas: string
  sourceFile: string
  /** Absent on feeds that don't carry the block. */
  renewal: FeedRenewal | null
  /** Newest first. */
  records: FeedRecord[]
}

export interface FeedDataset {
  meta: { count: number; recordCount: number }
  feeds: SubstanceFeed[]
}

// ── EU Pesticide Database ────────────────────────────────────
// The same molecules under the plant-protection regulation, (EC) No 1107/2009.
// A separate regime from the BPR — different uses, different exposure, a
// different dossier — so a non-approval there is a precedent, not a verdict.

/** Added to the export by Pelsis, not published by the Commission. Kept in its
 *  own object so it can never be mistaken for the EU's own columns. */
export interface PppAnalysis {
  /** How the approval ended, e.g. "Non-inclusion - no dossier submitted". */
  mechanism: string
  /** Whether safety drove it — "No - commercial", "Yes - refused on the merits". */
  safetyBased: string
  primaryReason: string
  reasonDetail: string
  /** The act that ended it. */
  keyAct: string
  /** The chain of acts, oldest first. */
  history: string
  /** How far the analysis stands behind itself: "High", "Low", … */
  confidence: string
  /** The document the reading rests on — usually a EUR-Lex link. */
  source: string
  /** A caveat about the underlying row, where there is one. */
  qualityFlag: string
}

export interface PppRecord {
  /** The pesticide database's own name for the substance. */
  name: string
  euId: string
  /** "Approved" | "Not approved" */
  status: string
  approvalDate: string
  expiryDate: string
  /** The PPP regime's own substitution finding — its wording, not a Yes/No. */
  substitution: string
  legislation: string
  /** Rapporteur member state, with the co-rapporteur where there is one. */
  rms: string
  /** Country codes with a national authorisation. */
  authorised: string[]
  classification: string
  ai: PppAnalysis
}

export interface PppDataset {
  meta: {
    source: string
    sourceFile: string
    note: string
    rows: number
    count: number
    unmatched: number
  }
  bySubstance: Record<string, PppRecord>
}

// ── Substitution / derogation consultations ──────────────────
// ECHA consults publicly before deciding whether a substance is a candidate for
// substitution, and before granting a derogation from the Article 5(1)
// exclusion criteria. A row states the conditions the substance is *said* to
// meet and what was consulted on — the evidence behind the substitution flag,
// not the decision that followed it.

export interface ConsultationLink {
  label: string
  url: string
}

export interface Consultation {
  /** "CfS" | "Derogation" | "CfS & Derogation" */
  scope: string
  /** "open" while it is still taking comments, "closed" once it has run. */
  state: 'open' | 'closed'
  /** The name as the consultation wrote it. */
  name: string
  /** Every product type consulted on, e.g. ["PT18", "PT19"]. */
  productTypes: string[]
  start: string
  deadline: string
  intendedUse: string
  /** The substitution criteria said to be met — Article 10(1)(a)–(f). */
  article10: string
  /** The exclusion criteria said to be met — Article 5(1)(a)–(e). */
  article5: string
  additional: string
  /** Where to comment, on an open consultation. */
  link: string
  received: ConsultationLink[]
  attachments: ConsultationLink[]
}

export interface ConsultationDataset {
  meta: {
    source: string
    sourceFiles: string[]
    rows: number
    count: number
    unmatched: number
  }
  /** Newest consultation first. */
  bySubstance: Record<string, Consultation[]>
}

// ── PACT: ECHA's Public Activities Coordination Tool ─────────
// What any EU authority is doing about the substance outside the biocides file
// — substance and dossier evaluation, PBT and endocrine-disruptor assessment,
// a harmonised classification proposal. None of it decides the renewal; a live
// CLH proposal or an open ED assessment is the kind of thing that lands on one.

export interface PactActivity {
  /** "CLH", "ED", "DEv" … */
  area: string
  /** The area spelled out, e.g. "Harmonised classification (CLH)". */
  areaLabel: string
  /** Where the activity has got to, in ECHA's words. */
  status: string
  /** ISO date the intention was registered. Often absent. */
  intention: string
  /** ISO date ECHA last touched it. */
  updated: string
  url: string
}

/** Membership of lists kept outside PACT, carried in the same export. */
export interface PactFlags {
  /** US EPA carcinogen classification, e.g. "Group C — Possible Human Carcinogen". */
  carcinogen: string
  carcinogenYear: string
  /** Which endocrine-disruptor list, e.g. "List I — identified ED". */
  edList: string
  edStatus: string
  /** "Health", "Health and environment" … */
  edEffects: string
  /** US EPA EDSP Tier 1 conclusion read against the EU ED criteria:
   *  "Potential ED", "Unresolved" or "No Tier 1 ED indication". */
  edspTag: string
  /** EPA's weight-of-evidence conclusion, verbatim. */
  edspConclusion: string
}

export interface PactRecord {
  /** PACT's own name for the substance. */
  name: string
  description: string
  /** Newest first. */
  activities: PactActivity[]
  flags: PactFlags
  /** PAN International HHP listings. Usually one; aluminium and magnesium
   *  phosphide are listed in their own name and again as phosphine. */
  pan?: PanListing[]
}

/** When a pesticide went onto the PAN HHP list. */
export interface PanAdded {
  /** As the workbook gives it, e.g. "January 2009 (original list)". */
  text: string
  /** ISO date; a range is dated at its end. */
  date: string
  /** "month" | "year" */
  precision: string
  /** Not on PAN's list of additions since 2009, so assumed to be original. */
  inferred: boolean
  /** PAN gives a span of years, e.g. "2009–2011". */
  range: boolean
}

export interface PanCriterion {
  /** PAN's column, e.g. "highly toxic bees". */
  key: string
  /** The same spelled out, e.g. "Highly toxic to bees". */
  label: string
  /** PAN's criterion group: "Acute toxicity", "Long-term effects" … */
  group: string
  /** Indexes into meta.pan.sources: the publications behind the column. */
  sources: number[]
}

export interface PanListing {
  /** PAN's name for the pesticide, which may differ from ECHA's. */
  panName: string
  cas: string
  added: PanAdded
  /** The criteria met, in PAN's column order. */
  criteria: PanCriterion[]
  /** A footnote on this entry, e.g. a deletion and re-listing. */
  note: string
}

export interface PanSource {
  group: string
  /** The PAN columns it supplies, as the Sources sheet names them. */
  columns: string
  source: string
  version: string
  url: string
  note: string
}

export interface PactDataset {
  meta: {
    source: string
    sourceFile: string
    rows: number
    empty: number
    count: number
    unmatched: number
    edspSourceFile?: string
    pan?: { sourceFile: string; edition: string; sources: PanSource[] }
  }
  bySubstance: Record<string, PactRecord>
}

// ── Article 14(5) postponements ──────────────────────────────
// One Commission decision moving an approval's expiry date. The acts the
// substance export names but does not unpack: who asked, how long was granted,
// and — where the recital says — why the evaluation ran late.

export interface Postponement {
  /** The decision number, e.g. "2025/349". */
  decision: string
  decisionUrl: string
  /** "1st" | "2nd" | "3rd" | "1st and only" */
  sequence: string
  /** ISO date adopted. Year-only for the three never retrieved. */
  adopted: string
  adoptedPrecision: string
  expiryFrom: string
  expiryTo: string
  /** As the decision puts it, e.g. "2 yr 6 mo". */
  extension: string
  authority: string
  /** The recital the quote comes from, e.g. "Recital (7)". */
  recitalRef: string
  /** The document's own words. */
  recitalQuote: string
  /** False where the decision text could not be retrieved. */
  retrieved: boolean
  /** Added by Pelsis, not the Commission: why the delay, in a few words. */
  reason: string
  /** Also Pelsis's: what the decision implies read against the others. */
  inference: string
}

export interface PostponementRecord {
  name: string
  authority: string
  /** The instrument that first approved the substance. */
  approvalOrigin: string
  /** How the renewal is being evaluated, e.g. "Full evaluation". The only
   *  source the app has for it. */
  track: string
  /** As written in the decision — sometimes two dates, e.g. "27+28 Apr 2021". */
  applicationSubmitted: string
  /** The same date in ISO, the first where there are two. Empty when the
   *  decisions never stated one. */
  applicationSubmittedIso: string
  status: string
  currentExpiry: string
  /** Oldest first. */
  postponements: Postponement[]
}

export interface PostponementDataset {
  meta: {
    source: string
    /** One export per product type. */
    sourceFiles: string[]
    note: string
    rows: number
    count: number
    unmatched: number
  }
  bySubstance: Record<string, PostponementRecord>
}

// ── BPC opinions and minority positions ──────────────────────
// Every opinion the Biocidal Products Committee has adopted on an approval or
// a renewal, and — where a member state disagreed — the minority position it
// put on the record.

export interface BpcDocument {
  label: string
  url: string
}

export interface BpcOpinion {
  /** ISO date the opinion was adopted. */
  date: string
  /** "First approval" | "Renewal" */
  stage: string
  /** The opinion document, where the export links one. */
  opinion: BpcDocument | null
  /** A member state's recorded dissent. Usually none. */
  minority: BpcDocument[]
}

export interface BpcOpinionDataset {
  meta: {
    source: string
    sourceFile: string
    rows: number
    skipped: number
    count: number
    minorityCount: number
    unmatched: number
  }
  /** Newest opinion first. */
  bySubstance: Record<string, BpcOpinion[]>
}

// ---------------------------------------------------------------------------
// The act that approved the substance, read off EUR-Lex, with the conditions
// its Annex attaches to product authorisations.

export interface ApprovalAct {
  /** "Implementing Regulation (EU) 2018/112", "Directive 2013/41/EU". */
  name: string
  /** "Initial approval (BPR Implementing Regulation)", "Renewal (BPR)", … */
  type: string
  celex: string
  /** ISO. */
  date: string
  url: string
  title: string
  /** Official Journal reference. */
  oj: string
}

/** The candidate-for-substitution finding, as the act states it. */
export interface ApprovalCfs {
  /** "Yes" | "No" | "" where the substance has no act. */
  inAct: string
  /** The Article 10(1) point, e.g. "10(1)(d)" or "10(1)(a), 10(1)(d)". */
  criterion: string
  /** What that point means, in the workbook's words. */
  meaning: string
  /** The recitals that state it, verbatim and whole. */
  rationale: string[]
}

/** REACH Annex XIII properties named in the act's recitals. */
export interface ApprovalHazard {
  /** ["vP", "T"] — the short codes, in the order the recital names them. */
  flags: string[]
  /** The same properties spelled out: "very persistent (vP); toxic (T)". */
  verbatim: string
  /** The single recital sentence stating the conclusion, verbatim. */
  clause: string
  /** Set only where the recitals discuss endocrine disruption. */
  ed: string
}

export interface ApprovalCondition {
  /** "CfS statement", "Scope limitation", "Standing requirement", … */
  bucket: string
  tags: string[]
  text: string
  /** Which act in the chain introduced it. */
  role: string
  celex: string
}

/** The earlier act, carried only where the substance has since been renewed. */
export interface InitialApproval {
  name: string
  type: string
  celex: string
  date: string
  url: string
  approvalDate: string
  approvalIso: string
  expiry: string
  expiryIso: string
  purity: string
  cfsInAct: string
  cfsCriterion: string
  hazardVerbatim: string
  hazardClause: string
}

/** One current assessment methodology, and whether this approval was assessed
 *  under it. */
export interface ApprovalMethod {
  /** "ED criteria", "PT18 emission scenarios". */
  label: string
  /** The same in the two or three characters a strip segment has room for. */
  short: string
  /** When the methodology came in, as "YYYY-MM". */
  since: string
  /** "covered" | "not covered" | "partial" | "-" (does not apply). */
  state: string
  /** Why, where the workbook gives a reason. Often empty. */
  note: string
}

export interface ApprovalRecord {
  /** Null for the 38 substance–PT pairs never approved. */
  act: ApprovalAct | null
  /** Evaluating competent authority. */
  authority: string
  opinionDate: string
  opinionType: string
  purity: string
  approvalDate: string
  /** The same date as ISO, for the record that dates the approval. */
  approvalIso: string
  expiryInAct: string
  expiryIso: string
  currentExpiry: string
  expirySource: string
  cfs: ApprovalCfs
  hazard: ApprovalHazard
  /** ECHA's own substitution field, which does not always agree with the act. */
  echaCfs: string
  renewed: boolean
  /** The seven current methodologies, in force order. Empty where the
   *  substance has never been approved. */
  methods: ApprovalMethod[]
  initial: InitialApproval | null
  conditions: ApprovalCondition[]
}

export interface ApprovalDataset {
  meta: {
    source: string
    sourceFile: string
    retrieved: string
    rows: number
    count: number
    withAct: number
    cfsInAct: number
    conditionRows: number
    conditionsDropped: number
    methodFlags: number
    unmatched: number
  }
  bySubstance: Record<string, ApprovalRecord>
}

// ── Changes between ECHA exports (lib/changes.json) ───────────

export type ExportChangeKind = 'renewal' | 'extension' | 'renewal-start' | 'expiry' | 'added' | 'removed'

/** What moved on one substance between two consecutive ECHA exports. */
export interface ExportChange {
  /** The export date of the first export to show the change. */
  date: string
  /** The export date of the one before it, which did not. */
  since: string
  kinds: ExportChangeKind[]
  /** Each tracked field that changed, as [before, after]. */
  fields: Partial<Record<'approvalStatus' | 'startDate' | 'endDate' | 'assessmentStatus' | 'assessmentSubStatus' | 'legalAct', string[]>>
  legalAct: string
  legalActUrl: string
  fromFile: string
  toFile: string
}

export interface ChangeDataset {
  meta: {
    exports: { file: string; exportDate: string }[]
    kinds: Record<string, number>
    count: number
  }
  bySubstance: Record<string, ExportChange[]>
}

// ── Product authorisations cancelled between exports (lib/productChanges.json) ──

export interface CancelledProduct {
  asset: string
  name: string
  market: string
  holder: string
  /** The status in the earlier export. */
  was: string
}

/** Authorisations cancelled between two consecutive product exports. */
export interface ProductCancellation {
  /** Export date of the first export to show them cancelled. */
  date: string
  /** Export date of the one before. */
  since: string
  fromFile: string
  toFile: string
  products: CancelledProduct[]
}

export interface ProductChangeDataset {
  meta: { exports: { file: string; exportDate: string }[]; count: number }
  bySubstance: Record<string, ProductCancellation[]>
}
