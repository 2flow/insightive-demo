#!/usr/bin/env python3
"""Compile the data/ folder into the JSON the app bundles.

The app has no backend: the whole dataset is compiled in. Re-run this after
dropping new files into data/ and the interface picks them up.

    python3 tools/convert_export.py [path/to/export.xlsx]

Inputs and outputs:

  data/ECHA_*.xlsx        the "Search for Chemicals" export      -> lib/substances.json
  data/article_95_*.xlsx  the Article 95 approved-supplier list  -> lib/suppliers.json
  data/biocidal-products-export.xlsx  authorised products        -> lib/products.json
                                                                 + public/products/<id>.json
  data/as-rnl_expressions_of_interest_*.xlsx  renewal interest   -> lib/interest.json

The product export is far too big to bundle (~3 MB of per-product rows), so it is
split: per-substance *summaries* go into the bundle, and the full per-product
detail is written as one static file per substance, fetched only when a reader
opens that substance's product page.

Renewal-signal feeds are NOT handled here: data/feeds/*.json is read directly by
the app (lib/feeds.ts), so those files can be edited by hand with no build step.

Requires openpyxl (`pip install openpyxl`).
"""

from __future__ import annotations

import collections
import csv
import json
import re
import sys
from datetime import date, datetime
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "lib" / "substances.json"
SUPPLIER_OUT = ROOT / "lib" / "suppliers.json"
PRODUCT_OUT = ROOT / "lib" / "products.json"
PRODUCT_DETAIL_DIR = ROOT / "public" / "products"
INTEREST_OUT = ROOT / "lib" / "interest.json"
PPP_OUT = ROOT / "lib" / "ppp.json"
CONSULTATION_OUT = ROOT / "lib" / "consultations.json"
PACT_OUT = ROOT / "lib" / "pact.json"
POSTPONEMENT_OUT = ROOT / "lib" / "postponements.json"
BPC_OUT = ROOT / "lib" / "bpcOpinions.json"
APPROVAL_OUT = ROOT / "lib" / "approvals.json"

# The header row sits under a title row + a blank row.
HEADER_ROW = 3


def clean(value) -> str:
    """ECHA pads a lot of cells; empty is empty."""
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def blank_dash(value: str) -> str:
    """ECHA writes a bare "-" for "no value". The interface renders its own
    em-dash placeholder, so normalise those to empty on the way in."""
    return "" if value == "-" else value


def parse_date(value: str) -> str:
    """dd/mm/yyyy -> ISO, or '' when the field is blank."""
    if not value:
        return ""
    return datetime.strptime(value, "%d/%m/%Y").date().isoformat()


def to_int(value: str) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def parse_export_date(sheet) -> str:
    """The criteria sheet carries "Export date: {0} 01/09/2026 06:52:26"."""
    for row in sheet.iter_rows(values_only=True):
        text = clean(row[0])
        m = re.search(r"(\d{2}/\d{2}/\d{4})", text)
        if text.lower().startswith("export date") and m:
            return parse_date(m.group(1))
    return ""


def parse_last_updated(sheet) -> str:
    for row in sheet.iter_rows(values_only=True):
        text = clean(row[0])
        m = re.match(r"Last updated\s*(\d{2}/\d{2}/\d{4})", text)
        if m:
            return parse_date(m.group(1))
    return ""


def bucket(end_iso: str, today: date) -> str:
    """Coarse approval-end bands — the filter's options and the row's urgency cue.

    Whole months, counted the same way as monthsUntil() in lib/data.ts so the
    band and the "N mo left" cue on the row never disagree."""
    if not end_iso:
        return "none"
    end = date.fromisoformat(end_iso)
    if end < today:
        return "expired"
    months = (end.year - today.year) * 12 + (end.month - today.month) - (1 if end.day < today.day else 0)
    if months <= 12:
        return "12m"
    if months <= 24:
        return "24m"
    if months <= 60:
        return "60m"
    return "beyond"


def convert(xlsx: Path) -> dict:
    book = openpyxl.load_workbook(xlsx, data_only=True)
    results = book["results"]
    rows = list(results.iter_rows(min_row=HEADER_ROW, values_only=True))
    header = [clean(h) for h in rows[0]]

    export_date = parse_export_date(book["criteria"]) if "criteria" in book.sheetnames else ""
    today = date.fromisoformat(export_date) if export_date else date.today()

    substances = []
    for raw in rows[1:]:
        record = {header[i]: clean(v) for i, v in enumerate(raw) if i < len(header)}
        name = record.get("Substance name", "")
        if not name:
            continue

        product_type = record.get("Product-type", "")
        pt = product_type.split("-", 1)[0]
        pt_name = product_type.split("-", 1)[1] if "-" in product_type else ""
        start = parse_date(record.get("Approval start date", ""))
        end = parse_date(record.get("Approval end date", ""))
        # ECHA leaves approval status blank while a first application is still
        # running; the interface shows that as its own state rather than a gap.
        status = record.get("Approval status", "") or "Pending"

        substances.append(
            {
                "id": f'{record.get("BAS number", "")}-{pt}',
                "name": name,
                "pt": pt,
                "ptName": pt_name,
                "ec": blank_dash(record.get("EC/List no.", "")),
                "cas": blank_dash(record.get("CAS no.", "")),
                "bas": record.get("BAS number", ""),
                "rml": blank_dash(record.get("RML ID", "")),
                "startDate": start,
                "endDate": end,
                "endBucket": bucket(end, today),
                "authority": blank_dash(record.get("Evaluating competent authority", "")),
                "approvalStatus": status,
                "assessmentStatus": record.get("Assessment status", ""),
                "assessmentSubStatus": blank_dash(record.get("Assessment sub-status", "")),
                "legalAct": record.get("Legal act", ""),
                "legalActUrl": record.get("Link to legal act", ""),
                "r4bp": blank_dash(record.get("R4BP asset number", "")),
                "substitution": record.get("Candidate for substitution", ""),
                "reviewProgramme": record.get("Review Programme flag", "") == "true",
                "newActiveSubstance": record.get("New active substance flag", "") == "true",
                "annexI": record.get("Annex I substance flag", "") == "true",
                "inclusionCategory": to_int(record.get("Inclusion Category", "")),
                "products": to_int(record.get("Related authorised biocidal products", "")),
                "factsheetUrl": record.get("Factsheet URL", ""),
                "substanceUrl": record.get("Substance information page", ""),

                # Added by Pelsis alongside the ECHA export — the BPC's most
                # recent opinion on this substance, when one has been published.
                "bpcOpinion": record.get("Recent BPC Opinion", ""),
                "bpcOpinionUrl": record.get("Recent BPC Opinion PDF", ""),

                # Also added by Pelsis: an approval running longer than the
                # statutory maximum (10 years, or 7 for a candidate for
                # substitution) implies the expiry date was moved. WORK IN
                # PROGRESS — the rule also catches renewals and ordinary
                # 10-year approvals of substitution candidates, so it is
                # carried in the data but not yet shown in the interface.
                # Matched by prefix so the "(WIP)" suffix can be dropped later.
                "expiryPostponed": next(
                    (v for k, v in record.items() if k.startswith("Expiry date postponed")), ""
                ) == "Yes",
            }
        )

    substances.sort(key=lambda s: (s["pt"], s["name"].lower()))
    return {
        "meta": {
            "source": "ECHA — Biocidal active substances (Search for Chemicals export)",
            "sourceFile": xlsx.name,
            "exportDate": export_date,
            "lastUpdated": parse_last_updated(book["criteria"]) if "criteria" in book.sheetnames else "",
            "productTypes": sorted({s["pt"] for s in substances}),
            "count": len(substances),
        },
        "substances": substances,
    }


# ── Article 95 supplier list ─────────────────────────────────

# ECHA writes "n.a." where a substance has no such identifier.
NOT_APPLICABLE = {"n.a.", "n/a", "na", "-", "none"}


def identifier(value: str) -> str:
    """An EC/CAS number, or "" when the substance genuinely has none."""
    return "" if value.strip().lower() in NOT_APPLICABLE else value


def iso_date(value) -> str:
    """Excel date cells arrive as datetimes; be tolerant of strings too."""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = clean(value)
    if not text:
        return ""
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return ""


def canonical_forms(values) -> dict[str, str]:
    """The file spells the same value several ways — "Substance supplier" vs
    "Substance Supplier", "Art.95(5)" vs "Art. 95(5)". Collapse variants that
    differ only in case, spacing or punctuation onto whichever spelling the file
    uses most, so the interface shows one label per real value."""
    groups: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    for value in values:
        if value:
            groups[re.sub(r"[^a-z0-9]", "", value.lower())][value] += 1
    return {squashed: counts.most_common(1)[0][0] for squashed, counts in groups.items()}


