#!/usr/bin/env python3
"""Write the "Expiry date postponed" column into the ECHA substance export.

An approval may not exceed 10 years, or 7 years for a candidate for
substitution. A start-to-end span longer than that cap therefore implies the
expiry date was moved after the original grant.

    python3 tools/flag_postponed.py [path/to/export.xlsx]

Run this after downloading a fresh ECHA export — the column is not part of what
ECHA publishes, so a new download arrives without it. The column is the source
of truth for the app: once written, individual rows can be corrected by hand in
the spreadsheet and the converter will read whatever is there.

Known limitation: a long span can also mean the approval was RENEWED (a new
period granted under Article 14(4)) rather than postponed. Those rows are
flagged too. See the notes in README.md.

Requires openpyxl.
"""

from __future__ import annotations

import sys
from copy import copy
from datetime import datetime
from pathlib import Path

import openpyxl

from convert_export import HEADER_ROW, exceeds_cap, latest
# Matched by prefix, so renaming the suffix (e.g. dropping "(WIP)") still finds it.
from convert_export import POSTPONED_PREFIX as COLUMN_PREFIX

COLUMN = "Expiry date postponed (WIP)"


def parse(value) -> "datetime.date | None":
    try:
        return datetime.strptime(str(value or "").strip(), "%d/%m/%Y").date()
    except ValueError:
        return None


def main() -> None:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else latest("substances")
    book = openpyxl.load_workbook(path)
    sheet = book["results"]
    header = [str(c.value).strip() if c.value else "" for c in sheet[HEADER_ROW]]

    col_start = header.index("Approval start date") + 1
    col_end = header.index("Approval end date") + 1
    col_substitution = header.index("Candidate for substitution") + 1
    # Reuse the column if it already exists, so re-running is idempotent.
    existing = next((i for i, h in enumerate(header) if h.startswith(COLUMN_PREFIX)), None)
    col_new = existing + 1 if existing is not None else sheet.max_column + 1

    source = sheet.cell(row=HEADER_ROW, column=col_new - 1)
    cell = sheet.cell(row=HEADER_ROW, column=col_new, value=COLUMN)
    cell.font, cell.fill = copy(source.font), copy(source.fill)
    cell.border, cell.alignment = copy(source.border), copy(source.alignment)
    sheet.column_dimensions[cell.column_letter].width = 22

    flagged = blank = 0
    for row in range(HEADER_ROW + 1, sheet.max_row + 1):
        if not sheet.cell(row=row, column=1).value:
            continue
        start = parse(sheet.cell(row=row, column=col_start).value)
        end = parse(sheet.cell(row=row, column=col_end).value)
        if not start or not end:
            # No approval period: the rule has nothing to measure.
            sheet.cell(row=row, column=col_new, value="")
            blank += 1
            continue
        substitution = str(sheet.cell(row=row, column=col_substitution).value or "").strip() == "Yes"
        over = exceeds_cap(start, end, substitution)
        sheet.cell(row=row, column=col_new, value="Yes" if over else "No")
        flagged += over

    book.save(path)
    print(f'"{COLUMN}" written to column {cell.column_letter} of {path.name}')
    print(f"  {flagged} flagged, {blank} with no approval period to measure")


if __name__ == "__main__":
    main()
