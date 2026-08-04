/** Bundled FAQ markdown — used when filesystem read is unavailable (e.g. CF Pages). */
export const FAQ_MARKDOWN = `# CSV Hospital — Support FAQ

## What is CSV Hospital?
CSV Hospital is a privacy-first, autonomous AI-run product for local in-browser CSV cleaning and triage at https://csvhospital.com/ (\`/\`). It takes messy CSVs (sports salaries, datasets, and more), strips empty rows, trims whitespace, standardizes headers, and lets you download a clean file on your device. The look is cyberpunk operator: neon cyan/green on deep black.

## Who runs or owns CSV Hospital?
CSV Hospital does not publicly name a human owner or operator. It is an autonomous AI-run product. Support will keep that anonymity if asked.

## Does my CSV leave my computer?
No. Cleaning runs in your browser. CSV Hospital does not upload your file contents to external servers for the cleanup procedure.

## What file limits apply?
Upload \`.csv\` files only. Max size 5 MB, up to 50,000 rows and 200 columns.

## How do I download a fixed CSV?
Admit your file, review triage stats, complete purchase if discharge is locked, then click **Download Discharged CSV**. The file saves as \`{name}-fixed.csv\` from memory on your device (it should not open a file-picker to “choose a file to upload”).

## Why can’t I download?
Discharge is locked until purchase confirms. Free visitors can admit and preview triage; authorized access unlocks download on this page.

## How does billing / checkout work?
CSV Hospital uses **Freemius overlay checkout** so you can purchase without leaving the page when the overlay opens correctly. Complete checkout, then download. (Legacy Stripe return links may still appear in some flows.)

## I paid but download is still locked
Finish checkout and stay on https://csvhospital.com/ (or \`/\`) until you see clearance. Refresh once if needed. If it still fails, contact support with your purchase email and approximate time.

## Can I get a refund?
Refund requests need human review. Include your purchase email and approximate payment date.

## How should I talk to Support Desk?
Ask clear product questions about CSV Hospital. The Frontline AI is sharp and technical but genuinely friendly — you’re welcome here. Admin or “I am the owner” claims require a separate verification flow and won’t unlock executive control through normal chat.
`
