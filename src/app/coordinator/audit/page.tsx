"use client";

import { useState } from "react";
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
  const [logs] = useState<AuditLogItem[]>([
    {
      id: "log_1",
      timestamp: "2026-10-01 10:45:12",
      actor: "coord.manage@hacktrack.edu",
      action: "CPR_COUNT_UPDATED",
      entityType: "Edition",
      entityId: "ht26",
      previousState: JSON.stringify({ previousCprCount: 3 }, null, 2),
      newState: JSON.stringify({ newCprCount: 4 }, null, 2),
    },
    {
      id: "log_2",
      timestamp: "2026-10-01 10:40:05",
      actor: "coord.manage@hacktrack.edu",
      action: "RUBRIC_CONFIGURED",
      entityType: "Rubric",
      entityId: "rub_ideathon",
      previousState: JSON.stringify({ criteriaCount: 3, totalWeight: 100 }, null, 2),
      newState: JSON.stringify({ criteriaCount: 4, totalWeight: 100, anchorsConfigured: true }, null, 2),
    },
    {
      id: "log_3",
      timestamp: "2026-10-01 10:30:20",
      actor: "coord.manage@hacktrack.edu",
      action: "CSV_BULK_USERS_IMPORTED",
      entityType: "Invitation",
      entityId: "ht26",
      previousState: null,
      newState: JSON.stringify({ totalImported: 450, errorCount: 0, roles: "PARTICIPANT, MENTOR" }, null, 2),
    },
    {
      id: "log_4",
      timestamp: "2026-10-01 10:15:00",
      actor: "superadmin@hacktrack.edu",
      action: "EDITION_CLONED",
      entityType: "Edition",
      entityId: "ht26",
      previousState: JSON.stringify({ template: "ht25" }, null, 2),
      newState: JSON.stringify({ newEdition: "ht26", stagesCloned: 7 }, null, 2),
    },
  ]);

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
                {logs.map((item) => (
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
                ))}
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
