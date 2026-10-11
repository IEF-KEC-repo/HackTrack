"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  Award,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  GitBranch,
  GraduationCap,
  Lightbulb,
  Menu,
  Rocket,
  Users,
  X,
} from "lucide-react";

// ------------------------------------------------------------
// Data types mirroring the public timeline API
// ------------------------------------------------------------
interface PublicEdition {
  id: string;
  name: string;
  slug: string;
  academicYear: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  startDate: string | null;
  endDate: string | null;
}

interface TimelineEvent {
  id: string;
  name: string;
  slug: string;
  sequenceIndex: number;
  status: string;
  reviewType: "ASYNC_MULTI_REVIEWER" | "LIVE_PANEL";
  submissionDeadline: string | null;
  evaluationDeadline: string | null;
}

interface TimelineResponse {
  edition: PublicEdition | null;
  events: TimelineEvent[];
  error?: string;
}

const EVENT_STATUS_LABELS: Record<string, string> = {
  UPCOMING: "Upcoming",
  REGISTRATION_OPEN: "Registration Open",
  SUBMISSION_OPEN: "Submissions Open",
  SUBMISSION_LOCKED: "Submissions Locked",
  EVALUATION_ACTIVE: "Evaluation Active",
  EVALUATION_LOCKED: "Evaluation Locked",
  COMPLETED: "Completed",
};

const STAGE_ACCENTS = [
  "from-indigo-500 to-blue-500",
  "from-sky-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-fuchsia-500 to-purple-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-violet-500 to-indigo-500",
];

function formatDate(iso: string | null): string {
  if (!iso) return "TBA";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBA";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(status: string): string {
  return EVENT_STATUS_LABELS[status] || status.replace(/_/g, " ");
}

function statusTone(status: string): string {
  if (status === "COMPLETED") return "bg-slate-100 text-slate-600 ring-slate-200";
  if (status.includes("OPEN") || status === "EVALUATION_ACTIVE")
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status.includes("LOCKED"))
    return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-slate-50 text-slate-600 ring-slate-200";
}

