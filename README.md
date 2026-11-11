# Substance Watch (demo)

An interactive view of ECHA's biocidal **active substances** for **PT18**
(insecticides, acaricides and products to control other arthropods) and **PT19**
(repellents and attractants) — one row per substance × product type, showing name,
product type, approval dates and status, and expanding in place to the rest of the
ECHA record.

The whole dataset is compiled into the app — there is **no backend, database, or
API**. It builds to a fully static site you can host anywhere.

Built by Insightive. Next.js (App Router) + React + Tailwind CSS — the same stack
and visual language as the Insightive Market Intelligence app.

---

## Quick start (development)

```bash
npm install
npm run dev        # http://localhost:3000
```

## Build & host as a static site

```bash
npm run build      # emits a self-contained ./out folder (static HTML/CSS/JS)
npm run preview    # serve ./out locally to check it (http://localhost:3000)
```

Deploy by uploading the contents of **`out/`** to any static host — Amazon
S3 + CloudFront, Netlify, Cloudflare Pages, GitHub Pages, or a plain nginx/Apache
directory. No Node.js runtime is needed in production.

**Hosting under a sub-path?** If the app lives at e.g. `https://host/substances/`
rather than a domain root, set `basePath` / `assetPrefix` in
[`next.config.mjs`](next.config.mjs) (commented example included) and rebuild.

`./make-export.sh` produces `substance-watch-static/` — clean source plus a
ready-to-host `out/` — for hand-off.

> Fonts (Inter Tight, JetBrains Mono) are self-hosted at build time, so the site
> makes **no external requests at runtime** and works fully offline.

---

## What's on screen

**The list.** One card per product type. Each row shows substance name (with EC /
CAS number and evaluating competent authority), approval start, approval end with
a "how long left" cue, and the approval status pill. Clicking a row expands it in
place to the full record: identifiers, evaluating CA, approval dates, legal act,
R4BP asset number, authorised-product count, candidate-for-substitution and
programme flags, and links back to ECHA (EUR-Lex, factsheet, substance information).

**Filter** by approval status, assessment sub-status, approval-end window
(already expired / within 12 months / 24 months / 5 years / beyond / no end date)
and product type. Free-text search covers substance name, EC / CAS / BAS number
and evaluating authority. Selections combine; an empty group means "all".

**Sort** by next to expire (the default), latest end date, newest approval start,
name, or approval status.

**Watchlist.** The ☆ on a row adds that substance to a watchlist stored in the
browser (`localStorage`, key `substance-watch:watchlist`); the Watchlist pill filters
the table down to it.

