# CSV Hospital — Product Notes

## What it is
CSV Hospital is Faceless Blur's local in-browser CSV cleaning and triage utility at https://facelessblur.com/hospital.

## Tech & formats
- Browser-based processing (JavaScript in the page)
- Supported input: .csv files
- Limits: max 5 MB, up to 50,000 data rows, up to 200 columns
- Repairs: remove empty rows, trim whitespace, standardize headers, sanitize cells, fix common delimiter/currency split issues

## Privacy
Client-side processing. No server-side storage of CSV contents for the cleaning workflow. Offline cleaning can continue after the page loads; checkout and support chat still need network when used.

## Billing
Freemius overlay checkout unlocks discharge (download). Free visitors can admit/preview triage. Paid/authorized access unlocks Download Discharged CSV ({name}-fixed.csv). License unlock is handled via Freemius purchase confirmation in the browser — not by pasting keys into Frontline chat.