// ------------------------------------------------------------
// Homepage
// ------------------------------------------------------------
export default function HomePage() {
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/public/timeline", { cache: "no-store" });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data: TimelineResponse = await res.json();
        if (active) {
          setTimeline(data);
          setError(null);
        }
      } catch (err: any) {
        if (active) setError(err?.message || "Could not load the timeline.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Close the mobile menu with the Escape key for keyboard users.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileNavOpen]);

  const edition = timeline?.edition ?? null;
  const events = timeline?.events ?? [];
  const editionLine = edition
    ? `${edition.name} (${edition.slug})`
    : "Live Edition";

  return (
    <div className="flex min-h-full flex-col bg-white">
      {/* Skip link: lands keyboard/SR users directly in the main content */}
      <a
        href="#top"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white focus:shadow-lg focus:ring-2 focus:ring-white"
      >
        Skip to content
      </a>
      {/* ============================= HEADER ============================= */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <a
            href="#top"
            className="flex items-center gap-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 font-extrabold text-white shadow-sm">
              HT
            </span>
            <span className="text-lg font-extrabold tracking-tight text-slate-900">
              HackTrack
            </span>
          </a>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex"
          >
            {[
              ["About", "#about"],
              ["Pipeline", "#pipeline"],
              ["Organizers", "#organizers"],
              ["FAQ", "#faq"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded px-1 py-1 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {label}
              </a>
            ))}
            <a
              href="/auth/login"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              Login
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </nav>

          <button
            type="button"
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 md:hidden"
            aria-label="Toggle navigation menu"
            aria-controls="mobile-navigation"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((v) => !v)}
          >
            {mobileNavOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>

        {mobileNavOpen && (
          <nav
            id="mobile-navigation"
            aria-label="Mobile"
            className="border-t border-slate-200 bg-white px-4 py-3 md:hidden"
          >
            {[
              ["About", "#about"],
              ["Pipeline", "#pipeline"],
              ["Organizers", "#organizers"],
              ["FAQ", "#faq"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={() => setMobileNavOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset"
              >
                {label}
              </a>
            ))}
            <a
              href="/auth/login"
              className="mt-2 block rounded-lg bg-indigo-600 px-3 py-2.5 text-center text-sm font-bold text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-inset"
            >
              Login
            </a>
          </nav>
        )}
      </header>

      <main id="top">
        {/* ============================= HERO ============================= */}
        <section className="relative overflow-hidden bg-slate-950">
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{
              backgroundImage:
                "radial-gradient(60% 60% at 20% 20%, rgba(99,102,241,0.35) 0%, transparent 60%), radial-gradient(50% 50% at 85% 30%, rgba(168,85,247,0.25) 0%, transparent 60%), radial-gradient(60% 60% at 50% 100%, rgba(34,211,238,0.12) 0%, transparent 55%)",
            }}
          />
          <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-indigo-200">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Live Edition: {editionLine}
            </div>

            <h1 className="mt-6 max-w-3xl text-4xl font-black leading-tight tracking-tight text-white sm:text-6xl">
              Where collegiate ideas become{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
                shipping products
              </span>
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              HackTrack is the annual multi-month innovation program of the
              Innovation and Entrepreneurship Forum, Kongu Engineering College.
              Teams move through a gated pipeline of evaluated stages, from a
              1-minute pitch in Ideathon all the way to Demo Day — with
              structured reviews, mentorship, and fair scoring at every gate.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a
                href="/auth/login"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                Access the Portal
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href="#pipeline"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white"
              >
                <GitBranch className="h-4 w-4" aria-hidden="true" />
                View the Pipeline
              </a>
            </div>

            <dl className="mt-14 grid max-w-3xl grid-cols-2 gap-6 border-t border-white/10 pt-8 sm:grid-cols-4">
              {[
                { icon: GitBranch, label: "Gated Stages", value: events.length ? `${events.length}` : "7" },
                { icon: CalendarDays, label: "Program Window", value: "Aug – Nov" },
                { icon: Users, label: "Team Size", value: "1 – 6" },
                { icon: Award, label: "Evaluation", value: "Panel + Jury" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label}>
                  <Icon className="h-5 w-5 text-indigo-300" aria-hidden="true" />
                  <dt className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {label}
                  </dt>
                  <dd className="mt-0.5 text-xl font-extrabold text-white">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ============================= ABOUT ============================= */}
        <section id="about" className="bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                  About the Program
                </span>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                  An annual, multi-month journey with a gate at every step
                </h2>
                <p className="mt-5 text-base leading-relaxed text-slate-600">
                  HackTrack runs once a year across a full semester. Every team
                  that registers enters a carefully designed pipeline where each
                  stage must be cleared before the next one opens. Nothing is
                  left to vibes — progress is tracked, cadence is checked, and
                  every evaluation uses a shared rubric with normalized scoring.
                </p>
                <p className="mt-4 text-base leading-relaxed text-slate-600">
                  The five gates of the program take a raw idea, pressure-test
                  it against mentors and panellists, and grow it into a working
                  proof of concept presented on Demo Day.
                </p>
              </div>

              <ol className="space-y-4">
                {[
                  {
                    icon: Lightbulb,
                    title: "Ideathon",
                    text: "36 hours to pitch and prototype your idea in front of a review panel.",
                  },
                  {
                    icon: Rocket,
                    title: "Innovatz",
                    text: "An innovation sprint that selects the ideas strong enough to keep building.",
                  },
                  {
                    icon: GitBranch,
                    title: "Continuous Reviews",
                    text: "Rolling project reviews with fortnightly mentor check-ins to keep teams moving.",
                  },
                  {
                    icon: CheckCircle2,
                    title: "POC",
                    text: "Teams convert the validated concept into a demonstrable proof of concept.",
                  },
                  {
                    icon: Award,
                    title: "Demo Day",
                    text: "The grand showcase where the strongest POCs are presented to the jury.",
                  },
                ].map(({ icon: Icon, title, text }, idx) => (
                  <li
                    key={title}
                    className="group flex gap-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-5 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
                  >
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-black text-slate-900">
                        <span className="mr-2 text-indigo-500">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        {title}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">
                        {text}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ============================= TIMELINE ============================= */}
        <section id="pipeline" className="bg-slate-950 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">
                Stage Timeline
              </span>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
                {edition ? `The ${edition.name} calendar` : "The live edition calendar"}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-400">
                Every stage, its current status, and its deadline — pulled live
                from the program database.
              </p>
            </div>

            <div className="mt-12">
              {loading ? (
                <div
                  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  aria-busy="true"
                  aria-label="Loading the event timeline"
                >
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="h-40 animate-pulse rounded-2xl border border-slate-800 bg-slate-900"
                    />
                  ))}
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-8 text-center">
                  <p className="text-sm font-bold text-rose-300">
                    The timeline could not be loaded.
                  </p>
                  <p className="mt-1 text-sm text-slate-400">{error}</p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="mt-4 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-rose-300"
                  >
                    Retry
                  </button>
                </div>
              ) : events.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
                  <CalendarDays className="mx-auto h-10 w-10 text-slate-500" aria-hidden="true" />
                  <p className="mt-4 text-base font-black text-white">
                    No active edition right now
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
                    The stage calendar for the next HackTrack program will be
                    published here as soon as registrations open.
                  </p>
                </div>
              ) : (
                <ol className="relative space-y-6">
                  {events.map((event, idx) => (
                    <li key={event.id} className="relative flex gap-5 sm:gap-7">
                      <div className="flex flex-col items-center">
                        <span
                          className={`z-10 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${STAGE_ACCENTS[idx % STAGE_ACCENTS.length]} text-sm font-black text-white shadow-lg`}
                        >
                          {event.sequenceIndex}
                        </span>
                        {idx < events.length - 1 && (
                          <span
                            className="mt-2 w-px flex-1 bg-gradient-to-b from-white/25 to-white/5"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <div className="flex-1 rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-white/20 hover:bg-white/[0.07] sm:p-6">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-base font-black text-white">
                            {event.name}
                          </h3>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${statusTone(event.status)}`}
                          >
                            {statusLabel(event.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-400">
                          {event.reviewType === "ASYNC_MULTI_REVIEWER"
                            ? "Asynchronous multi-reviewer"
                            : "Live panel evaluation"}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-300">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-4 w-4 text-indigo-400" aria-hidden="true" />
                            Submission: {formatDate(event.submissionDeadline)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                            Evaluation: {formatDate(event.evaluationDeadline)}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </section>

        {/* ============================= ORGANIZERS ============================= */}
        <section id="organizers" className="bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                Organizers
              </span>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                Driven by the Innovation and Entrepreneurship Forum
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                HackTrack is run by IEF@KEC — the Innovation and
                Entrepreneurship Forum of Kongu Engineering College — which
                prepares students to build, validate, and present real products.
              </p>
            </div>

            <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-8 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md">
                  <GraduationCap className="h-7 w-7" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-black text-slate-900">
                  Faculty Coordinator
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Program stewardship, academic liaison, and mentorship of the
                  student leadership team.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-8 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md">
                  <Users className="h-7 w-7" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-black text-slate-900">
                  Student Lead
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Day-to-day operations, stage execution, and the core team of
                  event captains behind each gate.
                </p>
              </div>
            </div>

            <div className="mx-auto mt-10 flex max-w-4xl items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <Building2 className="h-6 w-6 text-indigo-600" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-700">
                Kongu Engineering College · Perundurai, Erode — Innovation and
                Entrepreneurship Forum (IEF), Cell for Innovation and
                Entrepreneurship Development.
              </p>
            </div>
          </div>
        </section>

        {/* ============================= FAQ ============================= */}
        <section id="faq" className="bg-slate-50 py-20 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                FAQ
              </span>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                Common questions
              </h2>
            </div>

            <div className="mt-12 space-y-4">
              {[
                {
                  q: "Who can participate?",
                  a: "HackTrack is open to students of Kongu Engineering College. Each edition announces its eligibility window when registrations open — most stages are open to students from any branch or year.",
                },
                {
                  q: "How large can a team be?",
                  a: "Teams can have anywhere between 1 and 6 members. Solos are completely allowed — a strong single contributor can move through the entire pipeline on their own.",
                },
                {
                  q: "How is evaluation done?",
                  a: "Every stage uses a defined rubric. Async stages are scored independently by multiple evaluators and normalized to remove harshness or leniency bias; live stages are judged by a panel. Feedback is released to teams once locked.",
                },
                {
                  q: "What happens between stages?",
                  a: "Selected teams continue with mentor support and fortnightly check-ins. Progress milestones and slide submissions are tracked on the portal, and coordinators monitor the health of every team.",
                },
              ].map(({ q, a }) => (
                <details
                  key={q}
                  className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm open:border-indigo-300"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg text-sm font-black text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 [&::-webkit-details-marker]:hidden">
                    {q}
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 transition-transform group-open:rotate-180">
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    {a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ============================= FOOTER ============================= */}
      <footer className="border-t border-slate-800 bg-slate-950 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row md:items-start">
            <div className="max-w-sm text-center md:text-left">
              <a
                href="#top"
                className="inline-flex items-center gap-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 font-extrabold text-white">
                  HT
                </span>
                <span className="text-lg font-extrabold tracking-tight text-white">
                  HackTrack
                </span>
              </a>
              <p className="mt-4 text-sm text-slate-400">
                Innovation and Entrepreneurship Forum (IEF@KEC), Kongu
                Engineering College. For participant queries contact the
                IEF@KEC student coordinators at the Innovation and
                Entrepreneurship Development Cell.
              </p>
            </div>

            <div className="flex flex-col items-center gap-4">
              <a
                href="/auth/login"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                Login to the Portal
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href="#top"
                className="rounded text-xs font-semibold text-slate-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                Back to top ↑
              </a>
            </div>
          </div>

          <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-slate-400">
            <p>
              © {new Date().getFullYear()} HackTrack · IEF@KEC · Kongu
              Engineering College
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}