def list_date_from_name(name: str) -> str:
    """The list's own date lives only in its filename, e.g.
    `article_95_list_pt18_19_25.09.26_simplified.xlsx` -> 2026-09-25."""
    m = re.search(r"_(\d{2})\.(\d{2})\.(\d{2})_", name)
    if not m:
        return ""
    day, month, year = (int(g) for g in m.groups())
    try:
        return date(2000 + year, month, day).isoformat()
    except ValueError:
        return ""


def norm_id(value: str) -> str:
    return re.sub(r"[\s\-]", "", value).lower()


def loose_name(value: str) -> str:
    """Letters and digits only. A last resort for matching two lists that
    punctuate the same strain differently; safe only behind a uniqueness
    check, which is how every caller uses it."""
    return re.sub(r"[^a-z0-9]", "", value.lower())


def norm_name(value: str) -> str:
    squashed = re.sub(r"[\s,]", "", value).lower()
    # The two lists spell one thing differently: the Article 95 list writes
    # "supercritical CO2" where the substance export writes "supercritical
    # carbon dioxide". Without this the two Chrysanthemum extract variants
    # can't be told apart by name, and both fall back to a shared EC number.
    return squashed.replace("co2", "carbondioxide")


def strip_trailing_paren(value: str) -> str:
    """"Indoxacarb (enantiomeric reaction mass S:R 75:25)" -> "Indoxacarb"."""
    return re.sub(r"\s*\([^()]*\)\s*$", "", value).strip()


def trailing_paren(value: str) -> str:
    """The common name ECHA parks at the end of a systematic name:
    "…oxadiazine-4a-carboxylate (Indoxacarb)" -> "Indoxacarb"."""
    m = re.search(r"\(([^()]*)\)\s*$", value)
    return m.group(1).strip() if m else ""


def resolve_substances(group: dict, index: dict) -> list[str]:
    """Match one Article 95 group to the substance(s) it describes, within the
    same product type.

    Name rules come first because they are the *more specific* key here: our
    export splits one EC number into several BAS-level entries (three
    Chrysanthemum extracts share EC 289-699-3), and only the name says which
    extract a supplier is listed against. A name only counts when it lands on
    exactly one substance, so a loose match can never quietly pick the wrong
    one — the two Bacillus thuringiensis subspecies stay separate.

    Identifiers are the fallback. Where an EC/CAS covers several substances and
    no name matched, the suppliers attach to all of them: Article 95 lists
    suppliers per EC/CAS + PT and genuinely does not distinguish further.
    """
    pt = group["pt"]
    name = group["name"]

    for table, candidate in (
        ("name", norm_name(name)),
        ("stripped", norm_name(strip_trailing_paren(name))),
        ("stripped", norm_name(trailing_paren(name))),
    ):
        if not candidate:
            continue
        hits = index[table].get((candidate, pt), [])
        if len(hits) == 1:
            return hits

    for field, table in (("ec", "ec"), ("cas", "cas")):
        if not group[field]:
            continue
        hits = index[table].get((norm_id(group[field]), pt), [])
        if not hits:
            continue
        if len(hits) > 1:
            print(
                f'  ~ Article 95: "{name[:50]}" ({pt}) matched {len(hits)} substances'
                f" sharing {field.upper()} {group[field]} — suppliers shown on each",
                file=sys.stderr,
            )
        return hits

    return []


def build_index(substances: dict) -> dict:
    index = {k: collections.defaultdict(list) for k in ("ec", "cas", "name", "stripped")}
    for s in substances["substances"]:
        if s["ec"]:
            index["ec"][(norm_id(s["ec"]), s["pt"])].append(s["id"])
        if s["cas"]:
            index["cas"][(norm_id(s["cas"]), s["pt"])].append(s["id"])
        index["name"][(norm_name(s["name"]), s["pt"])].append(s["id"])
        index["stripped"][(norm_name(strip_trailing_paren(s["name"])), s["pt"])].append(s["id"])
    return index


def convert_suppliers(xlsx: Path, substances: dict) -> dict:
    """Group the supplier rows by substance × product type and resolve each
    group to a substance id. The four substance identity columns only drive that
    matching — they aren't carried through, since the app already holds them."""
    book = openpyxl.load_workbook(xlsx, data_only=True)
    sheet = book[book.sheetnames[0]]
    rows = list(sheet.iter_rows(values_only=True))
    header = [clean(h) for h in rows[0]]
    records = [dict(zip(header, r)) for r in rows[1:] if r and r[0]]

    types = canonical_forms(clean(r.get("Supplier Type")) for r in records)
    reasons = canonical_forms(clean(r.get("Inclusion Reason")) for r in records)
    squash = lambda v: re.sub(r"[^a-z0-9]", "", v.lower())  # noqa: E731

    groups: dict[tuple, dict] = {}
    for record in records:
        name = clean(record.get("Active Substance Name"))
        ec = identifier(clean(record.get("EC no.")))
        cas = identifier(clean(record.get("CAS no.")))
        pt = f'PT{clean(record.get("PT"))}'
        key = (ec, cas, name.lower(), pt)

        group = groups.setdefault(key, {"ec": ec, "cas": cas, "name": name, "pt": pt, "suppliers": []})
        supplier_type = clean(record.get("Supplier Type"))
        reason = clean(record.get("Inclusion Reason"))
        group["suppliers"].append(
            {
                "entity": clean(record.get("Entity Name")),
                "country": clean(record.get("Country")),
                "type": types.get(squash(supplier_type), supplier_type),
                "reason": reasons.get(squash(reason), reason),
                "listedAsPt": iso_date(record.get("Inclusion Date AS-PT")),
                "listedSupplier": iso_date(record.get("Inclusion Date Supplier")),
            }
        )

    for group in groups.values():
        group["suppliers"].sort(key=lambda s: s["entity"].lower())

    # Resolve to substance ids here rather than at runtime, so a name that can't
    # be matched is reported once at build time instead of vanishing quietly.
    index = build_index(substances)
    by_substance: dict[str, list] = {}
    unmatched = 0
    for group in sorted(groups.values(), key=lambda g: (g["pt"], g["name"].lower())):
        substance_ids = resolve_substances(group, index)
        if not substance_ids:
            unmatched += 1
            print(
                f'  ! Article 95: "{group["name"][:60]}" ({group["pt"]})'
                f" matches no substance in the export — {len(group['suppliers'])} supplier(s) dropped",
                file=sys.stderr,
            )
            continue
        for substance_id in substance_ids:
            by_substance.setdefault(substance_id, []).extend(group["suppliers"])

    # The source repeats a few rows verbatim; one company should appear once.
    for substance_id, rows in by_substance.items():
        seen, unique = set(), []
        for row in rows:
            fingerprint = tuple(sorted(row.items()))
            if fingerprint not in seen:
                seen.add(fingerprint)
                unique.append(row)
        by_substance[substance_id] = unique

    return {
        "meta": {
            "source": "ECHA — Article 95 list of approved active substance suppliers",
            "sourceFile": xlsx.name,
            "listDate": list_date_from_name(xlsx.name),
            "count": len(by_substance),
            "supplierCount": sum(len(v) for v in by_substance.values()),
            "unmatchedGroups": unmatched,
        },
        "bySubstance": by_substance,
    }


# ── Expressions of interest in renewal ───────────────────────

# ECHA states the outcome in the same column as the company name.
INTEREST_MARKERS = {
    "renewal application": "submitted",
    "no renewal has been received": "none-received",
    "no interest in renewal": "no-interest",
}

INTEREST_HEADER_ROW = 14


def interest_state(value: str) -> str:
    low = value.lower()
    for marker, state in INTEREST_MARKERS.items():
        if low.startswith(marker):
            return state
    return "interested" if value and low != "none" else ""


MONTHS_LONG = ("january february march april may june july august september "
               "october november december").split()


def prepared_as(sheet) -> str:
    """The list's own "Prepared as of 30/June/2026" line, from the title block.

    It is the only date the list carries about itself, and the nearest thing to
    a date for an entry on it: an interest recorded here was recorded by then.
    """
    for row in sheet.iter_rows(min_row=1, max_row=6, values_only=True):
        for cell in row:
            m = re.search(r"prepared as of\s*(\d{1,2})[/\s]([A-Za-z]+)[/\s](\d{4})", str(cell or ""), re.I)
            if m:
                day, month, year = m.groups()
                name = month.strip().lower()
                for i, full in enumerate(MONTHS_LONG, start=1):
                    if full.startswith(name[:3]):
                        return f"{year}-{i:02d}-{int(day):02d}"
    return ""


