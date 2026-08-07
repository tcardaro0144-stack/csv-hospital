#!/usr/bin/env python3
"""
CSV Hospital — automated content flywheel for /guides.

Drops the next evergreen guide from the TOPIC_QUEUE into:
  - src/content/guides/<slug>.js
  - shared/guidesCatalog.js
  - src/content/guides/index.js
Then regenerates public/sitemap.xml via `npm run sitemap`.

Usage:
  python scripts/content_flywheel.py
  python scripts/content_flywheel.py --list
  python scripts/content_flywheel.py --slug how-to-handle-invisible-trailing-spaces-in-csv-cells
  python scripts/content_flywheel.py --dry-run

GitHub Actions: .github/workflows/content-flywheel.yml (workflow_dispatch).
"""

from __future__ import annotations

import argparse
import json
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

# ---------------------------------------------------------------------------
# Evergreen topic queue (publish in order; skip if slug already in catalog)
# ---------------------------------------------------------------------------

TOPIC_QUEUE: list[dict] = [
    {
        "slug": "how-to-handle-invisible-trailing-spaces-in-csv-cells",
        "title": "How to Handle Invisible Trailing Spaces in CSV Cells",
        "description": (
            "Why leading and trailing spaces break CSV joins and filters — and how "
            "CSV Hospital trims invisible padding from every cell in your browser."
        ),
        "readingMinutes": 6,
        "tags": ["csv", "whitespace", "trim", "data-cleaning"],
        "focus": "invisible trailing spaces",
        "hook": (
            "Your VLOOKUP fails. Your SQL join returns empty. The values look identical "
            "on screen — until you notice \"active\" is actually \"active \" with a trailing "
            "space nobody can see. Invisible padding is one of the most common CSV "
            "landmines. This guide shows why it happens and how CSV Hospital "
            f"({SITE}) strips it during triage."
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
            f"https://{SITE}/ and let whitespace physiotherapy clear the bandages."
        ),
    },
    {
        "slug": "how-to-fix-broken-date-time-formats-in-csv-exports",
        "title": "How to Fix Broken Date-Time Formats in CSV Exports",
        "description": (
            "Deal with mixed date formats, Excel serial numbers, and timezone chaos in CSV "
            "exports — and how CSV Hospital stabilizes messy spreadsheet admissions first."
        ),
        "readingMinutes": 7,
        "tags": ["csv", "dates", "datetime", "excel"],
        "focus": "broken date-time formats",
        "hook": (
            "One column shows 03/04/2026. The next row shows 2026-03-04. Another shows "
            "45321 — Excel’s serial date in disguise. Importers guess wrong, dashboards "
            "sort like strings, and “March 4” becomes “April 3” depending on locale. "
            "This guide covers broken date-time formats in CSV exports and how "
            f"CSV Hospital ({SITE}) gets the file structurally healthy before you "
            "normalize dates in your pipeline."
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
            "Locale-dependent exports (MDY vs DMY) from regional Excel installs.",
            "Excel serial numbers when a date column was saved as General/Number.",
            "ISO timestamps mixed with bare dates in the same field.",
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
            f"https://{SITE}/, discharge a clean baseline, then normalize timestamps once."
        ),
    },
    {
        "slug": "how-to-convert-and-flatten-nested-headers-in-csv-files",
        "title": "How to Convert and Flatten Nested Headers in CSV Files",
        "description": (
            "Convert multi-row or nested spreadsheet headers into a single clean header "
            "row — and how CSV Hospital standardizes crooked column names in the browser."
        ),
        "readingMinutes": 7,
        "tags": ["csv", "headers", "nested-headers", "spreadsheets"],
        "focus": "converting nested headers",
        "hook": (
            "Marketing exports a “pretty” spreadsheet: row 1 is a merged category, row 2 "
            "is the real field names, row 3 finally starts the data. Your CSV importer "
            "treats the category row as headers and everything downstream is nonsense. "
            "This guide explains nested / multi-row headers and how CSV Hospital "
            f"({SITE}) standardizes column names so the chart board stops arguing."
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
            f"https://{SITE}/ and discharge a file with headers your importer expects."
        ),
    },
    {
        "slug": "how-to-fix-truncated-numbers-and-zip-codes-in-csv-files",
        "title": "How to Fix Truncated Numbers and ZIP Codes in CSV Files",
        "description": (
            "Stop Excel from dropping leading zeros on ZIP codes and IDs — and how "
            "CSV Hospital helps you discharge clean, privacy-first spreadsheet repairs."
        ),
        "readingMinutes": 6,
        "tags": ["csv", "zip-codes", "leading-zeros", "excel"],
        "focus": "fixing truncated numbers and ZIP codes",
        "hook": (
            "ZIP 02108 becomes 2108. Employee ID 000442 becomes 442. Phone numbers lose "
            "their leading zero the moment Excel “helps.” Truncated numbers destroy "
            "joins and mail merges. This guide covers why it happens and how "
            f"CSV Hospital ({SITE}) fits into a workflow that keeps identifiers intact."
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
            f"https://{SITE}/, heal the structure, and treat ID columns as text going forward."
        ),
    },
    {
        "slug": "how-to-clean-unquoted-multi-line-text-fields-in-csv-files",
        "title": "How to Clean Unquoted Multi-Line Text Fields in CSV Files",
        "description": (
            "Clean up CSV rows broken by unquoted line breaks inside notes and comments — "
            "and how CSV Hospital helps you restabilize ragged files in the browser."
        ),
        "readingMinutes": 7,
        "tags": ["csv", "multiline", "quoting", "notes-fields"],
        "focus": "cleaning unquoted multi-line text fields",
        "hook": (
            "A support export includes a Notes column. Someone pressed Enter inside a "
            "cell. Without proper quoting, that single logical row becomes two physical "
            "lines — and every column after Notes slides into the wrong seat. This guide "
            "covers unquoted multi-line text fields and how CSV Hospital "
            f"({SITE}) helps you get back to a rectangular, discharge-ready file."
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
            f"https://{SITE}/ and restabilize before the next import."
        ),
    },
]


