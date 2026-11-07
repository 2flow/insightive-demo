# Data update 07.11.26: summary of changes

Downloaded 7 November 2026. Each source is compared with the version the app
used before this update.

| Source | Previous version | This update |
| --- | --- | --- |
| ECHA active substances (PT18/19) | 20.10.26 (export 20 Oct 2026) | export 7 Nov 2026, ECHA "last updated" 6 Nov 2026 |
| Biocidal products (PT18/19) | 20.10.26 | 07.11.26 |
| Article 95 list (PT18/19) | 25.09.26 | 07.11.26 |
| AS renewal expressions of interest (PT18/19) | list prepared 30 Jun 2026 | list prepared 30 Sep 2026 |
| PACT export (with EPA and ED-list flags) | 20.09.26 | 07.11.26 |
| CLH proposals (classes proposed / added per CLH process) | none (new source) | 07.11.26 |

## File preparation

- `active-substances-export.xlsx` → `ECHA_active-substance-export_07_11_26.xlsx`
  (renamed only).
- `biocidal-products-export_pesticides.xlsx` → `biocidal-products-export_07_11_26.xlsx`
  (renamed only).
- `art95_list_en.xlsx` → `article_95_list_pt18_19_simplified_07_11_26.xlsx`.
  - Cut down from the full ECHA list to the "Article 95 list" sheet, PT18/PT19
    rows only (5,327 → 112 rows).
  - The explanatory-note sheet and the "Annex – Timely withdrawn AS" sheet were
    dropped. Header row 1, same 10 columns as the 25.09.26 version.
- `as-rnl_expressions_of_interest_public_en.xlsx` →
  `as-rnl_expressions_of_interest_PT18-PT19_07_11_26.xlsx`.
  - Cut down to PT18/PT19 (494 → 47 rows) and rebuilt in the earlier layout:
    title block A1:I3 with a "FILTERED EXTRACT" line, explanatory note A5:I12,
    header on row 14.
  - Three cells were normalised to the earlier format: one product type written
    "PT19" (icaridin) became `19`, and two deadlines typed as text became dates.
- `pact-export-filtered-2026-11-07.csv` →
  `pact-export-filtered_updated_and_other_flags_07_11_26.csv` (renamed only).
  Same 64 columns as the 20.09.26 file, including the EPA carcinogen and
  endocrine-disruptor list columns.
- `pact-clh-proposals_2026-11-07.csv` (added in `data/updates/`) moved here as
  `pact-clh-proposals_07_11_26.csv`. This is a new source: what each CLH
  proposal classifies. All 67 rows match a PACT CLH activity. Chrysanthemum's
  CLH 1 and CLH 2 are identical, and PACT folds them into one activity.
  Peanut butter's withdrawn proposal is the only PACT CLH activity the file
  doesn't cover.
- `tools/flag_postponed.py` was not run. The "Expiry date postponed (WIP)" column
  is computed by the converter and is not shown in the interface. The 20.10.26
  export was used without it too.
- The original downloads were not kept in the repository.

## 1. ECHA active substances

- 99 substance × product-type records, unchanged in number. Nothing added or
  removed.
- **No changes** to approval status, start or end date, assessment status or
  sub-status, or legal act. This export therefore raises no renewal,
  renewal-start or expiry signals.
- Other field changes:
  - **cis-tricos-9-ene (Muscalure), PT19:** Candidate for substitution changed
    from "Under assessment" to **"No"**. This is data only and **not a signal**
    (decided 07.11.26).
  - **Deltamethrin, PT18:** related authorised biocidal products 104 → 105.

## 2. Biocidal products

5,525 → 5,560 authorisation rows. None disappeared.

### Status changes

| Asset | Product | Market | Substance | Change | In the app |
| --- | --- | --- | --- | --- | --- |
| SK-0034572-0000 | Doff Formi-Ex | Slovakia | 1R-trans phenothrin | Authorised → **Cancelled** | **Cancellation signal** (substance is Approved) |
| IE-0034400-0000 | Sojet | Ireland | imidacloprid | Authorised → Expired | Shown as a recent product change on the product page; no signal |

### New authorisations (35)

- **Icaridin (PT19), 17:**
  - Henkel: 7 lotions, Spain (ES-0036681-0001…0007).
  - Austria: Doctan Active, AttraTec, Anti-Brumm Family Protect and Heropic
    Family.
  - Others: Kruidvat Anti-Insect (Belgium), Saltidin 20% Outdoor (Greece) and
    2 placeholders in Norway (see below).
- **Margosa extract (PT19), 8:** the *Effectis* repellent range for dogs and
  cats, Norway (NO-0035121-0001…0008).
- **Deltamethrin (PT18), 4:**
  - *SOLFAC Flexx* in Spain, Italy and the Netherlands (2022 Environmental
    Science FR, i.e. Envu).
  - *Atomic Gr* in Spain (Sharda Cropchem, with piperonyl butoxide).