def convert_interest(xlsx: Path, substances: dict) -> dict:
    """ECHA's courtesy list of who intends to apply for renewal, matched to
    substances the same way the Article 95 list is."""
    book = openpyxl.load_workbook(xlsx, data_only=True)
    sheet = book[book.sheetnames[0]]
    rows = list(sheet.iter_rows(min_row=INTEREST_HEADER_ROW, values_only=True))
    header = [clean(h) for h in rows[0]]
    records = [dict(zip(header, r)) for r in rows[1:] if r and r[0]]

    groups: dict[tuple, dict] = {}
    for record in records:
        name = clean(record.get("Substance Name"))
        ec = identifier(clean(record.get("EC No.")))
        cas = identifier(clean(record.get("CAS No.")))
        pt = f'PT{clean(record.get("PT"))}'
        group = groups.setdefault(
            (ec, cas, name.lower(), pt),
            {"ec": ec, "cas": cas, "name": name, "pt": pt,
             "state": "", "deadline": "", "companies": []},
        )
        group["deadline"] = group["deadline"] or iso_date(record.get("Deadline for renewal application (AS-RNL)"))
        value = clean(record.get("Company interested in renewal"))
        state = interest_state(value)
        if state == "interested":
            entry = {"name": value, "country": clean(record.get("Country of the company"))}
            if entry not in group["companies"]:
                group["companies"].append(entry)
        # A named company outranks a status marker if both somehow appear.
        if state and (not group["state"] or state == "interested"):
            group["state"] = state

    index = build_index(substances)
    by_substance: dict[str, dict] = {}
    unmatched = 0
    for group in sorted(groups.values(), key=lambda g: (g["pt"], g["name"].lower())):
        ids = resolve_substances(group, index)
        if not ids:
            unmatched += 1
            print(f'  ! Interest list: "{group["name"][:55]}" ({group["pt"]}) matches no substance',
                  file=sys.stderr)
            continue
        for substance_id in ids:
            by_substance[substance_id] = {
                "state": group["state"],
                "deadline": group["deadline"],
                "companies": group["companies"],
            }

    return {
        "meta": {
            "source": "ECHA — Expressions of interest in the renewal of active substances",
            "sourceFile": xlsx.name,
            "preparedAs": prepared_as(sheet),
            "count": len(by_substance),
            "unmatched": unmatched,
        },
        "bySubstance": by_substance,
    }


# ── Authorised biocidal products ─────────────────────────────

# Legal-form tokens that say nothing about which company a holder belongs to.
LEGAL_FORMS = {
    "sa", "sas", "sarl", "srl", "spa", "sl", "sau", "sac", "nv", "bv", "bvba", "cv",
    "gmbh", "ag", "kg", "kgaa", "mbh", "ltd", "limited", "plc", "llc", "inc", "corp",
    "as", "a/s", "oy", "ab", "aps", "sp", "zoo", "kft", "doo", "eood", "ood", "ad",
    "sro", "lda", "se", "co", "company", "holding", "holdings", "group", "europe",
    "international", "deutschland", "hellas", "iberia", "france", "italia", "polska",
    "romania", "bulgaria", "austria", "benelux", "uk", "espana", "sucursal", "en",
}


def split_cell(value) -> list[str]:
    """ECHA packs multi-valued cells into one pipe-separated string."""
    return [p.strip() for p in str(value or "").split("|") if p.strip()]


def unique_cell(value) -> str:
    """Some cells repeat a value once per trade name — "indoor use | indoor use
    | outdoor use". Keep one of each, in the order they first appear."""
    return " · ".join(dict.fromkeys(split_cell(value)))


def product_types(value) -> list[str]:
    """"PT18-Insecticides… | PT14-Rodenticides" -> ["PT18", "PT14"]."""
    return [p.split("-", 1)[0].strip() for p in split_cell(value)]


def holder_lead(holder: str) -> str:
    """The first word of a holder name that actually identifies the company."""
    head = re.split(r"[(,]", holder, 1)[0]
    words = [w for w in re.split(r"[\s.]+", head) if w]
    for word in words:
        if re.sub(r"[^a-z]", "", word.lower()) not in LEGAL_FORMS and len(word) > 2:
            return word.strip("-–—")
    return words[0] if words else holder


def holder_groups(holders) -> dict[str, str]:
    """Collapse a holder's national subsidiaries onto the parent brand.

    Leading words are compared case-insensitively, and a longer key that starts
    with a shorter one folds into it — so "Bayer", "BAYER" and
    "BayerCropScience" are all one group, displayed as the commonest spelling.
    """
    seen: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    for holder in holders:
        lead = holder_lead(holder)
        seen[re.sub(r"[^a-z0-9]", "", lead.lower())][lead] += 1

    keys = sorted(seen, key=len)
    roots: dict[str, str] = {}
    for key in keys:
        roots[key] = next((root for root in roots.values() if key.startswith(root)), key)

    labels: dict[str, str] = {}
    for key, root in roots.items():
        merged = collections.Counter()
        for other, other_root in roots.items():
            if other_root == root:
                merged.update(seen[other])
        labels[key] = merged.most_common(1)[0][0]
    return {key: labels[key] for key in seen}


def group_of(holder: str, groups: dict[str, str]) -> str:
    return groups.get(re.sub(r"[^a-z0-9]", "", holder_lead(holder).lower()), holder_lead(holder))


def family_name(members: list[dict]) -> str:
    """The trade name most of the family's authorisations carry. Ties go to the
    shortest, which is reliably the brand rather than a localised variant
    ("Alba", not "Stallfliegenmittel Alba")."""
    rows_with = collections.Counter()
    for member in members:
        for name in set(member["tradeNames"]):
            rows_with[name] += 1
    if not rows_with:
        return ""
    best = max(rows_with.values())
    return min((n for n, c in rows_with.items() if c == best), key=lambda n: (len(n), n.lower()))


def display_name(name: str) -> str:
    """Trade names are shouted in the source; title-case the all-caps ones."""
    return name.title() if name.isupper() else name


def authorisation_kind(value: str) -> str:
    """"Union authorisation" -> "Union"."""
    return value.replace(" authorisation", "").replace(" Authorisation", "").strip() or "—"


# ── The EU Pesticide Database ────────────────────────────────
# The same molecules, judged under the plant-protection regulation instead of
# the BPR. Whether a substance survived there is not decisive for a biocidal
# renewal — different uses, different exposure, different dossier — but it is
# the nearest thing to a precedent, and a non-approval names what the concern
# was. The AI-analysis columns (AH-AP) were added to this export by Pelsis;
# they are carried through labelled as such, never merged into the EU's own.

PPP_HEADER_ROW = 3

PPP_AI_FIELDS = {
    "mechanism": "Non-approval mechanism (AI Analysis)",
    "safetyBased": "Safety-based? (AI Analysis)",
    "primaryReason": "Primary reason (AI Analysis)",
    "reasonDetail": "Reason detail (AI Analysis)",
    "keyAct": "Terminating / key act (AI Analysis)",
    "history": "Regulatory history (AI Analysis)",
    "confidence": "Confidence (AI Analysis)",
    "source": "Source (AI Analysis)",
    "qualityFlag": "Data quality flag (AI Analysis)",
}


def convert_ppp(xlsx: Path, substances: dict) -> dict:
    """The plant-protection status of each substance, matched across product
    types — a PPP approval is a property of the molecule, not of PT18 vs PT19,
    so one row attaches to every substance row that shares its CAS or name."""
    book = openpyxl.load_workbook(xlsx, data_only=True)
    sheet = book[book.sheetnames[0]]
    rows = list(sheet.iter_rows(min_row=PPP_HEADER_ROW, values_only=True))
    header = [clean(h) for h in rows[0]]
    records = [dict(zip(header, r)) for r in rows[1:] if r and clean(r[1])]

    by_cas: dict[str, list[str]] = {}
    by_name: dict[str, list[str]] = {}
    by_loose: dict[str, list[str]] = {}
    for s in substances["substances"]:
        if s["cas"]:
            by_cas.setdefault(norm_id(s["cas"]), []).append(s["id"])
        for form in (s["name"], strip_trailing_paren(s["name"]), trailing_paren(s["name"])):
            if form:
                by_name.setdefault(norm_name(form), []).append(s["id"])
                by_loose.setdefault(loose_name(form), []).append(s["id"])

    by_substance: dict[str, dict] = {}
    unmatched: list[str] = []
    for record in records:
        name = clean(record.get("Substance"))
        cas = identifier(clean(record.get("CAS Number")))

        ids = by_cas.get(norm_id(cas), []) if cas else []
        if not ids:
            # No CAS allocated — the four Bacillus/Capsicum entries. A name
            # only counts when it lands somewhere, and the PPP file writes its
            # own common names, so try the same forms the other lists use.
            for form in (name, strip_trailing_paren(name), trailing_paren(name)):
                ids = by_name.get(norm_name(form), []) if form else []
                if ids:
                    break
        if not ids:
            # Punctuation alone separates the two spellings of the Bti strain:
            # "(serotype H-14) strain AM65-52" against "Serotype H14, Strain
            # AM65-52". Letters and digits only — and only when it lands on
            # exactly one substance, so it can never pick the wrong strain.
            for form in (name, strip_trailing_paren(name)):
                hits = by_loose.get(loose_name(form), []) if form else []
                if len(set(hits)) == 1:
                    ids = hits
                    break
        if not ids:
            unmatched.append(name)
            print(f'  ! Pesticide DB: "{name[:55]}" matches no substance', file=sys.stderr)
            continue

        entry = {
            "name": name,
            "euId": clean(record.get("Active Substance ID")),
            "status": clean(record.get("Status under Reg. (EC) No 1107/2009")),
            "approvalDate": iso_date(record.get("Date of approval")),
            "expiryDate": iso_date(record.get("Expiration of approval")),
            "substitution": clean(record.get("Candidate for substitution")),
            "legislation": clean(record.get("Legislation")),
            "rms": " / ".join(x for x in (clean(record.get("RMS")), clean(record.get("Co-RMS"))) if x),
            "authorised": [c for c in re.split(r"[,\s]+", clean(record.get("Authorised"))) if c],
            "classification": clean(record.get("Classification (Reg. 1272/2008)")),
            "ai": {key: clean(record.get(column)) for key, column in PPP_AI_FIELDS.items()},
        }
        for substance_id in ids:
            by_substance[substance_id] = entry

    return {
        "meta": {
            "source": "EU Pesticide Database — active substances under Reg. (EC) No 1107/2009",
            "sourceFile": xlsx.name,
            "note": "The AI-analysis fields were added to the export by Pelsis, not by the Commission.",
            "rows": len(records),
            "count": len(by_substance),
            "unmatched": len(unmatched),
        },
        "bySubstance": by_substance,
    }


