/**
 * PDF export for Cassian Renewal Retention ROI Calculator
 * Requires jsPDF (global window.jspdf.jsPDF) loaded via CDN.
 */

(function () {
  function money(n) {
    if (!Number.isFinite(n)) return "—";
    return (
      "$" +
      Math.round(n).toLocaleString("en-US", { maximumFractionDigits: 0 })
    );
  }

  function pct(rate) {
    return (rate * 100).toFixed(0) + "%";
  }

  function months(m) {
    if (!Number.isFinite(m) || m <= 0) return "—";
    if (m < 1) return "< 1 month";
    return m.toFixed(1) + " months";
  }

  function pdfFilename(config) {
    const stamp = new Date().toISOString().slice(0, 10);
    const brandSlug = (config.brandName || "cassian")
      .toLowerCase()
      .replace(/\s+/g, "-");
    return `${brandSlug}-renewal-roi-${stamp}.pdf`;
  }

  /**
   * Build the ROI report jsPDF document (does not save or download).
   * @param {{
   *   config: object,
   *   inputs: object,
   *   results: object,
   *   prospectName: string,
   *   prospectEmail: string
   * }} opts
   * @returns {import("jspdf").jsPDF | null}
   */
  function buildRoiPdfDoc(opts) {
    const { config, inputs, results, prospectName, prospectEmail } = opts;
    const JsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!JsPDF) {
      console.error("jsPDF not loaded");
      return null;
    }

    const c = config.brandColors || {};
    const navy = c.navy || "#0b1f33";
    const slate = c.slate || "#3d4f63";
    const accent = c.accent || "#b08d57";
    const positive = c.positive || "#2f6b4f";
    const muted = c.muted || "#5c6b7a";

    const doc = new JsPDF({ unit: "pt", format: "letter" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 48;
    let y = margin;

    // Header bar
    doc.setFillColor(navy);
    doc.rect(0, 0, pageW, 64, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(config.brandName || "Cassian", margin, 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Renewal Retention ROI Report", margin, 48);

    y = 88;
    doc.setTextColor(muted);
    doc.setFontSize(9);
    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    doc.text(`Prepared for ${prospectName || "Agency Principal"} · ${prospectEmail || ""}`, margin, y);
    y += 14;
    doc.text(dateStr, margin, y);
    y += 28;

    // Zone 1 — Headline
    doc.setTextColor(navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("ESTIMATED ANNUAL COST OF RENEWAL LEAKAGE", margin, y);
    y += 22;
    doc.setFontSize(28);
    doc.setTextColor(navy);
    doc.text(money(results.totalAnnualCost), margin, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(slate);
    const headline =
      "Your agency is losing an estimated " +
      money(results.totalAnnualCost) +
      " every year to renewal leakage and manual CSR work.";
    const headlineLines = doc.splitTextToSize(headline, pageW - margin * 2);
    doc.text(headlineLines, margin, y);
    y += headlineLines.length * 14 + 18;

    // Zone 2 — Breakdown
    doc.setDrawColor(accent);
    doc.setLineWidth(1.5);
    doc.line(margin, y, margin + 80, y);
    y += 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(navy);
    doc.text("BREAKDOWN", margin, y);
    y += 16;

    const rows = [
      ["Revenue walking out the door (non-renewal)", money(results.revenueLost)],
      ["CSR time burned on manual renewal work", money(results.automatableLabor)],
      ["Total annual cost", money(results.totalAnnualCost)],
    ];

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    rows.forEach(([label, value], i) => {
      doc.setTextColor(slate);
      doc.text(label, margin, y);
      doc.setFont("helvetica", i === 2 ? "bold" : "normal");
      doc.setTextColor(navy);
      doc.text(value, pageW - margin, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 16;
    });
    y += 12;

    // Inputs snapshot
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(navy);
    doc.text("YOUR INPUTS", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(muted);
    const inputLine =
      `${Math.round(inputs.pif).toLocaleString()} PIF · ` +
      `${money(inputs.avgPremium)} avg premium · ` +
      `${pct(inputs.retentionRate)} retention · ` +
      `${pct(inputs.commissionRate)} commission · ` +
      `${inputs.csrCount} CSRs · ` +
      `${inputs.csrHoursPerWeek} hrs/wk · ` +
      `${money(inputs.csrHourlyCost)}/hr loaded`;
    const inputLines = doc.splitTextToSize(inputLine, pageW - margin * 2);
    doc.text(inputLines, margin, y);
    y += inputLines.length * 12 + 18;

    // Zone 3 — Comparison table
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(navy);
    doc.text("CURRENT STATE VS WITH " + (config.brandName || "CASSIAN").toUpperCase(), margin, y);
    y += 16;

    const colX = [margin, 260, 370, pageW - margin];
    const headers = ["Metric", "Current", "With Cassian", "Delta"];
    doc.setFontSize(8);
    doc.setTextColor(muted);
    headers.forEach((h, i) => {
      const align = i === 0 ? "left" : "right";
      const x = i === 0 ? colX[0] : colX[i];
      doc.text(h.toUpperCase(), x, y, { align });
    });
    y += 6;
    doc.setDrawColor(220);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 14;

    const a = config.assumptions;
    const table = [
      [
        "Retention rate",
        pct(results.currentRetention),
        pct(results.projectedRetention),
        `+${a.retentionImprovementPp}pp`,
      ],
      [
        "Revenue lost to non-renewal",
        money(results.revenueLost),
        money(results.projectedRevenueLost),
        money(results.revenueRecovered),
      ],
      [
        "CSR labor on renewals",
        money(results.yearlyCsrLaborCost),
        money(results.projectedCsrLaborOnRenewals),
        money(results.csrLaborDelta),
      ],
      ["Annual savings", "—", "—", money(results.annualSavings)],
    ];

    doc.setFontSize(9);
    table.forEach((row, idx) => {
      const isDelta = idx === table.length - 1;
      if (isDelta) {
        doc.setFillColor(232, 243, 237);
        doc.rect(margin - 4, y - 11, pageW - margin * 2 + 8, 18, "F");
        doc.setTextColor(positive);
        doc.setFont("helvetica", "bold");
      } else {
        doc.setTextColor(slate);
        doc.setFont("helvetica", "normal");
      }
      doc.text(row[0], colX[0], y);
      doc.setTextColor(isDelta ? positive : navy);
      doc.text(row[1], colX[1], y, { align: "right" });
      doc.text(row[2], colX[2], y, { align: "right" });
      doc.text(row[3], colX[3], y, { align: "right" });
      y += 18;
    });
    y += 14;

    // Payback + 3-year
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(navy);
    doc.text("INVESTMENT MATH", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(slate);

    const investLines = [
      `Engagement (Audit + Build): ${money(config.engagementCost)}`,
      `Payback period: ${months(results.paybackMonths)}`,
      `Year 1 net (after engagement): ${money(results.year1Net)}`,
      `Year 2 net (after ${money(config.annualRetainer)} retainer): ${money(results.year2Net)}`,
      `Year 3 net: ${money(results.year3Net)}`,
      `3-year cumulative: ${money(results.threeYearTotal)}`,
    ];
    investLines.forEach((line) => {
      doc.text(line, margin, y);
      y += 14;
    });
    y += 12;

    // Bridge / CTA
    doc.setFillColor(247, 244, 239);
    doc.roundedRect(margin - 4, y - 8, pageW - margin * 2 + 8, 72, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(navy);
    doc.text("NEXT STEP: THE AUDIT", margin + 4, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(slate);
    const bridge =
      `A ${money(config.auditCost)} Audit confirms these numbers against your actual workflows and HawkSoft configuration. ` +
      `Most agencies recover the Audit cost within the first 3 months of implementation. ` +
      `Book a discovery call or reply to ${config.contactEmail}.`;
    const bridgeLines = doc.splitTextToSize(bridge, pageW - margin * 2 - 8);
    doc.text(bridgeLines, margin + 4, y + 22);
    y += 88;

    // Assumptions
    doc.setFontSize(8);
    doc.setTextColor(muted);
    const assumptionText =
      `Assumptions: +${a.retentionImprovementPp}pp retention improvement (typical range +${a.retentionImprovementLowPp}–${a.retentionImprovementHighPp}pp); ` +
      `${Math.round(a.csrAutomatablePortion * 100)}% of renewal CSR tasks automatable; ` +
      `${Math.round(a.laborSavingsOfAutomatable * 100)}% reduction in CSR renewal labor cost. Conservative estimates for agencies in the $750K–$2.5M revenue band.`;
    const aLines = doc.splitTextToSize(assumptionText, pageW - margin * 2);
    doc.text(aLines, margin, y);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(muted);
    doc.text(
      `${config.brandName || "Cassian"} · Confidential estimate — not a formal proposal`,
      margin,
      doc.internal.pageSize.getHeight() - 28
    );

    return doc;
  }

  /**
   * Build PDF and return base64 for webhook upload (no browser download).
   * @param {Parameters<typeof buildRoiPdfDoc>[0]} opts
   * @returns {{ filename: string, pdfBase64: string } | null}
   */
  function buildRoiPdfBase64(opts) {
    const doc = buildRoiPdfDoc(opts);
    if (!doc) return null;
    const dataUri = doc.output("datauristring");
    const marker = "base64,";
    const idx = dataUri.indexOf(marker);
    const pdfBase64 = idx !== -1 ? dataUri.substring(idx + marker.length) : dataUri;
    return {
      filename: pdfFilename(opts.config || {}),
      pdfBase64,
    };
  }

  /**
   * Build and download the ROI report PDF in the browser.
   * @param {Parameters<typeof buildRoiPdfDoc>[0]} opts
   */
  function exportRoiPdf(opts) {
    const doc = buildRoiPdfDoc(opts);
    if (!doc) {
      alert("PDF library failed to load. Check your network connection and try again.");
      return;
    }
    doc.save(pdfFilename(opts.config || {}));
  }

  window.buildRoiPdfDoc = buildRoiPdfDoc;
  window.buildRoiPdfBase64 = buildRoiPdfBase64;
  window.exportRoiPdf = exportRoiPdf;
})();
