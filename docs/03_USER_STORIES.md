# User Stories by Role & Epic
## Project: HackTrack — Multi-Edition Collegiate Innovation Platform
**Document Version:** 1.0.0  
**Phase:** Phase 0 — Discovery and Documentation  
**Status:** Approved for Implementation Planning  

---

## Epic 1: Edition & Event Pipeline Orchestration

### US-1.1: Super Admin — Edition Setup & Configuration
- **Story:** *As a Super Admin*, I want to create and configure a new hackathon edition (e.g., "HackTrack 2026") with its own dates, branding, and registration limits, *so that* previous years' data remains archived while current operations run smoothly in an isolated workspace.
- **Acceptance Criteria:**
  - Can input edition name, academic year, and active status.
  - Can clone event stages and rubrics from a previous edition.
  - Activating a new edition automatically updates the default navigation for incoming traffic.

### US-1.2: Coordinator (Manage) — Configurable Event Pipeline
- **Story:** *As a Coordinator (Manage)*, I want to define the specific sequence of events (Ideathon → Innovatz → 3–5 Continuous Project Reviews → POC → Demo Day) for our edition, *so that* our academic calendar's exact review schedule is accurately modeled.
- **Acceptance Criteria:**
  - Can add, reorder, rename, or remove event stages before the edition begins.
  - Can designate each event's type (`ASYNC_REVIEW` for Ideathon vs `LIVE_PANEL` for Innovatz/Demo Day).
  - Can set independent submission opening and locking timestamps per event.

### US-1.3: Coordinator (View-Only) — Event Timeline Inspection
- **Story:** *As a Coordinator (View-Only)*, I want to inspect the global event pipeline, milestones, and real-time status across all stages without fear of accidentally modifying dates or settings, *so that* I can stay informed and provide executive oversight.
- **Acceptance Criteria:**
  - Read-only calendar and Gantt view of the active edition.
  - All edit buttons and action triggers are hidden or disabled in the UI.

---

## Epic 2: Team Formation, Registration & Artifacts

### US-2.1: Participant (Team Lead) — Team Registration & Unique Code Generation
- **Story:** *As a Participant (Team Lead)*, I want to register our team (with a team name and track selection) and receive an auto-generated unique registration code (e.g., `HT26-T042`), *so that* our team identity is established and standardized across all future reviews and file submissions.
- **Acceptance Criteria:**
  - Supports 1 to 6 members (solo allowed).
  - Atomically assigns a unique registration code upon creation.
  - Generates a secure shareable invite link for teammates.

### US-2.2: Participant (Team Member) — Joining a Team via Invite
- **Story:** *As a Participant (Team Member)*, I want to join my team using an invitation link or team registration code, *so that* I am recognized as an official roster member and gain access to team deliverables.
- **Acceptance Criteria:**
  - Validates that team size does not exceed 6 members.
  - Prevents a user from joining multiple active teams within the same edition.
  - Updates the roster immediately in real-time.

### US-2.3: Participant (Team Lead) — Submitting Google Slides Presentation
- **Story:** *As a Participant (Team Lead)*, I want to submit our Google Slides shareable link and see an immediate embedded preview, *so that* I can verify our slides render properly for evaluators and satisfy presentation requirements before the deadline.
- **Acceptance Criteria:**
  - Input field parses Google Slides URLs and extracts the presentation key.
  - Immediately displays an embedded preview iframe in the submission modal.
  - Validates that the link is accessible and provides helpful troubleshooting tips if permissions are set to private.

### US-2.4: Participant (Team Lead) — Uploading Supporting Attachments
- **Story:** *As a Participant (Team Lead)*, I want to upload required project attachments (PDF reports, ZIP archives) and have the system automatically rename them to our team's registration code, *so that* evaluators can easily identify our files without us having to manually conform to file naming schemes.
- **Acceptance Criteria:**
  - Uploaded files are renamed server-side to `{REG_CODE}_{ORIGINAL_NAME}.{ext}`.
  - File size limits (max 25MB) and mime-types (`.pdf`, `.zip`, `.png`, `.jpg`) are enforced.
  - Once the submission deadline locks, further file uploads and link edits are blocked.

---

## Epic 3: Mentorship & Continuous Progress Tracking

### US-3.1: Mentor — Team Roster & Milestone Dashboard
- **Story:** *As a Mentor*, I want to view a dedicated dashboard showing all the teams assigned to me, along with their current stage, Google Slides deck, and milestone status, *so that* I can prepare tailored guidance for upcoming reviews.
- **Acceptance Criteria:**
  - Displays a clean list of assigned teams with their registration code and project track.
  - Provides one-click access to the team's embedded slide deck and GitHub repository link.

### US-3.2: Mentor — Logging Check-In Sessions
- **Story:** *As a Mentor*, I want to log notes and attendance from our bi-weekly team check-ins, *so that* coordinators can track which teams are actively progressing and identify teams at risk of elimination.
- **Acceptance Criteria:**
  - Structured form: Meeting date, attendance checklist, project health tag (`ON_TRACK`, `AT_RISK`, `BLOCKED`), notes, and next milestone goals.
  - Submissions are timestamped and visible to Coordinators.