# ── Substitution / derogation consultations ──────────────────
# ECHA consults publicly before deciding whether a substance is a candidate for
# substitution, and before granting a derogation from the Article 5(1)
# exclusion criteria. The row names the conditions the substance is *said* to
# meet and what was consulted on — the evidence behind the substitution flag,
# not a decision. Two exports: an open consultation still taking comments, and
# the closed ones.

CONSULTATION_ATTACHMENT = re.compile(r'([^#"]+)#"([^"]*)"')


def attachments(value: str) -> list[dict]:
    """The export packs links as name, then the URL in quotes, separated by
    hashes, several in a row. Empty slots carry nothing and are dropped."""
    out = []
    for label, url in CONSULTATION_ATTACHMENT.findall(value or ""):
        label = label.strip().strip('"')
        if label and url:
            out.append({"label": label, "url": url})
    return out


def product_types(value: str) -> list[str]:
    """"09, 12" and "PT06" and "1" all mean the same thing somewhere in this
    file. Normalise to PT1 … PT22, in the order given."""
    seen: list[str] = []
    for token in re.split(r"[,\s]+", clean(value)):
        digits = re.sub(r"\D", "", token)
        if digits:
            label = f"PT{int(digits)}"
            if label not in seen:
                seen.append(label)
    return seen


def convert_consultations(paths: list[Path], substances: dict) -> dict:
    """The open consultations, one list per substance, newest first.

    The reader is given the *open* ones because those are the only ones still
    answerable. A closed consultation's grounds are superseded by whatever was
    decided, and the decision is the substitution field itself. The `state`
    field and the closed rendering stay in place for when the conclusions are
    added alongside the historical rows.
    """
    by_ec: dict[str, list[str]] = {}
    by_cas: dict[str, list[str]] = {}
    by_name: dict[str, set] = {}
    for s in substances["substances"]:
        if s["ec"]:
            by_ec.setdefault(norm_id(s["ec"]), []).append(s["id"])
        if s["cas"]:
            by_cas.setdefault(norm_id(s["cas"]), []).append(s["id"])
        for form in (s["name"], strip_trailing_paren(s["name"]), trailing_paren(s["name"])):
            if form:
                by_name.setdefault(loose_name(form), set()).add(s["id"])

    by_substance: dict[str, list[dict]] = {}
    rows_read = unmatched = 0
    for path in paths:
        state = "open" if path.stem.endswith("Current") else "closed"
        with path.open(encoding="utf-8-sig", newline="") as handle:
            for record in csv.DictReader(handle):
                name = clean(record.get("Name"))
                if not name:
                    continue
                rows_read += 1

                ec = identifier(clean(record.get("EC Number")))
                cas = identifier(clean(record.get("CAS Number")))
                ids = (by_ec.get(norm_id(ec), []) if ec else []) or (
                    by_cas.get(norm_id(cas), []) if cas else []
                )
                if not ids:
                    for form in (name, strip_trailing_paren(name)):
                        hits = by_name.get(loose_name(form), set())
                        if hits:
                            ids = sorted(hits)
                            break
                if not ids:
                    # Most rows are other product types entirely — different
                    # molecules, nothing to attach them to. Only worth a line
                    # when the consultation covered PT18 or PT19.
                    unmatched += 1
                    if {"PT18", "PT19"} & set(product_types(record.get("Product type"))):
                        print(f'  ! Consultation: "{name[:55]}" (PT18/19) matches no substance',
                              file=sys.stderr)
                    continue

                entry = {
                    "scope": clean(record.get("Scope")),
                    "state": state,
                    "name": name,
                    "productTypes": product_types(record.get("Product type")),
                    "start": iso_date(record.get("Start date for providing information")),
                    "deadline": iso_date(record.get("Deadline for providing information")),
                    "intendedUse": clean(record.get("Intended use")),
                    "article10": clean(record.get("Which conditions of Article 10(1) are met")),
                    "article5": clean(record.get("Which conditions of Article 5(1) are met")),
                    "additional": clean(record.get("Additional information")),
                    "link": clean(record.get("Link for providing information")),
                    "received": attachments(record.get("Information received", "")),
                    "attachments": attachments(record.get("Attachments", "")),
                }
                for substance_id in ids:
                    by_substance.setdefault(substance_id, []).append(entry)

    for entries in by_substance.values():
        entries.sort(key=lambda e: e["start"], reverse=True)

    return {
        "meta": {
            "source": "ECHA — consultations on potential candidates for substitution and on derogation conditions",
            "sourceFiles": [p.name for p in paths],
            "rows": rows_read,
            "count": len(by_substance),
            "unmatched": unmatched,
        },
        "bySubstance": by_substance,
    }


# ── PACT: ECHA's Public Activities Coordination Tool ─────────
# What any EU authority is doing about the substance outside the biocides file:
# substance and dossier evaluation, PBT and endocrine-disruptor assessment, a
# harmonised classification proposal, and so on. A live CLH proposal or an ED
# assessment under way is the kind of thing that lands on a renewal, so the
# activities are worth seeing next to it.
#
# The export packs several activities into one cell, separated by " | ", and one
# set of columns per area. The area codes are confirmed by the URLs in the file
# itself — the SEv links point at the CoRAP table, ED at ed-assessment, and so on.

PACT_AREAS = [
    ("SEv", "Substance evaluation (CoRAP)"),
    ("DEv", "Dossier evaluation"),
    ("PBT", "PBT / vPvB assessment"),
    ("ED", "Endocrine disruptor assessment"),
    ("ARN", "Assessment of regulatory needs"),
    ("CLH", "Harmonised classification (CLH)"),
    ("SVHC", "SVHC identification"),
    ("Recom", "Recommendation for Annex XIV"),
    ("Restriction", "Restriction"),
]


def split_cell(value: str) -> list[str]:
    """One cell, several activities, separated by " | ".

    The separator also turns up *inside* a status — "Concluded (not ED |
    inconclusive)" is one activity, while "Concluded (…) | Concluded (…)" is
    two — so split only at bracket depth zero. Empty slots are kept, so the four
    columns of an area stay aligned with one another.
    """
    text = clean(value)
    if not text:
        return []
    parts, depth, current = [], 0, []
    for ch in text:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        if ch == "|" and depth == 0:
            parts.append("".join(current).strip())
            current = []
        else:
            current.append(ch)
    parts.append("".join(current).strip())
    return parts


def pact_activities(record: dict) -> list[dict]:
    """Every activity in the row, flattened across the nine areas."""
    out = []
    for code, label in PACT_AREAS:
        statuses = split_cell(record.get(f"status_{code}"))
        if not statuses:
            continue
        expected = to_int(clean(record.get(code)))
        if expected and len([x for x in statuses if x]) != expected:
            print(
                f'  ~ PACT: {code} says {expected} activities but the status cell'
                f" splits into {len([x for x in statuses if x])}",
                file=sys.stderr,
            )
        intentions = split_cell(record.get(f"intention_date_{code}"))
        updates = split_cell(record.get(f"latest_update_{code}"))
        links = split_cell(record.get(f"link_{code}"))
        for i, status in enumerate(statuses):
            if not status:
                continue
            out.append(
                {
                    "area": code,
                    "areaLabel": label,
                    "status": status,
                    "intention": iso_date(intentions[i]) if i < len(intentions) else "",
                    "updated": iso_date(updates[i]) if i < len(updates) else "",
                    "url": links[i] if i < len(links) else "",
                }
            )
    # A PACT row can cover several ECHA names at once — the three Chrysanthemum
    # extracts share one — and the export then repeats each activity per name.
    # Two activities identical in all four fields are indistinguishable, so the
    # duplicate carries nothing.
    seen, unique = set(), []
    for a in out:
        key = (a["area"], a["status"], a["intention"], a["updated"], a["url"])
        if key not in seen:
            seen.add(key)
            unique.append(a)

    # Newest first, undated last — the same order the signal timeline uses.
    unique.sort(key=lambda a: a["updated"] or "", reverse=True)
    return unique


