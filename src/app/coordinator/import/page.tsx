"use client";

import { useState } from "react";
import { CoordinatorShell } from "@/components/coordinator/CoordinatorShell";
import { ActionButton } from "@/components/coordinator/ActionButton";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { validateCsvRows, parseCsvText, CsvImportReport } from "@/lib/services/csv-import-service";

const SAMPLE_CSV = `email,name,role,team
priya.sharma@college.edu,Priya Sharma,PARTICIPANT,QuantumForge
liam.oconnor@college.edu,Liam O'Connor,PARTICIPANT,QuantumForge
alan.turing@college.edu,Alan Turing,MENTOR,
alex.rivera@college.edu,Alex Rivera,EVALUATOR,
sarah.jenkins@college.edu,Sarah Jenkins,COORDINATOR_VIEW,
marcus.vance@college.edu,Marcus Vance,COORDINATOR_MANAGE,
bad-email-format,John Doe,PARTICIPANT,
duplicate.user@college.edu,Dup One,PARTICIPANT,
duplicate.user@college.edu,Dup Two,PARTICIPANT,
no.name@college.edu,,EVALUATOR,
invalid.role@college.edu,Test User,SUPER_COORDINATOR,
`;

export default function BulkCsvImportPage() {
  const [csvContent, setCsvContent] = useState(SAMPLE_CSV);
  const [report, setReport] = useState<CsvImportReport | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const handleValidateAndImport = () => {
    setIsProcessing(true);
    setNotification(null);

    try {
      const { headers, rows } = parseCsvText(csvContent);
      const { validRows, errors } = validateCsvRows(headers, rows);

      const generatedTokens = validRows.map((r) => ({
        email: r.email,
        role: r.role,
        token: `inv_${Math.random().toString(36).substring(2, 12)}`,
      }));

      const newReport: CsvImportReport = {
        totalRows: rows.length,
        validCount: validRows.length,
        errorCount: errors.length,
        skippedDuplicates: 0,
        createdInvitationsCount: generatedTokens.length,
        errors,
        createdTokens: generatedTokens,
      };

      setReport(newReport);

      if (errors.length === 0) {
        setNotification({
          type: "success",
          msg: `Successfully validated and staged ${validRows.length} user invitations! Zero errors found.`,
        });
      } else {
        setNotification({
          type: "error",
          msg: `Import completed with ${errors.length} validation error(s). Review the detailed error report below.`,
        });
      }
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Failed to parse CSV." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "hacktrack_users_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <CoordinatorShell
      title="Bulk User CSV Ingestion & Onboarding"
      description="Import thousands of participants, mentors, and evaluators with automated role assignment and strict validation."
      action={
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadTemplate}>
            Download CSV Template
          </Button>
          <ActionButton onClick={handleValidateAndImport} isLoading={isProcessing}>
            Validate & Ingest CSV
          </ActionButton>
        </div>
      }
    >
      <div className="space-y-6">
        {notification && (
          <Alert variant={notification.type === "success" ? "success" : "error"} title="Ingestion Telemetry">
            {notification.msg}
          </Alert>
        )}

        {/* CSV Input Area */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Paste CSV Data</h2>
            <span className="text-xs text-slate-500">
              Columns: email, name, role (PARTICIPANT, MENTOR, EVALUATOR, COORDINATOR_VIEW, COORDINATOR_MANAGE)
            </span>
          </div>

          <textarea
            rows={8}
            value={csvContent}
            onChange={(e) => setCsvContent(e.target.value)}
            className="w-full font-mono text-xs rounded-md border border-slate-300 p-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="email,name,role,team..."
          />
        </div>

        {/* Execution Summary Cards */}
        {report && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-slate-500">Total Rows Processed</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{report.totalRows}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-slate-500">Valid Users Staged</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{report.validCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-slate-500">Validation Errors</p>
              <p className="mt-1 text-2xl font-bold text-rose-600">{report.errorCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-slate-500">Tokens Generated</p>
              <p className="mt-1 text-2xl font-bold text-indigo-600">{report.createdInvitationsCount}</p>
            </div>
          </div>
        )}

        {/* Line-by-Line Error Report Table */}
        {report && report.errors.length > 0 && (
          <div className="rounded-xl border border-rose-200 bg-white overflow-hidden shadow-sm">
            <div className="border-b border-rose-100 bg-rose-50 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-rose-900">
                  Validation Error Report ({report.errors.length} Issues Flagged)
                </h3>
                <p className="text-xs text-rose-700">These rows were skipped and require correction</p>
              </div>
              <Badge variant="danger">{report.errors.length} Critical Issues</Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-rose-100 text-xs">
                <thead className="bg-rose-50/50 text-rose-800">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 text-left font-semibold">Row #</th>
                    <th scope="col" className="px-4 py-2.5 text-left font-semibold">Email Target</th>
                    <th scope="col" className="px-4 py-2.5 text-left font-semibold">Field</th>
                    <th scope="col" className="px-4 py-2.5 text-left font-semibold">Failure Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-100 bg-white">
                  {report.errors.map((err, i) => (
                    <tr key={i} className="hover:bg-rose-50/20">
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-700">Line {err.row}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-900">{err.email}</td>
                      <td className="px-4 py-2.5 font-semibold text-rose-700">{err.field}</td>
                      <td className="px-4 py-2.5 text-rose-800">{err.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Staged Invitations Table */}
        {report && report.createdTokens.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">
                Staged Invitations Ready for Distribution ({report.createdTokens.length})
              </h3>
              <span className="text-xs text-slate-500">Invite tokens valid for 14 days</span>
            </div>

            <div className="overflow-x-auto max-h-72">
              <table className="min-w-full divide-y divide-slate-100 text-xs">
                <thead className="bg-slate-50 text-slate-700 sticky top-0">
                  <tr>
                    <th scope="col" className="px-4 py-2 text-left font-semibold">Recipient</th>
                    <th scope="col" className="px-4 py-2 text-left font-semibold">Assigned Role</th>
                    <th scope="col" className="px-4 py-2 text-left font-semibold">Redemption Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {report.createdTokens.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2 font-medium text-slate-900">{item.email}</td>
                      <td className="px-4 py-2">
                        <Badge
                          variant={
                            item.role === "COORDINATOR_MANAGE"
                              ? "purple"
                              : item.role === "COORDINATOR_VIEW"
                              ? "default"
                              : item.role === "EVALUATOR"
                              ? "info"
                              : item.role === "MENTOR"
                              ? "warning"
                              : "success"
                          }
                          size="sm"
                        >
                          {item.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 font-mono text-slate-500 select-all">
                        /auth/register?token={item.token}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </CoordinatorShell>
  );
}
