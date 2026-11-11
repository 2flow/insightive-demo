# Data update 10.11.26: summary of changes

NGO watch run of 10 November 2026, plus a refreshed approval-conditions
workbook (muscalure renewal). No ECHA export or other source file changed: the
latest of those is still `data_update_07_11_26`.

| Source | Previous version | This update |
| --- | --- | --- |
| NGO substance reports (`data/reports/<slug>/…_NGO_combined.md`, 53 files) | run of 20.10.26 | run of 10.11.26 |
| NGO class reports (`data/reports/_classes/<class>/…_class_combined.md`, 10 files) | run of 21.10.26 | run of 10.11.26 |
| Approval conditions (EUR-Lex, AI-extracted) | 20.09.26 | 10.11.26 (workbook updated 08 Nov 2026) |

# Part 1: Approval conditions

## File preparation

- `BPR_PT18_PT19_approval_conditions_EURLex_AI_Extracted_UPDATED_method_flags_10_11_26.xlsx`.
  It arrived as `PR_PT18…` (missing the leading B) and was renamed, since the
  converter matches names exactly and would have skipped it.
- Full workbook, same 4 sheets (Substances, Conditions, Act chain, Method) and
  headers as 20.09.26; 100 rows in Substances and 62 in Act chain, as before.
  The converter reads only the latest version, so a partial file would have
  dropped every other substance.
- `BPR_PT18_PT19_approval_conditions_EURLex_AI_Extracted_20_09_26.xlsx` (no
  method flags) was removed from `data/baseline_20_09_26/`. The converter never
  read it: it reads only the `…_UPDATED_method_flags` file.

## What changed in the workbook

**cis-tricos-9-ene (Muscalure), PT19: renewed.**
- Anchor act: Directive 2012/38/EU → Implementing Regulation (EU) 2026/2247 of
  12 October 2026 (renewal under the BPR), based on the BPC opinion of
  27 November 2025. Expiry 30 June 2041 (was 31 March 2027 under postponement
  2024/1283, which Implementing Decision (EU) 2026/2252 repeals).
- Initial act kept as its own record: Directive 2012/38/EU, approval from
  1 October 2014, original expiry 30 September 2024. Conditions from both acts
  (1 from 2026/2247, 2 from 2012/38/EU).
- Act chain: anchor `32026R2247`, live postponement cleared.
- Methodology flags re-assessed against the renewal (BPR approval and ED
  criteria now covered; human health v5.0, resistance, bee risk and drinking
  water not covered, with reasons).
- ECHA CfS flag "Under assessment" → "No".

**Refreshed from the ECHA export of 08/11/2026** (columns the app does not
read, so no visible change): clothianidin status "Expired", cyromazine
"Renewal in progress", and "expires in N days" notes for acetamiprid,
Bt kurstaki ABTS-351, indoxacarb and DEET.

## Effect on the app

- `lib/approvals.json`: only muscalure changed; 61 approval acts (unchanged),
  conditions 210 → 211.
- Muscalure's approval panel now shows 2026/2247 and its conditions. The
  timeline keeps "Included in Annex I to Directive 98/8/EC for PT19"
  (1 Oct 2014), whose summary now adds that the approval has since been renewed
  by 2026/2247, to 30 June 2041.

## Code change: renewal signal kept (lib/changeSignals.ts)

The first `npm run data` failed the history check: muscalure's "Approval
renewed" signal (first seen in the ECHA export of 20 Oct 2026, strong +) had
disappeared. `changeSignals.ts` dropped that record once the approval workbook
listed the renewing act, on the assumption that the approval record already
showed the act. That stopped being true when the approval record moved to the
*first* approval: the renewal only appears there in a sentence. The check is
removed, so the renewal stays on the timeline. History check after the fix:
592 records, none lost.

## Converter fix: Article 95 suppliers on shared identifiers (tools/convert_export.py)

Metofluthrin (45-PT19, no longer supported) showed a current Article 95
supplier. It shares CAS 240494-71-7 with epsilon-metofluthrin (2463), neither
has an EC number, and the converter attached the supplier rows to both. The
Article 95 rows name the epsilon isomer ("…(1R,3R)…(Z)-prop-1-enyl…").

Rule now: where an EC/CAS matches several substances and no name decides, the
suppliers go to the candidates still Approved or Pending. The Article 95 list
carries only substances approved or under assessment, and ECHA removes one
that is no longer supported, not approved or expired. Inclusion reason could
not decide: ECHA marks both metofluthrin entries as new active substances, and
both Margosa extracts as review-programme substances. The same matching serves
the renewal-interest list.