def today_iso() -> str:
    return date.today().isoformat()


def js_string(value: str, *, single: bool = False) -> str:
    """Emit a JS string literal. Use single=True to match catalog style."""
    if not single:
        return json.dumps(value, ensure_ascii=False)
    escaped = (
        value.replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace("\n", "\\n")
        .replace("\r", "\\r")
    )
    return f"'{escaped}'"


def existing_slugs(catalog_text: str) -> set[str]:
    return set(
        re.findall(r'slug:\s*[\'"]([^\'"]+)[\'"]', catalog_text)
    )

def pick_topic(slug: str | None) -> dict:
    catalog_text = CATALOG_PATH.read_text(encoding="utf-8")
    published = existing_slugs(catalog_text)

    if slug:
        for topic in TOPIC_QUEUE:
            if topic["slug"] == slug:
                if slug in published:
                    raise SystemExit(f"[flywheel] slug already published: {slug}")
                return topic
        raise SystemExit(f"[flywheel] unknown slug: {slug}")

    for topic in TOPIC_QUEUE:
        if topic["slug"] not in published:
            return topic

    raise SystemExit(
        "[flywheel] TOPIC_QUEUE exhausted — all 5 evergreen topics are already in the catalog."
    )


def build_blocks(topic: dict) -> list[dict]:
    focus = topic["focus"]
    return [
        {"type": "p", "text": topic["hook"]},
        {"type": "h2", "text": f"What goes wrong with {focus}"},
        {
            "type": "p",
            "text": (
                f"CSV looks flat until {focus} sneak in. Spreadsheets forgive the mess; "
                "parsers and warehouses do not. The symptom is usually blamed on “bad data” "
                "when the real issue is text-file logistics — quoting, padding, or row "
                "boundaries that no longer match the header contract."
            ),
        },
        {"type": "pre", "code": topic["code"]},
        {"type": "h2", "text": "The usual suspects"},
        {"type": "ul", "items": topic["suspects"]},
        {"type": "h2", "text": "Why one-off scripts do not scale"},
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
                f"https://{SITE}/; triage runs entirely in your browser. For admissions "
                f"haunted by {focus}, the ward applies the same surgical moves teams "
                "usually script by hand:"
            ),
        },
        {"type": "ul", "items": topic["hospital_moves"]},
        {
            "type": "callout",
            "tone": "signal",
            "text": (
                "No Python environment, no regex workshop, no waiting on engineering. "
                "Admit → review triage stats → discharge a healed {name}-fixed.csv when "
                "you are ready. One-time file credits unlock download; repair stays local."
            ),
        },
        {"type": "h2", "text": "Practical workflow"},
        {
            "type": "ol",
            "items": [
                "Keep a backup of the original CSV.",
                f"Admit the file at https://{SITE}/ (CSV only; size and shape limits apply).",
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
    blocks_js = json.dumps(blocks, indent=2, ensure_ascii=False)
    # Quadruple braces in the f-string so the emitted JSDoc keeps `{{ ... }}`.
    return f"""/**
 * Guide — {topic["focus"]} (generated by scripts/content_flywheel.py).
 */

/** @typedef {{{{ type: 'p'|'h2'|'h3'|'ul'|'ol'|'pre'|'callout', text?: string, items?: string[], code?: string, tone?: 'signal'|'warn' }}}} GuideBlock */

/** @type {{{{ slug: string, blocks: GuideBlock[] }}}} */
export const guide = {{
  slug: {js_string(topic["slug"], single=True)},
  blocks: {blocks_js},
}}

export default guide
"""


def render_catalog_entry(topic: dict, published: str) -> str:
    tags = ", ".join(js_string(t, single=True) for t in topic["tags"])
    return f"""  {{
    slug: {js_string(topic["slug"], single=True)},
    title: {js_string(topic["title"], single=True)},
    description:
      {js_string(topic["description"], single=True)},
    publishedAt: {js_string(published, single=True)},
    updatedAt: {js_string(published, single=True)},
    readingMinutes: {int(topic["readingMinutes"])},
    tags: [{tags}],
  }},
"""

def camel_import_name(slug: str) -> str:
    parts = slug.replace("how-to-", "").split("-")
    base = "".join(p.capitalize() for p in parts[:6]) or "Guide"
    return base[0].lower() + base[1:] if base else "guideTopic"


def update_catalog(topic: dict, published: str, dry_run: bool) -> None:
    text = CATALOG_PATH.read_text(encoding="utf-8")
    entry = render_catalog_entry(topic, published)

    marker = "\n]\n\n/**\n * @param {string} slug"
    if marker not in text:
        raise SystemExit("[flywheel] could not find GUIDES array end marker in guidesCatalog.js")

    if topic["slug"] in existing_slugs(text):
        raise SystemExit(f"[flywheel] catalog already has slug {topic['slug']}")

    updated = text.replace(marker, "\n" + entry.rstrip() + marker, 1)
    if dry_run:
        print(f"[flywheel] dry-run: would update {CATALOG_PATH}")
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
        print(f"[flywheel] dry-run: would update {INDEX_PATH}")
        return
    INDEX_PATH.write_text(text, encoding="utf-8", newline="\n")
    print(f"[flywheel] updated {INDEX_PATH.relative_to(ROOT)}")


def write_guide_file(topic: dict, blocks: list[dict], dry_run: bool) -> Path:
    out = GUIDES_DIR / f"{topic['slug']}.js"
    if out.exists():
        raise SystemExit(f"[flywheel] guide file already exists: {out}")
    content = render_guide_module(topic, blocks)
    if dry_run:
        print(f"[flywheel] dry-run: would write {out} ({len(content)} bytes)")
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
    # shell=True helps Windows find npm.cmd
    subprocess.run(cmd, cwd=ROOT, check=True, shell=(sys.platform == "win32"))


def list_queue() -> None:
    catalog = CATALOG_PATH.read_text(encoding="utf-8")
    published = existing_slugs(catalog)
    print("[flywheel] TOPIC_QUEUE status:")
    for i, topic in enumerate(TOPIC_QUEUE, 1):
        if topic["slug"] in published:
            status = "published"
        elif all(t["slug"] in published for t in TOPIC_QUEUE[: i - 1]):
            status = "next"
        else:
            status = "queued"
        print(f"  {i}. [{status}] {topic['slug']}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="CSV Hospital guides content flywheel")
    parser.add_argument("--list", action="store_true", help="Show topic queue status")
    parser.add_argument("--slug", help="Publish a specific queued slug")
    parser.add_argument("--dry-run", action="store_true", help="Print actions without writing")
    args = parser.parse_args(argv)

    if args.list:
        list_queue()
        return 0

    topic = pick_topic(args.slug)
    published = today_iso()
    blocks = build_blocks(topic)

    print(f"[flywheel] publishing: {topic['slug']}")
    write_guide_file(topic, blocks, args.dry_run)
    update_catalog(topic, published, args.dry_run)
    update_index(topic, args.dry_run)
    regenerate_sitemap(args.dry_run)

    if not args.dry_run:
        print(f"[flywheel] live URL path: /guides/{topic['slug']}")
        print("[flywheel] done")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as err:
        print(f"[flywheel] sitemap command failed: {err}", file=sys.stderr)
        raise SystemExit(err.returncode)
