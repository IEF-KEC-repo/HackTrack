"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected errors
    console.error("[HackTrack Global Error Boundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-5">
        <div className="h-16 w-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-3xl">
          ⚠️
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-900">Something went wrong</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            An unexpected error occurred in the collegiate platform. The issue has been logged for system administrators.
          </p>
          {error.digest && (
            <p className="text-[10px] font-mono text-slate-400">
              Error Digest: {error.digest}
            </p>
          )}
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="primary"
            size="sm"
            onClick={() => reset()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            Try Again 🔄
          </Button>
          <a href="/">
            <Button variant="secondary" size="sm" className="w-full sm:w-auto">
              Return Home 🏠
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
