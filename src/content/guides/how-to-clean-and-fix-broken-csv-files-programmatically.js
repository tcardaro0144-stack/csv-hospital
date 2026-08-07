/**
 * First CSV Hospital guide — article body as structured sections
 * (fast, dependency-free, SEO-friendly).
 */

/** @typedef {{ type: 'p'|'h2'|'h3'|'ul'|'ol'|'pre'|'callout', text?: string, items?: string[], code?: string, tone?: 'signal'|'warn' }} GuideBlock */

/** @type {{ slug: string, blocks: GuideBlock[] }} */
export const guide = {
  slug: 'how-to-clean-and-fix-broken-csv-files-programmatically',
  blocks: [
    {
      type: 'p',
      text: 'CSV looks simple until it is not. One crooked quote, a UTF-8 BOM, or a column that quietly shifted right by one cell and your importer fails, your dashboard blanks out, or worse — the file “loads” with the wrong values in the wrong fields. This guide covers the failure modes that show up again and again, how teams usually try to fix them with scripts, and how CSV Hospital (csvhospital.com) heals the same messes instantly in the browser.',
    },
    {
      type: 'h2',
      text: 'Why “just open it in Excel” is not a repair strategy',
    },
    {
      type: 'p',
      text: 'Spreadsheets forgive a lot of sins. Parsers do not. A file that looks fine in Excel can still break Python’s csv module, pandas, database COPY, or a SaaS import because each tool applies different rules for quotes, escapes, line endings, and encodings. Programmatic cleaning means making the file unambiguous: consistent delimiters, aligned columns, and an encoding every consumer can read.',
    },
    {
      type: 'h2',
      text: 'Common CSV formatting errors',
    },
    {
      type: 'h3',
      text: '1. Broken or mixed delimiters',
    },
    {
      type: 'p',
      text: 'Comma, semicolon, tab, and pipe all appear in the wild — sometimes in the same export. European locales often emit `;` while US tools expect `,`. A single row that used the wrong separator shifts every subsequent field. “Broken delimiters” also include unescaped commas inside free-text columns when quotes were stripped upstream.',
    },
    {
      type: 'pre',
      code: `# Looks like 4 columns… until the note field contains a comma
id,name,note,status
1,Ada,"Works fine",ok
2,Tom,Needs,attention,error   ← parser sees 5 fields`,
    },
    {
      type: 'h3',
      text: '2. Mismatched columns (ragged rows)',
    },
    {
      type: 'p',
      text: 'The header promises N columns; some rows deliver N−1 or N+1. Causes include truncated exports, copy-paste into the middle of a file, and fields that contained line breaks without proper quoting. Downstream code that indexes by column number silently misattributes data — a quiet data-quality emergency.',
    },
    {
      type: 'h3',
      text: '3. Encoding issues (UTF-8, Latin-1, BOM)',
    },
    {
      type: 'p',
      text: 'Bytes are not characters. A file saved as Windows-1252 (or “ANSI”) will garble names like José or currencies like € when read as UTF-8. Conversely, a UTF-8 BOM (`EF BB BF`) at the start of the file can attach itself to the first header name (`\\ufeffid` instead of `id`), breaking joins and schema checks. Mixed encodings inside one file are rarer but devastating.',
    },
    {
      type: 'h3',
      text: '4. Empty rows, noisy whitespace, crooked headers',
    },
    {
      type: 'p',
      text: 'Blank stretcher-rows from spreadsheet exports inflate row counts and break “required field” validators. Leading/trailing spaces turn `" active"` into a different key than `"active"`. Headers with inconsistent casing or padding (`" Email "` vs `"email"`) make merges fail for no good reason.',
    },
    {
      type: 'h2',
      text: 'The usual programmatic fix (and why it slows you down)',
    },
    {
      type: 'p',
      text: 'Engineers reach for one-off scripts: sniff the delimiter, decode with chardet, drop empty rows, strip cells, rewrite with csv.DictWriter. That works — until the next file uses a different quirk and you are back in the editor tweaking regex. Manual script editing does not scale across teammates, support tickets, or non-developers who just need a clean download.',
    },
    {
      type: 'pre',
      code: `# Typical one-off — brittle across vendors
import csv
with open("messy.csv", newline="", encoding="utf-8-sig") as f:
    rows = list(csv.reader(f))
# …custom logic for empty rows, padding, header rename…
with open("fixed.csv", "w", newline="", encoding="utf-8") as f:
    csv.writer(f).writerows(rows)`,
    },
    {
      type: 'h2',
      text: 'How CSV Hospital solves this without script editing',
    },
    {
      type: 'p',
      text: 'CSV Hospital is the digital ER for messy spreadsheets. You admit a .csv on csvhospital.com; triage runs entirely in your browser. The file never checks into a server ward. The tool applies the same surgical moves teams script by hand:',
    },
    {
      type: 'ul',
      items: [
        'Empty-row excision — blank rows are removed so the dataset can sit up straight.',
        'Whitespace physiotherapy — leading and trailing spaces are trimmed from cells.',
        'Header alignment — column names are standardized so the chart board stops arguing with itself.',
        'Bedside privacy — processing stays on-device; you review stats before discharge.',
      ],
    },
    {
      type: 'callout',
      tone: 'signal',
      text: 'No Python environment, no regex workshop, no waiting on engineering. Admit → review triage stats → discharge a healed {name}-fixed.csv when you are ready. One-time file credits unlock download; the repair itself stays local.',
    },
    {
      type: 'h2',
      text: 'A practical workflow',
    },
    {
      type: 'ol',
      items: [
        'Keep a backup of the original CSV (always).',
        'Open https://csvhospital.com/ and admit the file (CSV only; size and shape limits apply).',
        'Read the triage board: original vs stabilized rows, what was excised or trimmed.',
        'If discharge is locked, purchase a one-time credit pack — credits stack.',
        'Download the discharged file and re-run your importer or pipeline.',
      ],
    },
    {
      type: 'h2',
      text: 'When you still need a custom script',
    },
    {
      type: 'p',
      text: 'Hospital triage covers the common wards: emptiness, whitespace, and header hygiene. Domain-specific transforms (mapping product SKUs, exploding JSON-in-a-cell, vendor-specific date formats) still belong in your pipeline. Use CSV Hospital to get a sane, rectangular, UTF-8-friendly baseline first — then apply business logic on clean input.',
    },
    {
      type: 'h2',
      text: 'Bottom line',
    },
    {
      type: 'p',
      text: 'Broken delimiters, mismatched columns, and encoding landmines are not character flaws — they are logistics failures in how text files move between tools. Fixing them programmatically is table stakes; doing it without hand-editing a new script for every export is how you ship. CSV Hospital turns that repair into an admit-and-discharge flow so you can get back to the work the data was supposed to enable.',
    },
    {
      type: 'callout',
      tone: 'warn',
      text: 'Ready to treat a terminal spreadsheet? Admit a patient at csvhospital.com — privacy-first, browser-local, no manual script editing required.',
    },
  ],
}

export default guide
