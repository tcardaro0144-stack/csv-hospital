/**
 * Guide — mismatched columns / shifted CSV rows.
 */

/** @typedef {{ type: 'p'|'h2'|'h3'|'ul'|'ol'|'pre'|'callout', text?: string, items?: string[], code?: string, tone?: 'signal'|'warn' }} GuideBlock */

/** @type {{ slug: string, blocks: GuideBlock[] }} */
export const guide = {
  slug: 'how-to-fix-mismatched-columns-and-shifted-data-in-csv-files',
  blocks: [
    {
      type: 'p',
      text: 'You open a CSV and everything looks fine — until column C suddenly contains what used to live in column B. Names sit under phone numbers. Status values drift into notes. Somewhere upstream, a single extra comma (or a missing one) shifted the rest of the row like a conveyor belt that skipped a notch. This guide explains why mismatched columns happen, how to spot them, and how CSV Hospital (csvhospital.com) realigns structure so your data stops sliding sideways.',
    },
    {
      type: 'h2',
      text: 'What “shifted data” actually means',
    },
    {
      type: 'p',
      text: 'CSV has no hard schema. Each row is a list of fields separated by a delimiter. If one field contains an unquoted comma, or a quote is dropped, the parser invents an extra column for that row only. The header still says four columns; that row quietly delivers five. Every field after the break lands one seat to the right — mismatched columns, also called ragged rows.',
    },
    {
      type: 'pre',
      code: `# Header promises 4 columns
id,name,city,status
1,Ada,Boston,ok
2,Tom,New York,NY,error
#                 ↑ extra comma → city="New York", status="NY", leftover="error"`,
    },
    {
      type: 'h2',
      text: 'The usual suspects',
    },
    {
      type: 'ul',
      items: [
        'Extra commas inside free-text fields when quotes were stripped by an upstream export.',
        'Missing delimiters after a truncated cell (copy-paste into the middle of a file).',
        'Embedded line breaks in a field that was never properly quoted — one logical row becomes two physical lines.',
        'Mixed delimiter habits (comma vs semicolon) on a single “bad” row while the rest of the file is consistent.',
        'Trailing commas that invent empty trailing columns on some rows but not others.',
      ],
    },
    {
      type: 'h2',
      text: 'Why spreadsheets hide the crime',
    },
    {
      type: 'p',
      text: 'Excel and Sheets often display ragged rows without complaint. Your eyes see a neat grid; your importer sees unequal field counts. Pipelines that index by position (`row[2]`) silently misattribute values. Joins on “email” fail because the email slid into the wrong index. The bug feels like bad business logic when it is really a structural fracture in the text file.',
    },
    {
      type: 'h2',
      text: 'How teams usually fix it (the slow way)',
    },
    {
      type: 'p',
      text: 'The classic repair is a one-off script: count fields per row, quarantine offenders, hand-edit quotes, re-export. That works for one ticket. The next vendor export invents a new way to smuggle commas into notes, and you are back in the editor. Manual column-alignment does not scale across support queues or non-developers who just need a clean download.',
    },
    {
      type: 'pre',
      code: `# Fragile triage — breaks on the next weird export
import csv
with open("messy.csv", newline="", encoding="utf-8") as f:
    rows = list(csv.reader(f))
width = len(rows[0])
bad = [i for i, r in enumerate(rows) if len(r) != width]
# …then custom surgery for each bad row…`,
    },
    {
      type: 'h2',
      text: 'How CSV Hospital aligns column structures',
    },
    {
      type: 'p',
      text: 'CSV Hospital treats shifted rows as a triage problem, not a scripting workshop. You admit a .csv on csvhospital.com; repair runs in your browser. The ward focuses on making the file rectangular and readable again:',
    },
    {
      type: 'ul',
      items: [
        'Header alignment — crooked or padded column names get standardized so the chart board stops arguing with itself.',
        'Empty-row excision — blank stretcher-rows that inflate counts and confuse validators are removed.',
        'Whitespace physiotherapy — leading/trailing spaces that turn “active” and “ active” into different keys are trimmed.',
        'Bedside privacy — the file never checks into a server; you review triage stats before discharge.',
      ],
    },
    {
      type: 'callout',
      tone: 'signal',
      text: 'The goal is a stable column layout you can trust: same number of seats on every row, headers that mean what they say, no invisible padding. Once the structure holds, your importer — and your brain — can stop chasing ghosts in the wrong cells.',
    },
    {
      type: 'h2',
      text: 'A practical workflow when columns look drunk',
    },
    {
      type: 'ol',
      items: [
        'Keep a backup of the original CSV.',
        'Admit the file at https://csvhospital.com/ (CSV only; size and shape limits apply).',
        'Compare original vs stabilized row counts on the triage board.',
        'Spot-check a few rows that used to look “shifted” in your old viewer.',
        'Discharge a healed {name}-fixed.csv with a one-time credit when download is locked.',
      ],
    },
    {
      type: 'h2',
      text: 'When you still need custom logic',
    },
    {
      type: 'p',
      text: 'If a notes field legitimately contains structured lists that must become multiple columns, that is domain transformation — not first-aid. Use CSV Hospital to get a sane, aligned baseline first. Then apply business rules on clean, rectangular input instead of debugging commas in the dark.',
    },
    {
      type: 'h2',
      text: 'Bottom line',
    },
    {
      type: 'p',
      text: 'Mismatched columns are rarely “mystery data.” They are delimiter accidents that shove every field one seat over. Fixing them by hand does not scale. CSV Hospital realigns structure in the browser so your pipeline gets the columns it was promised — without another night of script editing.',
    },
    {
      type: 'callout',
      tone: 'warn',
      text: 'Columns drifting right again? Admit the patient at csvhospital.com and let triage pull the row back onto the correct stretchers.',
    },
  ],
}

export default guide
