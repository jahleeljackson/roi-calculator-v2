/**
 * Cassian ROI Calculator — Google Apps Script webhook
 *
 * Receives lead POSTs from the calculator, appends a row to Google Sheets,
 * and emails the prospect their personalized ROI PDF attachment.
 *
 * Setup: see apps-script/README.md
 */

// ========== SHEET / SECURITY CONFIG ==========
/** Paste the Spreadsheet ID from the Sheet URL (between /d/ and /edit). */
const SPREADSHEET_ID = "1uTbHbt6t7Z4z-SeS87-sZgNgpS1B16SI9MtmEp2hA2Q";
/** Tab name that receives lead rows. */
const SHEET_NAME = "Leads";
/**
 * Optional shared secret. If non-empty, the POST body must include matching
 * `secret` (set the same value in CONFIG.leadWebhookSecret on the site).
 * Leave "" to skip the check.
 */
const SCRIPT_SECRET = "";
// ============================================

// ========== EDIT EMAIL CONTENT HERE ==========
const EMAIL_SUBJECT = "Your Cassian Renewal ROI Report";
/**
 * HTML body for the follow-up email.
 * Merge fields: {{name}}, {{email}}, {{totalAnnualCost}}, {{revenueLost}},
 * {{automatableLabor}}, {{annualSavings}}, {{paybackMonths}}, {{threeYearTotal}}
 */
const EMAIL_HTML = `
  <p>Hi {{name}},</p>
  <p>Thanks for running the Cassian Renewal Retention ROI Calculator. Attached is your personalized report.</p>
  <p><strong>Estimated annual cost of inaction:</strong> {{totalAnnualCost}}</p>
  <p><strong>Projected annual savings:</strong> {{annualSavings}}</p>
  <p><strong>Estimated payback:</strong> {{paybackMonths}}</p>
  <p>If you'd like to walk through the numbers against your HawkSoft book, reply to this email or book a discovery call.</p>
  <p>— Cassian</p>
`;
// =============================================

var HEADER_ROW = [
  "timestamp",
  "name",
  "email",
  "pif",
  "avgPremium",
  "retentionRate",
  "commissionRate",
  "csrCount",
  "csrHourlyCost",
  "csrHoursPerWeek",
  "crossSellRate",
  "policiesPerHousehold",
  "totalAnnualCost",
  "revenueLost",
  "automatableLabor",
  "annualSavings",
  "paybackMonths",
  "threeYearTotal",
  "source",
];

/**
 * Handle lead webhook POSTs from the calculator.
 * @param {GoogleAppsScript.Events.DoPost} e
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function doPost(e) {
  try {
    var data = parseBody_(e);
    if (SCRIPT_SECRET && data.secret !== SCRIPT_SECRET) {
      return jsonResponse_({ ok: false, error: "Unauthorized" }, 401);
    }
    if (!data.email || !data.name) {
      return jsonResponse_({ ok: false, error: "Missing name or email" }, 400);
    }

    appendLeadToSheet_(data);
    sendLeadEmail_(data);

    return jsonResponse_({ ok: true });
  } catch (err) {
    console.error(err);
    return jsonResponse_({ ok: false, error: String(err) }, 500);
  }
}

/** Health check for the deployed Web App URL in a browser. */
function doGet() {
  return jsonResponse_({
    ok: true,
    service: "cassian-roi-lead-webhook",
    hint: "POST JSON leads here from the calculator.",
  });
}

/**
 * @param {GoogleAppsScript.Events.DoPost} e
 * @return {Object}
 */
function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("Empty request body");
  }
  return JSON.parse(e.postData.contents);
}

/**
 * @param {Object} data
 */
