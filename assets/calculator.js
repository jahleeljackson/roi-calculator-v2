/**
 * Cassian Renewal Retention ROI Calculator
 * ============================================================
 * FILL IN THE CONFIG BLOCK BELOW before sharing with prospects.
 * See README.md for a full map of what each field controls.
 * ============================================================
 */

const CONFIG = {
  // --- Brand ---
  brandName: "Cassian",
  /** Path to logo image, e.g. "assets/logo.png". Leave "" to use wordmark text. */
  logoUrl: "",
  /** Primary CTA — paste your Calendly (or booking) URL */
  calendlyUrl: "https://calendly.com/jahleeljackson-cassianconsultingai/30-minute-discovery-call",
  /** Shown in footer / PDF. Replace with your real email. */
  contactEmail: "jahleeljackson@cassianconsultingai.com",

  /**
   * Google Apps Script Web App URL (see apps-script/README.md).
   * Leave "" for local-only: leads go to localStorage + console.
   * When set, POSTs JSON on unlock: name, email, inputs, results,
   * timestamp, source, pdfBase64, pdfFilename [, secret].
   */
  leadWebhookUrl: "https://script.google.com/macros/s/AKfycbwfBVZ4BPjozQ2EudhVlaZB5e5LZ8XUvsAPhJPAUZOXCqz38APE_fPn3ZATA1q7t_Kq5w/exec",
  /**
   * Optional shared secret — must match SCRIPT_SECRET in apps-script/Code.gs.
   * Leave "" if SCRIPT_SECRET is also empty.
   */
  leadWebhookSecret: "",

  // --- Pricing (design PDF) ---
  engagementCost: 24000, // Audit $3K + Build $15K
  auditCost: 5000,
  buildCost: 20000,
  annualRetainer: 3000,

  // --- Projection assumptions (conservative) ---
  assumptions: {
    retentionImprovementPp: 5, // primary projection (+4 to +8 range)
    retentionImprovementLowPp: 4,
    retentionImprovementHighPp: 8,
    csrAutomatablePortion: 0.6, // 60% of renewal CSR work automatable
    laborSavingsOfAutomatable: 0.65, // recover 65% of automatable portion
  },

  // --- Input defaults (pre-fill form) ---
  defaults: {
    commissionRatePct: 14,
    csrHourlyCost: 25,
  },

  // --- Brand colors (mirrored in styles.css :root; used by PDF) ---
  brandColors: {
    navy: "#0b1f33",
    slate: "#3d4f63",
    paper: "#f7f4ef",
    accent: "#b08d57",
    positive: "#2f6b4f",
    ink: "#142231",
    muted: "#5c6b7a",
    white: "#ffffff",
  },
};

// ---------------------------------------------------------------------------
// Calculation engine
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} CalculatorInputs
 * @property {number} pif
 * @property {number} avgPremium
 * @property {number} retentionRate  0–1
 * @property {number} commissionRate 0–1
 * @property {number} csrCount
 * @property {number} csrHourlyCost
 * @property {number} csrHoursPerWeek
 * @property {number|null} crossSellRate 0–1 optional
 * @property {number|null} policiesPerHousehold optional
 */

/**
 * @param {CalculatorInputs} inputs
 */
