# Lead webhook (Google Sheets + Gmail)

This Apps Script is a **backend webhook only**. It receives unlock submissions from the ROI calculator, appends a row to a Google Sheet, and emails the prospect their personalized PDF.

## Important: what this is *not*

Do **not** paste the calculator’s `index.html` into Apps Script / HtmlService (`myFunction` + `Index.html`).

| Piece | Where it lives |
|-------|----------------|
| Calculator UI (`index.html`, `assets/*`) | Static host or local server (Netlify, GitHub Pages, `python3 -m http.server`) |
| Sheets + Gmail webhook (`doPost`) | This Apps Script project, deployed as a **Web app** |

If your Apps Script only has something like:

```js
function myFunction() {
  return HtmlService.createHtmlOutputFromFile('Index');
}
```

…POSTs from the calculator will fail with **Script function not found: doPost**, and the Sheet will never update.

Also: opening `index.html` via `file://` often blocks the webhook (`Failed to fetch`). Serve the folder over `http://localhost` when testing.

## 1. Create the spreadsheet

1. Create a new Google Sheet (or open an existing one).
2. Copy the **Spreadsheet ID** from the URL:  
   `https://docs.google.com/spreadsheets/d/`**`SPREADSHEET_ID`**`/edit`
3. Optionally rename the first tab to `Leads` (or match whatever you set as `SHEET_NAME` in `Code.gs`). The script will create the tab and header row if needed.

## 2. Create / fix the Apps Script project

1. Go to [script.google.com](https://script.google.com) → open your project (or **New project**).
2. Delete any HtmlService/`Index` hosting code. Remove unused HTML files if present.
3. Replace `Code.gs` entirely with the contents of [`Code.gs`](Code.gs) from this repo (must include `doPost` and `doGet`).
4. Set config at the top of `Code.gs`:
   - `SPREADSHEET_ID` — from step 1
   - `SHEET_NAME` — usually `"Leads"`
   - `SCRIPT_SECRET` — optional; if set, also set the same value in site `CONFIG.leadWebhookSecret`
5. Edit the email copy under **`EDIT EMAIL CONTENT HERE`** (`EMAIL_SUBJECT`, `EMAIL_HTML`).  
   Available merge fields: `{{name}}`, `{{email}}`, `{{totalAnnualCost}}`, `{{revenueLost}}`, `{{automatableLabor}}`, `{{annualSavings}}`, `{{paybackMonths}}`, `{{threeYearTotal}}`.

## 3. Deploy as a Web App

1. **Deploy** → **New deployment** (or **Manage deployments** → edit → **New version** after code changes).
2. Type: **Web app**.
3. Description: e.g. `ROI lead webhook`.
4. **Execute as:** Me.
5. **Who has access:** Anyone.
6. Deploy, authorize Gmail + Sheets when prompted, then copy the **Web app URL** (ends in `/exec`).

**Sanity check:** open the Web app URL in a browser. You should see JSON like `{"ok":true,"service":"cassian-roi-lead-webhook",...}` — not an HTML error and not your calculator page. If you see “Script function not found”, the deployed version still doesn’t include `doPost` / `doGet`.

## 4. Wire the calculator

In [`assets/calculator.js`](../assets/calculator.js), set:

```js
leadWebhookUrl: "https://script.google.com/macros/s/XXXX/exec",
leadWebhookSecret: "", // same as SCRIPT_SECRET if you use one
```

Keep hosting the calculator as static files. Do not put the calculator HTML inside this Apps Script project.

## 5. Test

1. From the project folder: `python3 -m http.server 8080` → open `http://localhost:8080` (not a `file://` path).
2. Run Calculate → Unlock Full Report with a real inbox you can check.
3. Confirm:
   - A new row appears in the Sheet (timestamp, name, email, inputs, results).
   - That inbox received the follow-up email with the PDF attached.

## Sheet columns

| timestamp | name | email | pif | avgPremium | retentionRate | commissionRate | csrCount | csrHourlyCost | csrHoursPerWeek | crossSellRate | policiesPerHousehold | totalAnnualCost | revenueLost | automatableLabor | annualSavings | paybackMonths | threeYearTotal | source |

Rates are stored as decimals (e.g. `0.84` for 84% retention), matching the calculator payload.
