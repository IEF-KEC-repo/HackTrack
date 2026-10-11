# HackTrack — Phase Roadmap: Real Product, No Demo

This supersedes nothing already approved — finish the in-flight work (display_score monotonicity test, 48h grace period, doc sync) first. This document is what comes after that, in order. Do not skip ahead to a later phase while an earlier one still has unresolved items.

## Phase 0 (in progress, finish first)
- Add the monotonicity test for display_score vs normalizedScore (approved).
- Implement the 48h Slides broken-link grace period exactly as specified in the last prompt.
- Sync docs/02_SRS.md, 04_EVENT_GATE_PLAYBOOK.md, 05_OPEN_DECISIONS.md, 06_ARCHITECTURE_AND_ADRS.md to the real formula/features.
- Paste combined verification (vitest, tsc --noEmit, next build) after all three.

## Phase 1 — Public homepage (single-page marketing site)

Build a new public route (`/` or `/home`, whichever isn't already claimed by an authenticated redirect) as a polished single-page site — this is the front door, not an admin screen, so it should look designed, not like another dashboard page. Sections, in order:

1. **Hero** — event name, tagline, current edition, a prominent CTA ("Register Your Team" if registration is open, otherwise "Learn More")
2. **About the event** — what HackTrack/this program is: the annual, multi-month, gated accelerator pipeline (Ideathon → Innovatz → Continuous Reviews → POC → Demo Day), in plain, non-technical language for a prospective student
3. **About the organizers** — IEF@KEC (Innovation and Entrepreneurship Forum, Kongu Engineering College). Use **placeholder names/roles** for now (clearly marked as placeholder in a code comment, not literally shown as "placeholder" text to visitors — use realistic-sounding generic role titles like "Faculty Coordinator," "Student Lead" with blank/TBD names), real info to be swapped in later.
4. **Timeline** — pull live from the current edition's actual `Event` records (name, order, open/close dates) via a public (read-only, no-auth) API endpoint. If no edition is currently active/published, show a clear "next edition coming soon" state rather than an empty or broken section.
5. **FAQ** (optional but recommended, replaces the vague "forum" ask) — a few real Q&As about eligibility, team size, how evaluation works
6. **Footer** — contact/organizer info, same IEF@KEC placeholder content

**Login access:** a login button in the header (sticky/top) and again in the footer — both go to the existing real `/auth/login` route. Do not build a second auth system; this is just navigation into what already exists.

**Design standard:** this should look like a real event site — custom layout, not a reused dashboard shell. If a frontend-design approach/skill is available to you, use it. Responsive, accessible (this NFR was already specified — don't regress it for the new page).

**This is a new public route — it must not require authentication and must not expose anything beyond what's explicitly listed above** (no team data, no scores, no participant lists).

Acceptance: load the homepage logged out, see real event timeline data (not fixtures), click login from both header and footer, land on the real login page.

## Phase 2 — Eliminate every remaining demo/mock surface

Before touching the database connection, sweep the codebase for anything still fake, since "real credentials, nothing like a demo" was the explicit ask:
- The four pages flagged earlier with inline mock `useState` data (coordinator/analytics, coordinator/progress, coordinator/evaluations calibration samples, NotificationBell) — wire these to their real routes now if not already done.
- The login page's prefilled demo password (flagged earlier) — confirm this is gone; if not, remove it now.
- Any remaining seeded-user fallback, demo banner, or "Password123!" style seed credential that would ship to production — list anything like this explicitly so we can decide per-item whether it's dev-only (and properly gated) or must go entirely.
- Confirm Team Lead and Team Member are genuinely separate accounts/logins (not one shared team login) — each team member invited by email gets their own real credentials and session, with role (`PARTICIPANT_LEAD` vs `PARTICIPANT_MEMBER`) correctly scoping what they can do (lead: invite/remove members, submit/withdraw; member: everything except those).

Paste a list of every file touched and confirm the full verification suite still passes.

## Phase 3 — Go live on a real database (gated on DATABASE_URL being provided)

Once DATABASE_URL/DIRECT_URL are provided:
1. `prisma db push` (or migrate), seed with real role accounts (no "Password123!" in anything that isn't clearly local-dev-only and gitignored).
2. Run the full real end-to-end HTTP lifecycle from the earlier prompt: real signup → real login → real team creation → real idea submission → real evaluator assignment and scoring → real normalization/display_score output → real Coordinator gate decision → real audit log entry. Paste the actual request/response and DB rows at each step.
3. Paste the real COORDINATOR_VIEW-rejected-mutation 403 (this was blocked before only for lack of a real session).
4. Run the load-test-simulator for real against the live wired routes (not the in-process-only simulation noted earlier) at the target scale, paste real p95 latency.
5. Confirm the homepage's live timeline section renders real data from this database.

## Phase 4 — Final hardening before calling this "the product"

- Security pass: confirm no secrets in repo, confirm API RBAC is exercised with real requests (not just unit tests) against the live DB.
- Accessibility pass on the new homepage specifically (this is the one surface built this round that hasn't been audited yet).
- Deployment: stand this up on the recommended hosting (Vercel/Railway + the same Postgres) so there's an actual reachable URL, not just a passing local build.

## Reporting standard (unchanged)

Real output, diffs, and DB rows per phase, not narrative summaries. Report after each phase, not all four at once. If something is blocked (most obviously Phase 3 until DATABASE_URL arrives), say so plainly and move to whichever phase isn't blocked rather than guessing or faking the blocked part.