function calculateRoi(inputs) {
  const a = CONFIG.assumptions;

  const annualRenewalEligibleRevenue =
    inputs.pif * inputs.avgPremium * inputs.commissionRate;

  const policiesLost = inputs.pif * (1 - inputs.retentionRate);
  const revenueLost = policiesLost * inputs.avgPremium * inputs.commissionRate;

  const yearlyCsrHours = inputs.csrCount * inputs.csrHoursPerWeek * 52;
  const yearlyCsrLaborCost = yearlyCsrHours * inputs.csrHourlyCost;
  const automatableLabor = yearlyCsrLaborCost * a.csrAutomatablePortion;
  const totalAnnualCost = revenueLost + automatableLabor;

  // Projection — retention capped at 99%
  const projectedRetention = Math.min(
    0.99,
    inputs.retentionRate + a.retentionImprovementPp / 100
  );
  const projectedPoliciesLost = inputs.pif * (1 - projectedRetention);
  const projectedRevenueLost =
    projectedPoliciesLost * inputs.avgPremium * inputs.commissionRate;
  const revenueRecovered = revenueLost - projectedRevenueLost;

  const projectedCsrLaborCost =
    yearlyCsrLaborCost - automatableLabor * a.laborSavingsOfAutomatable;
  const laborSaved = yearlyCsrLaborCost - projectedCsrLaborCost;
  // Design shows "CSR labor on renewals" projected as remaining cost after
  // recovering 65% of the automatable portion (not of total labor).
  const projectedAutomatableShown =
    automatableLabor * (1 - a.laborSavingsOfAutomatable);
  // For the comparison table, match design: Current CSR labor = full yearly cost;
  // With Cassian = reduced by labor savings on automatable portion.
  // Design Dave row: Current $48,672 → With $17,035 → Delta $31,637
  // $48,672 - $31,637 = $17,035; laborSaved = automatable * 0.65? 
  // 29203.2 * 0.65 ≈ 18982 — doesn't match $31,637.
  // Design: "Projected labor savings: 50–70% of automatable portion" OR of total?
  // Looking again: Current CSR labor $48,672, With $17,035, Delta $31,637
  // $31,637 / $48,672 ≈ 65% of TOTAL labor — so they used 65% of full CSR renewal labor,
  // not 65% of automatable. But Stream B says automatable portion 60% = $29,203 for Zone 2.
  // Zone 3 uses full labor cost for "CSR labor on renewals" current, and reduces by ~65% of total.
  // $48672 * 0.35 = 17035.2 ✓ — so With Cassian CSR labor = total * (1 - 0.65)
  // AND/OR: labor savings delta = 65% of total yearly CSR labor.
  // I'll use: projected full CSR labor = yearlyCsrLaborCost * (1 - laborSavingsOfAutomatable)
  // when laborSavingsOfAutomatable is 0.65 → matches Dave example for Zone 3.
  // Zone 2 still shows automatableLabor (60% of total) as "CSR time burned on manual work".

  const projectedCsrLaborOnRenewals =
    yearlyCsrLaborCost * (1 - a.laborSavingsOfAutomatable);
  const csrLaborDelta = yearlyCsrLaborCost - projectedCsrLaborOnRenewals;

  const annualSavings = revenueRecovered + csrLaborDelta;

  const paybackMonths =
    annualSavings > 0
      ? CONFIG.engagementCost / (annualSavings / 12)
      : Infinity;

  const year1Net = annualSavings - CONFIG.engagementCost;
  const year2Net = annualSavings - CONFIG.annualRetainer;
  const year3Net = annualSavings - CONFIG.annualRetainer;
  const threeYearTotal = year1Net + year2Net + year3Net;

  return {
    annualRenewalEligibleRevenue,
    policiesLost,
    revenueLost,
    yearlyCsrHours,
    yearlyCsrLaborCost,
    automatableLabor,
    totalAnnualCost,
    currentRetention: inputs.retentionRate,
    projectedRetention,
    projectedRevenueLost,
    revenueRecovered,
    projectedCsrLaborOnRenewals,
    csrLaborDelta,
    annualSavings,
    paybackMonths,
    year1Net,
    year2Net,
    year3Net,
    threeYearTotal,
    engagementCost: CONFIG.engagementCost,
    auditCost: CONFIG.auditCost,
    // optional context
    crossSellRate: inputs.crossSellRate,
    policiesPerHousehold: inputs.policiesPerHousehold,
  };
}

/**
 * Dave example from design PDF — run in console: assertDaveExample()
 * Expected: revenueLost ≈ 74592, automatableLabor ≈ 29203, total ≈ 103795
 */
