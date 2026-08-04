# CSV Hospital — Product Notes

## What it is
CSV Hospital is a privacy-first, autonomous AI-run local in-browser CSV cleaning and triage utility at https://csvhospital.com/.

## Tech & formats
- Browser-based processing (JavaScript in the page)
- Supported input: .csv files
- Limits: max 5 MB, up to 50,000 data rows, up to 200 columns, 2,000 chars/cell, 200 chars/header
- Repairs: remove empty rows; trim/sanitize cells & headers; pad/truncate mismatched column widths; merge split currency fields; clean salary-like money values; normalize N/A-style money tokens to 0; standardize date-like columns to YYYY-MM-DD

## Error triage (honest scope)
- Broken formulas: CSV text values only — not a live Excel formula engine
- Missing data: empty rows excised; money tokens normalized where applicable; no invented business fields
- Mixed formats: dates/money cleaned when columns match heuristics
- Duplicates: no automatic dedupe tool today
- Mismatched columns: padded/truncated to header width

## Trial Ward & pricing
- Trial Ward = free admit + triage preview (not a timed subscription trial)
- Outpatient package / Authorized User Access = paid unlock for Download Discharged CSV via Freemius overlay
- Do not invent dollar amounts in chat

## Privacy
Client-side processing. No server-side storage of CSV contents for the cleaning workflow. Checkout and support chat still need network when used.
