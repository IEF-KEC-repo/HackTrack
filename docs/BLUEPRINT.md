# Hackathon Series Platform: Blueprint

Structure, documentation requirements and phase-by-phase build prompts.
**Final v1: personalised for 1,000+ participants per edition, teams of 1 to 6, single college, annual editions.**
Remaining items marked **(Assumption)** are minor defaults you can change anytime — every decision that mattered has been resolved (see section 13).

---

## 1. Purpose and scope

A web platform that runs a series of hackathons, each lasting about 6 months from idea registration to working prototype, with multiple review gates.

**Goals**
- One place for registration, teams, milestones, reviews and announcements.
- Consistent, auditable evaluation (scores plus written feedback).
- Less manual coordination for organizers.

**Out of scope for v1 (Assumption):** payments, public marketing site, live-streaming, in-app chat, mobile apps.

---

## 2. Roles and permissions

| Capability | Participant | Mentor | Evaluator | Coordinator (View) | Coordinator (Manage) | Super Admin |
|---|---|---|---|---|---|---|
| Register idea, edit own team's idea | ✔ | | | | | ✔ |
| Manage own team members | ✔ (team lead) | | | | | ✔ |
| Add/update milestones & deliverables | ✔ (own team) | ✔ (assigned teams) | | | ✔ | ✔ |
| View all ideas, teams, progress | | ✔ (assigned) | ✔ | ✔ | ✔ | ✔ |
| Post mentor notes | | ✔ | | | | ✔ |
| Score and give feedback | | | ✔ (assigned) | | | ✔ |
| See own team's scores and feedback | ✔ | ✔ (assigned) | | | | ✔ |
| See all scores and feedback | | | | ✔ | ✔ | ✔ |
| See other judges' scores before submitting | | | ✘ | | | ✔ |
| Schedule reviews, assign judges/mentors | | | | | ✔ | ✔ |
| Edit teams/ideas, make gate decisions | | | | | ✔ | ✔ |
| Configure stages, rubrics, weights | | | | | | ✔ |
| Publish announcements | | | | | ✔ | ✔ |
| Advance/reject/shortlist teams | | | | | ✔ | ✔ |
| Export reports | | | | | ✔ | ✔ |
| Delete users, purge audit log | | | | | | ✔ (Super Admin only) |

**Reviewer refinements for scale** ("Judge" above covers both reviewer types below; Sponsor and Support/Moderator have been removed in favor of the two Coordinator tiers described in section 2)

- **Ideathon Reviewer:** many people, each assigned roughly 20 to 30 ideas, light rubric, no access to later events.
- **Panel Evaluator:** a smaller group who score Innovatz, Continuous Reviews, POC and Demo Day.
- **Super Admin:** system-wide — user deletion, audit log purge, and settings beyond a single edition.
- **Team roles:** Team Lead and Members (1 to 6 people, solo allowed).

Load estimate **(Assumption)**: about 300 teams x 3 reviews = about 900 screening reviews, so roughly 40 reviewers at 22 to 23 ideas each.

---

**Role descriptions**

