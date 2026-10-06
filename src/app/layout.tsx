import type { Metadata } from "next";
import "./globals.css";
import { NotificationBell } from "@/components/notifications/NotificationBell";

export const metadata: Metadata = {
  title: "HackTrack | Collegiate Innovation & Hackathon Management",
  description: "Enterprise hackathon platform supporting multi-edition lifecycle, rubrics, and normalization.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-slate-50 text-slate-900 antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white shadow-sm">
                HT
              </span>
              <div>
                <a href="/" className="text-lg font-bold tracking-tight text-slate-900 hover:text-indigo-600">
                  HackTrack
                </a>
                <span className="ml-2 inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                  Edition 2026
                </span>
              </div>
            </div>

            <nav aria-label="Main Navigation" className="flex items-center gap-4 text-sm font-medium text-slate-600">
              <a href="/coordinator" className="hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-2 py-1">
                Coordinator
              </a>
              <a href="/evaluator" className="hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-2 py-1">
                Evaluator
              </a>
              <a href="/mentor" className="hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-2 py-1">
                Mentor
              </a>
              <a href="/team" className="hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-2 py-1">
                Team
              </a>
              <NotificationBell />
              <a
                href="/auth/login"
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                Sign In
              </a>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
          <p>© 2026 HackTrack Collegiate Platform. Designed for high-scale, accessible hackathon operations.</p>
        </footer>
      </body>
    </html>
  );
}
