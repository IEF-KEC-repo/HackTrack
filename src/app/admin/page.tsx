export default function AdminPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
            Super Admin Only
          </span>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Institutional Administration</h1>
          <p className="mt-1 text-sm text-slate-500">
            Cross-edition lifecycle provisioning, global role elevations, and immutable audit logs.
          </p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">Edition Lifecycle</h2>
          <p className="mt-1 text-xs text-slate-500">Currently Active: HackTrack 2026 (ht26)</p>
          <div className="mt-4 flex gap-2">
            <button className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500">
              + Clone Edition
            </button>
            <button className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              Archive Active
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">Global RBAC Elevation</h2>
          <p className="mt-1 text-xs text-slate-500">Assign Coordinator, Evaluator, or Mentor credentials.</p>
          <button className="mt-4 rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
            Generate Staff Invite Token
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">System Audit Trail</h2>
          <p className="mt-1 text-xs text-slate-500">Real-time log of security events and score overrides.</p>
          <span className="mt-4 inline-block text-xs font-medium text-indigo-600 hover:underline cursor-pointer">
            View All 1,420 Audit Records →
          </span>
        </div>
      </div>
    </div>
  );
}