- **Cypermethrin (PT18), 3:** Kaeltia Cypermethrin 0.5% DP and 1% SG
  (Netherlands) and Aeroxon Anti Poissons d'Argent (France).
- **Ethyl butylacetylaminopropionate / IR3535 (PT19), 2:** Anti-Brumm Textil
  (Germany) and Loción anti mosquitos (Spain).
- **DEET (PT19), 1:** CLAC Family (Spain).
- **Permethrin (PT18), 1:** Perblu (Italy, Bleu Line, with piperonyl butoxide).
- **Transfluthrin (PT18), 1:** Raid indoor mosquito product (Finland, SC
  Johnson).

#### The two "placeholder" authorisations

NO-0035995-0001 and -0002: icaridin (PT19), holder Ferdinand Eimermacher
GmbH & Co. KG.

- Trade name: "Placeholder. No products to be traded in NO by the authorsation
  owner."
- National authorisation NO-2026-0277, valid 2 Nov – 28 Nov 2026.
- Mutual-recognition copies of the Danish authorisations DK-0035984-0001/-0002,
  which are also placeholders ("Pladsholder. Ingen distribution af produkter i
  DK", valid to 28 Nov 2035).
- Target organisms: horse flies and deer flies; ticks.

The holder keeps a valid authorisation in a country without putting a product on
the market there. The 20.10.26 export already held 6 such placeholders (DK ×2,
LU ×3, IE ×1, all icaridin). These two bring the total to 8. The app currently
counts them as ordinary authorisations.

### Holder changes (24 authorisations)

- **Bayer → SBM Développement**, deltamethrin (K-Othrine, Fastion, Baition D,
  Myrr, Ameisenfrei):
  - Belgium: 4
  - Netherlands: 2
  - Finland: 3
  - Germany: 1
- **BASF entity renames:**
  - Czechia: BASF spol. s r.o. → BASF Agro Česká republika.
  - France: BASF France SAS → BASF Agricultural Solutions France.
  - Slovakia: BASF Slovensko → BASF Agro Slovensko.
  - Products: Fendona, Canasta (alpha-cypermethrin) and Seclira (dinotefuran).
- **Omega Pharma / Jaico RDP → Perrigo Supply Chain International**, DEET
  (Cyprus, Netherlands).
- **Sumitomo Chemical Agro Europe → Sumitomo Chemical UK Sucursal en España**,
  Aroxol against Ants (Cyprus).
- **Activa s.r.l. → ENDURA S.p.A.**, Aegis (Austria).

Holder changes do not raise signals in the app.

### End-date extensions (11 authorisations)

- **DEET:**
  - Sweden: MyggA Roll On and Mosquito Milk Spray, 2026 → 2035.
  - Cyprus: Ben's Max, 2026 → 2036.
  - Germany: Nobite Hautspray, 2026 → 2027.
- **Imidacloprid, Hungary:** EC Gel csótányirtó (2026 → 2035), Maxforce White
  and Ec Gél Hangyairtó (2026 → 2027).
- **Other substances:**
  - Lambda-cyhalothrin: COMPO Hangyairtó, Hungary, 2026 → 2029.
  - Deltamethrin: Insecticide Delta Concentré (France, 2026 → 2028) and
    Deltamethrin SC 25L (Ireland, 2027 → 2028).
  - Bti: Culinex Tab plus, Germany, 2026 → 2027.

These are logged only.

## 3. Article 95 list

114 → 112 rows.

- **Clothianidin (PT18) removed from the list:** both suppliers are gone (Bayer
  S.A.S, Art. 95 submission; Sumitomo Chemical UK, RP participant). This is
  consistent with its approval having expired on 30 Sep 2026. In the app, its
  supplier table is empty, and leaving the list is not a signal (decided
  07.11.26: it continues the expiry).
  - The two earlier records "entered the Article 95 supplier list" (Sumitomo,
    24 Sep 2014; Bayer, 24 Jul 2015) **stay on its timeline**. Each now notes
    that the 7 Nov 2026 edition no longer carries the supplier.
  - The converter now keeps suppliers from earlier list editions that the
    latest one drops (`formerBySubstance` in `lib/suppliers.json`).
- All other differences are a respelling by ECHA ("Art. 95(5) submission" →
  "Art.95(5) submission") for piperonyl butoxide, *Cymbopogon winterianus* oil
  and *Eucalyptus citriodora* oil. The converter already merges spelling
  variants, so nothing changes in the app.

## 4. AS renewal expressions of interest

No changes for PT18/PT19 between the 30 Jun and 30 Sep 2026 lists. The only
row-level differences were the formatting issues noted under File preparation.

The new list would have re-dated the existing "Company interested in renewal" (5)
and "Renewal application submitted" (6) records from 30 Jun to 30 Sep 2026.
Fixed: each entry is now dated by the first list edition showing it, so they
keep **30 Jun 2026**. An entry that later leaves the list is kept on the
timeline.

## Signal-history check (new with this update)

Every record the app shows is now kept in `data/record-ledger.json` (566
records). `npm run data` fails if an update makes any of them disappear (see the
README section "Keeping signal history"). Compared with the previous commit,
nothing was lost other than the two ARN "no EU RRM action needed" records
removed on purpose (PACT rule B).

## 5. PACT (ECHA Public Activities Coordination Tool)

89 rows, the same substances as on 20.09.26. No change to the EPA carcinogen or
endocrine-disruptor list flags, names or identifiers. Five activities moved, all
still open:

| Substance | Area | Before | Now | Last update | Where it shows |
| --- | --- | --- | --- | --- | --- |
| **Imidacloprid** | CLH | Intention | **Submitted** | 3 Nov 2026 | Regulatory activity panel |
| **Decanoic acid** | CLH | Intention | **Submitted** | 3 Nov 2026 | Regulatory activity panel |
| **d-Allethrin** | CLH | Consultation | **Opinion development** | 3 Nov 2026 | Regulatory activity panel |
| Geraniol | CLH | Intention | Intention (date only) | 9 Sep 2025 → 20 Oct 2026 | Regulatory activity panel |
| Methyl nonyl ketone | ARN | Under development | Under development (Currently no EU RRM action needed) | unchanged, 8 Dec 2021 | Timeline record retitled |

What this means:

- For imidacloprid and decanoic acid, the harmonised classification (CLH)
  proposal announced in August–September has now been formally submitted.
- For d-allethrin, the public consultation has closed and ECHA's Committee for
  Risk Assessment (RAC) is preparing its opinion.
- None of this raises a signal. CLH is procedural and appears only in the
  Regulatory activity panel. The open-activity counts are unchanged, since every
  activity was open before and is still open.
- Methyl nonyl ketone's ARN record keeps its date. Only its title takes the
  fuller ECHA wording, and its hazard cue is unchanged (still open, nothing
  identified).

### PACT signal rules (decided 07.11.26, implemented in this update)

Which PACT activities become timeline signals. The full table is in the README
section "PACT signals".

- **A. SEv / PBT / ED:** every status. Strong where something was identified,
  otherwise weak.
- **B. ARN:** only an assessment opened or concluded proposing action, weak.
  "No EU RRM action needed" conclusions are no longer signals. The 2 such
  records (hydrogen cyanide, nitrogen) left the timeline and stay on the panel.
- **C. SVHC / Annex XIV / Restriction:** every status. Strong for intention,
  submission, listing, recommendation, opinion or adoption; weak otherwise.
- **D. CLH:** only proposals adding a class that can trigger a BPR exclusion
  criterion. These are CMR 1A/1B, ED category 1, PBT/vPvB, or such a hazard
  named without its category yet. They are signalled when the proposal is filed
  and when RAC adopts its opinion, weak.
- **E. DEv:** every status, weak and neutral.
- **F. EPA carcinogen and ED-list flags:** newly listed or moved into List I is
  strong; removed is weak.
- Earlier statuses now stay on the timeline. A status with no ECHA date is
  dated to the first PACT export showing it ("First recorded date").

**Signals this produces now:**

| Substance | Signal | Dated |
| --- | --- | --- |
| Deltamethrin (PT18) | Classification proposal: **PBT, Repr. 1B** | 20 Feb 2026 (intention) |
| Imidacloprid (PT18) | Classification proposal: **ED ENV 1** | 10 Sep 2026 (intention) |
| Cypermethrin (PT18) | Classification proposal: **ED ENV 1** | 20 Sep 2026, first recorded (no intention date in PACT) |
| Geraniol (PT18, PT19) | Classification proposal: **reproductive toxicity (category not yet given)** | 18 Sep 2024 (intention) |

The back-fill also adds 17 dossier-evaluation (DEv) records, each dated by
ECHA's own last update. None of this round's PACT status moves is itself a
signal: they are CLH steps, and an ARN rewording.

## Expected effect on the app (once `npm run data` is run)

- **New signal:** "1 product authorisation cancelled", 1R-trans phenothrin
  (PT18).
- Product counts and trend badges move with the 35 new authorisations, mainly
  icaridin, margosa extract and deltamethrin.
- Muscalure shows "Candidate for substitution: No", with no signal.
- Clothianidin's Article 95 supplier table becomes empty.
- The PACT Regulatory activity panels for imidacloprid, decanoic acid,
  d-allethrin and geraniol show the new CLH statuses. Methyl nonyl ketone's ARN
  record is retitled.
- No new renewal, renewal-start or expiry signals.
- New hazard signals for the 4 CLH proposals above. CLH rows on the panel now
  show the classes each proposal adds, with the exclusion-relevant ones in red.
