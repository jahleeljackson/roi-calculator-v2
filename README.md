# Cassian Renewal Retention ROI Calculator

Static HTML/JS calculator for independent personal-lines agency principals ($750K–$2.5M band). Quantifies revenue lost to non-renewal and CSR labor waste, then projects conservative savings from a Cassian Audit + Build engagement.

**Stack:** single page, plain JavaScript, CSS, jsPDF (CDN). Lead capture uses an optional Google Apps Script webhook (Sheets + Gmail).

## Quick start

1. Open [`index.html`](index.html) in a browser (double-click or local server).
2. Fill the **CONFIG** block in [`assets/calculator.js`](assets/calculator.js) (see below).
3. Host the folder on Netlify, GitHub Pages, or your site at `/roi-calculator`.

```bash
# optional local server
cd roi-calculator
python3 -m http.server 8080
# → http://localhost:8080
```

## What you must fill in

All editable settings live at the top of [`assets/calculator.js`](assets/calculator.js) in the `CONFIG` object:

| Field | What to put | Lines (approx.) |
|-------|-------------|-----------------|
| `brandName` | Your brand as shown in header/hero/PDF | ~12 |
| `logoUrl` | e.g. `"assets/logo.png"` — leave `""` for text wordmark | ~14 |
| `calendlyUrl` | Full Calendly / booking URL (replaces `#BOOK_DISCOVERY_CALL`) | ~16 |
| `contactEmail` | Real email for footer + PDF | ~18 |
| `leadWebhookUrl` | Deployed Apps Script Web App URL (see [`apps-script/README.md`](apps-script/README.md)); leave `""` for local-only | ~25 |
| `leadWebhookSecret` | Optional; must match `SCRIPT_SECRET` in Apps Script | ~30 |
| `engagementCost` / `auditCost` / `buildCost` / `annualRetainer` | Pricing shown in Bridge + 3-year math | ~33–36 |
| `assumptions.*` | Projection knobs (+5pp retention, 60% automatable, 65% labor reduction) | ~39–45 |
| `defaults.*` | Form pre-fills (commission 14%, CSR $25/hr) | ~48–51 |
| `brandColors.*` | PDF colors — keep in sync with [`assets/styles.css`](assets/styles.css) `:root` if you rebrand | ~54–62 |

### Logo

1. Drop your logo file into `assets/` (e.g. `assets/logo.svg` or `assets/logo.png`).
2. Set `logoUrl: "assets/logo.png"`.
3. The wordmark hides automatically when a logo URL is set.

### Lead capture (Google Sheets + email)

On email unlock, the calculator:

1. Appends `{ name, email, inputs, results, timestamp }` to `localStorage` key `cassian_roi_leads`
2. Logs the same object to the browser console
3. If `leadWebhookUrl` is set:
   - Builds the ROI PDF as base64
   - `POST`s the lead payload + PDF to your Google Apps Script Web App
   - The script appends a Sheet row and emails the prospect with the PDF attached

**Email copy** is edited in [`apps-script/Code.gs`](apps-script/Code.gs) under the `EDIT EMAIL CONTENT HERE` block (`EMAIL_SUBJECT`, `EMAIL_HTML`). Full setup: [`apps-script/README.md`](apps-script/README.md).

Inspect stored leads in DevTools:

```js
JSON.parse(localStorage.getItem("cassian_roi_leads"))
```

### CSS brand tokens

Visual colors/fonts are in [`assets/styles.css`](assets/styles.css) under `:root`. Change those for the live page; mirror hex values in `CONFIG.brandColors` so PDF export stays on-brand.

## File map

```
roi-calculator/
  index.html              Page structure (hero → form → results)
  assets/
    styles.css            Brand tokens + layout
    calculator.js         CONFIG + math + UI flow + lead webhook
    pdf-export.js         jsPDF shareable report (+ base64 for email)
  apps-script/
    Code.gs               Sheets append + Gmail with PDF attachment
    README.md             Deploy / wire-up steps
  README.md               This file
```

## User flow

1. Principal enters 7 core inputs (optional advanced: cross-sell %, policies/household).
2. **Calculate My ROI** → Zone 1 headline + Zone 2 breakdown (immediate).
3. Email gate → unlock Zone 3 comparison table, payback / 3-year metrics, Zone 4 Audit CTA.  
   If webhook is configured: Sheet row + automated email with PDF attachment.
4. **Book a Discovery Call** → `calendlyUrl`
5. **Download This Report** → PDF via jsPDF (browser download; separate from the email)

## Math (design PDF)

- Revenue lost = PIF × (1 − retention) × avg premium × commission
- Automatable CSR cost = CSR count × hrs/week × 52 × loaded hourly × **60%**
- Total cost of inaction = revenue lost + automatable CSR cost
- Projection: **+5pp** retention (capped at 99%); CSR renewal labor reduced by **65%**
- Engagement **$18,000**; Year 2–3 retainer **$9,000** for cumulative view

Verify the design’s “Dave” example in the browser console:

```js
assertDaveExample()
```

Expected: ~$74,592 revenue lost, ~$29,203 automatable labor, ~$103,795 total, ~3.9 month payback.

## Language

Use insurance language: renewal retention, revenue lost to non-renewal, CSR labor, book, HawkSoft, Audit. Avoid: churn, AI-powered, digital transformation, SaaS jargon.

## Out of scope

CRM sync beyond the Apps Script webhook, backend database, Notion embed.