def convert_pact(path: Path, substances: dict) -> dict:
    by_name: dict[str, set] = {}
    by_ec: dict[str, list[str]] = {}
    by_cas: dict[str, list[str]] = {}
    for s in substances["substances"]:
        # A few ECHA names carry a second spelling after a semicolon —
        # "…(alpha-Cypermethrin); [1α(S*),3α]-(α)-cyano-…" — and PACT writes
        # only the first. Index every part, so either spelling lands.
        for part in [s["name"], *s["name"].split(";")]:
            if part.strip():
                by_name.setdefault(loose_name(part), set()).add(s["id"])
        if s["ec"]:
            by_ec.setdefault(norm_id(s["ec"]), []).append(s["id"])
        if s["cas"]:
            by_cas.setdefault(norm_id(s["cas"]), []).append(s["id"])

    by_substance: dict[str, dict] = {}
    rows = empty = unmatched = 0
    with path.open(encoding="utf-8-sig", newline="") as handle:
        for record in csv.DictReader(handle):
            names = [n.strip() for n in clean(record.get("Substance")).split("|") if n.strip()]
            if not names:
                continue
            rows += 1

            activities = pact_activities(record)
            flags = {
                "carcinogen": clean(record.get("EPA_carc_list_classification")),
                "carcinogenYear": clean(record.get("EPA_carc_list_date")),
                "edList": clean(record.get("endo_disr_lists_list")),
                "edStatus": clean(record.get("endo_disr_lists_status")),
                "edEffects": clean(record.get("endo_disr_lists_effects")),
            }
            if not activities and not any(flags.values()):
                # On the list with nothing recorded against it — most rows.
                empty += 1
                continue

            # The Substance column carries every ECHA name the PACT row covers,
            # which is how the Chrysanthemum and Margosa variants stay together.
            ids: set = set()
            for name in names:
                ids |= by_name.get(loose_name(name), set())
            if not ids:
                ec = identifier(clean(record.get("EC / List no")))
                cas = identifier(clean(record.get("CAS no")))
                ids = set(by_ec.get(norm_id(ec), []) if ec else []) or set(
                    by_cas.get(norm_id(cas), []) if cas else []
                )
            if not ids:
                unmatched += 1
                print(f'  ! PACT: "{names[0][:55]}" matches no substance', file=sys.stderr)
                continue

            entry = {
                "name": clean(record.get("PACT Substance Name")) or names[0],
                "description": clean(record.get("Description")),
                "activities": activities,
                "flags": flags,
            }
            for substance_id in ids:
                by_substance[substance_id] = entry

    return {
        "meta": {
            "source": "ECHA — Public Activities Coordination Tool (PACT), with EPA and endocrine-disruptor list flags",
            "sourceFile": path.name,
            "rows": rows,
            "empty": empty,
            "count": len(by_substance),
            "unmatched": unmatched,
        },
        "bySubstance": by_substance,
    }


# ── Article 14(5) postponements ──────────────────────────────
# One row per Commission decision moving an approval's expiry date. These are
# the acts the substance export names but does not unpack: who asked, how long
# was granted, and — where the recital says — why the evaluation ran late.
#
# The `Reason_AI` and `Inference_AI` columns are a reading added by Pelsis, not
# the Commission's; `Recital_quote` is the document's own words. They are kept
# apart on the way in so the interface can label them apart.


def partial_date(value: str) -> tuple[str, str]:
    """"2025-02-21" -> day precision; a bare "2021" -> year precision.

    Three of these decisions were never retrieved, so the export carries only
    the year it was adopted. Anchoring those to 1 January keeps them sortable
    while the precision flag stops the interface claiming a day it doesn't know.
    """
    text = clean(value)
    if re.fullmatch(r"\d{4}", text):
        return f"{text}-01-01", "year"
    iso = iso_date(text)
    return (iso, "day") if iso else ("", "day")


def loose_tokens(value: str) -> set:
    """Words, with punctuation stripped inside each: "ABTS-1743" and "ABTS1743"
    become the same token, "AM65-52" and "AM65-52" likewise."""
    parts = re.split(r"[\s,;]+", value.lower())
    return {re.sub(r"[^a-z0-9]", "", p) for p in parts if re.sub(r"[^a-z0-9]", "", p)}


def filing_date(value: str) -> str:
    """"28 Jul 2020" -> ISO. "27+28 Apr 2021" is two applications filed on
    consecutive days; the first is the one that starts the clock, and the
    verbatim string is kept alongside so neither date is lost."""
    text = clean(value)
    m = re.match(r"(\d{1,2})(?:\s*\+\s*\d{1,2})?\s+([A-Za-z]{3,})\.?\s+(\d{4})", text)
    if not m:
        return ""
    day, month, year = m.groups()
    for fmt in ("%d %b %Y", "%d %B %Y"):
        try:
            return datetime.strptime(f"{day} {month[:3]} {year}", "%d %b %Y").date().isoformat()
        except ValueError:
            continue
    return ""


def convert_postponements(paths: list[Path], substances: dict) -> dict:
    """Every export of Commission decisions moving an approval's expiry date.

    One file per product type, and the product type only appears in the
    filename — so it is read from there and used in the match. A PT18 decision
    must not attach to the PT19 row of the same molecule: the two run on
    separate timetables and are postponed by separate acts.
    """
    # Keyed by product type as well as name.
    by_name: dict[tuple, set] = {}
    tokens: list[tuple] = []
    for s in substances["substances"]:
        for form in (s["name"], strip_trailing_paren(s["name"]), trailing_paren(s["name"]),
                     *s["name"].split(";")):
            if form.strip():
                by_name.setdefault((loose_name(form), s["pt"]), set()).add(s["id"])
        tokens.append((loose_tokens(s["name"]), s["pt"], s["id"]))

    by_substance: dict[str, dict] = {}
    rows = unmatched = 0
    for path in paths:
        m = re.match(r"(PT\d+)", path.name, re.I)
        pt = m.group(1).upper() if m else ""

        with path.open(encoding="utf-8-sig", newline="") as handle:
            for record in csv.DictReader(handle):
                name = clean(record.get("Substance"))
                if not name:
                    continue
                rows += 1

                ids: set = set()
                for form in (name, strip_trailing_paren(name), trailing_paren(name)):
                    if form:
                        ids = by_name.get((loose_name(form), pt), set())
                        if ids:
                            break
                if not ids:
                    # The Bacillus entries name the strain differently on each
                    # side. Score by how much of the decision's name our record
                    # accounts for, and take the best only when it stands alone
                    # — within this product type.
                    wanted = loose_tokens(name)
                    scored = sorted(
                        ((len(wanted & have) / len(wanted), sid)
                         for have, spt, sid in tokens if spt == pt),
                        reverse=True,
                    )
                    if scored and scored[0][0] >= 0.6 and (
                        len(scored) == 1 or scored[0][0] > scored[1][0]
                    ):
                        ids = {scored[0][1]}
                if not ids:
                    unmatched += 1
                    print(f'  ! Postponements: "{name[:50]}" ({pt}) matches no substance',
                          file=sys.stderr)
                    continue

                adopted, precision = partial_date(record.get("Adopted"))
                entry = {
                    "decision": clean(record.get("Decision")),
                    "decisionUrl": clean(record.get("Decision_URL")),
                    "sequence": clean(record.get("Sequence")),
                    "adopted": adopted,
                    "adoptedPrecision": precision,
                    "expiryFrom": iso_date(record.get("Expiry_from")),
                    "expiryTo": iso_date(record.get("Expiry_to")),
                    "extension": clean(record.get("Extension")),
                    "authority": clean(record.get("Competent_authority")),
                    # The document's own words.
                    "recitalRef": clean(record.get("Recital_ref")),
                    "recitalQuote": clean(record.get("Recital_quote")),
                    "retrieved": clean(record.get("Source_retrieved")).lower() == "yes",
                    # Added by Pelsis, kept separate so it can be labelled.
                    "reason": clean(record.get("Reason_AI")),
                    "inference": clean(record.get("Inference_AI")),
                }

                for substance_id in ids:
                    holder = by_substance.setdefault(
                        substance_id,
                        {
                            "name": name,
                            "authority": clean(record.get("Competent_authority")),
                            "approvalOrigin": clean(record.get("Approval_origin")),
                            # How the renewal is being evaluated, e.g. "Full
                            # evaluation" — the only source the app has for it.
                            "track": clean(record.get("Renewal_track")),
                            "applicationSubmitted": clean(record.get("Application_submitted")),
                            "applicationSubmittedIso": filing_date(record.get("Application_submitted")),
                            "status": clean(record.get("Substance_status")),
                            "currentExpiry": iso_date(record.get("Current_expiry")),
                            "postponements": [],
                        },
                    )
                    holder["postponements"].append(entry)

    for holder in by_substance.values():
        holder["postponements"].sort(key=lambda e: e["adopted"] or "")

    return {
        "meta": {
            "source": "Commission decisions postponing the expiry date of an approval",
            "sourceFiles": [p.name for p in paths],
            "note": "Reason and inference are a Pelsis reading; the recital quote is the document's own words.",
            "rows": rows,
            "count": len(by_substance),
            "unmatched": unmatched,
        },
        "bySubstance": by_substance,
    }



