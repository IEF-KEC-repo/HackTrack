export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-2xl bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 p-8 text-white shadow-xl sm:p-12">
        <span className="inline-flex items-center rounded-full bg-indigo-500/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-200 ring-1 ring-inset ring-indigo-400/30">
          HackTrack 2026 Active
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl">
          Collegiate Innovation & Multi-Stage Hackathon Engine
        </h1>
        <p className="mt-4 max-w-3xl text-base text-indigo-100 sm:text-lg">
          Guiding 1,000+ participants across 300 multidisciplinary teams through the structured pipeline:
          Ideathon → Innovatz → Continuous Project Reviews → POC → Demo Day.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <a
            href="/auth/login"
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-700"
          >
            Access Portal
          </a>
          <a
            href="/auth/register"
            className="rounded-lg border border-indigo-300/40 bg-indigo-900/40 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-indigo-900/60 focus:outline-none focus:ring-2 focus:ring-white"
          >
            Redeem Invite Token
          </a>
        </div>
      </div>

      {/* Role Quick Access Matrix */}
      <section className="mt-12" aria-labelledby="roles-heading">
        <h2 id="roles-heading" className="text-xl font-bold text-slate-900">
          Platform Role Workspaces & RBAC Boundaries
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Every role is constrained strictly to its authorized views and mutation boundaries.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-indigo-400 transition-colors">
            <span className="inline-block rounded-md bg-purple-100 p-2 text-purple-700 font-semibold text-xs">
              Super Admin
            </span>
            <h3 className="mt-3 text-lg font-semibold text-slate-900">Super Admin Console</h3>
            <p className="mt-1 text-sm text-slate-600">
              Edition lifecycle provisioning, role assignments, system-wide settings, and audit logs.
            </p>
            <a href="/admin" className="mt-4 inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500">
              Open Admin Panel →
            </a>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-indigo-400 transition-colors">
            <span className="inline-block rounded-md bg-blue-100 p-2 text-blue-700 font-semibold text-xs">
              Coordinator (Manage)
            </span>
            <h3 className="mt-3 text-lg font-semibold text-slate-900">Operations Control</h3>
            <p className="mt-1 text-sm text-slate-600">
              Event pipeline setup, 3-reviewer allocation, rubric building, and Z-score normalization.
            </p>
            <a href="/coordinator/manage" className="mt-4 inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500">
              Open Coordinator Manage →
            </a>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-indigo-400 transition-colors">
            <span className="inline-block rounded-md bg-slate-100 p-2 text-slate-700 font-semibold text-xs">
              Coordinator (View)
            </span>
            <h3 className="mt-3 text-lg font-semibold text-slate-900">Executive Overview</h3>
            <p className="mt-1 text-sm text-slate-600">
              Read-only macro visibility across all stage completions, live scoreboards, and CSV exports.
            </p>
            <a href="/coordinator" className="mt-4 inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500">
              Open Coordinator View →
            </a>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-indigo-400 transition-colors">
            <span className="inline-block rounded-md bg-emerald-100 p-2 text-emerald-700 font-semibold text-xs">
              Evaluator
            </span>
            <h3 className="mt-3 text-lg font-semibold text-slate-900">Split-Screen Cockpit</h3>
            <p className="mt-1 text-sm text-slate-600">
              Embedded Google Slides viewer on left, dynamic weighted rubric scoring on right.
            </p>
            <a href="/evaluator" className="mt-4 inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500">
              Open Evaluator Cockpit →
            </a>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-indigo-400 transition-colors">
            <span className="inline-block rounded-md bg-amber-100 p-2 text-amber-700 font-semibold text-xs">
              Mentor
            </span>
            <h3 className="mt-3 text-lg font-semibold text-slate-900">Mentorship Workspace</h3>
            <p className="mt-1 text-sm text-slate-600">
              Dedicated assigned team roster, CPR milestone trackers, and bi-weekly check-in logging.
            </p>
            <a href="/mentor" className="mt-4 inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500">
              Open Mentor Dashboard →
            </a>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-indigo-400 transition-colors">
            <span className="inline-block rounded-md bg-indigo-100 p-2 text-indigo-700 font-semibold text-xs">
              Participant
            </span>
            <h3 className="mt-3 text-lg font-semibold text-slate-900">Team Hub</h3>
            <p className="mt-1 text-sm text-slate-600">
              Auto-assigned registration code, Google Slides link embedding, and milestone board.
            </p>
            <a href="/team" className="mt-4 inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-500">
              Open Team Hub →
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
