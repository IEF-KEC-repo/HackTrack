export default function CoordinatorManagePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
            Coordinator (Manage) Restricted Zone
          </span>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Operational Controls & Action Center</h1>
          <p className="mt-1 text-sm text-slate-500">
            CRUD operations, automated 3-reviewer allocation, dynamic rubrics, and Z-score normalization.
          </p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Ideathon 3-Reviewer Allocation Engine</h2>
          <p className="mt-1 text-sm text-slate-600">
            Distribute 300 ideas across evaluators ensuring 3 distinct reviews per idea with conflict-of-interest checks.
          </p>
          <div className="mt-4 flex gap-3">
            <button className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500">
              Run Balanced Allocation
            </button>
            <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Inspect Distribution
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Score Normalization (Z-Score)</h2>
          <p className="mt-1 text-sm text-slate-600">
            Standardize grades across lenient and strict evaluators and compute cohort scaled rankings.
          </p>
          <div className="mt-4 flex gap-3">
            <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500">
              Execute Z-Score Normalization
            </button>
            <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Preview Cutoff Leaderboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
