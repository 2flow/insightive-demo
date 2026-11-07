# How to do a data update

## 1. Add the files

1. Create a folder named for the download date:
   `data/updates/data_update_DD_MM_YY/` (e.g. `data_update_07_11_26`).
2. Put in **only the files that changed**. Older versions stay where they are.
   **Never delete or overwrite an earlier file.** The app compares versions to
   find what changed and to keep history.
3. Rename each file to its exact source name, followed by `_DD_MM_YY` (the
   download date). A file whose name doesn't match exactly is silently
   ignored.

| File you download | Rename to | Prep needed |
| --- | --- | --- |
| ECHA active substances export (PT18 + PT19) | `ECHA_active-substance-export_DD_MM_YY.xlsx` | none |
| ECHA biocidal products export | `biocidal-products-export_DD_MM_YY.xlsx` | none |
| ECHA Article 95 list (`art95_list_en.xlsx`) | `article_95_list_pt18_19_simplified_DD_MM_YY.xlsx` | keep only the "Article 95 list" sheet and rows with PT 18 or 19, header on row 1 |
| ECHA renewal expressions of interest (`as-rnl_expressions_of_interest_public_en.xlsx`) | `as-rnl_expressions_of_interest_PT18-PT19_DD_MM_YY.xlsx` | keep only PT 18/19 rows; **header must be on row 14**; PT as a plain number (`19`, not `PT19`); deadlines as dates |
| ECHA PACT export (with the EPA / ED-list columns added) | `pact-export-filtered_updated_and_other_flags_DD_MM_YY.csv` | same columns as last time |
| CLH proposals (classes proposed / added) | `pact-clh-proposals_DD_MM_YY.csv` | same columns as last time |
| EU Pesticides Database, with the AI analysis | `EU_Pesticide_Database_PT18_PT19_with_AI_analysis_DD_MM_YY.xlsx` | |
| PT18 / PT19 postponements | `PT18-postponements-open_DD_MM_YY.csv`, `PT19-postponements-open_DD_MM_YY.csv` | |
| BPC opinions | `bpc opinions on active substance approval_and_minority_opinions_DD_MM_YY.csv` | |
| Approval conditions (EUR-Lex, AI-extracted) | `BPR_PT18_PT19_approval_conditions_EURLex_AI_Extracted_UPDATED_method_flags_DD_MM_YY.xlsx` | |
| Substitution consultations (current) | `consultations on potential candidates for substitution and on derogations conditions_Current_DD_MM_YY.csv` | |
| EPA EDSP Tier 1 | `EPA_2015_EDSP_Tier1_WoE_Conclusions_x_ECHA_PT18-PT19_ED_tags_DD_MM_YY.xlsx` | |
| PAN HHP list | `PAN_HHP_PT18_PT19_DD_MM_YY.xlsx` | |

The exact names are in `SOURCES` at the top of `tools/convert_export.py`.

**Not in the update folder** (edited in place, no date in the name):
- `data/feeds/*.json`: curated research.
- `data/reports/<substance>/…_NGO_combined.md` and
  `data/reports/_classes/<class>/…_class_combined.md`: NGO watch reports.
- `data/classes.json`: chemical classes.
- BPC meeting notes: `lib/bpcMeetingSignals.ts`, with the matching sub-status
  overrides in `tools/convert_export.py`. **Never remove these**, even once
  the ECHA export catches up.

## 2. Build and check

1. **`npm run data`** converts everything, then runs the signal-history check.
   - In the log, check which file it used for each source and the counts.
     Read every `!` line (a row matched nothing) and `~` line (a note).
   - If the history check fails (`✗ … signal record(s) … are gone`), the
     update has removed records from the timeline. Fix the cause. Run
     `npm run history:accept` only if the removal was a decision.
2. **Check in the app:** `npm run dev`, then open http://localhost:3000.
   Don't run `npm run build` while the dev server is running: it breaks the
   dev page's CSS. Use `npx tsc --noEmit` to type-check instead.
3. **Write `update_summary_DD_MM_YY.md`** in the update folder: what changed per
   source and which signals appeared.
4. **Commit** the update folder, `lib/`, `public/products/` and
   `data/record-ledger.json`.

## 3. What becomes a signal, and what only updates a panel

Signals appear on the substance timeline and the all-signals page. Everything
else only updates the tiles and panels. A signal, once shown, **stays on the
timeline**, even when the status changes later or a newer file drops the row.

| File | Becomes a signal | Updates the panel / tile only |
| --- | --- | --- |
| **ECHA substance export** | **Approval renewed** (strong +). **Renewal started** (strong +, unless an application is already on record). **Approval expired**, once the end date has passed. **Filing deadline passed with nothing on record**. **BPC opinion** (from the opinion columns, carried over from earlier exports) | approval / assessment status and sub-status, end dates moved by postponement, candidate-for-substitution field, other columns |
| **Products export** | **N product authorisations cancelled**, approved substances only (weak −; strong if none are left) | new authorisations, expiries, holder changes, end dates, counts and trend badges, "recent changes" on the product page |
| **Article 95 list** | **Supplier entered the list**: weak + for its own submission, neutral for a carried-over review-programme participant | supplier table. A supplier *leaving* is not a signal; its entry record stays |
| **Renewal interest list** | **Company interested in renewal** (weak +). **Renewal application submitted** (strong +). Both are dated by the **first** edition that shows them | renewal-status tile, ECHA's filing deadline, "no interest" states |
| **PACT export** | ED / PBT / substance evaluation (SEv): every status (strong if a hazard is identified, otherwise weak). ARN: opened, or concluded proposing action (weak). SVHC / Annex XIV / Restriction: every status (strong for main steps). Dossier evaluation: every status (weak, "REACH procedure"). EPA carcinogen / ED-list value newly listed or moved to List I (strong); removed (weak +). EPA carcinogen listing (dated by year) | all activities on the "Potential hazard lists" and "Other regulatory activity" panels; ARN "no EU RRM action needed"; all other CLH activity |
| **CLH proposals** | **Classification proposal** and **RAC opinion adopted** (weak −), **only** when the proposal adds a BPR exclusion class: CMR 1A/1B, ED cat. 1, PBT/vPvB, or such a hazard without its category yet | classes proposed / added on each CLH row, with exclusion classes in red; red alert on the overview tile |
| **Postponements (PT18, PT19)** | **Expiry postponed**, one per postponement (neutral). Dates the **Renewal application submitted** record from the recitals | postponements tile |
| **BPC opinions** | gives the BPC opinion signal its date | approval-data panel (opinions, minority positions) |
| **Approval conditions** | **Approved** (neutral; weak − if the act found a candidate for substitution) | approval-data panel: conditions, methodology flags |
| **EU Pesticides Database** | **Plant-protection approval ended** (weak −), only where an approval actually ran out | plant-protection tile and panel |
| **PAN HHP list** | **PAN HHP listing** (weak −), dated by when it was added | hazard-lists panel |
| **EPA EDSP Tier 1** | none | hazard-lists panel |
| **Substitution consultations** | none | candidate-for-substitution tile |
| **BPC meeting notes** (hand-entered) | **BPC opinion adopted (BPC-NN)** (strong +) | assessment sub-status |
| **Curated feeds** (`data/feeds`) | every record in the file, as written | |
| **NGO reports** (`data/reports`) | Tier 1–3 items as **NGO** signals (drawn lighter, kept out of the tallies) | the rest of the report |

Full rules and reasoning: README sections "PACT signals" and "Keeping signal
history".
