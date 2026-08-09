#!/usr/bin/env python3
"""
CSV Hospital — automated content flywheel for /guides.

Publishes the next high-intent, long-tail data-wrangling / spreadsheet-formatting
guide from TOPIC_QUEUE into the Vite publishing pipeline with zero hand-edits:

  - src/content/guides/<slug>.js   (structured blocks, hand-guide JS style)
  - shared/guidesCatalog.js        (SEO meta + sitemap source)
  - src/content/guides/index.js    (body registry)
  - public/sitemap.xml             via `npm run sitemap`

Usage:
  python scripts/content_flywheel.py
  python scripts/content_flywheel.py --list
  python scripts/content_flywheel.py --slug how-to-fix-excel-serial-dates-in-csv-exports
  python scripts/content_flywheel.py --dry-run

GitHub Actions: .github/workflows/content-flywheel.yml
  (weekly Monday cron + workflow_dispatch)
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "shared" / "guidesCatalog.js"
INDEX_PATH = ROOT / "src" / "content" / "guides" / "index.js"
GUIDES_DIR = ROOT / "src" / "content" / "guides"
SITE = "csvhospital.com"
SITE_URL = f"https://{SITE}"

SLUG_RE = re.compile(r"^how-to-[a-z0-9]+(?:-[a-z0-9]+)*$")

# ---------------------------------------------------------------------------
# High-intent long-tail queue (publish in order; skip if slug already live)
# Intent: people actively searching to fix a concrete spreadsheet/CSV bug.
# ---------------------------------------------------------------------------

TOPIC_QUEUE: list[dict] = [
    {
        "slug": "how-to-handle-invisible-trailing-spaces-in-csv-cells",
        "title": "How to Handle Invisible Trailing Spaces in CSV Cells",
        "description": (
            "Fix invisible trailing spaces that break VLOOKUP, filters, and SQL joins "
            "in CSV files — trim padded cells in your browser with CSV Hospital."
        ),
        "readingMinutes": 6,
        "tags": ["csv", "trailing-spaces", "trim", "vlookup", "data-cleaning"],
        "primary_keyword": "invisible trailing spaces in CSV",
        "search_intents": [
            "trailing spaces breaking VLOOKUP CSV",
            "trim whitespace CSV cells Excel export",
            "leading trailing spaces join mismatch",
        ],
        "symptom": (
            "Values look identical on screen, but filters, VLOOKUP, and warehouse joins "
            "miss rows because cells hide a trailing space."
        ),
        "focus": "invisible trailing spaces",
        "hook": (
            "Your VLOOKUP fails. Your SQL join returns empty. The values look identical "
            "on screen — until you notice \"active\" is actually \"active \" with a trailing "
            "space nobody can see. Invisible padding is one of the most common CSV "
            f"landmines. This guide shows why it happens and how CSV Hospital ({SITE}) "
            "strips it during triage."
        ),
        "code": (
            "# Looks equal — is not\n"
            "status\n"
            "active\n"
            "active \n"
            "#      ^ trailing space → filter misses the row\n"
            "\n"
            "# Python trap\n"
            'row["email"] == "ada@example.com"  # False if cell is "ada@example.com "'
        ),
        "suspects": [
            "Copy-paste from spreadsheets that pad cells for display.",
            "Exports that quote fields and preserve accidental spaces inside quotes.",
            "Fixed-width legacy dumps converted to CSV without a trim pass.",
            "Human editing in Notepad that leaves a space before the delimiter.",
        ],
        "hospital_moves": [
            "Whitespace physiotherapy — leading and trailing spaces are trimmed from cells.",
            "Header alignment — padded column names like \" Email \" become usable keys.",
            "Empty-row excision — blank stretcher-rows that hide among padded empties are removed.",
            "Bedside privacy — repair runs in your browser; the file never checks into a server ward.",
        ],
        "bottom": (
            "Invisible spaces are not a mystery — they are padding that survived export. "
            "CSV Hospital trims them so joins, filters, and humans finally agree on what "
            "a cell says."
        ),
        "cta": (
            "Filters missing “identical” values? Admit the CSV at "
            f"{SITE_URL}/ and let whitespace physiotherapy clear the bandages."
        ),
    },
    {
        "slug": "how-to-fix-excel-serial-dates-and-mixed-datetime-formats-in-csv",
        "title": "How to Fix Excel Serial Dates and Mixed Date-Time Formats in CSV",
        "description": (
            "Fix Excel serial dates (45321), MDY/DMY swaps, and mixed timestamps in one "
            "CSV column — stabilize the export in-browser before you normalize datetimes."
        ),
        "readingMinutes": 7,
        "tags": ["csv", "excel-serial-date", "datetime", "mdy-dmy", "spreadsheet"],
        "primary_keyword": "fix Excel serial dates in CSV",
        "search_intents": [
            "Excel serial number date in CSV export",
            "mixed date formats same CSV column",
            "MDY vs DMY CSV import wrong month",
            "45321 date Excel CSV",
        ],
        "symptom": (
            "One date column mixes 03/04/2026, ISO timestamps, and bare Excel serial "
            "numbers — importers guess wrong and dashboards sort like strings."
        ),
        "focus": "Excel serial dates and mixed datetime formats",
        "hook": (
            "One column shows 03/04/2026. The next row shows 2026-03-04. Another shows "
            "45321 — Excel’s serial date in disguise. Importers guess wrong, dashboards "
            "sort like strings, and “March 4” becomes “April 3” depending on locale. "
            "This guide covers fixing Excel serial dates and mixed date-time formats in "
            f"CSV exports, and how CSV Hospital ({SITE}) gets the file structurally "
            "healthy before you normalize dates in your pipeline."
        ),
        "code": (
            "# Mixed date chaos in one column\n"
            "event_at\n"
            "03/04/2026\n"
            "2026-03-04T15:00:00Z\n"
            "45321\n"
            "# ↑ MDY vs ISO vs Excel serial — parsers pick one and lie about the rest"
        ),
        "suspects": [
            "Locale-dependent Excel exports (MDY vs DMY) from regional installs.",
            "Date columns saved as General/Number → bare Excel serial integers.",
            "ISO timestamps mixed with bare calendar dates in the same field.",
            "Timezone suffixes present on some rows and missing on others.",
        ],
        "hospital_moves": [
            "Empty-row excision and whitespace trim so date parsers see clean cells.",
            "Header alignment so event_at / Event At / \" event_at \" collapse to one key.",
            "Rectangular structure — ragged rows no longer shove dates into the wrong column.",
            "Local-in-browser triage — you review the stabilized file before discharge.",
        ],
        "bottom": (
            "Date formats are a domain problem; crooked CSV structure makes them worse. "
            "Stabilize the patient at CSV Hospital first, then apply one honest datetime "
            "parser to a clean column."
        ),
        "cta": (
            "Dates sorting like alphabet soup? Admit the export at "
            f"{SITE_URL}/, discharge a clean baseline, then normalize timestamps once."
        ),
    },
    {
        "slug": "how-to-flatten-merged-and-multi-row-headers-in-excel-csv-exports",
        "title": "How to Flatten Merged and Multi-Row Headers in Excel CSV Exports",
        "description": (
            "Convert nested Excel title rows and merged category headers into one clean "
            "CSV header row — stop importers treating banner text as column names."
        ),
        "readingMinutes": 7,
        "tags": ["csv", "merged-cells", "multi-row-headers", "excel-export", "schema"],
        "primary_keyword": "flatten multi-row headers Excel CSV",
        "search_intents": [
            "Excel merged cells broken CSV headers",
            "multi row header CSV import",
            "title row above column names CSV",
            "nested spreadsheet headers flatten",
        ],
        "symptom": (
            "Row 1 is a merged category banner, row 2 holds real field names, and your "
            "importer treats the banner as headers — every column name is wrong."
        ),
        "focus": "merged and multi-row Excel headers",
        "hook": (
            "Marketing exports a “pretty” spreadsheet: row 1 is a merged category, row 2 "
            "is the real field names, row 3 finally starts the data. Your CSV importer "
            "treats the category row as headers and everything downstream is nonsense. "
            "This guide explains how to flatten merged and multi-row headers in Excel CSV "
            f"exports, and how CSV Hospital ({SITE}) standardizes column names so the "
            "chart board stops arguing."
        ),
        "code": (
            "# Nested header disaster\n"
            "Account,,,,Metrics,,,\n"
            "id,name,tier,mrr,churn,nps\n"
            "1,Ada,pro,99,0.02,72\n"
            "# Parser thinks headers are Account,,,,Metrics,,, — data starts \"wrong\""
        ),
        "suspects": [
            "Excel merges and multi-row title blocks saved as CSV.",
            "BI tools that emit section labels above the real schema row.",
            "Manual report templates with blank spacer rows before data.",
            "Inconsistent casing and padding across “the same” header names.",
        ],
        "hospital_moves": [
            "Header alignment — crooked, padded, or inconsistent names get standardized.",
            "Empty-row excision — spacer rows between title blocks and data are removed.",
            "Whitespace physiotherapy — invisible padding in header cells is trimmed.",
            "Admit → review → discharge — you confirm the schema before download.",
        ],
        "bottom": (
            "Nested headers are a presentation habit that CSVs cannot express. Flatten "
            "to one honest header row, then let CSV Hospital keep that schema clean "
            "across every admission."
        ),
        "cta": (
            "Still fighting merged title rows? Clean the admission at "
            f"{SITE_URL}/ and discharge a file with headers your importer expects."
        ),
    },
    {
        "slug": "how-to-stop-excel-from-dropping-leading-zeros-in-zip-codes-and-ids",
        "title": "How to Stop Excel from Dropping Leading Zeros in ZIP Codes and IDs",
        "description": (
            "Fix truncated ZIP codes and employee IDs when Excel strips leading zeros "
            "on CSV open/save — keep identifiers intact with a privacy-first repair flow."
        ),
        "readingMinutes": 6,
        "tags": ["csv", "leading-zeros", "zip-code", "excel", "scientific-notation"],
        "primary_keyword": "Excel dropping leading zeros ZIP CSV",
        "search_intents": [
            "Excel removes leading zeros ZIP code CSV",
            "employee ID leading zeros stripped Excel",
            "CSV scientific notation long account number",
            "keep ZIP code as text Excel export",
        ],
        "symptom": (
            "ZIP 02108 becomes 2108 and ID 000442 becomes 442 the moment Excel treats "
            "the column as a number — mail merges and warehouse joins fail."
        ),
        "focus": "Excel dropping leading zeros on ZIPs and IDs",
        "hook": (
            "ZIP 02108 becomes 2108. Employee ID 000442 becomes 442. Phone numbers lose "
            "their leading zero the moment Excel “helps.” Truncated numbers destroy "
            "joins and mail merges. This guide covers how to stop Excel from dropping "
            "leading zeros in ZIP codes and IDs, and how CSV Hospital "
            f"({SITE}) fits into a workflow that keeps identifiers intact."
        ),
        "code": (
            "# Leading zeros — gone\n"
            "zip,employee_id\n"
            "02108,000442\n"
            "# After Excel save-as CSV (General format):\n"
            "2108,442\n"
            "# Joins to a zero-padded warehouse key now fail"
        ),
        "suspects": [
            "Excel inferring numeric type and stripping leading zeros on open/save.",
            "Downstream tools casting ID columns to integers.",
            "Locale decimal/thousands separators mangling long numeric strings.",
            "Scientific notation on long account numbers (1.23E+15).",
        ],
        "hospital_moves": [
            "Stabilize structure so ID columns are not shifted into numeric neighbor fields.",
            "Trim whitespace that can hide inside quoted ZIP cells.",
            "Standardize headers so zip / ZIP / Zip Code map cleanly for your next step.",
            "Browser-local repair — sensitive address files need not upload to a server.",
        ],
        "bottom": (
            "ZIP codes and IDs are strings that only look like numbers. Keep them quoted "
            "and zero-padded in the source of truth; use CSV Hospital to clean the "
            "file’s structure before another spreadsheet pass truncates them again."
        ),
        "cta": (
            "ZIPs missing their leading zero? Admit a backup copy at "
            f"{SITE_URL}/, heal the structure, and treat ID columns as text going forward."
        ),
    },
    {
        "slug": "how-to-fix-csv-rows-broken-by-unquoted-line-breaks-in-notes",
        "title": "How to Fix CSV Rows Broken by Unquoted Line Breaks in Notes",
        "description": (
            "Repair CSV files where Alt+Enter notes split one logical row into many — "
            "restabilize unquoted multi-line text fields before your next import."
        ),
        "readingMinutes": 7,
        "tags": ["csv", "multiline", "unquoted-fields", "alt-enter", "ragged-rows"],
        "primary_keyword": "unquoted line breaks breaking CSV rows",
        "search_intents": [
            "CSV broken by newline inside cell",
            "Alt Enter Excel export splits CSV row",
            "unquoted multiline field CSV shift columns",
            "notes column line break CSV parse error",
        ],
        "symptom": (
            "A Notes field with an Enter keypress splits one record across two physical "
            "lines — every column after Notes slides into the wrong seat."
        ),
        "focus": "unquoted line breaks in notes fields",
        "hook": (
            "A support export includes a Notes column. Someone pressed Enter inside a "
            "cell. Without proper quoting, that single logical row becomes two physical "
            "lines — and every column after Notes slides into the wrong seat. This guide "
            "covers fixing CSV rows broken by unquoted line breaks in notes, and how "
            f"CSV Hospital ({SITE}) helps you get back to a rectangular, discharge-ready "
            "file."
        ),
        "code": (
            "# Broken by an embedded newline (quotes missing)\n"
            "id,note,status\n"
            "1,Called twice\n"
            "still waiting,open\n"
            "# Parser sees row1: id=1 note=Called twice\n"
            "#          row2: id=still waiting note=open  ← shifted wreckage"
        ),
        "suspects": [
            "Spreadsheet cells with Alt+Enter line breaks exported without RFC quoting.",
            "CRM note fields that allow newlines but emitters that forget to quote.",
            "Manual CSV edits that delete opening/closing quotes around paragraphs.",
            "Mixed line endings (CRLF/LF) confusing brittle split-based “parsers.”",
        ],
        "hospital_moves": [
            "Empty-row excision — stray blank lines from broken multiline fields get cleared.",
            "Whitespace trim — padding around note fragments is cleaned.",
            "Header alignment — after structural chaos, column names are standardized again.",
            "Local triage — review stabilized row counts before you discharge.",
        ],
        "bottom": (
            "Multi-line text is legal in CSV only when properly quoted. When quotes are "
            "missing, the file ceases to be rectangular. CSV Hospital is the ER for that "
            "admission — stabilize, review, discharge, then keep notes quoted upstream."
        ),
        "cta": (
            "Notes field detonating your row layout? Admit the patient at "
            f"{SITE_URL}/ and restabilize before the next import."
        ),
    },
    {
        "slug": "how-to-fix-comma-vs-semicolon-delimiter-mismatch-in-csv-files",
        "title": "How to Fix Comma vs Semicolon Delimiter Mismatch in CSV Files",
        "description": (
            "Fix European semicolon CSV exports that break US comma importers — detect "
            "mixed delimiters and restabilize spreadsheet exports in your browser."
        ),
        "readingMinutes": 6,
        "tags": ["csv", "delimiter", "semicolon", "locale", "excel-europe"],
        "primary_keyword": "CSV semicolon vs comma delimiter",
        "search_intents": [
            "Excel Europe semicolon CSV US import",
            "mixed comma semicolon delimiter CSV",
            "CSV opens as one column Excel",
            "change CSV delimiter semicolon to comma",
        ],
        "symptom": (
            "A European Excel export uses `;` while your pipeline expects `,` — the file "
            "opens as a single column or shifts every field after the first separator."
        ),
        "focus": "comma vs semicolon delimiter mismatch",
        "hook": (
            "Your colleague in Berlin saves a “CSV.” Your US importer sees one fat column "
            "or a jagged mess. European Excel often emits semicolons; US tools expect "
            "commas. Mix both in one file and every downstream parser lies. This guide "
            "covers comma vs semicolon delimiter mismatch and how CSV Hospital "
            f"({SITE}) helps you restabilize the admission before the next load."
        ),
        "code": (
            "# Locale trap — same “CSV”, different separators\n"
            "id;name;amount\n"
            "1;Ada;19,99\n"
            "# US tool splits on commas → amount field explodes\n"
            "# EU tool expects `;` → US comma file looks like one column"
        ),
        "suspects": [
            "Excel list-separator locale (`;` in many EU regions, `,` in US).",
            "Pipelines that hard-code comma while vendors emit semicolon.",
            "Decimal commas (19,99) colliding with comma delimiters.",
            "Manual merges of EU and US exports into one franken-file.",
        ],
        "hospital_moves": [
            "Structural triage so ragged, mis-split rows become reviewable again.",
            "Header alignment after a delimiter disaster scrambles column names.",
            "Whitespace and empty-row cleanup so the healed file is discharge-ready.",
            "Browser-local repair — no need to ship the raw export to a remote script host.",
        ],
        "bottom": (
            "Delimiter is a contract, not a suggestion. Align the separator upstream when "
            "you can; when the file is already crooked, CSV Hospital is the ER that gets "
            "you back to a rectangular patient."
        ),
        "cta": (
            "CSV stuck as one column? Admit it at "
            f"{SITE_URL}/, stabilize the structure, then standardize on one delimiter."
        ),
    },
    {
        "slug": "how-to-remove-blank-rows-and-phantom-empty-columns-from-csv-exports",
        "title": "How to Remove Blank Rows and Phantom Empty Columns from CSV Exports",
        "description": (
            "Clean blank stretcher-rows and empty trailing columns from spreadsheet CSV "
            "exports that break row counts, pivots, and database COPY loads."
        ),
        "readingMinutes": 6,
        "tags": ["csv", "blank-rows", "empty-columns", "excel-export", "data-cleaning"],
        "primary_keyword": "remove blank rows from CSV Excel",
        "search_intents": [
            "delete empty rows CSV Excel export",
            "trailing empty columns CSV",
            "blank lines breaking CSV import",
            "CSV row count higher than expected empty rows",
        ],
        "symptom": (
            "Row counts disagree with the spreadsheet grid because blank rows and "
            "phantom trailing columns survived Save As CSV."
        ),
        "focus": "blank rows and phantom empty columns",
        "hook": (
            "The sheet shows 500 real records. The CSV claims 512 — plus a trail of empty "
            "commas on the right. Blank stretcher-rows and phantom columns break pivots, "
            "inflate metrics, and make database COPY reject or pad nulls forever. This "
            "guide shows how to remove blank rows and empty columns from CSV exports, and "
            f"how CSV Hospital ({SITE}) excises them during triage."
        ),
        "code": (
            "id,name,email,,,,\n"
            "1,Ada,ada@example.com,,,,\n"
            "2,Tom,tom@example.com,,,,\n"
            ",,,,,,\n"
            ",,,,,,\n"
            "# ↑ phantom columns + blank rows Excel left behind"
        ),
        "suspects": [
            "Excel used ranges larger than the data when exporting.",
            "Deleted-looking rows that still contain spaces or formulas.",
            "Copy-paste that extended formatting far past the last record.",
            "Tools that pad every row to a fixed wide column count.",
        ],
        "hospital_moves": [
            "Empty-row excision — stretcher-rows with no signal are removed.",
            "Whitespace physiotherapy — space-only “blank” cells collapse cleanly.",
            "Header alignment — noisy trailing header commas stop polluting the schema.",
            "Admit → review row counts → discharge a tighter file.",
        ],
        "bottom": (
            "Blank rows are not harmless padding in a text file — they are fake records. "
            "CSV Hospital cuts them so your next import matches the spreadsheet you meant "
            "to share."
        ),
        "cta": (
            "Row counts lying to you? Admit the export at "
            f"{SITE_URL}/ and discharge a file without the ghost rows."
        ),
    },
    {
        "slug": "how-to-fix-csv-files-that-open-as-one-column-in-excel",
        "title": "How to Fix CSV Files That Open as One Column in Excel",
        "description": (
            "Repair CSV files that Excel shows as a single column — wrong delimiter, "
            "quoting errors, or encoding issues — then discharge a clean import-ready file."
        ),
        "readingMinutes": 6,
        "tags": ["csv", "excel", "one-column", "text-to-columns", "delimiter"],
        "primary_keyword": "CSV opens as one column in Excel",
        "search_intents": [
            "CSV file opens in one column Excel",
            "Excel Text to Columns CSV not splitting",
            "CSV all data in column A",
            "fix CSV delimiter Excel one column",
        ],
        "symptom": (
            "Double-clicking the CSV dumps every field into column A — Excel never split "
            "on the real delimiter."
        ),
        "focus": "CSV files that open as one column in Excel",
        "hook": (
            "You email a CSV. Finance opens it. Everything sits in column A like a brick. "
            "Text to Columns becomes the daily ritual. Usually the delimiter, quoting, or "
            "locale separator does not match what Excel expects. This guide covers fixing "
            "CSV files that open as one column in Excel, and how CSV Hospital "
            f"({SITE}) stabilizes the patient before the next share."
        ),
        "code": (
            "# What Excel shows as one cell per row\n"
            "\"id,name,status\"\n"
            "\"1,Ada,ok\"\n"
            "# Whole row wrapped in one pair of quotes → no split\n"
            "\n"
            "# Or delimiter Excel does not expect\n"
            "id|name|status\n"
            "1|Ada|ok"
        ),
        "suspects": [
            "Entire rows double-quoted so Excel treats the line as one field.",
            "Pipe/tab/semicolon separators while Excel assumes comma (or the reverse).",
            "UTF-16 / odd encodings that confuse Excel’s splitter.",
            "Regional list-separator settings fighting the file’s real delimiter.",
        ],
        "hospital_moves": [
            "Structural cleanup so fields land in the seats the header promised.",
            "Header alignment when the first row was swallowed as a single blob.",
            "Whitespace and empty-row triage before you re-open in Excel.",
            "Local-in-browser discharge — share a healed file, not another Text-to-Columns ticket.",
        ],
        "bottom": (
            "“One column” is almost always a delimiter or quoting contract failure. Fix "
            "the file once with CSV Hospital instead of teaching every teammate the same "
            "Excel wizard."
        ),
        "cta": (
            "Stuck in column A again? Admit the CSV at "
            f"{SITE_URL}/ and discharge something Excel can split on sight."
        ),
    },
]


REQUIRED_TOPIC_KEYS = (
    "slug",
    "title",
    "description",
    "readingMinutes",
    "tags",
    "primary_keyword",
    "search_intents",
    "symptom",
    "focus",
    "hook",
    "code",
    "suspects",
    "hospital_moves",
    "bottom",
    "cta",
)


def today_iso() -> str:
    return date.today().isoformat()


def js_escape(value: str) -> str:
    """Escape a string for a single-quoted JS literal (hand-guide style)."""
    return (
        value.replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
        .replace("\r", "\\n")
    )


def js_string(value: str) -> str:
    return f"'{js_escape(value)}'"


def emit_js(value, indent: int = 0) -> str:
    """
    Emit JS literals matching hand-authored guides:
    single-quoted strings, 2-space indent, trailing commas.
    """
    pad = "  " * indent
    inner = "  " * (indent + 1)

    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int) and not isinstance(value, bool):
        return str(value)
    if isinstance(value, float):
        return repr(value)
    if isinstance(value, str):
        return js_string(value)
    if isinstance(value, list):
        if not value:
            return "[]"
        lines = [emit_js(item, indent + 1) for item in value]
        body = ",\n".join(f"{inner}{line}" for line in lines)
        return f"[\n{body},\n{pad}]"
    if isinstance(value, dict):
        if not value:
            return "{}"
        parts = []
        for key, item in value.items():
            parts.append(f"{inner}{key}: {emit_js(item, indent + 1)}")
        body = ",\n".join(parts)
        return f"{{\n{body},\n{pad}}}"
    raise TypeError(f"Unsupported JS emit type: {type(value)!r}")


def existing_slugs(catalog_text: str) -> set[str]:
    return set(re.findall(r"slug:\s*['\"]([^'\"]+)['\"]", catalog_text))


def validate_topic(topic: dict) -> None:
    missing = [k for k in REQUIRED_TOPIC_KEYS if k not in topic]
    if missing:
        raise SystemExit(f"[flywheel] topic missing keys {missing}: {topic.get('slug')}")

    slug = topic["slug"]
    if not SLUG_RE.match(slug):
        raise SystemExit(f"[flywheel] invalid slug (use how-to-… kebab): {slug}")

    if len(topic["title"]) > 90:
        raise SystemExit(f"[flywheel] title too long (>90): {slug}")
    if not (50 <= len(topic["description"]) <= 170):
        raise SystemExit(
            f"[flywheel] description should be 50–170 chars for SEO meta ({slug}: "
            f"{len(topic['description'])})"
        )
    if not topic["tags"] or len(topic["tags"]) > 6:
        raise SystemExit(f"[flywheel] need 1–6 tags: {slug}")
    if len(topic["search_intents"]) < 3:
        raise SystemExit(f"[flywheel] need ≥3 search_intents: {slug}")
    for key in ("suspects", "hospital_moves"):
        if len(topic[key]) < 3:
            raise SystemExit(f"[flywheel] need ≥3 {key}: {slug}")
    if "\t" in topic["code"]:
        raise SystemExit(f"[flywheel] code sample contains tabs (use spaces): {slug}")


def validate_blocks(blocks: list[dict]) -> None:
    allowed = {"p", "h2", "h3", "ul", "ol", "pre", "callout"}
    if not blocks or blocks[0].get("type") != "p":
        raise SystemExit("[flywheel] blocks must start with an intro paragraph")
    for i, block in enumerate(blocks):
        btype = block.get("type")
        if btype not in allowed:
            raise SystemExit(f"[flywheel] unknown block type at {i}: {btype}")
        if btype in {"p", "h2", "h3"} and not str(block.get("text", "")).strip():
            raise SystemExit(f"[flywheel] empty text on {btype} block {i}")
        if btype in {"ul", "ol"}:
            items = block.get("items") or []
            if len(items) < 2:
                raise SystemExit(f"[flywheel] list block {i} needs ≥2 items")
        if btype == "pre" and not str(block.get("code", "")).strip():
            raise SystemExit(f"[flywheel] empty pre block {i}")
        if btype == "callout":
            if block.get("tone") not in {"signal", "warn"}:
                raise SystemExit(f"[flywheel] callout {i} needs tone signal|warn")
            if not str(block.get("text", "")).strip():
                raise SystemExit(f"[flywheel] empty callout {i}")


def pick_topic(slug: str | None) -> dict | None:
    catalog_text = CATALOG_PATH.read_text(encoding="utf-8")
    published = existing_slugs(catalog_text)

    if slug:
        for topic in TOPIC_QUEUE:
            if topic["slug"] == slug:
                if slug in published:
                    raise SystemExit(f"[flywheel] slug already published: {slug}")
                validate_topic(topic)
                return topic
        raise SystemExit(f"[flywheel] unknown slug: {slug}")

    for topic in TOPIC_QUEUE:
        if topic["slug"] not in published:
            validate_topic(topic)
            return topic

    return None


def build_blocks(topic: dict) -> list[dict]:
    focus = topic["focus"]
    keyword = topic["primary_keyword"]
    return [
        {"type": "p", "text": topic["hook"]},
        {"type": "h2", "text": f"High-intent problem: {keyword}"},
        {
            "type": "p",
            "text": (
                f"Search traffic for this issue is rarely casual browsing — people hit "
                f"“{keyword}” when a concrete workflow is already broken. Typical symptom: "
                f"{topic['symptom']}"
            ),
        },
        {
            "type": "h3",
            "text": "Queries this guide answers",
        },
        {"type": "ul", "items": list(topic["search_intents"])},
        {"type": "h2", "text": f"What goes wrong with {focus}"},
        {
            "type": "p",
            "text": (
                f"CSV looks flat until you hit {focus}. Spreadsheets forgive the mess; "
                "parsers and warehouses do not. The symptom is usually blamed on “bad data” "
                "when the real issue is text-file logistics — quoting, padding, delimiters, "
                "or row boundaries that no longer match the header contract."
            ),
        },
        {"type": "pre", "code": topic["code"]},
        {"type": "h2", "text": "The usual spreadsheet and export suspects"},
        {"type": "ul", "items": list(topic["suspects"])},
        {"type": "h2", "text": "Why one-off cleanup scripts do not scale"},
        {
            "type": "p",
            "text": (
                "Engineers write a quick trim/parse/rewrite script, merge the ticket, and "
                "move on — until the next export invents a new variant. Manual script editing "
                "does not help analysts or support staff who need a clean download now. "
                "Evergreen triage belongs in a repeatable admit-and-discharge flow."
            ),
        },
        {"type": "h2", "text": f"How CSV Hospital helps with {focus}"},
        {
            "type": "p",
            "text": (
                f"CSV Hospital is the digital ER for messy spreadsheets. You admit a .csv on "
                f"{SITE_URL}/; triage runs entirely in your browser. For admissions haunted "
                f"by {focus}, the ward applies the same surgical moves teams usually script "
                "by hand:"
            ),
        },
        {"type": "ul", "items": list(topic["hospital_moves"])},
        {
            "type": "callout",
            "tone": "signal",
            "text": (
                "No Python environment, no regex workshop, no waiting on engineering. "
                "Admit → review triage stats → discharge a healed {name}-fixed.csv when "
                "you are ready. One-time file credits unlock download; repair stays local."
            ),
        },
        {"type": "h2", "text": "Practical fix workflow"},
        {
            "type": "ol",
            "items": [
                "Keep a backup of the original CSV.",
                f"Admit the file at {SITE_URL}/ (CSV only; size and shape limits apply).",
                "Read the triage board: original vs stabilized rows.",
                f"Spot-check fields that used to fail because of {focus}.",
                "Discharge the healed file with a one-time credit if download is locked.",
            ],
        },
        {"type": "h2", "text": "Bottom line"},
        {"type": "p", "text": topic["bottom"]},
        {"type": "callout", "tone": "warn", "text": topic["cta"]},
    ]


def render_guide_module(topic: dict, blocks: list[dict]) -> str:
    blocks_js = emit_js(blocks, indent=1)
    return (
        f"/**\n"
        f" * Guide — {topic['primary_keyword']} (generated by scripts/content_flywheel.py).\n"
        f" * Long-tail intent: data wrangling / spreadsheet formatting bug.\n"
        f" */\n"
        f"\n"
        f"/** @typedef {{{{ type: 'p'|'h2'|'h3'|'ul'|'ol'|'pre'|'callout', text?: string, "
        f"items?: string[], code?: string, tone?: 'signal'|'warn' }}}} GuideBlock */\n"
        f"\n"
        f"/** @type {{{{ slug: string, blocks: GuideBlock[] }}}} */\n"
        f"export const guide = {{\n"
        f"  slug: {js_string(topic['slug'])},\n"
        f"  blocks: {blocks_js},\n"
        f"}}\n"
        f"\n"
        f"export default guide\n"
    )


def render_catalog_entry(topic: dict, published: str) -> str:
    tags = ", ".join(js_string(t) for t in topic["tags"])
    return (
        f"  {{\n"
        f"    slug: {js_string(topic['slug'])},\n"
        f"    title: {js_string(topic['title'])},\n"
        f"    description:\n"
        f"      {js_string(topic['description'])},\n"
        f"    publishedAt: {js_string(published)},\n"
        f"    updatedAt: {js_string(published)},\n"
        f"    readingMinutes: {int(topic['readingMinutes'])},\n"
        f"    tags: [{tags}],\n"
        f"  }},\n"
    )


def camel_import_name(slug: str) -> str:
    parts = slug.replace("how-to-", "").split("-")
    base = "".join(p.capitalize() for p in parts[:8]) or "Guide"
    return base[0].lower() + base[1:] if base else "guideTopic"


def update_catalog(topic: dict, published: str, dry_run: bool) -> None:
    text = CATALOG_PATH.read_text(encoding="utf-8")
    entry = render_catalog_entry(topic, published)

    marker = "\n]\n\n/**\n * @param {string} slug"
    if marker not in text:
        raise SystemExit(
            "[flywheel] could not find GUIDES array end marker in guidesCatalog.js"
        )

    if topic["slug"] in existing_slugs(text):
        raise SystemExit(f"[flywheel] catalog already has slug {topic['slug']}")

    # Ensure prior last object keeps a trailing comma before the new entry.
    updated = text.replace(marker, "\n" + entry.rstrip() + marker, 1)
    if dry_run:
        print(f"[flywheel] dry-run: would update {CATALOG_PATH.relative_to(ROOT)}")
        return
    CATALOG_PATH.write_text(updated, encoding="utf-8", newline="\n")
    print(f"[flywheel] updated {CATALOG_PATH.relative_to(ROOT)}")


def update_index(topic: dict, dry_run: bool) -> None:
    text = INDEX_PATH.read_text(encoding="utf-8")
    alias = camel_import_name(topic["slug"])
    if f"as {alias}" in text:
        alias = alias + "Guide"

    import_line = f"import {{ guide as {alias} }} from './{topic['slug']}.js'\n"
    if f"./{topic['slug']}.js" in text:
        raise SystemExit(f"[flywheel] index.js already imports {topic['slug']}")

    import_block = re.search(
        r"(import \{ guide as \w+ \} from '\./[^']+\.js'\n)+",
        text,
    )
    if not import_block:
        raise SystemExit("[flywheel] could not find guide imports in index.js")

    insert_at = import_block.end()
    text = text[:insert_at] + import_line + text[insert_at:]

    bodies_match = re.search(r"const BODIES = \{\n((?:  .+\n)*)\}", text)
    if not bodies_match:
        raise SystemExit("[flywheel] could not find BODIES map in index.js")

    existing_entries = bodies_match.group(1)
    lines = [ln for ln in existing_entries.splitlines(True)]
    if lines and not lines[-1].rstrip().endswith(","):
        lines[-1] = lines[-1].rstrip("\n") + ",\n"
    new_entries = "".join(lines) + f"  [{alias}.slug]: {alias},\n"
    text = text[: bodies_match.start(1)] + new_entries + text[bodies_match.end(1) :]

    if dry_run:
        print(f"[flywheel] dry-run: would update {INDEX_PATH.relative_to(ROOT)}")
        return
    INDEX_PATH.write_text(text, encoding="utf-8", newline="\n")
    print(f"[flywheel] updated {INDEX_PATH.relative_to(ROOT)}")


def write_guide_file(topic: dict, blocks: list[dict], dry_run: bool) -> Path:
    out = GUIDES_DIR / f"{topic['slug']}.js"
    if out.exists():
        raise SystemExit(f"[flywheel] guide file already exists: {out}")
    content = render_guide_module(topic, blocks)
    # Publishing pipeline expects LF and a trailing newline.
    if not content.endswith("\n"):
        content += "\n"
    if dry_run:
        print(f"[flywheel] dry-run: would write {out.relative_to(ROOT)} ({len(content)} bytes)")
        return out
    out.write_text(content, encoding="utf-8", newline="\n")
    print(f"[flywheel] wrote {out.relative_to(ROOT)}")
    return out


def regenerate_sitemap(dry_run: bool) -> None:
    if dry_run:
        print("[flywheel] dry-run: would run npm run sitemap")
        return
    cmd = ["npm", "run", "sitemap"]
    print(f"[flywheel] running {' '.join(cmd)}")
    subprocess.run(cmd, cwd=ROOT, check=True, shell=(sys.platform == "win32"))


def write_github_output(slug: str | None, skipped: bool) -> None:
    out_path = os_environ_get_github_output()
    if out_path is None:
        return
    with out_path.open("a", encoding="utf-8") as fh:
        fh.write(f"skipped={'true' if skipped else 'false'}\n")
        fh.write(f"slug={slug or ''}\n")


def os_environ_get_github_output() -> Path | None:
    import os

    raw = os.environ.get("GITHUB_OUTPUT")
    return Path(raw) if raw else None


def list_queue() -> None:
    catalog = CATALOG_PATH.read_text(encoding="utf-8")
    published = existing_slugs(catalog)
    print("[flywheel] TOPIC_QUEUE status (high-intent long-tail):")
    for i, topic in enumerate(TOPIC_QUEUE, 1):
        validate_topic(topic)
        if topic["slug"] in published:
            status = "published"
        elif all(t["slug"] in published for t in TOPIC_QUEUE[: i - 1]):
            status = "next"
        else:
            status = "queued"
        print(f"  {i}. [{status}] {topic['slug']}")
        print(f"      keyword: {topic['primary_keyword']}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="CSV Hospital high-intent guides content flywheel"
    )
    parser.add_argument("--list", action="store_true", help="Show topic queue status")
    parser.add_argument("--slug", help="Publish a specific queued slug")
    parser.add_argument(
        "--dry-run", action="store_true", help="Validate and print actions without writing"
    )
    args = parser.parse_args(argv)

    if args.list:
        list_queue()
        return 0

    topic = pick_topic(args.slug)
    if topic is None:
        print(
            "[flywheel] skip: TOPIC_QUEUE exhausted — nothing new to publish.",
            file=sys.stderr,
        )
        write_github_output(None, skipped=True)
        return 0

    published = today_iso()
    blocks = build_blocks(topic)
    validate_blocks(blocks)

    print(f"[flywheel] publishing: {topic['slug']}")
    print(f"[flywheel] primary_keyword: {topic['primary_keyword']}")
    write_guide_file(topic, blocks, args.dry_run)
    update_catalog(topic, published, args.dry_run)
    update_index(topic, args.dry_run)
    regenerate_sitemap(args.dry_run)
    write_github_output(topic["slug"], skipped=False)

    if not args.dry_run:
        print(f"[flywheel] live URL path: /guides/{topic['slug']}")
        print("[flywheel] done — pipeline files are PR-ready (no manual formatting)")
    else:
        print("[flywheel] dry-run ok - generation validates for the publishing pipeline")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as err:
        print(f"[flywheel] sitemap command failed: {err}", file=sys.stderr)
        raise SystemExit(err.returncode)
