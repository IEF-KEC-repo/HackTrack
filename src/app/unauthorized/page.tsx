export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <span className="rounded-full bg-rose-100 p-3 text-rose-600 text-3xl">🚫</span>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
        403 — Access Denied
      </h1>
      <p className="mt-2 max-w-md text-sm text-slate-600">
        Your current edition role does not have authorization to view or modify this resource.
      </p>

      <div className="mt-6 flex gap-3">
        <a
          href="/"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          Return Home
        </a>
        <a
          href="/auth/login"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Sign In with Another Role
        </a>
      </div>
    </div>
  );
}
