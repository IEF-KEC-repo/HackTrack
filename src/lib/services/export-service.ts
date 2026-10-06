/**
 * Export Engine: RFC 4180 CSV Generator & Printable HTML Report Engine
 * Guarantees 100% numerical parity between on-screen numbers and exported files.
 */

export interface ExportTeamIdeaItem {
  regCode: string;
  name: string;
  track?: string | null;
  status: string;
  leadName?: string;
  leadEmail?: string;
  memberCount: number;
  slidesUrl?: string | null;
  problemStatement?: string | null;
  solutionAbstract?: string | null;
  techStack?: string | null;
  githubUrl?: string | null;
}

export interface ExportScoreRecordItem {
  rank: number;
  regCode: string;
  teamName: string;
  track: string;
  rawAverageScore: number;
  normalizedScore: number;
  zScoreMean: number;
  evaluatorCount: number;
  rankShift: number; // e.g. +3, -1, 0
  tieBreakReason?: string | null;
  stageDecision?: string | null;
}

export interface ExportRubricFeedbackItem {
  regCode: string;
  teamName: string;
  eventName: string;
  evaluatorName: string;
  criterionTitle: string;
  weightPercentage: number;
  criterionScore: number;
  maxPoints: number;
  writtenFeedback?: string | null;
  coordinatorReason?: string | null;
}

export interface ExportMilestoneItem {
  regCode: string;
  teamName: string;
  milestoneTitle: string;
  source: "COORDINATOR_MANDATORY" | "TEAM_CUSTOM";
  dueDate: string;
  status: string;
  submittedAt?: string | null;
  isOverdue: boolean;
  daysOverdue: number;
  evidenceType?: string | null;
  evidenceUrl?: string | null;
}

/**
 * Escapes a cell value according to RFC 4180:
 * - Wrap in quotes if it contains commas, double quotes, or newlines.
 * - Double up any double quotes inside the string.
 */
export function escapeCsvCell(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Builds an RFC 4180 CSV string with UTF-8 Byte Order Mark (BOM) for Excel compatibility.
 */
export function buildCsv(headers: string[], rows: any[][]): string {
  const BOM = "\uFEFF";
  const headerLine = headers.map(escapeCsvCell).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(","));
  return BOM + [headerLine, ...dataLines].join("\r\n");
}

/**
 * Exports Ideas and Teams to CSV.
 */
export function exportIdeasToCsv(teams: ExportTeamIdeaItem[]): string {
  const headers = [
    "Registration Code",
    "Team Name",
    "Track",
    "Team Status",
    "Team Lead Name",
    "Team Lead Email",
    "Member Count",
    "Google Slides URL",
    "Problem Statement",
    "Solution Abstract",
    "Tech Stack",
    "GitHub URL",
  ];

  const rows = teams.map((t) => [
    t.regCode,
    t.name,
    t.track || "General",
    t.status,
    t.leadName || "N/A",
    t.leadEmail || "N/A",
    t.memberCount,
    t.slidesUrl || "Not Submitted",
    t.problemStatement || "",
    t.solutionAbstract || "",
    t.techStack || "",
    t.githubUrl || "",
  ]);

  return buildCsv(headers, rows);
}

/**
 * Exports Scores, Z-Score Normalization & Rankings to CSV.
 * Acceptance: Exported numbers match on-screen numbers with 100% numerical parity.
 */
export function exportScoresToCsv(records: ExportScoreRecordItem[]): string {
  const headers = [
    "Official Rank",
    "Registration Code",
    "Team Name",
    "Track",
    "Normalized Score",
    "Raw Average Score",
    "Mean Z-Score",
    "Evaluators Count",
    "Rank Shift",
    "Tie-Break Resolution",
    "Stage Decision",
  ];

  const rows = records.map((r) => [
    r.rank,
    r.regCode,
    r.teamName,
    r.track,
    // Match exact on-screen format (2 decimal precision)
    r.normalizedScore.toFixed(2),
    r.rawAverageScore.toFixed(2),
    r.zScoreMean >= 0 ? `+${r.zScoreMean.toFixed(3)}` : r.zScoreMean.toFixed(3),
    r.evaluatorCount,
    r.rankShift > 0 ? `+${r.rankShift}` : r.rankShift < 0 ? `${r.rankShift}` : "0",
    r.tieBreakReason || "Direct Score Differential",
    r.stageDecision || "Pending",
  ]);

  return buildCsv(headers, rows);
}

/**
 * Exports Rubric Criteria ratings & written commentary to CSV.
 */