| Substance | Before | After |
| --- | --- | --- |
| Metofluthrin 45-PT19 | Sumitomo | none |
| epsilon-Metofluthrin 2463-PT19 | Sumitomo | Sumitomo (unchanged) |
| Margosa extract 43-PT18 (expired) | Terra Nostra, ARMOSA TECH, LIMARU | none |
| Margosa extract 1469-PT18 (pending) | Terra Nostra, ARMOSA TECH, LIMARU | unchanged |

Four supplier signals that had been attached to the wrong substance were
removed from the ledger on purpose (`check_history.mjs --accept`): Sumitomo on
45-PT19 (2023-04-21), and Terra Nostra (2014-09-24), ARMOSA TECH SA
(2026-05-28) and LIMARU NV (2026-06-12) on 43-PT18. The same signals remain on
2463-PT19 and 1469-PT18. History check: 588 records, none lost otherwise.

# Part 2: NGO reports

The NGO reports are not kept in this folder: each combined file holds the
baseline plus every update and is replaced in place (see HOW_TO_UPDATE.md).
This file records what that replacement changed.

## File preparation

- All 63 combined files replaced with the 10.11.26 versions. Same files, same
  paths: no substance or class was added or dropped.
- Every file now has `last_run: 2026-11-10` and the 10.11.26 run added at the
  end of its `updates:` list.
- Class files gained a section "3. Follow-ups on known items" (later sections
  renumbered). Only section 2 becomes signals, so this has no effect on the app.

## Consistency check against the previous reports

- Every line of every previous section 2 (the signal items) is present,
  unchanged, in the new files. Nothing was reworded or re-dated.
- Text that did change is summary, follow-up and "what NGOs say is coming
  next" prose, rewritten by the new run. None of it is read as a signal.
- Signal-history check: 566 → 592 records, none lost, 26 new (see below).

## New NGO items in the 10.11.26 run

Four files report "change: new" (permethrin, horizontal, pyrethroid, PFAS);
the other 59 report "change: none". The run marks five items as new.

| Date | Scope | Tier | Item | In the app |
| --- | --- | --- | --- | --- |
| 2026-11-03 | Horizontal | A | PAN Germany urges supporters to lobby EPP and ECR MEPs to stop the Omnibus, citing longer approval periods for pesticides **and biocides** and wider exemptions for banned substances | Shown, all-signals timeline |
| 2026-11-05 | Pyrethroid class | B | Beyond Pesticides highlights a study linking prenatal pyrethroid exposure to weaker newborn immune function (fewer and dying lymphocytes in cord blood) | Shown, once on the timeline and on the page of each pyrethroid member (23 substance rows) |
| 2026-10-22 | Permethrin | B | PAN Europe and Velt find permethrin among the top pesticides in Flemish classroom dust, "banned for crop protection … still allowed as biocide", and call for stronger EU pesticide rules | Shown, permethrin page and timeline |
| 2026-11-05 | Horizontal | C | PAN Europe and partners publish a seven-country YouGov poll showing voters reject unlimited pesticide approvals | Not shown: Tier C tagged `PPP` / `indirect–use` |
| 2026-10-22 | PFAS class | C | Velt and PAN Europe on 12 PFAS pesticides and TFA in Flemish classroom dust | Not shown: Tier C tagged `national:BE` / `indirect–use` |

Tier C items are shown only when tagged `BPR` or `direct` (unchanged rule).

So 3 new signals reach the app. The history check counts 26 new records
because it counts each place a signal appears: the horizontal item (1), the
pyrethroid class item on the timeline (1) and on each member's page (23), and
the permethrin item (1). The all-signals page shows each class item once, so
it gains 3 entries.

## Parser change (lib/ngoSignals.ts)

The 10.11.26 run writes a `- Date: …` line under each new item's bold heading
and tag line. The parser took that line as the start of a new item, which
split the permethrin item into two broken records (one with no summary or
source, one titled just "2026-10-22"). A `Date:` line that follows a heading
before any other field now belongs to that item. Checked: the previous reports
still parse to exactly the same 566 records.

## Expected effect on the app

- Permethrin: one new NGO signal (Tier B, 2026-10-22) with the PAN Europe press
  release and two Velt pages as sources.
- Pyrethroid members: one new class signal (Tier B, 2026-11-05).
- All-signals timeline: the horizontal PAN Germany item (Tier A, 2026-11-03)
  and the pyrethroid item.