# ── BPC opinions and minority positions ──────────────────────
# Every opinion the Biocidal Products Committee has adopted on an approval or a
# renewal, with the document itself and — where a member state disagreed — the
# minority position it filed. A minority position is a named authority putting
# its dissent on the record, so the count is worth having on the page.

def convert_bpc_opinions(path: Path, substances: dict) -> dict:
    by_name: dict[tuple, set] = {}
    by_id: dict[tuple, set] = {}
    tokens: list[tuple] = []
    for s in substances["substances"]:
        for form in (s["name"], strip_trailing_paren(s["name"]), trailing_paren(s["name"]),
                     *s["name"].split(";")):
            if form.strip():
                by_name.setdefault((loose_name(form), s["pt"]), set()).add(s["id"])
        for value in (s["ec"], s["cas"]):
            if value:
                by_id.setdefault((norm_id(value), s["pt"]), set()).add(s["id"])
        tokens.append((loose_tokens(s["name"]), s["pt"], s["id"]))

    by_substance: dict[str, list[dict]] = {}
    rows = skipped = unmatched = 0
    with path.open(encoding="utf-8-sig", newline="") as handle:
        for record in csv.DictReader(handle):
            name = clean(record.get("Name"))
            digits = re.sub(r"\D", "", clean(record.get("Product Type (PT)")))
            if not name or not digits:
                continue
            pt = f"PT{int(digits)}"
            if pt not in ("PT18", "PT19"):
                # The file covers every product type; the app covers two.
                skipped += 1
                continue
            rows += 1

            ids: set = set()
            for form in (name, strip_trailing_paren(name), trailing_paren(name)):
                if form:
                    ids = by_name.get((loose_name(form), pt), set())
                    if ids:
                        break
            if not ids:
                for value in (record.get("EC Number"), record.get("CAS Number")):
                    ids = by_id.get((norm_id(identifier(clean(value))), pt), set())
                    if ids:
                        break
            if not ids:
                wanted = loose_tokens(name)
                scored = sorted(
                    ((len(wanted & have) / len(wanted), sid)
                     for have, spt, sid in tokens if spt == pt),
                    reverse=True,
                )
                if scored and scored[0][0] >= 0.6 and (
                    len(scored) == 1 or scored[0][0] > scored[1][0]
                ):
                    ids = {scored[0][1]}
            if not ids:
                unmatched += 1
                print(f'  ! BPC opinions: "{name[:50]}" ({pt}) matches no substance', file=sys.stderr)
                continue

            opinion = attachments(record.get("BPC Opinion", ""))
            entry = {
                "date": iso_date(record.get("Date of opinion")),
                "stage": clean(record.get("First approval or first renewal")),
                "opinion": opinion[0] if opinion else None,
                "minority": attachments(record.get("BPC minority positions", "")),
            }
            for substance_id in ids:
                by_substance.setdefault(substance_id, []).append(entry)

    for entries in by_substance.values():
        entries.sort(key=lambda e: e["date"] or "", reverse=True)

    minority = sum(len(e["minority"]) for v in by_substance.values() for e in v)
    return {
        "meta": {
            "source": "ECHA — BPC opinions on active substance approval, with minority positions",
            "sourceFile": path.name,
            "rows": rows,
            "skipped": skipped,
            "count": len(by_substance),
            "minorityCount": minority,
            "unmatched": unmatched,
        },
        "bySubstance": by_substance,
    }


def nothing(value) -> str:
    """The workbook writes "None" and "—" where a field does not apply."""
    text = clean(value)
    return "" if text in ("None", "—", "-", "nan") else text


def long_date(value) -> str:
    """"1 November 2012" -> "2012-11-01". The acts write their dates out in
    full; every one of the 61 parses, and every one matches the approval start
    date in ECHA's own export."""
    text = nothing(value)
    if not text:
        return ""
    try:
        return datetime.strptime(text, "%d %B %Y").date().isoformat()
    except ValueError:
        print(f'  ! approvals: date "{text[:40]}" not understood', file=sys.stderr)
        return ""


def recitals(value) -> list[str]:
    """The rationale cell joins whole recitals with " | ", each already opening
    with its own "(7)" number, so the separator is unambiguous — checked
    against all 8 rows that carry one."""
    text = nothing(value)
    return [part.strip() for part in text.split(" | ") if part.strip()] if text else []


# The short name each methodology gets on the strip, where the column header is
# too long for a 7-segment bar.
METHOD_SHORT = {
    "BPR approval": "BPR",
    "ED criteria": "ED",
    "human health": "HH",
    "PT18 emission scenarios": "ESD",
    "bee risk": "Bee",
    "drinking water treatment": "H\u2082O",
    "resistance": "Res",
}


def methodologies(record: dict, headers: list[str]) -> list[dict]:
    """The "Methodology: <name> (MM-YYYY)" columns, as one entry each.

    Every cell is a single-pair object — {"covered": ""}, {"not covered": "why"},
    {"partial": "why"} or {"-": "why not applicable"} — so the key is the state
    and the value, where there is one, is the explanation.

    Checked against the data: all 379 covered/not-covered flags agree exactly
    with whether the opinion date falls after the methodology's own date, so the
    set is anchored to the assessment, not to the approval.
    """
    out = []
    for header in headers:
        if not header.startswith("Methodology:"):
            continue
        name = header[len("Methodology:"):].strip()
        match = re.search(r"\((\d{2})-(\d{4})\)\s*$", name)
        label = re.sub(r"\s*\(\d{2}-\d{4}\)\s*$", "", name)
        raw = clean(record.get(header))
        if not raw or raw == "None":
            continue
        try:
            pair = json.loads(raw)
        except json.JSONDecodeError:
            print(f'  ! approvals: methodology cell not understood: {raw[:60]}', file=sys.stderr)
            continue
        if not pair:
            continue
        state, note = next(iter(pair.items()))
        out.append({
            "label": label,
            "short": METHOD_SHORT.get(label, label[:3]),
            # ISO-ish, so the interface can format it: "2018-06".
            "since": f"{match.group(2)}-{match.group(1)}" if match else "",
            # covered | not covered | partial | -
            "state": clean(state),
            "note": clean(note),
        })
    return out