function assertDaveExample() {
  const r = calculateRoi({
    pif: 1800,
    avgPremium: 1850,
    retentionRate: 0.84,
    commissionRate: 0.14,
    csrCount: 3,
    csrHourlyCost: 26,
    csrHoursPerWeek: 12,
    crossSellRate: null,
    policiesPerHousehold: null,
  });

  const checks = [
    ["revenueLost", r.revenueLost, 74592],
    ["automatableLabor", r.automatableLabor, 29203.2],
    ["totalAnnualCost", r.totalAnnualCost, 103795.2],
    ["yearlyCsrLaborCost", r.yearlyCsrLaborCost, 48672],
    ["projectedCsrLaborOnRenewals", r.projectedCsrLaborOnRenewals, 17035.2],
  ];

  console.group("assertDaveExample()");
  let ok = true;
  for (const [name, actual, expected] of checks) {
    const pass = Math.abs(actual - expected) < 1;
    console.log(
      `${pass ? "✓" : "✗"} ${name}: got ${actual.toFixed(2)}, expected ~${expected}`
    );
    if (!pass) ok = false;
  }
  console.log(
    `projected retention: ${(r.projectedRetention * 100).toFixed(0)}% (expect 89%)`
  );
  console.log(`annualSavings: $${Math.round(r.annualSavings)}`);
  console.log(`paybackMonths: ${r.paybackMonths.toFixed(1)} (expect ~3.9)`);
  console.groupEnd();
  return ok;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatCurrency(n, { compact = false } = {}) {
  if (!Number.isFinite(n)) return "—";
  if (compact && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

function formatPct(rate) {
  return `${(rate * 100).toFixed(0)}%`;
}

function formatMonths(m) {
  if (!Number.isFinite(m) || m <= 0) return "—";
  if (m < 1) return "< 1 month";
  return `${m.toFixed(1)} months`;
}

function animateCount(el, target, duration = 900) {
  const start = performance.now();
  const from = 0;
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const value = from + (target - from) * eased;
    el.textContent = formatCurrency(value);
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// DOM / app
// ---------------------------------------------------------------------------

let lastInputs = null;
let lastResults = null;
let resultsUnlocked = false;

function $(sel) {
  return document.querySelector(sel);
}

function applyBrand() {
  const name = CONFIG.brandName || "Cassian";
  document.title = `${name} — Renewal Retention ROI Calculator`;

  document.querySelectorAll("[data-brand-name]").forEach((el) => {
    el.textContent = name;
  });

  const logoImg = $("#brand-logo");
  const wordmark = $("#brand-wordmark");
  if (CONFIG.logoUrl && logoImg) {
    logoImg.src = CONFIG.logoUrl;
    logoImg.alt = name;
    logoImg.classList.add("is-visible");
    if (wordmark) wordmark.classList.add("is-hidden");
  }

  const calendly = $("#cta-calendly");
  if (calendly) {
    calendly.href = CONFIG.calendlyUrl || "#BOOK_DISCOVERY_CALL";
  }

  const emailLinks = document.querySelectorAll("[data-contact-email]");
  emailLinks.forEach((el) => {
    el.textContent = CONFIG.contactEmail;
    if (el.tagName === "A") {
      el.href = `mailto:${CONFIG.contactEmail}`;
    }
  });

  const auditCostEl = $("#audit-cost-display");
  if (auditCostEl) {
    auditCostEl.textContent = formatCurrency(CONFIG.auditCost);
  }

  const paybackLabel = $("#payback-label");
  if (paybackLabel) {
    paybackLabel.textContent = `Payback on ${formatCurrency(CONFIG.engagementCost)} engagement`;
  }

  document.querySelectorAll("[data-brand-with]").forEach((el) => {
    el.textContent = `With ${CONFIG.brandName}`;
  });
}

function readInputs() {
  const num = (id) => {
    const raw = $(id).value.replace(/,/g, "").trim();
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : NaN;
  };

  const optionalNum = (id) => {
    const raw = $(id).value.replace(/,/g, "").trim();
    if (!raw) return null;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : null;
  };

  return {
    pif: num("#input-pif"),
    avgPremium: num("#input-premium"),
    retentionRate: num("#input-retention") / 100,
    commissionRate: num("#input-commission") / 100,
    csrCount: num("#input-csr-count"),
    csrHourlyCost: num("#input-csr-hourly"),
    csrHoursPerWeek: num("#input-csr-hours"),
    crossSellRate: (() => {
      const v = optionalNum("#input-cross-sell");
      return v == null ? null : v / 100;
    })(),
    policiesPerHousehold: optionalNum("#input-policies-hh"),
  };
}

function validateInputs(inputs) {
  const errors = [];
  const fields = [
    ["#input-pif", inputs.pif, (v) => v > 0],
    ["#input-premium", inputs.avgPremium, (v) => v > 0],
    [
      "#input-retention",
      inputs.retentionRate * 100,
      (v) => v >= 0 && v <= 100,
    ],
    [
      "#input-commission",
      inputs.commissionRate * 100,
      (v) => v > 0 && v <= 100,
    ],
    ["#input-csr-count", inputs.csrCount, (v) => v >= 0],
    ["#input-csr-hourly", inputs.csrHourlyCost, (v) => v > 0],
    ["#input-csr-hours", inputs.csrHoursPerWeek, (v) => v >= 0],
  ];

  document.querySelectorAll(".field input").forEach((el) => {
    el.classList.remove("is-invalid");
  });

  for (const [sel, value, ok] of fields) {
    const el = $(sel);
    if (!Number.isFinite(value) || !ok(value)) {
      el.classList.add("is-invalid");
      errors.push(sel);
    }
  }
  return errors.length === 0;
}

function setDefaults() {
  $("#input-commission").value = CONFIG.defaults.commissionRatePct;
  $("#input-csr-hourly").value = CONFIG.defaults.csrHourlyCost;
}

function renderPartial(results) {
  const section = $("#results");
  section.classList.add("is-visible");

  const headlineEl = $("#headline-amount");
  animateCount(headlineEl, results.totalAnnualCost);

  $("#headline-copy").textContent =
    `Your agency is losing an estimated ${formatCurrency(results.totalAnnualCost)} every year to renewal leakage and manual CSR work.`;

  $("#bd-revenue").textContent = formatCurrency(results.revenueLost);
  $("#bd-labor").textContent = formatCurrency(results.automatableLabor);
  $("#bd-total").textContent = formatCurrency(results.totalAnnualCost);

  // Bar widths relative to total
  const total = Math.max(results.totalAnnualCost, 1);
  requestAnimationFrame(() => {
    $("#bar-revenue").style.width = `${(results.revenueLost / total) * 100}%`;
    $("#bar-labor").style.width = `${(results.automatableLabor / total) * 100}%`;
    $("#bar-total").style.width = "100%";
  });

  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderFull(inputs, results) {
  const full = $("#full-results");
  full.classList.add("is-unlocked");

  $("#cmp-retention-current").textContent = formatPct(results.currentRetention);
  $("#cmp-retention-projected").textContent = formatPct(results.projectedRetention);
  $("#cmp-retention-delta").textContent = `+${CONFIG.assumptions.retentionImprovementPp}pp`;

  $("#cmp-revenue-current").textContent = formatCurrency(results.revenueLost);
  $("#cmp-revenue-projected").textContent = formatCurrency(
    results.projectedRevenueLost
  );
  $("#cmp-revenue-delta").textContent = formatCurrency(results.revenueRecovered);

  $("#cmp-labor-current").textContent = formatCurrency(results.yearlyCsrLaborCost);
  $("#cmp-labor-projected").textContent = formatCurrency(
    results.projectedCsrLaborOnRenewals
  );
  $("#cmp-labor-delta").textContent = formatCurrency(results.csrLaborDelta);

  $("#cmp-savings-delta").textContent = formatCurrency(results.annualSavings);

  $("#metric-payback").textContent = formatMonths(results.paybackMonths);
  $("#metric-annual-savings").textContent = formatCurrency(results.annualSavings);
  $("#metric-three-year").textContent = formatCurrency(results.threeYearTotal);

  const a = CONFIG.assumptions;
  $("#assumptions-text").textContent =
    `Projections assume a conservative +${a.retentionImprovementPp}pp retention improvement and ${Math.round(a.laborSavingsOfAutomatable * 100)}% reduction in CSR renewal labor cost. ` +
    `Actual results from agencies in your revenue band typically range from +${a.retentionImprovementLowPp}pp to +${a.retentionImprovementHighPp}pp depending on current retention rate and AMS configuration. ` +
    `${Math.round(a.csrAutomatablePortion * 100)}% of renewal CSR tasks are treated as automatable (data entry, follow-up scheduling, re-quote prep — not client conversations or carrier negotiations).`;

  // Optional advanced note
  const adv = $("#advanced-note");
  if (inputs.crossSellRate != null || inputs.policiesPerHousehold != null) {
    const bits = [];
    if (inputs.crossSellRate != null) {
      bits.push(`cross-sell rate ${formatPct(inputs.crossSellRate)}`);
    }
    if (inputs.policiesPerHousehold != null) {
      bits.push(`${inputs.policiesPerHousehold} policies per household`);
    }
    adv.hidden = false;
    adv.textContent =
      `You also noted ${bits.join(" and ")}. The Audit can model account-rounding and upsell lift on top of these retention figures.`;
  } else {
    adv.hidden = true;
  }
}

function saveLead(name, email, inputs, results) {
  const payload = {
    name,
    email,
    inputs,
    results: {
      totalAnnualCost: results.totalAnnualCost,
      revenueLost: results.revenueLost,
      automatableLabor: results.automatableLabor,
      annualSavings: results.annualSavings,
      paybackMonths: results.paybackMonths,
      threeYearTotal: results.threeYearTotal,
    },
    timestamp: new Date().toISOString(),
    source: "roi-calculator",
  };

  try {
    const existing = JSON.parse(localStorage.getItem("cassian_roi_leads") || "[]");
    existing.push(payload);
    localStorage.setItem("cassian_roi_leads", JSON.stringify(existing));
  } catch (e) {
    console.warn("localStorage unavailable", e);
  }

  console.log("[Cassian ROI lead]", payload);

  // #region agent log
  fetch('http://127.0.0.1:7764/ingest/2cba638a-699b-4b8b-858c-e76fd4c090dd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e34d84'},body:JSON.stringify({sessionId:'e34d84',runId:'pre-fix',hypothesisId:'A',location:'calculator.js:saveLead',message:'saveLead reached webhook branch check',data:{hasWebhookUrl:!!CONFIG.leadWebhookUrl,webhookHost:CONFIG.leadWebhookUrl?String(CONFIG.leadWebhookUrl).split('/')[2]:'',hasInputs:!!inputs,hasResults:!!results,protocol:typeof location!=='undefined'?location.protocol:''},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  if (CONFIG.leadWebhookUrl) {
    postLeadWebhook(payload, name, email, inputs, results);
  }

  return payload;
}

/**
 * Fire-and-forget POST to Apps Script: Sheet row + email with PDF attachment.
 */
function postLeadWebhook(payload, name, email, inputs, results) {
  const body = { ...payload };
  if (CONFIG.leadWebhookSecret) {
    body.secret = CONFIG.leadWebhookSecret;
  }

  let pdfAttached = false;
  let pdfBase64Len = 0;
  if (typeof window.buildRoiPdfBase64 === "function") {
    try {
      const pdf = window.buildRoiPdfBase64({
        config: CONFIG,
        inputs,
        results,
        prospectName: name,
        prospectEmail: email,
      });
      if (pdf) {
        body.pdfBase64 = pdf.pdfBase64;
        body.pdfFilename = pdf.filename;
        pdfAttached = true;
        pdfBase64Len = (pdf.pdfBase64 && pdf.pdfBase64.length) || 0;
      }
    } catch (err) {
      console.warn("PDF base64 build failed; sending lead without attachment", err);
    }
  }

  // #region agent log
  fetch('http://127.0.0.1:7764/ingest/2cba638a-699b-4b8b-858c-e76fd4c090dd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e34d84'},body:JSON.stringify({sessionId:'e34d84',runId:'pre-fix',hypothesisId:'D',location:'calculator.js:postLeadWebhook:beforeFetch',message:'About to POST lead webhook',data:{pdfAttached:pdfAttached,pdfBase64Len:pdfBase64Len,bodyKeys:Object.keys(body),approxJsonLen:JSON.stringify(body).length},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  fetch(CONFIG.leadWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
    redirect: "follow",
  })
    .then(async (res) => {
      let text = "";
      try {
        text = await res.text();
      } catch (_) {
        text = "";
      }
      const snippet = String(text).replace(/\s+/g, " ").slice(0, 300);
      // #region agent log
      fetch('http://127.0.0.1:7764/ingest/2cba638a-699b-4b8b-858c-e76fd4c090dd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e34d84'},body:JSON.stringify({sessionId:'e34d84',runId:'pre-fix',hypothesisId:'C',location:'calculator.js:postLeadWebhook:response',message:'Lead webhook response',data:{status:res.status,ok:res.ok,type:res.type,redirected:res.redirected,snippet:snippet,mentionsDoPost:!/doPost/i.test(snippet)?false:/doPost/i.test(snippet),looksLikeGasError:/Script function not found|Error/i.test(snippet)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (!res.ok || /Script function not found|error/i.test(snippet)) {
        console.warn("Lead webhook response not ok", res.status, snippet);
      }
    })
    .catch((err) => {
      // #region agent log
      fetch('http://127.0.0.1:7764/ingest/2cba638a-699b-4b8b-858c-e76fd4c090dd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e34d84'},body:JSON.stringify({sessionId:'e34d84',runId:'pre-fix',hypothesisId:'B',location:'calculator.js:postLeadWebhook:catch',message:'Lead webhook fetch failed',data:{error:String(err)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      console.warn("Lead webhook failed", err);
    });
}

function onCalculate(e) {
  e.preventDefault();
  const inputs = readInputs();
  if (!validateInputs(inputs)) {
    $("#form-error").textContent = "Please fill in all required fields with valid numbers.";
    return;
  }
  $("#form-error").textContent = "";

  lastInputs = inputs;
  lastResults = calculateRoi(inputs);
  resultsUnlocked = false;

  $("#full-results").classList.remove("is-unlocked");
  $("#email-gate").hidden = false;

  renderPartial(lastResults);
}

function onUnlock(e) {
  e.preventDefault();
  const name = $("#gate-name").value.trim();
  const email = $("#gate-email").value.trim();
  const err = $("#gate-error");

  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    err.textContent = "Enter your name and a valid work email to unlock the full report.";
    return;
  }
  err.textContent = "";

  saveLead(name, email, lastInputs, lastResults);
  resultsUnlocked = true;
  $("#email-gate").hidden = true;
  renderFull(lastInputs, lastResults);
}

function onAdvancedToggle() {
  const panel = $("#advanced-fields");
  const btn = $("#advanced-toggle");
  const open = panel.classList.toggle("is-open");
  btn.setAttribute("aria-expanded", open ? "true" : "false");
  btn.textContent = open ? "Hide advanced inputs" : "Show advanced inputs (optional)";
}

function onDownloadPdf() {
  if (!resultsUnlocked || !lastResults || !lastInputs) return;
  const name = $("#gate-name").value.trim();
  const email = $("#gate-email").value.trim();
  if (typeof window.exportRoiPdf === "function") {
    window.exportRoiPdf({
      config: CONFIG,
      inputs: lastInputs,
      results: lastResults,
      prospectName: name,
      prospectEmail: email,
    });
  }
}

function init() {
  applyBrand();
  setDefaults();

  $("#roi-form").addEventListener("submit", onCalculate);
  $("#gate-form").addEventListener("submit", onUnlock);
  $("#advanced-toggle").addEventListener("click", onAdvancedToggle);
  $("#cta-pdf").addEventListener("click", onDownloadPdf);

  // Expose for console verification / debugging
  window.CONFIG = CONFIG;
  window.calculateRoi = calculateRoi;
  window.assertDaveExample = assertDaveExample;
}

document.addEventListener("DOMContentLoaded", init);
