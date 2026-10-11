"use client";

import { useEffect, useState } from "react";
import { CoordinatorShell } from "@/components/coordinator/CoordinatorShell";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface AuditLogItem {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  previousState?: string | null;
  newState?: string | null;
}

export default function AuditTrailPage() {
  // Audit trail loaded live from recorded audit logs (no fabricated entries).
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/coordinator/audit-logs");
        if (!res.ok) throw new Error("Failed to load the audit trail.");
        const data = await res.json();
        if (!active) return;
        setLogs(
          (data.logs || []).map((log: any) => ({
            id: log.id,
            timestamp: log.createdAt
              ? new Date(log.createdAt).toISOString().slice(0, 19).replace("T", " ")
              : "—",
            actor: log.actor?.email || "System",
            action: log.action,
            entityType: log.entityType,
            entityId: log.entityId,
            previousState: log.previousState ?? null,
            newState: log.newState ?? null,
          }))
        );
      } catch (err: any) {
        if (active) setLogsError(err?.message || "Failed to load the audit trail.");
      } finally {
        if (active) setLogsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const getActionBadgeVariant = (action: string) => {
    if (action.includes("CLONED")) return "purple" as const;
    if (action.includes("CPR")) return "info" as const;
    if (action.includes("RUBRIC")) return "success" as const;
    if (action.includes("CSV")) return "warning" as const;
    return "default" as const;
  };

  return (
    <CoordinatorShell
      title="Immutable Audit Trail & Governance"
      description="Cryptographic timeline of all stage changes, rubric revisions, user imports, and gate promotions. Read-only for all staff tiers."
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-4 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">
              Audit Event Log ({logs.length} Recorded Entries)
            </h3>
            <span className="text-xs text-slate-500">Immutable Append-Only Record</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left font-semibold">Timestamp (UTC)</th>
                  <th scope="col" className="px-6 py-3 text-left font-semibold">Actor</th>
                  <th scope="col" className="px-6 py-3 text-left font-semibold">Action</th>
                  <th scope="col" className="px-6 py-3 text-left font-semibold">Entity Type</th>
                  <th scope="col" className="px-6 py-3 text-right font-semibold">State Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {logsLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                      Loading the live audit trail…
                    </td>
                  </tr>
                ) : logsError ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-rose-600">
                      {logsError}
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                      No audited operations recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3.5 font-mono text-slate-500">{item.timestamp}</td>
                    <td className="px-6 py-3.5 font-medium text-slate-900">{item.actor}</td>
                    <td className="px-6 py-3.5">
                      <Badge variant={getActionBadgeVariant(item.action)} size="sm">
                        {item.action}
                      </Badge>
                    </td>
                    <td className="px-6 py-3.5 text-slate-600 font-mono">
                      {item.entityType} ({item.entityId})
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelectedLog(item)}>
                        Inspect Diff
                      </Button>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* State Diff Inspection Modal */}
      {selectedLog && (
        <Modal
          isOpen={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title={`Audit Record: ${selectedLog.action}`}
          description={`Actor: ${selectedLog.actor} • ${selectedLog.timestamp}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold text-slate-700 uppercase mb-1">Previous State:</p>
                <pre className="rounded bg-slate-900 text-slate-100 p-3 text-xs font-mono overflow-x-auto max-h-56">
                  {selectedLog.previousState || "null (Initial creation)"}
                </pre>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700 uppercase mb-1">New State:</p>
                <pre className="rounded bg-slate-900 text-slate-100 p-3 text-xs font-mono overflow-x-auto max-h-56">
                  {selectedLog.newState || "null"}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button onClick={() => setSelectedLog(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </CoordinatorShell>
  );
}
