"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      router.push(data.redirectUrl || "/");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const autofill = (userEmail: string) => {
    setEmail(userEmail);
    setPassword("");
    setError(null);
  };

  // Seeded-persona shortcuts are a developer convenience only. They are never
  // compiled into production builds unless NEXT_PUBLIC_ENABLE_DEMO_PERSONAS
  // is explicitly set (default: off).
  const DEMO_PERSONAS_ENABLED =
    process.env.NEXT_PUBLIC_ENABLE_DEMO_PERSONAS === "true";

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <span className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-indigo-600 font-bold text-white text-xl shadow-sm">
            HT
          </span>
          <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
            Sign in to HackTrack
          </h2>
          <p className="mt-1 text-center text-sm text-slate-600">
            Use the institutional email and password issued to your account.
          </p>
        </div>

        {error && (
          <div role="alert" className="rounded-md bg-rose-50 p-4 border border-rose-200 text-sm text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Institutional Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="user@hacktrack.edu"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
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
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        {DEMO_PERSONAS_ENABLED && (
          <div className="border-t border-slate-200 pt-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Testing Shortcuts (Autofill Seeded Personas):
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs [&>button]:focus:outline-none [&>button]:focus:ring-2 [&>button]:focus:ring-indigo-500">
              <button
                type="button"
                onClick={() => autofill("superadmin@hacktrack.edu")}
                className="rounded border border-purple-200 bg-purple-50 p-2 text-left text-purple-900 hover:bg-purple-100"
              >
                👑 Super Admin
              </button>
              <button
                type="button"
                onClick={() => autofill("coord.manage@hacktrack.edu")}
                className="rounded border border-blue-200 bg-blue-50 p-2 text-left text-blue-900 hover:bg-blue-100"
              >
                🛠️ Coord (Manage)
              </button>
              <button
                type="button"
                onClick={() => autofill("coord.view@hacktrack.edu")}
                className="rounded border border-slate-200 bg-slate-50 p-2 text-left text-slate-800 hover:bg-slate-100"
              >
                👁️ Coord (View)
              </button>
              <button
                type="button"
                onClick={() => autofill("evaluator@hacktrack.edu")}
                className="rounded border border-emerald-200 bg-emerald-50 p-2 text-left text-emerald-900 hover:bg-emerald-100"
              >
                ⚖️ Evaluator
              </button>
              <button
                type="button"
                onClick={() => autofill("mentor@hacktrack.edu")}
                className="rounded border border-amber-200 bg-amber-50 p-2 text-left text-amber-900 hover:bg-amber-100"
              >
                🧭 Mentor
              </button>
              <button
                type="button"
                onClick={() => autofill("lead@hacktrack.edu")}
                className="rounded border border-indigo-200 bg-indigo-50 p-2 text-left text-indigo-900 hover:bg-indigo-100"
              >
                🚀 Team Lead
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
