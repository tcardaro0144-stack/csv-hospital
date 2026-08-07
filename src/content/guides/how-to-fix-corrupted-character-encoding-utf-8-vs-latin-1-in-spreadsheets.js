/**
 * Guide — UTF-8 vs Latin-1 / mojibake in CSVs.
 */

/** @typedef {{ type: 'p'|'h2'|'h3'|'ul'|'ol'|'pre'|'callout', text?: string, items?: string[], code?: string, tone?: 'signal'|'warn' }} GuideBlock */

/** @type {{ slug: string, blocks: GuideBlock[] }} */
export const guide = {
  slug: 'how-to-fix-corrupted-character-encoding-utf-8-vs-latin-1-in-spreadsheets',
  blocks: [
    {
      type: 'p',
      text: 'You export a CSV with names like José, Müller, or São Paulo. On another machine — or in another tool — those characters become `JosÃ©`, `MÃ¼ller`, or a forest of ``. That is mojibake: bytes decoded with the wrong character encoding. This guide explains UTF-8 vs Latin-1 (and friends), why spreadsheets make the problem worse, and how CSV Hospital (csvhospital.com) cleans and normalizes encoding in the browser so special characters survive the trip.',
    },
    {
      type: 'h2',
      text: 'Bytes are not characters',
    },
    {
      type: 'p',
      text: 'A CSV is a stream of bytes. Characters only appear when software applies a decoding map. UTF-8 and Latin-1 (ISO-8859-1 / Windows-1252 “ANSI”) use different maps for the same high bytes. Read UTF-8 bytes as Latin-1 and you get nonsense. Read Latin-1 bytes as UTF-8 and the parser may throw — or substitute replacement characters. The file is not “corrupt” in the disk sense; it is mislabeled.',
    },
    {
      type: 'pre',
      code: `# Same name, different readings
José  → UTF-8 bytes: 4a 6f 73 c3 a9
      → misread as Latin-1: JosÃ©

# UTF-8 BOM at the start of a file
EF BB BF + "id,name"  → first header becomes "\\ufeffid"`,
    },
    {
      type: 'h2',
      text: 'UTF-8 vs Latin-1 in plain language',
    },
    {
      type: 'ul',
      items: [
        'UTF-8 — modern default for the web and most APIs; handles emoji and global scripts; variable-width bytes.',
        'Latin-1 / Windows-1252 — legacy Western European encodings; one byte per character in a limited range; still common in older Windows exports.',
        'BOM (byte order mark) — optional UTF-8 signature that some Windows tools prepend; can glue itself onto the first column name and break joins.',
      ],
    },
    {
      type: 'h2',
      text: 'Where mojibake usually comes from',
    },
    {
      type: 'p',
      text: 'A CRM exports “ANSI.” A Mac user opens it as UTF-8. A pipeline assumes UTF-8-SIG. A database COPY session uses client_encoding=WIN1252. Each hop that guesses wrong paints another layer of garble. Spreadsheets often auto-detect and quietly re-save, so the next export is a different encoding than the last — with no warning in the UI.',
    },
    {
      type: 'h3',
      text: 'Symptoms to watch for',
    },
    {
      type: 'ul',
      items: [
        'Accented letters become two-character junk (`Ã©`, `Ã¼`).',
        'Currency symbols (€, £) or smart quotes turn into `` or boxes.',
        'First header looks like `\\ufeffid` or fails equality checks against `id`.',
        'Importer crashes with UnicodeDecodeError while Excel still “looks fine.”',
      ],
    },
    {
      type: 'h2',
      text: 'The usual fix (and why it keeps coming back)',
    },
    {
      type: 'p',
      text: 'Engineers reach for chardet, ftfy, or a hand-picked `encoding=` argument, rewrite the file as UTF-8, and move on — until the next vendor email attachment arrives in a different code page. Encoding repair as a tribal script does not help analysts or support staff who need a clean file now.',
    },
    {
      type: 'pre',
      code: `# Classic one-off — encoding argument is a coin flip
with open("export.csv", "r", encoding="cp1252") as src:
    text = src.read()
with open("export-utf8.csv", "w", encoding="utf-8", newline="") as out:
    out.write(text)`,
    },
    {
      type: 'h2',
      text: 'How CSV Hospital normalizes encoding in the browser',
    },
    {
      type: 'p',
      text: 'CSV Hospital is built for messy admissions. You drop a .csv on csvhospital.com; triage runs locally — the file never checks into a server ward. Alongside empty-row excision, whitespace trim, and header alignment, the flow is designed to leave you with a clean, UTF-8-friendly discharge you can feed to modern tools without another encoding debate.',
    },
    {
      type: 'ul',
      items: [
        'Admit in the browser — no upload to a remote repair service.',
        'Stabilize structure — empty rows and padding that often travel with bad exports get cleaned.',
        'Standardize headers — including the kind of first-column weirdness a BOM leaves behind.',
        'Discharge a healed file — one-time credits unlock download when you are ready.',
      ],
    },
    {
      type: 'callout',
      tone: 'signal',
      text: 'Think of encoding repair as bedside manner for bytes: get the patient onto UTF-8, clear the invisible bandages (BOM, padding), then let your pipeline speak a language every system understands.',
    },
    {
      type: 'h2',
      text: 'Practical workflow when names look cursed',
    },
    {
      type: 'ol',
      items: [
        'Keep the original attachment as a backup.',
        'Admit the CSV at https://csvhospital.com/.',
        'Scan triage stats, then spot-check rows that used to show mojibake.',
        'Confirm accented names and symbols read correctly in the healed preview.',
        'Download the discharged UTF-8-oriented file and re-run your importer.',
      ],
    },
    {
      type: 'h2',
      text: 'When custom decoding still matters',
    },
    {
      type: 'p',
      text: 'Mixed encodings inside a single file, or binary blobs pretending to be CSV, still need specialist tooling. For the everyday case — one export, wrong code page, ugly symbols — browser-local triage is faster than debating which `encoding=` string to try next.',
    },
    {
      type: 'h2',
      text: 'Bottom line',
    },
    {
      type: 'p',
      text: 'Mojibake is a translation error between byte streams and character maps, not a moral failing of your data. UTF-8 vs Latin-1 collisions are the most common ward visits. CSV Hospital normalizes the patient in your browser so José stays José — without another one-off decoding script.',
    },
    {
      type: 'callout',
      tone: 'warn',
      text: 'Seeing Ã© where an accent should be? Admit the spreadsheet at csvhospital.com and let the ER normalize encoding before your next import.',
    },
  ],
}

export default guide