- **Coordinator (Manage):** the college's organizing team for this event. Same powers as a full admin for this event — configure stages/rubrics, assign reviewers, manage schedule, edit teams/ideas, make gate decisions, post announcements, export reports. Excluded: deleting users and purging the audit log (Super Admin only).
- **Coordinator (View-only):** internal observers (faculty, department heads, event organizers not actively managing) who need full visibility — teams, ideas, progress, scores and feedback — without edit, assignment or decision rights.
- Both tiers are scoped to one event (the college's current edition in the series), not to a track or region — this is a single-college, one-event-at-a-time setup, reused across differently-named editions.

## 3. Program lifecycle (annual edition, named events)

An **edition** is one year of the program at the college. Each edition runs a fixed named sequence of **events**; the number of continuous project reviews is chosen by Coordinator (Manage) per edition (3 to 5), so the sequence isn't hard-coded — it's configured from a template each year.

| Order | Event | What happens | Who evaluates | Output |
|---|---|---|---|---|
| 0 | Setup | Coordinator (Manage) creates the edition, sets the number of reviews (3–5) for this year, configures rubrics, invites evaluators | — | Edition published |
| 1 | **Ideathon** | Teams register and submit their initial idea | 3 reviewers per idea, normalized scores | Shortlist (Coordinator manually selects who advances from the ranked list) |
| 2 | **Innovatz** (idea review) | Shortlisted teams present/refine the idea for a deeper review | Assigned evaluators | Continue / conditional / exit |
| 3 | **Continuous Project Review 1..N** (N = 3 to 5, set per edition) | Rolling progress reviews against milestones, spaced through the build period | Assigned evaluators per review | Progress score + feedback each round |
| 4 | **POC** (proof of concept) | Teams demonstrate a working proof of concept | Panel evaluators | Continue / conditional / exit |
| 5 | **Demo Day** | Final prototype demo | Panel evaluators (larger panel) | Final ranking, results published |

Between named events, rolling elements continue: milestones with due dates, fortnightly check-ins, mentor sessions, ad-hoc announcements — these aren't separate "events" but ongoing activity that evaluators and coordinators can see progress on going into each event.

**Team states:** Draft → Submitted → Shortlisted / Rejected → Active → Conditional → Exited / Finalist → Completed. Rejected and Exited teams keep permanent read-only login access to their own history (submissions, milestones, past feedback) — they're just removed from active queues and can't edit or submit anything further.

**Event model (config, not hard-coded):** each edition stores an ordered list of events, each with a name, type (idea-review / continuous-review / poc / demo / custom), evaluator count, rubric, and open/close dates. The Setup step for a new edition starts from last year's list and lets the coordinator add, remove, rename, or reorder events — so "Innovatz" or "POC" can be renamed or dropped in a future year without a code change.

**Evaluators per event — fully configurable, decided close to each event:**
- Ideathon is the one fixed rule: 3 reviewers per idea, normalized scores.
- Every other event (Innovatz, each Continuous Project Review, POC, Demo Day) has its evaluator count set as a plain number field when the Coordinator (Manage) opens that event — it varies year to year and event to event, so the system never assumes a fixed panel size. The Coordinator sets it, assigns that many evaluators per team, and can change it up until assignment closes.
- **Shortlist cuts are the same story:** the Ideathon shortlist (and any other event with a cut) is a manual decision — the Coordinator reviews the ranked list and marks who advances, rather than the system applying a percentage or fixed count automatically. The system still shows the ranked list and lets the Coordinator select-and-advance in bulk; it just never decides the cutoff on its own.

---

## 4. Functional requirements

**FR-1 Accounts and access**
- Sign-up by invitation link or bulk CSV import. Email and password login only (no SSO for v1).
- Role-based access control; a user can hold different roles per edition.
- Profile: name, email, organisation, skills, photo.

**FR-2 Edition and event management (Coordinator: Manage)**
- Create editions (one per year), each with name, dates, and an ordered list of events cloned from last year's template.
- Configure each event: name, type (idea-review / continuous-review / poc / demo / custom), order, evaluator count, open/close dates, whether late submissions are allowed.
- Add, remove, rename or reorder events within an edition (so the sequence isn't hard-coded to Ideathon/Innovatz/POC/Demo Day forever).
- Set the number of Continuous Project Reviews for this edition (3 to 5).
- Configure rubrics per event (criteria, scale, weights, anchors).

**FR-3 Idea registration**
- **Step 1, at registration (short, to limit reviewer load):** title, one-line pitch, problem (word limit), proposed solution (word limit), track, team, eligibility declarations.
- **Step 2, unlocked for shortlisted teams:** target users, tech/approach, expected outcome, supporting links.
- Save draft, submit, edit until deadline, withdraw.
- Duplicate-title warning; admin can request changes.

**FR-4 Teams**
- Create team, invite members by email, accept/decline, leave, transfer lead.
- Team size 1 to 6 members (solo allowed; min/max configurable per track) and one-team-per-edition rule (configurable).

**FR-5 Milestones and deliverables**
- Admin-defined mandatory milestones per event plus team-defined rolling milestones.
- Fields: title, description, due date, status (Not started / In progress / Done / Blocked), evidence (external link).
- Fortnightly check-in form: progress, blockers, help needed.
- Overdue flags visible to team, mentor and coordinators.

**FR-5b Google Slides deck**
- Each team has one **Slides link** field: the team pastes a Google Slides URL they've made shareable ("Anyone with the link can view"), set once the team is created and editable any time — one evolving deck reused across every event, not a new upload per event.
- The app validates the URL is a Slides link and stores it on the team record (not per-event).
- On every evaluator/reviewer scoring page, the deck renders inline via Slides' embed URL (`.../embed?start=false&loop=false`) in an iframe, next to the scoring form, so the evaluator never has to leave the page.
- **If the link breaks mid-edition** (permissions changed, deck deleted, wrong URL): the system detects the failed embed, gives the team a grace-period notification (in-app + email, e.g. 48 hours) asking them to fix sharing or the link, and does not block anything else on the team's account during that window. If it's still broken when an evaluator opens the page, they see a clear "can't load — ask the team to enable link sharing" message instead of a blank frame; nothing else about the team's status changes automatically.
- The Slides link is the only way a team shares a deck. There is no separate file-attachment/upload path in the product.

**FR-6 Reviews and evaluation**
- Coordinator (Manage) assigns evaluators to teams per event (manual or auto-balanced) and schedules sessions.
- Evaluator sees an assigned queue for the current event, the team's embedded Slides deck, scores per criterion, writes feedback, saves draft, submits (locked after submit unless a Coordinator (Manage) reopens).
- Conflict-of-interest declaration; conflicted evaluators are excluded.
- Aggregation: weighted average across evaluators, with per-reviewer score normalization at Ideathon (see section 6) and an outlier flag when spread is large.
- Feedback release is controlled by Coordinator (Manage), per event.

**FR-7 Mentoring**
- Coordinator (Manage) assigns mentors to teams; mentors log session notes and recommendations.

**FR-8 Notifications and announcements**
- In-app notification centre plus email.
- Announcements (posted by Coordinator: Manage) targeted by role, edition, event or team.

**FR-9 Dashboards and results**
- Participant: event-by-event progress, milestones, feedback, their Slides link status.
- Evaluator: assigned queue for the current event and completion count.
- Coordinators (both tiers): funnel across events (registered → shortlisted → active → finalist), overdue items, review completion, score distributions. Manage tier can act on it; View-only tier sees the same data read-only.
- Leaderboard visible only when a Coordinator (Manage) publishes it.

**FR-10 Reporting and audit**
- CSV/PDF export of ideas, scores, feedback and milestone status.
- Audit log of event changes, score edits, reopen actions, role changes — visible to both coordinator tiers, editable by neither (system-generated).

---

## 5. Data model (core entities)

- **User**(id, name, email, org, skills, status)
- **Edition**(id, name, start, end, status)
- **Membership**(user, edition, role)
- **Event**(id, edition, name, type [idea-review/continuous-review/poc/demo/custom], order, evaluator_count, open_at, close_at)  ← replaces the old fixed "Stage" concept; an edition's events are cloned from a template and can be renamed/reordered/added/removed
- **Track**(id, edition, name)
- **Team**(id, edition, name, team_code [the registration-time ID], lead_user, status, slides_url)
- **TeamMember**(team, user, status)
- **Idea**(id, team, title, problem, solution, target_users, approach, track, status, submitted_at)
- **Milestone**(id, team, event, title, description, due, status, evidence, created_by)
- **CheckIn**(id, team, period, progress, blockers, help_needed)
- **Rubric**(id, event) and **Criterion**(id, rubric, name, weight, scale_min, scale_max, anchors)
- **ReviewAssignment**(id, team, event, evaluator, scheduled_at, conflict_declared)
- **Review**(id, assignment, status, overall_feedback, submitted_at) and **ReviewScore**(review, criterion, score, comment)
- **MentorAssignment**(team, mentor) and **MentorNote**(id, team, mentor, body, created_at)
- **Decision**(id, team, event, outcome, note, decided_by)
- **Announcement**(id, edition, title, body, audience_filter, published_at)
- **Notification**(id, user, type, payload, read_at)
- **AuditLog**(id, actor, action, entity, before, after, at)

---

## 6. Evaluation model

Scale 1–5 with written anchors for each level. The table below is the **starting default** loaded when a Coordinator (Manage) creates a new event — every weight is editable per event in the admin UI, not hard-coded, as long as a rubric's weights sum to 100.

| Criterion | Ideathon | Innovatz / Continuous Reviews | POC | Demo Day |
|---|---|---|---|---|
| Innovation | 35% | 20% | 15% | 15% |
| Feasibility | 30% | 25% | 15% | 10% |
| Impact / value | 35% | 20% | 15% | 15% |
| Execution and progress | n/a | 35% | 30% | 20% |
| Prototype/POC quality | n/a | n/a | 25% | 20% |
| Presentation | n/a | n/a | n/a | 20% |

Rules: 3 reviewers per idea at Ideathon (fixed) with **z-score normalization**: each reviewer's raw scores are converted using that reviewer's own mean and standard deviation, then averaged per idea and ranked — this is the confirmed method, not a placeholder. Evaluator counts for every other event are set by the Coordinator per event, not fixed by the system (section 3). Scores hidden from other evaluators until all submit; outlier flag when a criterion spread is 2 or more, which triggers an extra review; ties broken by Execution then Impact; all overrides logged.

**Display rescale (decided):** the raw normalized score (`clamp(50 + 15z, 0, 100)`) stays the single source of truth for ranking, gating, and audit — never change this math. At small reviewer counts it mathematically compresses (e.g. only 28.8–71.2 is reachable at n=3), which is correct but reads as broken on a leaderboard. So leaderboards additionally show a **display-only, per-event min-max rescale**: within that event's current cohort, map the lowest raw-normalized score to 0 and the highest to 100, placing everyone else proportionally between. This is a monotonic transform of the same z-scores — it can never change who ranks above whom — so it's a presentation layer only. Store and show both numbers (`normalized_score` = authoritative, `display_score` = rescaled-for-readability) rather than silently replacing one with the other.

**Normalization at Ideathon:** each reviewer's raw scores are converted to z-scores using that reviewer's own mean and standard deviation across their assigned ideas, then averaged per idea and ranked. This needs each reviewer to score at least about 15 ideas, with assignments overlapping across reviewers so scoring styles can be compared. Both raw and normalized scores are stored; Coordinators (Manage) can view both and override with a logged reason.

**Calibration round:** before the Ideathon opens, every reviewer scores the same 5 sample ideas; Coordinators (Manage) review discrepancies and brief reviewers on the anchors.

---

## 7. Notification matrix

| Trigger | Recipients | Channel |
|---|---|---|
| Invitation to join edition/team | Invitee | Email |
| Idea submitted / decision made | Team | In-app + email |
| Slides link missing or not shared correctly, event opens in <48h | Team | In-app + email |
| Milestone due in 3 days / overdue | Team, mentor | In-app + email |
| Check-in reminder | Team lead | Email |
| Review assigned / scheduled / rescheduled | Evaluator, team | In-app + email |
| Reviews pending after deadline | Evaluator, Coordinators (Manage) | Email |
| Feedback released | Team, mentor | In-app + email |
| Announcement | Targeted audience | In-app + email |

---

## 8. Non-functional requirements

- **Security:** RBAC on every endpoint, hashed passwords, rate limiting, no sensitive data in logs.
- **Privacy:** consent notice, data-retention policy, ability to export/delete a user's data.
- **Performance:** pages under 2 s at 1,500 concurrent users, with spikes at deadlines (registration close, milestone due dates); bulk operations (CSV import, batch assignment, mass email) run as background jobs **(Assumption)**.
- **Availability:** daily backups, restore tested before launch.
- **Data retention (recommended default, adjust anytime):** the current and previous 2 editions stay fully live and editable; older editions move to a read-only archive (still exportable, still visible to Coordinators) rather than being deleted, since none was requested. Revisit this once you know actual storage costs and any college data-retention policy.
- **Accessibility:** WCAG 2.1 AA, keyboard navigable, responsive from mobile to desktop.
- **Auditability:** immutable audit log for scoring and decisions.
- **Maintainability:** typed code, automated tests, CI, documented environments.

---

## 9. Suggested stack **(Assumption, swappable)**

Next.js (TypeScript) · PostgreSQL · Prisma · Auth.js (email/password) · Tailwind + shadcn/ui · Resend or SES for email · a job queue or cron for reminders · GitHub Actions CI.

**Hosting (recommended default, since this wasn't decided):** Vercel (or Railway/Render) for the app plus a managed Postgres add-on (Neon or Supabase). This is the lowest-effort path for a single college running one event a year — no server to patch, scales automatically during deadline spikes, and free/low tiers likely cover 1,000 participants. Swap to the college's own infrastructure later if there's an institutional requirement to keep data on-prem; the Next.js/Postgres stack runs fine on a plain VM too.

**Google Slides embedding:** no Google API/OAuth integration is required for this — the team just pastes a public "Anyone with the link" Slides URL, and the app converts it to Google's embed URL format and renders it in an iframe. This is view-only for evaluators. If you later want the app itself to create per-team Drive folders or verify sharing automatically, that needs a Google Workspace service account and the Drive/Slides APIs — flagged as a later enhancement, not required for v1.

---

## 10. Site map

- **Public:** landing, login, accept invite
- **Participant:** dashboard (current event + status), my idea, my team, Slides link, milestones, check-ins, feedback, announcements
- **Mentor:** assigned teams, team detail (incl. embedded deck), notes
- **Evaluator:** review queue for the current event, review form with embedded Slides deck side-by-side, schedule
- **Coordinator (View-only):** same screens as Coordinator (Manage) below, minus every edit/assign/decide action — read-only mirror
- **Coordinator (Manage):** editions, events (add/reorder/rename), rubrics, users and roles, ideas, teams, assignments, schedule, decisions, announcements, analytics, exports, audit log (view only, system-generated)

---

## 11. Documentation set to produce

| Document | Purpose | Produced in |
|---|---|---|
| Product Requirements (PRD) | Goals, users, scope, success metrics | Phase 0 |
| Software Requirements Spec (SRS) | Numbered functional and non-functional requirements | Phase 0 |
| User journeys and stories | Per role, with acceptance criteria | Phase 0 |
| Process and event playbook | Rules for each event and gate | Phase 0 |
| Evaluation guide | Rubrics, anchors, evaluator instructions | Phase 0/5 |
| Architecture and ADRs | Stack, decisions, trade-offs | Phase 1 |
| Data model and ER diagram | Schema reference | Phase 1 |
| API specification | Endpoints, payloads, errors | Phases 1–7 |
| UX wireframes and design system | Screens and components | Phase 0/2 |
| Test plan and UAT scripts | Coverage and sign-off | Phase 8 |
| Security and privacy checklist | Controls and data policy | Phase 8 |
| Deployment and runbook | Environments, backup, incident steps | Phase 8 |
| User guides (participant, evaluator, coordinators) | Onboarding | Phase 8 |
| Release notes and changelog | Version history | Ongoing |

---

## 12. Phase-by-phase build prompts

**How to use:** start every prompt with the **Master context** below, paste in the relevant sections of this blueprint, and finish each phase before starting the next. Ask the AI to list assumptions before building.

### Master context (paste at the top of every prompt)

> You are a senior product engineer helping me build a web platform that runs an annual hackathon-style program for one college, reused year to year as different editions. Each edition runs a named sequence of events: Ideathon → Innovatz (idea review) → 3 to 5 Continuous Project Reviews (count set per edition) → POC → Demo Day, with rolling milestones and check-ins between them. The event list is configurable, not hard-coded, so events can be renamed/reordered/added in future editions. Scale: 1,000+ participants per edition (about 300 teams of 1 to 6 members, solo allowed). Roles: Participant (team lead or member), Mentor, Evaluator (Ideathon reviewer or panel evaluator, counts vary per event), Coordinator (View-only — full visibility, no edit rights), Coordinator (Manage — 2 to 3 people who do all CRUD/assignment/decisions for the event), Super Admin. Evaluation uses weighted rubrics with scores and written feedback; Ideathon uses 3 reviewers per idea with per-reviewer score normalization. Each team has one Google Slides deck (a shareable link they paste, not an upload) that must render embedded on every evaluator's scoring page. Stack: Next.js (TypeScript), PostgreSQL, Prisma, Auth.js, Tailwind. Follow the requirements, data model and permission matrix I paste below. Before writing anything, list your assumptions and ask any blocking questions. Then deliver the output in the format requested. Keep code typed, tested and accessible.

### Phase 0: Discovery and documentation

> [Master context] Using the pasted blueprint sections 1–8, produce: (1) a PRD with goals, personas, scope, non-goals and success metrics; (2) an SRS with numbered requirements (FR/NFR IDs) and testable acceptance criteria; (3) user stories for each role, grouped by epic; (4) an event-and-gate playbook describing entry/exit rules and state transitions; (5) a list of open decisions with your recommended default for each. Output as clean markdown, one section per document.

### Phase 1: Foundation (repo, auth, roles, schema)

> [Master context] Set up the project: repository structure, linting, formatting, environment config, CI running lint, type-check and tests. Implement the Prisma schema for the entities in section 5, migrations, and seed data (1 edition, sample users per role). Implement authentication (invite-only sign-up, login, password reset) and role-based access control middleware using the permission matrix in section 2, with per-edition memberships. Provide an architecture doc with ADRs and an ER diagram (Mermaid). Include unit tests for the permission rules. Acceptance: a user with each role can log in and only reach the routes allowed for them.

### Phase 2: Coordinator console and program setup

> [Master context] Build the Coordinator (Manage) area to: create a new edition by cloning last year's event list; add/remove/rename/reorder events; set the Continuous Project Review count (3–5) for this edition; configure rubrics and criteria per event (weights must total 100, with anchors for each scale level); bulk user import by CSV (thousands of rows, validated, with an error report); invitations and role assignment across the role hierarchy in section 2, including which coordinators get Manage vs View-only. Add validation, an audit log entry for every change (visible read-only to both coordinator tiers), and a dashboard shell shared by both tiers where the View-only tier sees identical screens with every action control disabled. Provide a design system page (buttons, forms, tables, status badges) reused by later phases. Acceptance: a Coordinator (Manage) can configure a complete edition end to end starting from a prior year's template, and a Coordinator (View-only) can see everything but change nothing.

### Phase 3: Idea registration and teams

> [Master context] Implement team creation for 1 to 6 members (solo allowed), a generated team code (used on the team record), email invitations (accept/decline), team lead rules and one-team-per-edition. Build the two-step idea form from FR-3 (short at Ideathon registration, detailed form unlocked for shortlisted teams) with draft/submit/withdraw, deadline enforcement, duplicate-title warning, and a Coordinator (Manage) request-changes flow. Add the team's Slides-link field (validate it's a Google Slides URL, store it, show a "not shared correctly" warning if the embed fails a load check) per FR-5b. Add the team/idea state machine from section 3. Include participant and coordinator list views with filters and search. Acceptance: a team can go from creation to a submitted idea with a working Slides link, and a Coordinator (Manage) can shortlist or reject in bulk (by top N or percentage) with a note that teams can see.

### Phase 4: Milestones, deliverables and check-ins

> [Master context] Implement mandatory (Coordinator-defined, per event) and team-defined rolling milestones with due dates, statuses and evidence (external link). Build the fortnightly check-in form and reminder logic. Add overdue detection, team and coordinator progress views, and mentor assignment with mentor notes. Provide a scheduled job for due-soon and overdue flags. Acceptance: progress percentage per team is correct, overdue items are flagged, and mentors see only assigned teams.

### Phase 5: Reviews, scheduling and scoring

> [Master context] Implement review assignment per event (manual and auto-balanced, with 3 reviewers per idea at Ideathon and configurable evaluator counts for other events, balanced workload per evaluator, and overlapping assignments at Ideathon so normalization works), conflict-of-interest declaration, scheduling with calendar-friendly times, and the evaluator queue. Build the scoring form from the event's rubric, with the team's Google Slides deck embedded inline (convert the stored share link to Slides' embed URL, iframe it read-only, show a clear error state if it fails to load) next to per-criterion score and comment fields, draft/submit/lock, and Coordinator (Manage) reopen (logged). Implement weighted aggregation, per-reviewer z-score normalization at Ideathon (store raw and normalized scores), a calibration round on shared sample ideas, hidden scores until all evaluators submit, outlier flagging that triggers an extra review, tie-break rules from section 6, and controlled feedback release per event. Add tests for aggregation math and visibility rules. Acceptance: three reviewers score a team at Ideathon, the weighted and normalized results match a hand calculation, the Slides deck renders correctly for a properly-shared link, and participants only see feedback after release.

### Phase 6: Notifications and announcements

> [Master context] Build the in-app notification centre and email delivery following the matrix in section 7 (including the Slides-link-not-shared reminder), with templates, user preferences and de-duplication. Implement announcements with audience targeting (role, edition, event or team) and read tracking. Use a queue or scheduled jobs for reminders and make delivery idempotent. Acceptance: every trigger in the matrix produces exactly one notification per recipient, and targeting never leaks announcements to the wrong audience.

### Phase 7: Dashboards, results and reporting

> [Master context] Build role-specific dashboards from FR-9: participant event-by-event progress, evaluator queue, and coordinator analytics (funnel across events, overdue items, review completion, score distributions) — shared between both coordinator tiers, actionable only for Manage. Add the Coordinator (Manage)-published leaderboard/results page, event decision recording (continue/conditional/exit) with notifications, and CSV/PDF exports for ideas, scores, feedback and milestones. Acceptance: exported numbers match on-screen numbers, and the leaderboard stays hidden until published.

### Phase 8: Hardening, testing and launch

> [Master context] Prepare for launch: end-to-end tests for the critical journeys of each role (including a full event-by-event journey for one team through Ideathon → Demo Day), load test to the target in section 8, security review (authorization on every endpoint, input validation, rate limiting), accessibility audit to WCAG 2.1 AA, backup and restore test, monitoring and error tracking. Produce the test plan and UAT scripts, security and privacy checklist, deployment runbook, and user guides for participant, evaluator, and both coordinator tiers. Acceptance: all critical journeys pass, no high-severity findings remain, and a restore from backup is demonstrated.

---

## 13. Decisions — final

Every open question has been resolved for v1. Two remain deliberately flexible by design (not oversights) — they're configured at runtime rather than fixed in the spec:

| # | Decision | Resolution |
|---|---|---|
| 1 | Editions in parallel or sequential? | One college, one edition at a time, **sequential** — not multiple concurrent editions with an "active" flag; the prior edition is closed (and archived per decision 9) before the next opens. |
| 2 | Team size | 1 to 6 members, solo allowed. |
| 3 | Rubric weights | Section 6 table is the default on a new event; editable per event by Coordinator (Manage), must sum to 100. |
| 4 | Auth method | Email/password only. No SSO for v1. |
| 5 | Ideathon reviewer count | Fixed: 3 per idea, with score normalization. |
| 6 | Evaluator counts for Innovatz, each Continuous Review, POC, Demo Day | **By design, not fixed** — set per event by the Coordinator close to the date (section 3). |
| 7 | Ideathon shortlist cut (and any other event's cut) | **By design, not fixed** — the Coordinator reviews the ranked list and manually selects who advances; the system never auto-applies a percentage or count. |
| 8 | Exited/rejected team access | Permanent read-only login — they see their own history, can't edit or submit further. |
| 9 | Data retention | Recommended default: current + previous 2 editions fully live, older editions archived read-only. Revisit once real storage costs and any college policy are known. |
| 10 | Hosting | Recommended default: Vercel/Railway + managed Postgres (Neon/Supabase). Swap to on-prem later if the college requires it. |
| 11 | Slides link breaks mid-edition | Grace-period notification (e.g. 48h) to the team; nothing else blocks during that window; evaluators see a clear error if it's still broken. |
| 12 | Coordinator (Manage) headcount and who decides the yearly split | Left to you to set each edition in the Setup step (section 4, FR-2) — the system just enforces that Manage-tier users can be added/removed by an existing Manage-tier user or Super Admin. |

This blueprint is ready to hand to Phase 0 as-is.
