"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Public, unauthenticated Team-Lead self-registration.
 *
 * This is the route the homepage's "Register Your Team" CTA points to. It does
 * NOT use an invitation token: a first-time Team Lead submits a team name plus
 * their own name/email/password, and the backend creates the account, the team
 * (with them as LEAD + permanent registration code) and a real session.
 *
 * Staff roles (Coordinator/Evaluator/Mentor) and additional team members keep
 * using the invite-only path at /auth/register.
 */

const REGISTRATION_OPEN_EVENT_STATUSES = [
  "UPCOMING",
  "REGISTRATION_OPEN",
  "SUBMISSION_OPEN",
];

export default function TeamLeadRegistrationPage() {
  const router = useRouter();

  const [teamName, setTeamName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Optimistic: render the form immediately; the effect below switches to the
  // "closed" notice only if the edition's registration event says so. The
  // server-side gate remains authoritative either way.
  const [registrationOpen, setRegistrationOpen] = useState(true);

  // Mirror the server-side gate in the UI.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/timeline", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (data: { edition: unknown | null; events: Array<{ status: string }> } | null) => {
          if (cancelled) return;
          const firstStatus = data?.events?.[0]?.status ?? null;
          setRegistrationOpen(
            Boolean(data?.edition) &&
              firstStatus !== null &&
              REGISTRATION_OPEN_EVENT_STATUSES.includes(firstStatus)
          );
        }
      )
      .catch(() => {
        // If the public timeline can't be read, don't block the form — the
        // register-team endpoint still enforces the real gate.
        if (!cancelled) setRegistrationOpen(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName, name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }

      router.push(data.redirectUrl || "/team");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white shadow-sm">
            HT
          </span>
          <h1 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
            Register Your Team
          </h1>
          <p className="mt-1 text-center text-sm text-slate-600">
            Create your account and your team for HackTrack. You become the Team
            Lead — no invitation needed.
          </p>
        </div>

        {!registrationOpen ? (
          <div className="space-y-4">
            <div
              role="alert"
              className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
            >
              Team registration is currently closed for this edition. If you
              already have an account, sign in to access your team.
            </div>
            <a
              href="/auth/login"
              className="flex w-full justify-center rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Sign In
            </a>
          </div>
        ) : (
          <>
            {error && (
              <div
                role="alert"
                className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="teamName"
                  className="block text-sm font-medium text-slate-700"
                >
                  Team Name
                </label>
                <input
                  id="teamName"
                  type="text"
                  required
                  minLength={2}
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g. QuantumForge"
                />
              </div>

              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-slate-700"
                >
                  Your Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Ada Lovelace"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-slate-700"
                >
                  Institutional Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="you@kongu.edu"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Registration is open to @kongu.edu email addresses only.
                </p>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-700"
                >
                  Create Password (min 8 chars)
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? "Creating your team…" : "Register Your Team"}
              </button>
            </form>
          </>
        )}

        <p className="text-center text-xs text-slate-500">
          Already registered, or joining an existing team?{" "}
          <a
            href="/auth/login"
            className="font-semibold text-indigo-600 hover:text-indigo-500"
          >
            Sign in
          </a>
          .
        </p>
      </div>
    </div>
  );
}