export function exportFeedbackToCsv(items: ExportRubricFeedbackItem[]): string {
  const headers = [
    "Registration Code",
    "Team Name",
    "Event Stage",
    "Evaluator Name",
    "Criterion",
    "Weight (%)",
    "Score Awarded",
    "Max Points",
    "Written Feedback",
    "Coordinator Reopen Rationale",
  ];

  const rows = items.map((f) => [
    f.regCode,
    f.teamName,
    f.eventName,
    f.evaluatorName,
    f.criterionTitle,
    `${f.weightPercentage}%`,
    f.criterionScore.toFixed(1),
    f.maxPoints,
    f.writtenFeedback || "",
    f.coordinatorReason || "",
  ]);

  return buildCsv(headers, rows);
}

/**
 * Exports Milestones & Deliverables to CSV.
 */
export function exportMilestonesToCsv(milestones: ExportMilestoneItem[]): string {
  const headers = [
    "Registration Code",
    "Team Name",
    "Milestone Title",
    "Category",
    "Due Date",
    "Status",
    "Submitted At",
    "Overdue?",
    "Days Overdue",
    "Evidence Type",
    "Evidence URL",
  ];

  const rows = milestones.map((m) => [
    m.regCode,
    m.teamName,
    m.milestoneTitle,
    m.source === "COORDINATOR_MANDATORY" ? "Mandatory Deliverable" : "Custom Team Milestone",
    m.dueDate,
    m.status,
    m.submittedAt || "Unsubmitted",
    m.isOverdue ? "YES" : "NO",
    m.daysOverdue,
    m.evidenceType || "N/A",
    m.evidenceUrl || "",
  ]);

  return buildCsv(headers, rows);
}

/**
 * Generates clean, printer-optimized HTML markup for browser PDF printing.
 */
export function generatePrintableHtmlReport(params: {
  reportTitle: string;
  editionName: string;
  eventName?: string;
  generatedBy: string;
  tableHeaders: string[];
  tableRows: string[][];
  summaryCards?: Array<{ label: string; value: string | number }>;
}): string {
  const { reportTitle, editionName, eventName, generatedBy, tableHeaders, tableRows, summaryCards = [] } = params;
  const now = new Date().toLocaleString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${reportTitle} — ${editionName}</title>
  <style>
    @page { size: A4 landscape; margin: 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; font-size: 11pt; line-height: 1.4; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 20pt; font-weight: 800; margin: 0; color: #0f172a; }
    .meta { font-size: 9pt; color: #64748b; text-align: right; }
    .summary-grid { display: flex; gap: 16px; margin-bottom: 24px; }
    .summary-card { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; background: #f8fafc; }
    .card-label { font-size: 8pt; text-transform: uppercase; color: #64748b; font-weight: 700; }
    .card-val { font-size: 16pt; font-weight: 800; color: #0f172a; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10pt; }
    th { background: #f1f5f9; color: #334155; font-weight: 700; text-align: left; padding: 8px 10px; border-bottom: 2px solid #cbd5e1; }
    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background-color: #f8fafc; }
    .podium-1 { background-color: #fef9c3 !important; font-weight: bold; }
    .podium-2 { background-color: #f1f5f9 !important; font-weight: bold; }
    .podium-3 { background-color: #ffedd5 !important; font-weight: bold; }
    .footer { margin-top: 30px; font-size: 8pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; display: flex; justify-content: space-between; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">${reportTitle}</h1>
      <p style="margin: 4px 0 0 0; color: #475569; font-weight: 600;">${editionName}${eventName ? ` — ${eventName}` : ""}</p>
    </div>
    <div class="meta">
      <div>Generated By: <strong>${generatedBy}</strong></div>
      <div>Date: ${now}</div>
      <div>Official Collegiate Record</div>
    </div>
  </div>

  ${
    summaryCards.length > 0
      ? `<div class="summary-grid">
      ${summaryCards
        .map(
          (c) => `<div class="summary-card">
        <div class="card-label">${c.label}</div>
        <div class="card-val">${c.value}</div>
      </div>`
        )
        .join("")}
    </div>`
      : ""
  }

  <table>
    <thead>
      <tr>
        ${tableHeaders.map((h) => `<th>${h}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${tableRows
        .map((row, idx) => {
          const podiumClass = idx === 0 ? ' class="podium-1"' : idx === 1 ? ' class="podium-2"' : idx === 2 ? ' class="podium-3"' : "";
          return `<tr${podiumClass}>
            ${row.map((cell) => `<td>${cell}</td>`).join("")}
          </tr>`;
        })
        .join("")}
    </tbody>
  </table>

  <div class="footer">
    <span>HackTrack Collegiate Platform — Official Audit Report</span>
    <span>Page 1 of 1</span>
  </div>

  <script>
    if (window.location.search.includes("autoprint=true")) {
      window.print();
    }
  </script>
</body>
</html>`;
}