**Each column names its source.** The ⓘ beside a column heading opens a small
popover with the ECHA publication the column is read from — a popover rather than
a tooltip, because the answer is a link. Substance, Status and Approval end come
from the [biocidal active substances
database](https://echa.europa.eu/information-on-chemicals/biocidal-active-substances);
Renewal status draws on that *and* the [expressions-of-interest
list](https://echa.europa.eu/documents/d/guest/as-rnl_expressions_of_interest_public_en),
each labelled with what it supplies. Naming both matters on that column, because
the two publications disagree on four substances. Renewal prospects has no note
yet — it draws on five sources and they are not all ECHA's.

**Every dashboard tile names its source the same way.** Approval ends, Renewal
status and Candidate for substitution read from the substance database; Suppliers
from the [Article 95
list](https://echa.europa.eu/information-on-chemicals/active-substance-suppliers);
Product authorisations from [ECHA — Biocidal
products](https://echa.europa.eu/information-on-chemicals/biocidal-products);
Plant-protection status from the [EU Pesticides
Database](https://ec.europa.eu/food/plant/pesticides/eu-pesticides-database/start/screen/active-substances).

Two are worth explaining. **Renewal track and Postponements** have no register of
their own: they come from the Commission's postponement Decisions, so the note
links a EUR-Lex search — `"postponing the expiry date of the approval of"` +
`"product-type 18"` — and shows the query as well as the link, so it can be rerun
by hand if the URL ever rots. It was checked: 45 results, the first being the
Decision named on imidacloprid in the export. **Candidate for substitution** names
two, as you asked: the substance database for the status once decided, and — only
where one is open — that substance's *own* consultation URL from the AS-RNL export,
for the grounds while it is under consultation.

Three of those tiles are themselves controls, and a button cannot contain another
button. `ActionTile` lays the hit area over the tile as an absolutely-positioned
button and puts the source note above it in the stacking order, so both stay
clickable and separately reachable by keyboard.

**Two renewal columns**, splitting where the renewal *stands* from what bears on
how it may *go*. Any combination of cues can appear, or none.

**Renewal status** — the state of the renewal on ECHA's record:

| Cue | Colour | Fires when |
|---|---|---|
| *Assessment status + sub-status* e.g. Renewal in progress · Competent authority evaluation | blue dot | ECHA records an assessment under way |
| No renewal recorded | grey dot | an approval still in force with no assessment recorded against it |
| *Company name*, or the interest state | green / red dot | from ECHA's expressions-of-interest list — who intends to apply, or that nobody has |

The two are mutually exclusive, so the column is one answer to "is a renewal under
way?" — either the stage it has reached, or the fact that nothing is on file. On a
lapsed or refused approval the blank means nothing, so neither appears.

**Renewal prospects** — what bears on the outcome:

| Cue | Colour | Fires when |
|---|---|---|
| Signals *n* + bar strip + **Open →** | neutral box | records exist for the substance; opens its page |
| Signals coming soon + **Open →** | grey, dashed | no records yet — the page still carries the standing facts |
| Candidate for substitution | orange | ECHA's substitution field is `Yes` |
| Filing deadline passed | red | fewer than **550 days** to expiry — the Article 13(1) filing deadline — with no renewal recorded, on either the assessment status field or the expressions-of-interest list |
| Not approved as plant protection | slate | the EU Pesticide Database records the substance as not approved under Reg. (EC) No 1107/2009 |
| Company interested in renewal: *name* | light green | the expressions-of-interest list names a company — 5 substances |
| Renewal recommended by BPC | green | a BPC opinion is on file — links straight to the PDF |

The signals box leads; the derived flags sit under a "Top signals:" label beneath
it.

The interest chip **carries the company name**, shortened by the same
`supplierShortName()` the suppliers tile uses — `ARYSTA LIFESCIENCE · TAGROS
INDIA`, full names in the tooltip. It is the only chip allowed to wrap; the rest
are short enough for one line. With the name in the prospects column, the Renewal
status column no longer repeats it: an interest is a cue about how the renewal may
*go*, not a statement of where it *stands*, and that column now shows only the
list's verdict on whether anything is filed. The box carries a blue **Open →** so the way into the full record is stated
rather than left to be discovered — the arrow matches the dashboard tile that
leaves for another page, and it nudges right on hover. The grey "coming soon" box
carries it too: there are no signals yet, but the page behind it still holds the
substance's standing facts, suppliers and products.

The plant-protection chip is **slate rather than red or amber** on purpose: the
failure happened in a different regime, so it is a precedent to read rather than a
warning about this approval — and several of these lapsed for commercial reasons
rather than safety ones, which the panel on the signals page spells out. 29 rows
carry it, 13 of them still approved as biocides.

The signals box shows **one bar per record, newest first** — the same order as the
page it opens. Hue is the direction that record was tagged with (red negative,
green positive, grey neutral) and depth is its strength (−3…+3). It shows the
volume and shape of the evidence, not a score — nothing is summed, and the app
never reduces a feed to a verdict. Weak readings stay pale on purpose, so a run of
them cannot be mistaken for a strong finding. Above 16 records it keeps the newest
16 and counts the older ones as `+n` at the tail.

Approval **start** date is not a column — the list is about what happens next, so
it lives in the expanded record alongside the rest of the ECHA fields.

The 550-day window is `RENEWAL_RISK_WINDOW_DAYS` in [`lib/data.ts`](lib/data.ts) —
change it in one place. Two records can show a renewal is under way and either
one clears the flag: ECHA's assessment status field, and its
expressions-of-interest list. The list is often ahead of the status field, so
reading only the latter would flag a filed renewal as missing. `isRenewalAtRisk()`
consults both, which is what keeps the "Renewal status" tile on the feed page from
saying *Not filed* under a row that says *Renewal application submitted*.

**Suppliers (Article 95)** live on the signals page, behind the tile in the
dashboard's second row: entity, country, supplier type, inclusion reason, and the
two inclusion dates for every supplier ECHA has approved to place that substance —
or products containing it — on the EU market. Substances with no approved supplier
say so explicitly rather than showing nothing, since that absence is itself
meaningful. In the list, a row's identifier line carries an `A95` count so the
table stays scannable without opening anything.

**Product authorisations** have a page of their own at `#products/<substance id>`,
reached from the dashboard tile on the signals page or the link in an expanded row.
It opens with the headline numbers — holder groups, market areas, live union
authorisations, newest grant year — then the **families**: products grouped by
their reference authorisation number, one dossier authorised across many national
markets. Each family lists every authorisation per market with its status, dates,
trade names, holder, authorisation number and field of use; dead families are
tinted and sink to the bottom.

Neither block sits in the expanded substance row any more. The row is the ECHA
record — identifiers, assessment, approval, legal basis — and both of these
describe something else: who may supply the substance, and what is authorised on
it. They belong with the pages that carry them, so the row keeps only a link.

Watch the two product counts, which are counting different things: the row's
**Products** field is ECHA's own, one per *product*, while the link beside it and
the page itself count **authorisations**, one per product × market. Clothianidin
reads 5 and 48. They match on 39 of the 47 substances with products and diverge on
8, so neither is derivable from the other.

The headline tiles count **live authorisations only** — a holder or a market whose
last authorisation lapsed is not a current route to market. Where the all-time
figure is higher it sits beside the live one as "of N", so the drop-off stays
visible: Indoxacarb reads *Holder groups 2 of 3* because DuPont's single Portuguese
authorisation expired in 2019, and Bendiocarb reads *0 of 2* in red because its
whole product estate has lapsed. The counts of authorisations, families and the
per-family live/expired/cancelled breakdown remain all-time.

Substances vary enormously — one has 791 authorisations across 197 families — so
the expanded row lists only the first six families, and the page opens families
collapsed once there are more than eight.

**Every substance has a signals page**, at `#feed/<substance id>`. The signals box
in the Renewal prospects column opens it, whether or not a feed has been researched
— as does the "Open feed" call-out in the expanded row, where there is one.

What the page always carries is the **dashboard of standing facts** — months to
expiry, how long the renewal has been running, the evaluation track, the number of
postponements, substitution status, and how many product authorisations outlive
the substance approval — then suppliers and product authorisations. All of that is
drawn from the ECHA exports, which cover all 99 substances.

**Substances awaiting a first approval** get a different dashboard. 16 of the 99
have never been approved — ECHA leaves the approval status blank while a first
application runs, which the converter writes as `Pending` — and for those there is
no renewal to describe. "Renewal status" becomes **"Status"** and carries ECHA's
assessment status and sub-status instead ("Initial application for approval in
progress / Competent authority evaluation"), while **Renewal track** and
**Postponements** are stood down: dashed, greyed, and noted as not applicable.
They stay on the page rather than disappearing, so the reader can see the question
was asked. `approvalStatus === 'Pending'` is the test — it covers both the 14 still
under evaluation and the 2 where the participant withdrew.

**Article 95 listings are records too.** Every supplier on that list entered it on
a stated day, and that is a dated fact about who is willing to keep the substance
on the EU market — so `lib/supplierSignals.ts` turns each listing event into a
record, tagged `Article 95 list` and sourced to the list edition. Suppliers that
entered on the same day for the same reason are one record, because that was one
event. They are **derived at runtime, not written into `data/feeds/*.json`**, so
the curated feeds stay hand-authored and a new edition of the list can never
clobber them. `recordsFor(substance)` merges the two streams by date.

The reading is deliberately weak in both directions, and turns on the inclusion
reason. `RP Participant` is neutral: the company was already in the review
programme and the entry records its transfer onto the list, not a new backer.
Every other reason — `Art. 95 submission`, `Art. 95(5) submission`,
`Third Party Dossier`, `AS not in the RP` — is weak positive: getting listed costs
a dossier or a letter of access and a fee, so it evidences a company willing to
pay for access. Neither says anything about how the evaluation will go, and the
records say so.

This is why 59 of the 99 substances now carry signals where 3 did before. The
other 40 have no approved supplier, so they still read "Signals coming soon".

**The filing deadline is a record too.** Where an approval is running down with
nothing filed against it, `lib/deadlineSignals.ts` emits one record dated the day
the statutory window closed — the approval end less the 550 days — tagged
`Article 13(1)`, weighted **strong negative** on a basis of `absence`. It fires on
exactly the condition behind the list's "Filing deadline passed" chip
(`isRenewalAtRisk()`), so the chip is always traceable to an entry and the two can
never disagree. Four substances carry it today: Clothianidin, Acetamiprid,
epsilon-Momfluorothrin and Cyfluthrin.

The record is marked `derived`, and says why it is weighted below an act on the
file: the closed window is documented, but "nothing filed" is read from an absence
in a dataset that can lag. Where ECHA publishes its own AS-RNL deadline the summary
says whether it agrees — it does, to the day, for all three of these that have one.

**Signals open newest first** — the substance's own page, the all-substances page,
and the bar strip in the list, all from one constant: `DEFAULT_ORDER` in
[`lib/feeds.ts`](lib/feeds.ts). Set it there and everything follows, so the three
cannot drift apart. A button in the section head flips a page to earliest first;
it is per-view and not remembered, since the default is the one to read in.

The strip runs the same way — **leftmost bar is the newest record**, which is the
first card on the page it opens, so position maps to position. Above 16 records it
keeps the newest 16 and counts the rest as `+n` at the tail.

Ordering goes through `orderRecords()`, which holds the **undated records out of
the sort and leads with them**. They are not events — the BPC opinion, and a few
curated standing observations — so they have no place *in* a run of dates. Holding
them out also means a reversal cannot shuffle them: they sit in the same place
whichever way the list runs.

**Each Article 14(5) postponement is a record** — `PT##-postponements-open_*.csv` into
`lib/postponements.json`, one Commission decision per row. **29 decisions across
18 substances** — 14 under PT18, 4 under PT19 — from a single "1st and only" up to
three each for Indoxacarb and magnesium phosphide.

**One export per product type, and the product type is only in the filename.** It
is read from there and used in the match, because a PT18 decision must not attach
to the PT19 row of the same molecule: the two run on separate timetables and are
postponed by separate acts. A new product type needs its own
`postponementsPT##` entry in `SOURCES` in `tools/convert_export.py`; the converter
reads the latest version of each. The card gives the decision number and link, what the expiry
moved from and to, the extension granted, the evaluating authority, and the
recital's own words about why.

They are read as **neutral**. A postponement keeps the approval alive — the
substance does not lapse while the evaluation runs on — and at the same time
records that the evaluation is late and the question still open. Neither half
outweighs the other, and deciding that it does would be the app forming a view the
documents do not state. What the reader can weigh is on the card: how often, how
long, and what the recital says.

The postponement list was read out of the decisions by AI, and `Reason_AI` and
`Inference_AI` are the client's reading, not the Commission's. The card, and the
Postponements and Renewal track tiles, carry the **AI** tag, which says so:

- the reason is a chip reading **`reason — unexplained delay`**, split on `;`
  where a decision cites more than one cause;
- where the reason column says nothing, the chip is **`reason not retrieved`** —
  a gap in the sources is not a view taken of them, and the reader should be
  able to tell a decision that gave no cause from one whose text was never read;
- `Inference_AI` is **not shown**. It is kept in `lib/postponements.json` if it is
  ever wanted somewhere quieter, but it had a block of its own on the card and
  most of what it held was provenance — "Date from recital (6) of 2024/1285" — so
  the box cost more attention than it returned.

These records carry **no reading of their own**: no "Why this reading", no
inference block. The card holds the decision, the dates, the extension and the
recital's own words, and the reason chip is the single client judgement on it.
`Recital_quote` sits in the summary, attributed to its recital.

The `INFERENCE` chip that still appears on three of them is a different thing —
the record's `basis`, the same `documented` / `inference` vocabulary the curated
feeds use. It marks the three decisions whose text was never retrieved.

Three decisions were never retrieved and carry only the year they were adopted,
read off a later decision's recital. Those are anchored to 1 January so they sort,
flagged `year` precision so the interface does not claim a day it doesn't know,
and marked **derived** with a basis of `inference` rather than `documented`.

**The Postponements tile counts these**, not the number a feed carries by hand —
Indoxacarb's feed says 0 where the register shows 3 — and its note names the latest
decision and the expiry now in force. The **Renewal track** tile reads the
`Renewal_track` column from the same decisions, which is the only source the app
has for it: before this it showed "—" on every substance but Indoxacarb. Matching is by name, with a token-overlap
fallback behind a uniqueness guard for the two Bacillus entries, which spell the
strain differently on each side. Every row's stated `Current_expiry` agrees with
the substance export's end date, which is what confirms the matching held.

**An expression of interest is a record** — `lib/interestSignals.ts`, **weak
positive**. Five substances, where the list names the company: Kieselguhr (Biofa),
Piperonyl butoxide (Endura), Imiprothrin and Phenothrin (Sumitomo), and
alpha-Cypermethrin (Arysta and Tagros, two companies).

Weak, and below the filing record, because an expression of interest is an
intention where a filing is a dossier paid for.

**The date is the list's own.** The AS-RNL export states "Prepared as of
30/June/2026" in its title block — `prepared_as()` reads it into
`meta.preparedAs` — and carries no date per entry. So the record is dated there
and labelled **(First recorded date)** beside the date itself, with the summary
spelling out what that supports: *"…the list gives no date for the entry itself,
so the interest was on the record by then rather than on that day."*

That label is `dateNote` on `FeedRecord` — for any record whose date stands for
something other than the day the thing happened. It is not the same as
`dateDerived`, which marks a date *worked out from context*; this one is stated
by the source, just not as the event's date.

Its source carries **no pinpoint**. The list is one document covering every
substance, so naming this one adds nothing the card has not already said.

Only the `interested` state becomes a record. `submitted` is covered by the filing
record where a date exists, and adds nothing dated where it does not.

**The renewal application is a record** — `lib/filingSignals.ts`, **strong
positive**. A dossier paid for and filed is the clearest evidence that someone
intends to keep the substance on the market; it sits just below the BPC opinion,
which is a judgement on the merits rather than a commitment.

The date comes from the postponement decisions, whose recitals state it outright
— *"On 27 February 2024, an application was submitted in accordance with Article
13(1)"*. **16 of the 18** substances in that data carry one; the two without are
those whose earliest decisions were never retrieved.

Four entries are two dates — `27+28 Apr 2021` — two applications filed on
consecutive days. `filing_date()` parses the first for sorting and the record
keeps the verbatim string, so neither is lost, and the title turns plural.

**The Renewal status tile uses it**, replacing the AS-RNL deadline that used to
sit there: Spinosad reads *5 yr · FILED 27+28 APR 2021* where it read *Submitted ·
ECHA DEADLINE 29 APR 2021*. A curated feed's own `renewal.started` is the
fallback, which is how Indoxacarb keeps *8 yr · FILED 28 JUN 2018* without being
in the postponement data.

With a filing date on the tile, the interest line below it became a repetition,
so it now earns its place only by naming companies — or by contradicting a filing
we can date, which would be worth seeing.

**ECHA's assessment status sits below both**, in blue, with its sub-status under
it: *Renewal in progress · Competent authority evaluation*. The figure says how
long the renewal has been running and the note says when it was filed, but neither
says that it **is** running — and on a tile headed "Renewal status" that is the
thing a reader came for. 22 substances carry it.

**The BPC opinion is a record** — `lib/bpcSignals.ts`, weighted **strong
positive**, the top of the scale. The committee that advises the Commission has
said the approval may be renewed, which is the most favourable thing on a file
short of the renewal itself. Four substances carry one, all reading "May be
renewed".

Deliberately bare: the opinion, the quote, the PDF. No rationale block — there is
nothing to add to a committee saying yes.

It carries **no date**. The substance export publishes the opinion and a link but
never when it was adopted, and inventing one would put a guess on the timeline.
Undated records **lead** the list instead — see `orderRecords()` — so a committee
saying yes is the first thing on the page rather than the last.

On a substance still awaiting a *first* approval there is no renewal to recommend,
so the title quotes the opinion instead — `BPC opinion: May be renewed` — rather
than repeating a claim the record does not support. That is epsilon-Metofluthrin
PT19, whose opinion sits on a row that has never been approved.

**A plant-protection approval that ended is a record** — `lib/pppSignals.ts`,
weighted **weak negative**. Nine substances: fipronil, Clothianidin, thiamethoxam,
Cyromazine, Cypermethrin, imidacloprid, diflubenzuron, Triflumuron and
alpha-Cypermethrin, ending between Sep 2017 and Jun 2021.

Weak on purpose. It happened under Regulation (EC) No 1107/2009 — a separate
regime, different uses, different exposure, a different dossier — so it is a
precedent worth reading rather than a finding about the biocidal approval, the
same reasoning that makes the list chip slate rather than red. And the reasons
vary enormously: imidacloprid's renewal application was withdrawn over bee risk,
while Cyromazine's simply lapsed with no renewal sought. The card states only what
the database states; the mechanism and reasoning stay in the plant-protection
panel, where they are labelled as analysis.

**Only the ones that ended.** Of the 29 substances the database records as not
approved, 9 held an approval that then expired; the other 20 were never included
— "no dossier submitted", "never applied for" — so nothing ended and there is no
date for a record to sit on. Their status is on the tile, where it belongs.

**Hazard listings and assessments are records** — `lib/hazardSignals.ts`, kept
plain: the listing or the status, the date, the link, no rationale. The EPA
carcinogen listing is dated by the year it was given (year precision, so nothing
claims a day). All 23 hazard assessments carry their own dates.

**The direction is not uniform, and cannot be.** Being on a carcinogen list is
adverse. An assessment still running is an open question that can land on a
renewal while it is being evaluated. But eleven of the twenty-three *concluded the
substance does not meet the criteria* — "Concluded (not ED)", "Concluded
(inconclusive)", "Currently no EU RRM action needed" — and colouring those red
would invert what they report:

| Reading | Count | When |
|---|---|---|
| strong negative | 1 | concluded that the criteria **are** met — Cyanamide, "Concluded (ED ENV \| ED HH)" |
| negative | 8 | still running: an open question |
| neutral | 14 | closed having found nothing, or withdrawn |

`identified()` is the test: concluded, with a parenthetical, and none of `not `,
`inconclusive`, `no eu rrm`, `no hypothesis` in it. A bare "Concluded" states no
finding either way and stays neutral.

The endocrine-disruptor lists stay on the panel rather than becoming records —
their only dates are years buried in free text about something else
("CLH classification proposed (2025)"), which is not the listing date.

**The list row carries a "Potential hazard list" cue** — red, on 15 rows. It fires
on a listing, or on a question still open. An assessment that closed having found
nothing is not a potential hazard; it is the record of one ruled out.

**An approval that has run out is a record** — `lib/expirySignals.ts`, weighted
strong negative. **17 substances**, every one of them carrying the status
"Expired", so the date and the status field agree without exception. Each cites
the ECHA export and, where ECHA names one, the act that set the approval period.

**A future expiry is not.** It is a date in the diary rather than something that
happened, and the dashboard tile and the list's countdown already carry it.
Putting the other 44 on the timeline stretched it to 2036 and made a third of "the
record" a forecast, so only the expired ones are emitted. The check is against
`asOf` — the export date — the same clock every other date calculation uses.

These 17 are why 75 of 99 substances carry signals, up from 59; the 44 approved
ones all had a record already.

**All signals on one timeline** lives at `#signals`, reached from the button beside
the list heading: every record across every substance in one run, newest first. Each card names
its substance and PT, and clicking that opens the substance's own page. Years break
the run into bands.

`allRecords()` builds it. A curated feed is matched by EC/CAS, so one feed can
serve both a substance's PT18 and PT19 rows; its records are attributed once, to
the first row that resolves it, while the Article 95 records — which really are per
product type — are not deduplicated. Four curated records carry no date at all
(standing observations rather than events); they sit under an "Undated" band at the
end whichever way the timeline runs.

The tally counts through `directionTone()` rather than matching `POSITIVE` /
`NEGATIVE` / `NEUTRAL` exactly, so a record tagged off-vocabulary is counted the
way it is coloured. One Indoxacarb record is tagged `MIXED`, and before this the
tally silently lost it — 131 of 132.

A **curated feed** of dated records, each judging what an event implies for that
substance's renewal, is the part that may be missing: three substances have one
today. Where there is no feed the page ends with a plain "Signals coming soon"
instead of the record, two tiles read "—" (the evaluation track and the
postponement count come from a `renewal` block on the feed itself, see below,
because nothing in the ECHA data records them), and there is no blocker strip,
since blockers are derived from the records.

The **blocker strip is derived**, not listed separately: each record names the
blockers it evidences in its own `blockers` array, and the strip is the union of
those. Every chip in the strip therefore appears in amber on the record it came
from, so it can be traced back — and the two can never disagree.

Beneath the dashboard sits what the renewal is *worth*: **Suppliers (Article 95)**
and **Product authorisations** for the substance, the same two blocks the expanded
row carries, each in its own card since they answer different questions. Both are
ECHA's record rather than the feed's, so they sit with the standing facts, above
the signals rather than among them. They keep their own styling by being wrapped
in a nested `.report-surface` — every rule for them is scoped to that class, and
it is also the card they were drawn to sit on, so only the frame needed adjusting
(`.fp-annex`). The expanded row keeps them too — the same data, one click closer.

**The dashboard is two rows of four.** The first holds the renewal facts —
approval ends, renewal status, renewal track, postponements. The second holds what
stands behind the substance: candidate for substitution, **Suppliers (Article
95)**, **Product authorisations past expiry** and **Plant-protection status**.

Three of those are tiles that *do* something, and the icon in the label says which:

| Tile | Figure | Line beneath | On click |
|---|---|---|---|
| Suppliers (Article 95) | supplier count | the companies, shortened — `BAYER · SUMITOMO`, up to three then `+n` | ⌄ opens the table in place |
| Product authorisations past expiry | past-expiry count, green, `of N` | national · union · **newest grant year** | → opens `#products/<id>` |
| Plant-protection status | Approved / Not approved | the approval expiry, or the approval date, or "no approval dates on record" | ⌄ opens the analysis in place |
| Candidate for substitution | ECHA's Yes / No / Under assessment | the open consultation's deadline, or how many have run | ⌄ opens the consultations in place |

Suppliers opens in place because there is no Article 95 page to send the reader to
and the table is only as long as the substance has suppliers; products has a page
of its own, so the tile goes there rather than unfolding a second summary on top of
the one already on screen. The short company names come from `supplierShortName()`,
which drops the "(Acting for …)" clause, legal forms and generic padding, then
keeps one or two words — a display hint only, since the full registered entity is
in the table one click away.

An **expanded substance row** still carries both blocks in full, since expanding
the row is already the request to see everything. There the family list keeps its
own disclosure, its label doubling as the control (`defaultOpen`).

The record itself is set at reading scale: one card per record, its left edge coloured
by direction, carrying the date (marked *derived* when it was worked out rather
than stated), a signal badge whose pips carry the weight (−3…+3) and whose words
carry the direction, the analyst's basis (*documented* / *inference*), tags, the
summary, the "why this reading" rationale, and every source with its tier,
pinpoint, link and note. Above the record sits the strongest signal and a plain
tally by direction.

Two deliberate choices:

- **Every interpretation is labelled (AI).** The line between what a document says
and what someone made of it runs through the whole app, and the label is how a
reader sees it without having to know the architecture:

| Marked | Where |
|---|---|
| **Why this reading (AI)** | the rationale tooltip on a record card (hover-only, so it keeps the words — a button cannot sit in a tooltip) |
| ⓘ beside the tally | the tally counts readings rather than facts — set by the research, or by a fixed rule for records built from exports; never combined |
| **AI** tag (opens a note) | anything not taken straight from a datasheet export — one mark, one note per source, in `components/AiTag.tsx`: NGO cards; postponement cards and the Postponements / Renewal track tiles; BPC meeting-note adoptions (card and list chip); the approval record, Approval data tile and panel (EUR-Lex act extracted by AI); the plant-protection analysis block and tile; the EPA EDSP entry in the hazard lists |

What is *not* marked is the record itself: dates, decision numbers, recital
quotes, statuses and links are the document, and adding "(AI)" to those would
blur exactly the line the label exists to draw. A gap in the sources is not a
reading either, which is why `reason not retrieved` carries no marker.

**The app never concludes.** It does not rank, weight or summarise the records
  into an overall reading, and no outcome verdict appears anywhere in the list.
  Each record carries the analyst's own direction and strength for that item
  alone; above them sits only a plain count of how the records were tagged.
  Reaching a view is the reader's job, from the record.
- The feed is a **hash route on the same page**, not a second Next route, so the
  list keeps its filters, sort and open rows while you read a feed and come back.
  URLs are still shareable and the browser back button works.

### Two things to know about the data

- ECHA leaves **approval status blank** while a first application for approval is
  still running. Those records are shown as **Pending** — that label is ours, not
  ECHA's.
- **Time to expiry is counted from the export date**, not from today, so the
  countdowns and the "ends within 12 months" tile always agree with the data on
  screen.

---

## How it's wired

```
ECHA_active-substance-…  ─┐                       ┌─▶ lib/substances.json ─▶ lib/data.ts
article_95_list_…         ├▶ tools/convert_export.py─▶ lib/suppliers.json ─▶ lib/suppliers.ts
biocidal-products-export ─┘  (latest dated copy of  └─▶ lib/products.json ──▶ lib/products.ts
  (data/baseline_*/,          each, Excel can't be      + public/products/<id>.json (lazy)
   data/updates/*/)           read in a browser)

data/feeds/*.json ─────────────────────────────────────────────────────▶ lib/feeds.ts
        (already JSON — read directly, NO build step, edit in place)
                                                                              │
                            app/page.tsx ◀────────────────────────────────────┘
                            (filter + sort state, #feed/<id>, #products/<id>)
                                   │
       components/SubstanceTable ▶ SubstanceRow ▶ SubstanceDetail ▶ SupplierTable
                                   │                    │          ProductSummary
                             app/report.css   #feed/<id> ▶ FeedPage
                                              #products/<id> ▶ ProductsPage
```

- **`data/`** — the raw source files, every dated version kept, so the dataset is
  reproducible and each update can be compared with the one before (see below).
- **`tools/convert_export.py`** — turns that export into `lib/substances.json`:
  parses dates to ISO, normalises ECHA's `-` placeholders, labels the blank
  approval status as `Pending`, and precomputes the approval-end band.
- **`lib/data.ts`** — loads the dataset and owns the date formatting, the
  time-to-expiry cue, and the filter vocabularies (derived from the data, so a new
  export can't leave a dead filter option).
- **`lib/filters.ts`** — matching helpers and the sort orders.
- **`app/page.tsx`** — the only route. A client component holding the search,
  filter, sort and watchlist state.
- **`components/`** — `SubstanceTable` (one product-type card: band, header strip,
  rows, expand-all), `SubstanceRow` (one expandable row), `SubstanceDetail` (the
  expanded record), `FilterBar` (the pill bar), `StatRow` (headline numbers),
  `useWatchlist` (the localStorage store + star), `icons`.
- **`app/report.css`** — the report's visual language (bands, pills, grid rows),
  scoped under `.report-surface`. `app/globals.css` is the app chrome (Tailwind).
- **`lib/types.ts`** — the data contract.

## Adding updated source files

Source files are versioned by date, and only the files that changed are added:

```
data/
  baseline_20_09_26/                 the first full snapshot (every source)
  updates/
    data_update_20_10_26/            only what changed that round
      ECHA_active-substance-export_20_10_26.xlsx
    data_update_DD_MM_YY/ …
```

- **Naming:** `<source name>_DD_MM_YY.<ext>`, the date being the download date —
  e.g. `ECHA_active-substance-export_20_10_26.xlsx`. The source names are listed
  in `SOURCES` at the top of `tools/convert_export.py`; a file whose name doesn't
  match one exactly is ignored. A new kind of source needs a new entry there.
- **Which version is used:** for each source, the most recent date wins, wherever
  it sits under `data/`. A source with no file in the latest update folder keeps
  its previous version. Two copies of one source with the same date stop the
  build.
- **Older versions are never deleted** — they are the record of what changed.

1. Create **`data/updates/data_update_DD_MM_YY/`** and drop in the changed files,
   renamed to the convention.
2. `npm run data` — or `python3 tools/convert_export.py path/to/export.xlsx` to
   force a specific ECHA export (needs `openpyxl`: `pip install openpyxl`). It
   prints which ECHA file it used, rewrites `lib/*.json` and prints the counts.
   It then runs the **signal-history check** (next section). If the check fails,
   the update has removed records from the timeline. Fix that before going
   further.

### Keeping signal history

A signal is a record of something that happened. It stays on the timeline when
a status later changes, and when a newer source file no longer carries the row
it was built from. Two mechanisms make sure of it.

**1. The converter keeps earlier versions.** Wherever a source has more than
one dated file, it compares them and carries forward what the latest dropped:

| Source | What is kept | Where |
| --- | --- | --- |
| ECHA substance export | every change between exports | `lib/changes.json` |
| Product export | cancellations and status changes | `lib/productChanges.json`, `public/products/` |
| Article 95 list | suppliers no longer listed; their "entered the list" record stays, noting the edition that dropped them | `formerBySubstance` in `lib/suppliers.json` |
| Renewal interest list | each entry dated by the **first** edition showing it (not the latest); earlier states and entries that left | `firstRecorded`, `pastBySubstance` in `lib/interest.json` |
| PACT | earlier statuses, dropped activities, moved list flags | `past`, `flagChanges` in `lib/pact.json` |

The other sources have one file each for now: postponements, BPC opinions,
plant-protection, approval acts, PAN and EDSP. When a second version arrives,
check what it drops.

**2. A ledger catches anything else.** `tools/check_history.mjs` runs after the
converter as part of `npm run data`.
- It compiles `lib/`, lists every record the app shows (`recordsFor()` for every
  substance, plus the class and horizontal NGO items) and compares the list with
  `data/record-ledger.json`.
- A record in the ledger that is no longer produced **fails the check** and is
  named, so the cause can be fixed in the converter before the update goes out.
- A record that was only reworded (same substance, kind and date) counts as the
  same one.
- New records are added to the ledger automatically.

Removing records on purpose, as a rule change agreed with the client, is
`npm run history:accept`. It prints what it drops. Commit
`data/record-ledger.json` with each update. Running
`node tools/check_history.mjs --root <dir>` compares another checkout against
the ledger without changing it.

On 07.11.26 the check found the renewal-interest and "application submitted"
records for 11 substances re-dated from 30 Jun to 30 Sep 2026 (the newest list).
They are now dated by the first edition. The only records removed on purpose
are the two "no EU RRM action needed" ARN conclusions (PACT rule B).

A fresh ECHA download arrives **without the columns the client adds by hand**. The
converter fills them in on its own and says so: the `Recent BPC Opinion` /
`Recent BPC Opinion PDF` values are carried over from the latest earlier export
that has them (matched by BAS number × product type; `bpcOpinionsFrom` in the
JSON meta names the file), and the expiry-postponed flag is computed from the
approval dates (next section). Add the columns to the new file whenever an
opinion needs correcting.

### What changed between exports → signals and status

The converter also compares **every ECHA export with the one before it** and
writes what moved to `lib/changes.json` (approval status, start/end date,
assessment status and sub-status, legal act — per substance, with both export
dates). Each change is classified:

| Change | Rule | What the app does |
| --- | --- | --- |
| `renewal` | end date moved later under a new Regulation, or a running renewal closed | **"Approval renewed"** signal; status reads **"Recently renewed"** for `RECENTLY_RENEWED_DAYS` (365, in `lib/approvals.ts`), then "Renewal granted"; the BPC-recommendation chip, renewal track and postponement tiles clear |
| `renewal-start` | assessment status became "Renewal in progress" | **"Renewal started"** signal — only when no "Renewal application submitted" signal (interest list or postponement Decision) already covers the renewal; otherwise status only |
| `expiry` | approval status became "Expired" | nothing extra — `lib/expirySignals.ts` already raises "Approval expired" from the end date |
| `extension` | end date moved later otherwise (e.g. postponement) | logged only |
| other field moves, `added`, `removed` | — | logged only |

ECHA gives no date for a change, so these signals are dated to the **first
export that shows them** and say so ("First recorded date"). The signal
records are built in `lib/changeSignals.ts`; the renewal status in
`renewalFor()` in `lib/approvals.ts`, which takes whichever is later of a
renewal act on file and a renewal seen between exports. Older exports must stay
in `data/` for this to work.
3. Check it locally: `npm run dev`.
4. `npm run build` for a fresh static `out/`, or `./make-export.sh` for the
   hand-off folder.

Nothing else needs touching: the product-type cards, the filter options and the
headline numbers are all derived from the data. Adding other product types (PT14,
PT21…) works the same way, though `components/SubstanceTable.tsx` maps only PT18
and PT19 to a band icon today.

## The "Expiry date postponed (WIP)" column — not yet shown

**Work in progress.** The column is computed and carried through to
`lib/substances.json` as `expiryPostponed`, but it is **not displayed anywhere in
the interface** — the rule is not yet reliable enough (see the limitations
below). Re-enabling it is a one-line change in
[`components/SubstanceRow.tsx`](components/SubstanceRow.tsx); the chip styling is
still in place.

The column is **not part of the ECHA export** — it is added to the spreadsheet
by `tools/flag_postponed.py` (latest ECHA export by default) and read straight
from there, so any row can be corrected by hand and the app will honour the
correction. When the latest export has no such column, the converter applies the
same rule itself. The converter matches
the column **by prefix**, so the "(WIP)" suffix can be dropped without breaking
anything.

```bash
python3 tools/flag_postponed.py        # writes the column; safe to re-run
```

The rule: an approval may not exceed **10 years**, or **7 years** for a candidate
for substitution (BPR Article 4(1) and Article 10(4)). A start-to-end span longer
than that cap therefore implies the expiry was moved after the original grant. It
flags 30 of the 61 rows that have an approval period.

**Two known limitations**, both of which produce false positives:

1. **Renewals look like postponements.** When an approval is renewed under
   Article 14(4) the start date stays put while the end date moves out, so the
   span covers two approval periods. epsilon-Metofluthrin spans 21 years and
   Dinotefuran 16.5 — both renewed, not postponed.
2. **The 7-year cap catches ordinary 10-year approvals.** Five substances were
   granted a standard 10-year term *and* are candidates for substitution, so the
   rule flags them although nothing moved — Clothianidin (Reg. 2015/985),
   Abamectin and fipronil (2011 Directives) among them. Their legal act is the
   original approval, not a postponement Decision.

**What a better rule would need.** The export carries no article reference — the
string "Article" appears in no cell — so the legal basis cannot be read from the
data. The only proxy is the instrument type in the free-text `Legal act` column:
postponements are Implementing *Decisions*, approvals and renewals are
*Regulations* (or, historically, *Directives*). Of the 24 rows spanning more than
10 years, 19 name a Decision, 2 name a Regulation and 3 give only a number
(`(EU) 2026/337`) and cannot be classified at all. That field is hand-typed and
holds only the most recent act, so a postponement that was later superseded by a
renewal disappears from it entirely.

Doing this properly means reading the acts themselves: each row carries a
`Link to legal act` EUR-Lex URL, and a postponement decision states its Article
14(5) basis in the recitals. That is a fetch-and-read exercise across ~60
documents, best done once and stored as a real column.

## PACT and hazard flags

`data/pact-export*.csv` is ECHA's **Public Activities Coordination Tool** — what
any EU authority is doing about the substance *outside* the biocides file, under
REACH and CLP — with two hazard-list flags carried in the same export. One row per
substance, nine activity areas, and a third dashboard row on the signals page.

**The areas are split by what they mean, not by where they came from.** A
substance evaluation, a PBT or endocrine-disruptor assessment, an assessment of
regulatory needs, SVHC identification — each is an authority asking whether the
molecule is a problem, so they sit with the hazard lists:

| Container | Holds | Colour | Opens |
|---|---|---|---|
| **Potential hazard lists** | the EPA carcinogen and endocrine-disruptor listings, the US EPA EDSP Tier 1 conclusions, the PAN International HHP list (criteria met, with the sources behind each), plus PACT activity in `SEv`, `PBT`, `ED`, `ARN`, `SVHC` | amber while running, grey once concluded | **by default** — it is the part worth reading first |
| **Regulatory activity** | the rest: `CLH`, `DEv` | blue while running, grey once concluded | on click |

A harmonised classification proposal or a dossier compliance check is procedure.
It may end in a hazard class, but the activity is a step, not a finding, and
colouring it amber would say more than it does — hence the separate container
below, in blue. `HAZARD_AREAS` in [`lib/pact.ts`](lib/pact.ts) is the whole of the
rule for the panels. Which activities become **signals** is a separate rule; see
"PACT signals" below.

None of it decides a renewal. An assessment still running is the kind of thing
that can land on one while it is being evaluated; a concluded one names what was
already looked at. Both panels say so rather than leaving it to be inferred.

The split puts **23 activities across 26 substances** in the hazard container
(20 ED, 5 ARN, 2 SEv, 1 PBT, plus 9 substances with a list flag) and **93 across
60** in the procedural one (76 CLH, 17 DEv).

**89 rows, 67 substances, 116 activities.** 31 rows are on the list with nothing
recorded against them and are dropped. Areas are read from the column codes, all
confirmed by the URLs in the file itself — `SEv` links to the CoRAP table, `ED` to
ed-assessment, `CLH` to the registry of CLH intentions, and so on. Every activity
keeps its own ECHA link, which is the source; there is no landing-page link on the
tile, because ECHA returns 403 to automated checks and an unverified URL behind an
ⓘ labelled "source" is worse than none.

Two parsing traps, both handled:

- **The `" | "` separator also appears inside a status.** `Concluded (not ED |
  inconclusive)` is one activity; `Concluded (…) | Concluded (…)` is two.
  `split_cell()` splits only at bracket depth zero, and the result is cross-checked
  against the area's own count column — a mismatch prints a warning. Splitting
  naively inflated the count from 116 to 144.
- **One PACT row can cover several ECHA names**, joined by `" | "` in the
  `Substance` column — the three Chrysanthemum extracts share one — and the export
  then repeats each activity once per name. Activities identical in all four
  fields are deduplicated.

**Open versus finished** is `isLive()`: `Concluded`, `Withdrawn` and
`Opinion adopted` are terminal, everything else is still being worked on. Opinion
adopted belongs with the finished ones — the committee has reported and ECHA's part
is over, even though a Commission decision may follow. Counting it as running put
55 of 116 activities in the wrong bucket and made almost every substance look
active; the true figure is **34 open across 24 substances**.

### PACT signals: which activities become timeline records

Decided 07.11.26. The rules live in [`lib/pactSignals.ts`](lib/pactSignals.ts):
the panels above show every activity, but only these become signals.

| | Area | What becomes a signal | Strength |
|---|---|---|---|
| A | `SEv`, `PBT`, `ED` | every status | **strong** (against) where something was identified; otherwise weak: against while open, for where it concluded "not ED / not PBT", neutral where inconclusive, bare "Concluded" or withdrawn |
| B | `ARN` | opened (still running), or concluded proposing action | weak, against. "No EU RRM action needed" is not a signal |
| C | `SVHC`, `Recom`, `Restriction` | every status | **strong** (against) for intention, submission, Candidate List, recommendation, opinion or adoption; weak for the steps between; withdrawal weak, for |
| D | `CLH` | only a proposal that **adds a class able to trigger a BPR exclusion criterion**: when it was filed, and when RAC adopted its opinion | weak, against |
| E | `DEv` | every status | weak, neutral |
| F | EPA carcinogen and ED-list columns | a value that moved between exports: newly listed, or moved into List I | **strong**, against; removed: weak, for |

**D: the exclusion test.** The classes that count are Carc., Muta. or Repr. in
category 1A/1B, ED HH / ED ENV category 1, and PBT / vPvB, all BPR Article 5(1)
exclusion criteria. Category 2 classes and Lact. don't count. A proposal still
at intention that names the hazard without a category (geraniol's
"Reproductive toxicity") counts until the category is published. The test reads
**"Classes added by the proposal"** from `pact-clh-proposals_DD_MM_YY.csv`, which
is compiled from ECHA's registry of CLH intentions. PACT itself carries only the
status. It runs in the converter (`exclusion_classes()`) and arrives as
`clh.exclusion` / `clh.exclusionPending` on each CLH activity. Each proposal is
matched to its PACT activity by substance, status and date of intention. The
panel lists the classes each proposal adds, with the exclusion-relevant ones in
red. On 07.11.26 this rule picks out deltamethrin (Repr. 1B, PBT), cypermethrin and
imidacloprid (ED ENV 1), and geraniol (reproductive toxicity, category not given).

**History.** Every PACT export under `data/` is compared with the one before
(`pact_history()`):
- An activity is identified across exports by its area and date of intention,
  or by its slot in the cell where there is no date.
- A status that moves leaves its earlier value in `past`, so the timeline keeps
  it. An activity the export stops carrying is kept in `past` too, marked
  `dropped`.
- A rewording that doesn't change the status is ignored: both still open, same
  opening word.
- Moved list values go to `flagChanges`.

**Dates.** A record takes ECHA's own date: the latest update for a status, the
date of intention for a CLH filing, the opinion date for a RAC opinion. Where
ECHA gives none, the record is dated to the **first PACT export that shows it**
and says so ("First recorded date"), like the ECHA export changes.

**Kinds.** `DEv`, `Recom` and `Restriction` records are of kind `reach`
("REACH procedure", category PACT). The rest stay `hazard`.

## Substitution consultations

`data/consultations on potential candidates for substitution*.csv`. ECHA consults
publicly before deciding whether a substance is a candidate for substitution
(Article 10(1)) and before granting a derogation from the Article 5(1) exclusion
criteria.

**Only `_Current` is converted** — the consultations still taking comments. A
closed consultation's grounds are superseded by whatever was decided, and the client
holds those conclusions separately; showing grounds beside an answered question
would only invite re-reading the question. The converter reads only the
`…_Current_DD_MM_YY.csv` export. The
`state` field and the closed rendering are left in place for when the conclusions
are added alongside the historical rows.

They open from the **Candidate for substitution tile** rather than a tile of their
own, because they are the grounds *for* that field, not a separate fact. The
tile's note carries the deadline in amber, and the entry a link to comment.

**2 rows, 1 substance** today — the alpha-cypermethrin isomer, open to 5 Oct 2026.
The other row is a product type we don't cover; a warning prints only when an
unmatched row covered PT18 or PT19, and none does. Matching is EC, then CAS, then
a punctuation-insensitive name. Product types are normalised on the way in: the
export writes `09`, `PT06` and `1` for the same idea, and `product_types()` turns
all of them into `PT9`, `PT6`, `PT1`.

A row states **the conditions the substance is said to meet** — `10(1)(d):
meeting two of the PBT criteria. BE eCA proposes that the P criterion is fulfilled
in addition to the T criterion` — the intended use consulted on, and links to the
comments received. The panel says plainly that these are grounds put out for
comment, not the conclusion; the conclusion is the substitution field above it.

Attachment columns pack several links into one cell as `name#"url"#""`;
`attachments()` pulls out the pairs and drops the empty slots.

## The EU Pesticide Database

`data/EU_Pesticide_Database_*.xlsx` is the same molecules under the
plant-protection regulation, (EC) No 1107/2009 — a **separate regime** from the
BPR, with different uses, different exposure and a different dossier. What
happened there is a precedent, not a verdict on the biocidal renewal, which is why
the tile states the status and the reasoning sits behind a click.

51 rows, matching **49 of the 99** substance rows: a PPP approval is a property of
the molecule rather than of PT18 vs PT19, so one row attaches to every substance
row sharing its CAS. 20 are approved, 31 not — and of those 31, only 9 ever held an
approval that then expired; the other 22 were never included. The ~50 substances
with no row at all were never plant-protection actives, and the tile simply does
not appear for them.

Matching is by CAS, then name, then a **punctuation-insensitive name** behind a
uniqueness check — four rows carry "No CAS allocated", and one of them writes
"(serotype H-14) strain AM65-52" where ECHA writes "Serotype H14, Strain AM65-52".
`loose_name()` compares letters and digits only, and is accepted only when it lands
on exactly one substance, so it can never pick the wrong Bti strain.

**Columns AH–AP are an AI analysis added to the export by the client, not published by
the Commission.** The converter keeps them in their own `ai` object and the panel
renders them in their own dashed, labelled block — "Why · AI analysis", with the
stated confidence. The provenance stays on the dataset's `meta.note` rather than
on every panel. Each carries a source link, and the `qualityFlag` caveats about the underlying row
(`"Row carries Permethrin's CAS…"`, `"Database cites '2002/2076' as a Decision"`)
render in amber. Nothing from this block feeds a signal, a count or a flag anywhere
else in the app.

## The expressions-of-interest list

`data/as-rnl_expressions_of_interest_*.xlsx` is ECHA's courtesy list of companies
that intend to apply for renewal of an active substance. Drop a new edition in and
re-run `npm run data`; the alphabetically last file wins. Rows are matched to
substances by EC, then CAS, then name — the same cascade the Article 95 list uses —
and anything unmatched is reported.

ECHA states the outcome in the *same column* as the company name, so the converter
splits it into a `state` plus any named companies:

| State | Shown as | Answers "is an application on file?" |
|---|---|---|
| `submitted` | "Renewal application submitted" | yes |
| `none-received` | "No application received by deadline" | yes |
| `no-interest` | "No interest in renewal so far" | yes |
| `interested` | "Company interested in renewal: *name (country)*" | **no** |

That last column is `statesFiling()`, and it decides what else the cell may show.
Three of the four states settle the filing question in ECHA's own words, so
**"No renewal recorded" is dropped beside them** — it would only repeat them, or
in the case of `submitted`, contradict them. `interested` is the exception: a
company stating it intends to apply is not an application, so there both lines
show and each says something different.

`submitted` is additionally **suppressed entirely** where ECHA's own status field
already says "Renewal in progress", since it adds nothing there.

On the feed page's **Renewal status** tile the list outranks our own reading. It
witnesses the same fact — whether an application is in — but states it in ECHA's
words and carries ECHA's date, so wherever it speaks and the feed holds no filing
date of its own, the list *is* the tile: `INTEREST_SHORT` in the value, the ECHA
deadline in the note. Our derived "Not filed / filing deadline passed" fills only
the gap where the list is silent, and never sits above a line contradicting it.
The line beneath the tile then does the one thing the value cannot — name the
companies — and is dropped when there is nobody to name.

The list also carries **ECHA's own AS-RNL filing deadline**, which is *not* shown
on the Renewal status tile. It is anchored to the expiry at the time the list was
published, so once the expiry has moved it no longer lines up with the other dates
beside it — Indoxacarb filed on 28 June 2018 against a stated deadline of 28
December 2022. The tile names the source instead. The deadline still drives the
Article 13(1) signal, where the record says exactly what it is measuring and
compares it with the date computed from the current expiry. Treat it with care: it is anchored to the expiry date *at the time the
list was published*. Where the expiry has since been postponed or renewed the
deadline is historical — 24 of the 43 matched rows now sit more than 550 days
before their current expiry, Dinotefuran by 3,106 days. For substances whose
expiry has not moved it is exact, and it corroborates the app's own 550-day rule
to the day (Clothianidin 29/03/2025, nano-silica 30/04/2027).

**Four rows contradict ECHA's own substance export**, saying a renewal application
has been submitted while the assessment status field is blank: Dinotefuran,
epsilon-Metofluthrin, Cyromazine and sulfuryl fluoride. The interface shows both
rather than picking a winner.

That gap is a trap for research done against the substance database alone. A
curated Cyromazine record dated 29 June 2026 read the unchanged status field as a
missed filing and weighted it *decisive negative* — while the AS-RNL list, against
the very same deadline, says in as many words that an application has been
submitted. The record has been deleted: once the false claim came out of it, what
was left said only that one ECHA source lags another, which is a note about our
data rather than a signal about the substance. The app already reconciles the two
sources, in `isRenewalAtRisk()` and on the Renewal status tile.

Two rules follow, for feeds written from here on:

- **Check the AS-RNL list before reading anything into a blank status field.**
- **Don't hand-write the filing-deadline signal** — the app computes it, from both
  sources, and a written one can assert what the derived one correctly declines to.

## Updating the Article 95 supplier list

Add the new list as `article_95_list_pt18_19_simplified_DD_MM_YY.xlsx` in an
update folder and re-run `npm run data`. The list's own date is read from that
filename (`…_25_09_26.xlsx` → 25 Sep 2026) and shown above the supplier table.

Only the supplier columns are carried through — entity, country, type, inclusion
reason and the two inclusion dates. The substance identity columns are used to
match rows to substances and then dropped, since the app already holds them.

**Matching happens at build time** and is reported, never silent. Rows are
grouped by substance × product type, then resolved by name first (the more
specific key — our export splits one EC number into several BAS-level entries,
and only the name says which extract a supplier is listed against), falling back
to EC and CAS:

- `!` a group matching nothing is reported and its suppliers are dropped.
- `~` a group matching several substances that share an EC/CAS is reported and
  its suppliers attach to each — Article 95 lists per EC/CAS and genuinely does
  not distinguish further.

The converter also folds spelling variants of the same value (`Substance
supplier`/`Substance Supplier`, `Art.95(5)`/`Art. 95(5)`) onto whichever spelling
the file uses most, so the interface shows one label per real value, and drops
rows the source repeats verbatim.

## Updating the product export

Add the new export as `biocidal-products-export_DD_MM_YY.xlsx` in an update
folder and re-run `npm run data`.

**Trends.** The Authorisations, Holder groups and Market areas tiles on the
product page carry a badge (+N green, −N red, ±0) comparing each count with the
newest product export at least 30 days older than the latest, by download date
(`TREND_DAYS` in `tools/convert_export.py`; an ⓘ on each tile explains it). With
no export that old, no badge is shown.

**Cancellations** are the only signal raised from product updates. Every pair of
consecutive product exports is compared on the R4BP asset number, and
authorisations whose status became `Cancelled` are written to
`lib/productChanges.json` — one entry per substance per update, which
`lib/productSignals.ts` turns into **one** "N product authorisations cancelled"
signal listing them (weak negative; strong when no live authorisation is left).
The signal is raised **only for substances whose approval status is Approved** —
after an expiry, cancellations are expected and stay in the log only.

**Recent product changes.** Each authorisation in `public/products/<id>.json`
carries its latest `change` between consecutive product exports (new, cancelled,
expired, re-authorised), dated to the first export that shows it. On the product
page, anything changed within the past 30 days (by the reader's date, like the
timeline's "New" tag) is tagged, its family is tagged and opened, and all of
them are listed together under **"Changed in the past 30 days"** at the top.

The export is far too big to bundle — ~6,600 rows, ~3 MB of per-product detail —
so the converter **splits it**:

- **`lib/products.json`** (~0.4 MB, bundled) holds one summary per substance:
  the headline counts and the family list that the expanded row renders.
- **`public/products/<substance id>.json`** (one file per substance) holds every
  authorisation. The product page fetches only the file it needs, so opening the
  app costs nothing extra. The directory is rewritten on every run.

The fetch path is relative (`products/<id>.json`), so it resolves whether the
site is hosted at a domain root or under a sub-path.

**Matching to substances.** A product row lists every active substance it
contains and every product type it's authorised for, both pipe-separated and
*not* positionally paired. The converter takes the cross product of (BAS number ×
product type) and keeps only pairs that exist as substances — so a product whose
PT14 component isn't in this export simply never matches. 5,458 of 6,597 rows
link to 47 substances; the rest are other product types.

Holder names are folded onto their parent brand ("Bayer CropScience S.r.l." and
"BAYER S.A.S" are both *Bayer*) by comparing leading words case-insensitively and
merging a longer key into a shorter one it starts with. A family's display name
is the trade name most of its authorisations share, ties going to the shortest —
reliably the brand rather than a localised variant.

## Adding or editing a renewal-signal feed

Feed files live in **`data/feeds/`** and are read **directly by the app** — there
is no build step and no generated copy. Edit the JSON, reload the page, done.
Drop a new file in and it is picked up automatically; run nothing.

The filename is for humans (`ec<EC number, dashes as underscores>_Feed.json`).
What actually matters is the `ec_list_no` inside the file, with `cas_no` as the
fallback — a mis-named file still lands on the right substance.

```jsonc
{
  "substance": { "name": "…", "ec_list_no": "266-257-8", "cas_no": "66215-27-8" },

  // Standing facts for the dashboard. Optional — omit the block and those
  // tiles read "—". Every value should be traceable to a record below; they
  // are NOT derived automatically, because one record can document three
  // postponements, so counting tagged records would undercount.
  "renewal": {
    "started": "2018-06-28",                    // ISO date the application was filed; "" if none
    "track": "Full Article 14(1) evaluation",   // the route the eCA chose
    "postponements": 3                          // times the expiry has been moved
  },

  "records": [
    {
      "date": "2026-06-29",
      "date_precision": "day",        // day | month | year — controls how it renders
      "date_derived": true,           // shows a "derived" marker
      "title": "…",
      "summary": "…",
      "tags": ["absence", "outcome"], // free text; each renders as a chip
      "blockers": ["Endocrine disruption"],  // findings that could block or slow the
                                             // renewal; shown in amber on this record
                                             // AND collected into the dashboard strip
      "signal": {
        "direction": "NEGATIVE",      // POSITIVE | NEGATIVE | NEUTRAL
        "strength": -3,               // −3…+3; magnitude drives the pips
        "label": "Decisive",          // "None" renders as just the direction
        "basis": "documented",        // documented | inference
        "rationale": "…"              // shown as "why this reading"
      },
      "sources": [
        {
          "citation": "…",
          "pinpoint": "recital 2",    // optional
          "tier": "PRIMARY",
          "verified": true,           // not rendered; kept for your own records
          "url": "https://…",
          "note": "…"                 // optional caveat, shown under the source
        }
      ]
    }
  ]
}
```

Records are re-sorted on load, so their order in the file doesn't matter. `pinpoint`, `url` and `note` may be `null`.

## Signal categories

Every record belongs to exactly one category, shown with its icon at the start
of the card and used by the filter on the All signals page (`lib/categories.ts`):

| Band | Category | Records |
|---|---|---|
| 1 · BPR renewal | Approval status | approval, expiry, postponement |
| | Renewal progress | interest, filing, deadline, BPC opinion |
| | Article 95 | Article 95 suppliers joining or leaving |
| | Products | product authorisations granted or cancelled |
| 2 · EU evidence | EU hazard findings | PACT hazard assessments and lists |
| | Plant protection | EU plant-protection approval ended or not renewed |
| | PACT (Public Activities Coordination Tool) | REACH dossier evaluation, Annex XIV recommendation, restriction |
| 3 · Context | Worldwide hazard findings | US EPA carcinogen list, GB |
| | NGO reports | `data/reports/` |

Derived records map by their kind; a record can override with `category`
(the US EPA listing does). Curated feed records can set `"category"` to one of
`approval`, `renewal`, `supplier` (Article 95), `industry` (Products), `hazard`, `ppp`, `other-eu` (REACH), `non-eu`, `ngo`;
without it they are placed from their tags.

Every card also carries an evidence tag: **Documented** (stated by the source),
**Derived** (worked out by a rule — a counted-back date, an absence, an
inference) or **Researched** (curated research and NGO reports).

## Adding an NGO watch report

NGO reports live in **`data/reports/<slug>/<YYYY-MM-DD>_NGO_report.md`**, one
folder per substance. Like the feeds, they are read **directly by the app**
(`lib/ngoSignals.ts`; `next.config.mjs` bundles `.md` files as text), so there
is no build step. Drop a new run in and the newest file in each folder is used:
latest date first, then highest version (`…_NGO_report_2.md` or `…_v2…` beats
`…_NGO_report.md`).

- **Matching:** by the `cas:` in the front matter, falling back to the folder
  slug against the ECHA name (for substances with no CAS, e.g. Bt strains).
- **What is read:** only the dated items under `## 2. Top signals`, with their
  tier (`### Tier N: …` or `**Tier N: …**`) and their `Summary`, `Why it matters`
  and `NGO` lines. The summary, lower-relevance items, outlook and method notes
  are not shown. Tier C (or 3) items — indirect, use-specific — are dropped
  unless they are tagged `BPR` or `direct` (or, without tags, are about biocides).
- **How they show:** as kind `ngo`, interleaved by date but drawn as lighter,
  smaller, dashed cards, getting fainter from Tier 1 to Tier 3. "Why it
  matters" sits behind the tier chip. They are left out of the
  negative/positive/neutral tallies, the signal strip and the "most recent"
  headline, and are counted separately as "+N NGO".

## Project structure

```
app/
  layout.tsx        fonts + metadata
  page.tsx          app shell: header, filter bar, filter/sort state
  globals.css       app chrome (Tailwind)
  report.css        report styling, scoped to .report-surface
components/
  SubstanceTable.tsx   one product-type card (band + header strip + rows)
  SubstanceRow.tsx     one substance, expandable in place; the alert chips
  SubstanceDetail.tsx  the expanded ECHA record + the "open feed" call-out
  SupplierTable.tsx    the Article 95 approved suppliers
  ProductSummary.tsx   product families summarised in the expanded row
  ProductsPage.tsx     every authorisation, as its own page (lazy-loaded)
  FeedPage.tsx         the renewal-signal feed, as its own page
  FilterBar.tsx        filter pills, sort and search
  StatRow.tsx          headline numbers for the export
  useWatchlist.tsx     localStorage watchlist + star button
  icons.tsx            dependency-free inline icons
lib/
  substances.json   the substance dataset (generated — do not hand-edit)
  suppliers.json    the Article 95 suppliers (generated — do not hand-edit)
  products.json     per-substance product summaries (generated)
  data.ts           dataset access, date formatting, alert rules, vocabularies
  suppliers.ts      supplier lookup by substance id
  products.ts       product summaries + on-demand detail fetch
  feeds.ts          reads data/feeds/*.json directly; lookup + strongest-signal
  changes.ts        changes between consecutive ECHA exports (lib/changes.json, generated)
  changeSignals.ts  renewals granted / started between exports, as records
  productSignals.ts product authorisations cancelled between exports (lib/productChanges.json)
  ngoSignals.ts     reads data/reports/*/…_NGO_report.md; Tier 1–3 items as 'ngo' records
  filters.ts        matching + sort orders
  types.ts          the data contract
tools/
  convert_export.py the .xlsx exports -> substances/suppliers/products json
data/
  baseline_20_09_26/<source>_DD_MM_YY.*              first full snapshot
  updates/data_update_DD_MM_YY/<source>_DD_MM_YY.*   only what changed that round
  feeds/<ec…>_Feed.json                              hand-edited, no build step
  reports/<slug>/<YYYY-MM-DD>_NGO_report.md          hand-added, no build step
public/
  insightive_logo_light.png
  products/<substance id>.json   per-substance authorisations (generated)
```