### US-3.3: Participant (Team Lead / Member) — Reviewing Mentor Feedback
- **Story:** *As a Participant*, I want to review notes and action items logged by our mentor, *so that* our team can address technical bottlenecks before the next Continuous Project Review panel.
- **Acceptance Criteria:**
  - Read-only feed of mentor check-in summaries displayed on the team portal.
  - Clear indication of assigned action items and deadlines.

---

## Epic 4: Evaluation, Rubrics & Normalization

### US-4.1: Coordinator (Manage) — Dynamic Weighted Rubric Definition
- **Story:** *As a Coordinator (Manage)*, I want to define weighted criteria (e.g., Problem Impact 25%, Technical Feasibility 30%, Innovation 25%, Presentation 20%) for each event stage, *so that* evaluators score teams systematically against agreed academic standards.
- **Acceptance Criteria:**
  - UI builder allows adding criteria with titles, descriptions, max score, and percentage weights.
  - Enforces that criteria weights sum to exactly 100%.
  - Supports both numeric scale sliders and mandatory qualitative feedback fields.

### US-4.2: Coordinator (Manage) — Ideathon 3-Reviewer Automated Allocation
- **Story:** *As a Coordinator (Manage)*, I want to automatically distribute all submitted Ideathon ideas to available evaluators such that every idea receives exactly 3 distinct reviews, *so that* workload is evenly distributed and evaluation coverage is guaranteed.
- **Acceptance Criteria:**
  - Round-robin allocator ensures each idea is assigned to 3 unique evaluators.
  - Workload variance between evaluators is minimized (balanced load).
  - Enforces conflict-of-interest rules (a mentor is never assigned to evaluate their own mentee team).

### US-4.3: Evaluator — Split-Screen Evaluation Cockpit
- **Story:** *As an Evaluator*, I want a unified split-screen interface displaying the team's Google Slides presentation on the left and the weighted rubric scoring form on the right, *so that* I can evaluate the project efficiently without juggling browser tabs.
- **Acceptance Criteria:**
  - Google Slides deck embeds with native slide advancement controls.
  - Rubric displays weighted criteria with instant running total calculation.
  - Draft inputs auto-save locally and debounce to the server to prevent data loss.
  - Submit button validates that all mandatory criteria and comments are completed.

### US-4.4: Coordinator (Manage) — Ideathon Score Normalization
- **Story:** *As a Coordinator (Manage)*, I want to trigger statistical score normalization on all Ideathon evaluations, *so that* teams scored by unusually harsh reviewers are not unfairly penalized compared to teams assigned to generous reviewers.
- **Acceptance Criteria:**
  - Calculates per-evaluator mean and standard deviation.
  - Computes standardized Z-scores and maps them to a normalized cohort baseline.
  - Displays side-by-side comparative views of raw vs. normalized leaderboards before finalizing results.

---

## Epic 5: Operational Coordination, Moderation & Gate Promotion

### US-5.1: Coordinator (Manage) — Gate Promotion & Team Cutoffs
- **Story:** *As a Coordinator (Manage)*, I want to view ranked leaderboards, apply cutoff thresholds (e.g. top 100 teams promote to Innovatz, top 40 advance to CPR), and execute stage promotions, *so that* the cohort advances cleanly into the next program phase.
- **Acceptance Criteria:**
  - Interactive cutoff threshold slider showing projected advance/eliminate counts.
  - Single-action batch promotion with an explicit confirmation modal.
  - Promoted teams transition to the next event stage; eliminated teams receive graceful exit notifications.

### US-5.2: Coordinator (View-Only) — Executive Leaderboard & Cohort Analytics
- **Story:** *As a Coordinator (View-Only)*, I want to monitor evaluation progress percentages, reviewer completion rates, and real-time score distributions, *so that* I can report status to college deans and ensure reviews finish on schedule.
- **Acceptance Criteria:**
  - Visual charts showing completion percentage by event stage and evaluator.
  - Exportable anonymized and identified CSV reports.
  - Read-only safeguards ensuring no data can be accidentally updated.

---

## Epic 6: Administrative Governance & Auditability

### US-6.1: Super Admin — Role Assignment & Elevation
- **Story:** *As a Super Admin*, I want to assign and revoke user roles (`PARTICIPANT`, `MENTOR`, `EVALUATOR`, `COORDINATOR_VIEW`, `COORDINATOR_MANAGE`, `SUPER_ADMIN`), *so that* each stakeholder has the exact permissions required for their institutional duties.
- **Acceptance Criteria:**
  - Dedicated user management dashboard with search and role filters.
  - Prevents accidental self-demotion if the user is the sole Super Admin.
  - Changes take effect immediately on next token refresh/session validation.

### US-6.2: Super Admin & Coordinator (View) — Audit Log Inspection
- **Story:** *As a Super Admin or Coordinator (View)*, I want to review an immutable audit log of all critical platform events (score edits, manual overrides, reviewer reassignments, gate promotions), *so that* total transparency and institutional accountability are maintained.
- **Acceptance Criteria:**
  - Comprehensive log table: timestamp, actor, IP/user-agent, event type, entity ID, diff details.
  - Searchable by team registration code, evaluator name, or action category.
  - Cannot be deleted or modified through any application API.