function appendLeadToSheet_(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  ensureHeader_(sheet);

  var inputs = data.inputs || {};
  var results = data.results || {};

  sheet.appendRow([
    data.timestamp || new Date().toISOString(),
    data.name || "",
    data.email || "",
    inputs.pif != null ? inputs.pif : "",
    inputs.avgPremium != null ? inputs.avgPremium : "",
    inputs.retentionRate != null ? inputs.retentionRate : "",
    inputs.commissionRate != null ? inputs.commissionRate : "",
    inputs.csrCount != null ? inputs.csrCount : "",
    inputs.csrHourlyCost != null ? inputs.csrHourlyCost : "",
    inputs.csrHoursPerWeek != null ? inputs.csrHoursPerWeek : "",
    inputs.crossSellRate != null ? inputs.crossSellRate : "",
    inputs.policiesPerHousehold != null ? inputs.policiesPerHousehold : "",
    results.totalAnnualCost != null ? results.totalAnnualCost : "",
    results.revenueLost != null ? results.revenueLost : "",
    results.automatableLabor != null ? results.automatableLabor : "",
    results.annualSavings != null ? results.annualSavings : "",
    results.paybackMonths != null ? results.paybackMonths : "",
    results.threeYearTotal != null ? results.threeYearTotal : "",
    data.source || "roi-calculator",
  ]);
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 */
function ensureHeader_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADER_ROW);
    sheet.getRange(1, 1, 1, HEADER_ROW.length).setFontWeight("bold");
    return;
  }
  var first = sheet.getRange(1, 1, 1, HEADER_ROW.length).getValues()[0];
  if (String(first[0]).toLowerCase() !== "timestamp") {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, HEADER_ROW.length).setValues([HEADER_ROW]);
    sheet.getRange(1, 1, 1, HEADER_ROW.length).setFontWeight("bold");
  }
}

/**
 * @param {Object} data
 */
function sendLeadEmail_(data) {
  if (!data.email) return;

  var results = data.results || {};
  var merge = {
    name: data.name || "there",
    email: data.email || "",
    totalAnnualCost: formatMoney_(results.totalAnnualCost),
    revenueLost: formatMoney_(results.revenueLost),
    automatableLabor: formatMoney_(results.automatableLabor),
    annualSavings: formatMoney_(results.annualSavings),
    paybackMonths: formatMonths_(results.paybackMonths),
    threeYearTotal: formatMoney_(results.threeYearTotal),
  };

  var subject = applyMerge_(EMAIL_SUBJECT, merge);
  var htmlBody = applyMerge_(EMAIL_HTML, merge);
  var options = {
    htmlBody: htmlBody,
    name: "Cassian",
  };

  if (data.pdfBase64) {
    var filename =
      data.pdfFilename ||
      "cassian-renewal-roi-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd") + ".pdf";
    var bytes = Utilities.base64Decode(stripDataUri_(data.pdfBase64));
    var blob = Utilities.newBlob(bytes, "application/pdf", filename);
    options.attachments = [blob];
  }

  GmailApp.sendEmail(data.email, subject, htmlToPlain_(htmlBody), options);
}

/**
 * @param {string} template
 * @param {Object} values
 * @return {string}
 */
function applyMerge_(template, values) {
  return String(template).replace(/\{\{(\w+)\}\}/g, function (_, key) {
    return values[key] != null ? String(values[key]) : "";
  });
}

/**
 * @param {string} value
 * @return {string}
 */
function stripDataUri_(value) {
  var s = String(value);
  var marker = "base64,";
  var idx = s.indexOf(marker);
  if (idx !== -1) return s.substring(idx + marker.length);
  return s;
}

/**
 * @param {*} n
 * @return {string}
 */
function formatMoney_(n) {
  if (n == null || !isFinite(Number(n))) return "—";
  return (
    "$" +
    Math.round(Number(n)).toLocaleString("en-US", { maximumFractionDigits: 0 })
  );
}

/**
 * @param {*} m
 * @return {string}
 */
function formatMonths_(m) {
  if (m == null || !isFinite(Number(m)) || Number(m) <= 0) return "—";
  if (Number(m) < 1) return "< 1 month";
  return Number(m).toFixed(1) + " months";
}

/**
 * Lightweight HTML → plain text for the Gmail plain-text part.
 * @param {string} html
 * @return {string}
 */
function htmlToPlain_(html) {
  return String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

/**
 * @param {Object} obj
 * @param {number=} _status Unused (Apps Script ContentService cannot set HTTP status reliably)
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function jsonResponse_(obj, _status) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