def convert_approvals(path: Path, substances: dict) -> dict:
    """The act that approved each substance, read off EUR-Lex.

    Two sheets. "Substances" is one row per substance x PT, carrying the anchor
    act — the latest act that approved, renewed or included the substance for
    that product type — with the candidate-for-substitution finding and the
    REACH Annex XIII properties quoted verbatim from its recitals. "Conditions"
    splits each act's Annex conditions into items, bucketed.

    The workbook was assembled by an AI reading EUR-Lex, so the panel says so;
    the quoted text is the act's own words and links to the act itself.
    """
    index = build_index(substances)
    by_name: dict[tuple, set] = {}
    for s in substances["substances"]:
        for form in (s["name"], strip_trailing_paren(s["name"]), trailing_paren(s["name"])):
            if form.strip():
                by_name.setdefault((loose_name(form), s["pt"]), set()).add(s["id"])
    by_id: dict[tuple, set] = {}
    for s in substances["substances"]:
        for value in (s["ec"], s["cas"]):
            if value:
                by_id.setdefault((norm_id(value), s["pt"]), set()).add(s["id"])

    def match(common: str, echa: str, ec: str, cas: str, pt: str) -> str:
        for form in (echa, common, strip_trailing_paren(common), trailing_paren(common)):
            if form:
                found = by_name.get((loose_name(form), pt), set())
                if len(found) == 1:
                    return next(iter(found))
        for value in (ec, cas):
            if value:
                found = by_id.get((norm_id(identifier(value)), pt), set())
                if len(found) == 1:
                    return next(iter(found))
        return ""

    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)

    # ---- One approval record per substance. Read first, because it also gives
    # the Conditions sheet its key: that sheet carries only the common name and
    # the PT, and several of these substances have names too long to match on
    # their own, but both sheets spell the common name identically.
    common_key: dict[tuple, str] = {}
    by_substance: dict[str, dict] = {}
    sheet = workbook["Substances"]
    rows = sheet.iter_rows(values_only=True)
    head = [clean(c) for c in next(rows)]
    total = unmatched = methods_seen = 0
    for row in rows:
        record = dict(zip(head, row))
        common = clean(record.get("Substance (common name)"))
        if not common:
            continue
        digits = re.sub(r"\D", "", clean(record.get("PT")))
        if not digits:
            continue
        total += 1
        pt = f"PT{int(digits)}"
        substance_id = match(
            common,
            clean(record.get("Substance name (ECHA)")),
            blank_dash(clean(record.get("EC no."))),
            blank_dash(clean(record.get("CAS no."))),
            pt,
        )
        if not substance_id:
            unmatched += 1
            print(f'  ! approvals: "{common[:50]}" ({pt}) matches no substance', file=sys.stderr)
            continue

        act_name = nothing(record.get("Anchor act"))
        entry = {
            "act": {
                "name": act_name,
                "type": nothing(record.get("Anchor act type")),
                "celex": nothing(record.get("Anchor CELEX")),
                "date": nothing(record.get("Anchor act date")),
                "url": nothing(record.get("EUR-Lex link")),
                "title": nothing(record.get("Anchor act title")),
                "oj": nothing(record.get("OJ reference")),
            } if act_name else None,
            "authority": nothing(record.get("Evaluating CA / RMS")),
            "opinionDate": nothing(record.get("Opinion / report date")),
            "opinionType": nothing(record.get("Opinion type")),
            "purity": nothing(record.get("Min. purity")),
            "approvalDate": nothing(record.get("Date of approval (anchor)")),
            "approvalIso": long_date(record.get("Date of approval (anchor)")),
            "expiryInAct": nothing(record.get("Expiry in anchor act")),
            "expiryIso": long_date(record.get("Expiry in anchor act")),
            "currentExpiry": nothing(record.get("Current expiry (EUR-Lex)")),
            "expirySource": nothing(record.get("Current expiry source")),
            "cfs": {
                "inAct": nothing(record.get("CfS in anchor act")),
                "criterion": nothing(record.get("CfS criterion")),
                "meaning": nothing(record.get("CfS criterion meaning")),
                "rationale": recitals(record.get("PBT / CfS rationale (recitals, verbatim)")),
            },
            "hazard": {
                "flags": [f.strip() for f in nothing(record.get("Hazard flags (recitals)")).split(",") if f.strip()],
                "verbatim": nothing(record.get("Hazard flags (verbatim)")),
                "clause": nothing(record.get("Hazard conclusion clause (verbatim)")),
                "ed": nothing(record.get("ED mention")),
            },
            # ECHA's own field, which for seven substances says Yes where the
            # act says nothing. Where that flag comes from is not documented in
            # anything we hold, so it is carried as its own value and the panel
            # reports both records rather than reconciling them.
            "echaCfs": nothing(record.get("ECHA CfS flag")),
            "renewed": nothing(record.get("Renewed since initial approval")) == "Yes",
            # Which of the current assessment methodologies existed when the
            # substance was assessed. Empty for the 38 never approved.
            "methods": methodologies(record, head),
            "initial": None,
            "conditions": [],
        }

        # Only where the substance has been renewed, so the act that first
        # approved it is a different document with its own findings.
        if nothing(record.get("Initial = anchor")) == "No":
            entry["initial"] = {
                "name": nothing(record.get("Initial act")),
                "type": nothing(record.get("Initial act type")),
                "celex": nothing(record.get("Initial CELEX")),
                "date": nothing(record.get("Initial act date")),
                "url": nothing(record.get("Initial EUR-Lex link")),
                "approvalDate": nothing(record.get("Initial date of approval")),
                "approvalIso": long_date(record.get("Initial date of approval")),
                "expiry": nothing(record.get("Initial expiry")),
                "expiryIso": long_date(record.get("Initial expiry")),
                "purity": nothing(record.get("Initial min. purity")),
                "cfsInAct": nothing(record.get("Initial CfS in act")),
                "cfsCriterion": nothing(record.get("Initial CfS criterion")),
                "hazardVerbatim": nothing(record.get("Initial hazard flags (verbatim)")),
                "hazardClause": nothing(record.get("Initial hazard conclusion clause (verbatim)")),
            }

        by_substance[substance_id] = entry
        methods_seen += len(entry["methods"])
        common_key[(loose_name(common), pt)] = substance_id

    # ---- Each act's Annex conditions, split into items and bucketed.
    sheet = workbook["Conditions"]
    rows = sheet.iter_rows(values_only=True)
    head = [clean(c) for c in next(rows)]
    condition_rows = dropped = 0
    for row in rows:
        record = dict(zip(head, row))
        name = clean(record.get("Substance (common name)"))
        digits = re.sub(r"\D", "", clean(record.get("PT")))
        text = nothing(record.get("Condition text"))
        if not name or not digits or not text:
            continue
        substance_id = common_key.get((loose_name(name), f"PT{int(digits)}"), "")
        if not substance_id:
            dropped += 1
            print(f'  ! approvals: condition for "{name[:50]}" (PT{digits}) has no act row', file=sys.stderr)
            continue
        condition_rows += 1
        by_substance[substance_id]["conditions"].append({
            "bucket": nothing(record.get("Bucket")),
            "tags": [t.strip() for t in nothing(record.get("Tags")).split(";") if t.strip()],
            "text": text,
            "role": nothing(record.get("Act role")),
            "celex": nothing(record.get("Act CELEX")),
        })

    workbook.close()
    with_act = sum(1 for e in by_substance.values() if e["act"])
    cfs_in_act = sum(1 for e in by_substance.values() if e["cfs"]["inAct"] == "Yes")
    return {
        "meta": {
            "source": "EUR-Lex — BPR PT18/PT19 approval acts, conditions extracted by AI",
            "sourceFile": path.name,
            "retrieved": "2026-09-21",
            "rows": total,
            "count": len(by_substance),
            "withAct": with_act,
            "cfsInAct": cfs_in_act,
            "conditionRows": condition_rows,
            "conditionsDropped": dropped,
            "methodFlags": methods_seen,
            "unmatched": unmatched,
        },
        "bySubstance": by_substance,
    }


def convert_products(xlsx: Path, substances: dict) -> tuple[dict, dict]:
    """Returns (bundled summaries, per-substance detail keyed by substance id).

    A product row lists every active substance it contains and every product
    type it is authorised for, each pipe-separated and *not* positionally
    paired. So we take the cross product of (BAS × PT) and keep only the pairs
    that exist as substances — a product whose PT14 component isn't in this
    export simply never matches, which is the behaviour we want.
    """
    book = openpyxl.load_workbook(xlsx, data_only=True)
    sheet = book["results"]
    rows = list(sheet.iter_rows(min_row=HEADER_ROW, values_only=True))
    header = [clean(h) for h in rows[0]]
    records = [dict(zip(header, r)) for r in rows[1:] if r and r[0]]

    known = {s["id"] for s in substances["substances"]}
    linked: dict[str, list[dict]] = collections.defaultdict(list)

    for record in records:
        ids = {
            f"{bas}-{pt}"
            for bas in split_cell(record.get("BAS number"))
            for pt in product_types(record.get("Product-type"))
        } & known
        if not ids:
            continue

        product = {
            "tradeNames": [display_name(n) for n in split_cell(record.get("Trade name"))],
            "market": clean(record.get("Market area")),
            "holder": clean(record.get("Authorisation holder")),
            "status": clean(record.get("Authorisation status")),
            "kind": authorisation_kind(clean(record.get("Authorisation type"))),
            "start": parse_date(clean(record.get("Authorisation start date"))),
            "end": parse_date(clean(record.get("Authorisation end date"))),
            "asset": clean(record.get("R4BP asset number")),
            "nationalNumber": blank_dash(clean(record.get("National authorisation number"))),
            "reference": clean(record.get("Reference authorisation number")),
            "fieldOfUse": unique_cell(record.get("Field of use")),
            "userCategory": unique_cell(record.get("User category")),
        }
        for substance_id in ids:
            linked[substance_id].append(product)

    # The substance's own expiry, so a summary can say how much of the product
    # estate outlives the approval it depends on.
    expiry = {s["id"]: s["endDate"] for s in substances["substances"]}
    summaries = {sid: summarise_products(rows, expiry.get(sid, "")) for sid, rows in linked.items()}
    detail = {sid: build_product_detail(rows) for sid, rows in linked.items()}

    export_date = parse_export_date(book["criteria"]) if "criteria" in book.sheetnames else ""
    meta = {
        "source": "ECHA — Biocidal products (Search for Chemicals export)",
        "sourceFile": xlsx.name,
        "exportDate": export_date,
        "substanceCount": len(summaries),
        "productCount": sum(len(v) for v in linked.values()),
    }
    return {"meta": meta, "bySubstance": summaries}, detail


def summarise_products(rows: list[dict], substance_end: str = "") -> dict:
    """One card's worth of numbers: the families and the headline counts."""
    families = collections.defaultdict(list)
    for row in rows:
        families[row["reference"]].append(row)
    groups = holder_groups([r["holder"] for r in rows if r["holder"]])

    family_list = []
    for reference, members in families.items():
        statuses = collections.Counter(m["status"] for m in members)
        markets = {m["market"] for m in members if m["market"]}
        holders = collections.Counter(group_of(m["holder"], groups) for m in members if m["holder"])
        ends = sorted(e for e in (m["end"] for m in members) if e)
        family_list.append(
            {
                "reference": reference,
                "name": family_name(members) or reference,
                "holder": holders.most_common(1)[0][0] if holders else "",
                "markets": sorted(markets),
                "kind": collections.Counter(m["kind"] for m in members).most_common(1)[0][0],
                "live": statuses.get("Authorised", 0),
                "expired": statuses.get("Expired", 0),
                "cancelled": statuses.get("Cancelled", 0),
                # Live while any authorisation still stands; the counts above say
                # how a dead family ended, so nothing has to arbitrate between
                # "expired" and "cancelled".
                "state": "live" if statuses.get("Authorised") else "dead",
                "end": ends[-1] if ends else "",
            }
        )

    # Live families first, biggest first; the dead ones sink to the bottom.
    family_list.sort(key=lambda f: (f["state"] != "live", -(f["live"] + f["expired"] + f["cancelled"]), f["name"].lower()))

    union = [f for f in family_list if f["kind"] == "Union"]
    starts = sorted(r["start"] for r in rows if r["start"])
    # Authorisations whose own end date outlives the substance approval.
    past = [r for r in rows if substance_end and r["end"] and r["end"] > substance_end]
    # Only holders with a live authorisation count as holders of record — a
    # company whose last authorisation lapsed years ago is not a current route
    # to market. The total is kept alongside so the drop-off stays visible.
    live_holders = {
        group_of(r["holder"], groups) for r in rows if r["holder"] and r["status"] == "Authorised"
    }
    return {
        "products": len(rows),
        "families": len(family_list),
        "holderGroups": len(live_holders),
        "holderGroupsEver": len(set(groups.values())),
        "marketAreas": len({r["market"] for r in rows if r["market"]}),
        "marketAreasLive": len({r["market"] for r in rows if r["market"] and r["status"] == "Authorised"}),
        "unionLive": sum(1 for f in union if f["state"] == "live"),
        "unionTotal": len(union),
        "newestGrant": int(starts[-1][:4]) if starts else 0,
        "pastExpiry": {
            "total": len(past),
            "national": sum(1 for r in past if r["kind"] == "National"),
            "union": sum(1 for r in past if r["kind"] == "Union"),
            "other": sum(1 for r in past if r["kind"] not in ("National", "Union")),
        },
        "list": family_list,
    }


def build_product_detail(rows: list[dict]) -> dict:
    """Every authorisation, grouped by family — written to its own file and
    fetched only when a reader opens the product page."""
    families = collections.defaultdict(list)
    for row in rows:
        families[row["reference"]].append(row)
    groups = holder_groups([r["holder"] for r in rows if r["holder"]])

    out = []
    for reference, members in families.items():
        members.sort(key=lambda m: (m["market"].lower(), m["asset"]))
        statuses = collections.Counter(m["status"] for m in members)
        holders = collections.Counter(group_of(m["holder"], groups) for m in members if m["holder"])
        out.append(
            {
                "reference": reference,
                "name": family_name(members) or reference,
                "holder": holders.most_common(1)[0][0] if holders else "",
                "kind": collections.Counter(m["kind"] for m in members).most_common(1)[0][0],
                "state": "live" if statuses.get("Authorised") else "dead",
                "products": members,
            }
        )
    out.sort(key=lambda f: (f["state"] != "live", -len(f["products"]), f["name"].lower()))
    return {"families": out}


def main() -> None:
    xlsx = Path(sys.argv[1]) if len(sys.argv) > 1 else DATA / "ECHA_all_PT18_PT19_active-substances-export.xlsx"

    substances = convert(xlsx)
    OUT.write_text(json.dumps(substances, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f'{substances["meta"]["count"]} substances -> {OUT.relative_to(ROOT)}')

    article_95 = sorted(DATA.glob("article_95_*.xlsx"))
    if article_95:
        suppliers = convert_suppliers(article_95[-1], substances)
        SUPPLIER_OUT.write_text(json.dumps(suppliers, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(
            f'{suppliers["meta"]["supplierCount"]} suppliers / {suppliers["meta"]["count"]} substances'
            f" -> {SUPPLIER_OUT.relative_to(ROOT)}"
        )

    interest_files = sorted(DATA.glob("as-rnl_expressions_of_interest_*.xlsx"))
    if interest_files:
        interest = convert_interest(interest_files[-1], substances)
        INTEREST_OUT.write_text(json.dumps(interest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f'{interest["meta"]["count"]} renewal-interest rows -> {INTEREST_OUT.relative_to(ROOT)}')

    ppp_files = sorted(DATA.glob("EU_Pesticide_Database_*.xlsx"))
    if ppp_files:
        ppp = convert_ppp(ppp_files[-1], substances)
        PPP_OUT.write_text(json.dumps(ppp, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(
            f'{ppp["meta"]["rows"]} pesticide-database rows / {ppp["meta"]["count"]} substances'
            f" -> {PPP_OUT.relative_to(ROOT)}"
        )

    # Only the open consultation. The closed ones are superseded by the
    # conclusions Pelsis holds separately, so carrying them here would show
    # grounds next to a decision that has already answered them.
    consultations = sorted(DATA.glob("consultations on potential candidates*_Current.csv"))
    if consultations:
        data = convert_consultations(consultations, substances)
        CONSULTATION_OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(
            f'{data["meta"]["rows"]} consultation rows / {data["meta"]["count"]} substances'
            f" -> {CONSULTATION_OUT.relative_to(ROOT)}"
        )

    pact_files = sorted(DATA.glob("pact-export*.csv"))
    if pact_files:
        pact = convert_pact(pact_files[-1], substances)
        PACT_OUT.write_text(json.dumps(pact, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(
            f'{pact["meta"]["rows"]} PACT rows ({pact["meta"]["empty"]} with nothing recorded)'
            f' / {pact["meta"]["count"]} substances -> {PACT_OUT.relative_to(ROOT)}'
        )

    postponement_files = sorted(DATA.glob("*postponements*.csv"))
    if postponement_files:
        data = convert_postponements(postponement_files, substances)
        POSTPONEMENT_OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(
            f'{data["meta"]["rows"]} postponement rows / {data["meta"]["count"]} substances'
            f" -> {POSTPONEMENT_OUT.relative_to(ROOT)}"
        )

    bpc_files = sorted(DATA.glob("bpc opinions*.csv"))
    if bpc_files:
        data = convert_bpc_opinions(bpc_files[-1], substances)
        BPC_OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(
            f'{data["meta"]["rows"]} BPC opinions ({data["meta"]["minorityCount"]} minority positions)'
            f' / {data["meta"]["count"]} substances -> {BPC_OUT.relative_to(ROOT)}'
        )

    approval_files = sorted(DATA.glob("BPR_PT18_PT19_approval_conditions*.xlsx"))
    if approval_files:
        data = convert_approvals(approval_files[-1], substances)
        APPROVAL_OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(
            f'{data["meta"]["withAct"]} approval acts ({data["meta"]["cfsInAct"]} stating candidate'
            f' for substitution) / {data["meta"]["conditionRows"]} conditions'
            f' / {data["meta"]["methodFlags"]} methodology flags'
            f' -> {APPROVAL_OUT.relative_to(ROOT)}'
        )

    products_xlsx = DATA / "biocidal-products-export.xlsx"
    if products_xlsx.exists():
        summaries, detail = convert_products(products_xlsx, substances)
        PRODUCT_OUT.write_text(json.dumps(summaries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

        # One file per substance, replacing whatever was there before.
        if PRODUCT_DETAIL_DIR.exists():
            for stale in PRODUCT_DETAIL_DIR.glob("*.json"):
                stale.unlink()
        PRODUCT_DETAIL_DIR.mkdir(parents=True, exist_ok=True)
        for substance_id, payload in detail.items():
            path = PRODUCT_DETAIL_DIR / f"{substance_id}.json"
            path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

        detail_mb = sum(p.stat().st_size for p in PRODUCT_DETAIL_DIR.glob("*.json")) / 1e6
        print(
            f'{summaries["meta"]["productCount"]} product links / {summaries["meta"]["substanceCount"]}'
            f" substances -> {PRODUCT_OUT.relative_to(ROOT)}"
            f" + {len(detail)} files ({detail_mb:.1f} MB) in {PRODUCT_DETAIL_DIR.relative_to(ROOT)}/"
        )



if __name__ == "__main__":
    main()
