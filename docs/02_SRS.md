# Software Requirements Specification (SRS)
## Project: HackTrack — Multi-Edition Collegiate Innovation Platform
**Document Version:** 1.0.0  
**Phase:** Phase 0 — Discovery and Documentation  
**Status:** Approved for Implementation Planning  

---

## 1. System Overview & Architecture Context
HackTrack is built using Next.js 15 (App Router with TypeScript), PostgreSQL managed via Prisma ORM, Auth.js (v5) for role-based authentication, and Tailwind CSS for accessible, responsive styling. The system operates under an Edition-partitioned schema where all critical operational domains (`Events`, `Teams`, `Submissions`, `Evaluations`, `Milestones`) cascade from an active `Edition` record.

```
       +-------------------------------------------------------------+
       |                  Client Layer (Next.js / React)            |
       |  Participant Hub  | Evaluator Cockpit | Coordinator Console|
       +------------------------------+------------------------------+
                                      | HTTPS / Server Actions / REST
       +------------------------------v------------------------------+
       |                 Application Layer (Next.js)                 |
       |  Auth.js (RBAC)  | Normalization Engine | Slides Embed Hdl  |
       +------------------------------+------------------------------+
                                      | Prisma Client
       +------------------------------v------------------------------+
       |                     Persistence Layer                       |
       |       PostgreSQL (Relational Core)                           |
       +-------------------------------------------------------------+
```

---

## 2. Functional Requirements (FR)

### 2.1 Edition & Event Pipeline Configuration (FR-ED)

#### FR-ED-001: Edition Creation and Lifecycle Management
- **Description:** The system shall allow Super Admins to create new program editions with distinct titles, academic years, start/end dates, and operational states (`DRAFT`, `ACTIVE`, `ARCHIVED`).
- **Acceptance Criteria:**
  - *Given* a Super Admin accessing the Edition Admin panel,
  - *When* submitting valid edition metadata and toggling it to `ACTIVE`,
  - *Then* the previous `ACTIVE` edition transitions to `ARCHIVED`, and the new edition becomes the default context for all registrations.

#### FR-ED-002: Dynamic Event Sequence Configuration
- **Description:** Coordinators (Manage) shall configure an ordered pipeline of events per edition (Default: Ideathon → Innovatz → 3 to 5 Continuous Project Reviews → POC → Demo Day). Events can be renamed, reordered, added, or deleted while the edition is in `DRAFT` or `SETUP` state.
- **Acceptance Criteria:**
  - *Given* an edition in `SETUP` mode,
  - *When* a Coordinator adds an event "CPR 4" with sequence index 5 and sets review type to `PANEL`,
  - *Then* the system updates the sequence order, recalculates pipeline steps, and verifies that sequence indices are contiguous without duplicates.

#### FR-ED-003: Event Gate Status Transitions
- **Description:** Each event shall support independent operational states: `UPCOMING`, `REGISTRATION_OPEN`, `SUBMISSION_OPEN`, `SUBMISSION_LOCKED`, `EVALUATION_ACTIVE`, `EVALUATION_LOCKED`, `COMPLETED`.
- **Acceptance Criteria:**
  - *Given* an event in `SUBMISSION_OPEN`,
  - *When* the deadline timestamp passes or Coordinator triggers `SUBMISSION_LOCKED`,
  - *Then* all team submission mutations are rejected with HTTP 403, and teams cannot alter slide links.

---

### 2.2 Team Formation & Identity (FR-TM)

#### FR-TM-001: Team Registration & Sizing Limits
- **Description:** Participants shall create teams with a minimum of 1 (solo) and a maximum of 6 members. The creator is designated as `TEAM_LEAD`.
- **Acceptance Criteria:**
  - *Given* an authenticated participant creating a team,
  - *When* specifying a team name and optional initial members,
  - *Then* the team is created, an invite token is generated, and the team size constraint `1 <= count <= 6` is enforced at database schema and application levels.

#### FR-TM-002: Collision-Proof Registration Code Generation
- **Description:** Upon team registration, the system shall atomically generate a unique, human-readable registration code formatted as `{EDITION_PREFIX}-T{SEQUENTIAL_OR_RANDOM_PADDED}` (e.g., `HT26-T001` or `HT26-T389`).
- **Acceptance Criteria:**
  - *Given* simultaneous registration of 50 teams under high load,
  - *When* records are inserted into PostgreSQL,
  - *Then* each team receives a strictly unique code enforced by a database `UNIQUE` constraint, without race conditions.

#### FR-TM-003: Team Member Invite and Lead Transfer
- **Description:** The Team Lead shall generate shareable join links and transfer leadership to any verified team member before the event registration cut-off.
- **Acceptance Criteria:**
  - *Given* an active team of 4 members,
  - *When* the Team Lead promotes Member B to Lead,
  - *Then* Member B acquires `TEAM_LEAD` privileges, and the former Lead transitions to `MEMBER`.

---

### 2.3 Google Slides Embedding (FR-AS)

#### FR-AS-001: Google Slides Shareable Link Embedding
- **Description:** Teams shall submit exactly one Google Slides URL for each submission-eligible event. The system shall validate the URL structure and transform standard share links (`https://docs.google.com/presentation/d/{ID}/edit?usp=sharing`) into sandboxed embed URLs (`https://docs.google.com/presentation/d/{ID}/embed?start=false&loop=false&delayms=3000`).
- **Acceptance Criteria:**
  - *Given* a team lead submitting a Google Slides URL,
  - *When* the URL matches the Google Slides regex pattern,
  - *Then* the system extracts the Presentation ID, stores both raw and embed URLs, and renders an interactive embedded preview in the submission dialog.
  - *If* an invalid link is provided (e.g. non-Google Slides URL), the system rejects the input with an actionable error.

---

### 2.4 Rubric & Evaluation Engine (FR-SC)

#### FR-SC-001: Dynamic Weighted Rubric Builder
- **Description:** Coordinators (Manage) shall configure custom rubrics per event. Each rubric consists of multiple criteria with title, description, max points, and weight percentage. Total weight must sum to 100%.
- **Acceptance Criteria:**
  - *Given* a Coordinator building an event rubric,
  - *When* criteria weights sum to 95%,
  - *Then* saving is blocked with a validation error indicating a 5% deficit.
  - *When* weights sum to exactly 100.0%, the rubric is published.

#### FR-SC-002: Ideathon 3-Reviewer Assignment Engine
- **Description:** For the Ideathon event, the system shall allocate exactly 3 distinct evaluators per submitted idea using a balanced round-robin algorithm that avoids evaluator overload and enforces conflict-of-interest checks (e.g., mentor cannot evaluate their own mentored team).
- **Acceptance Criteria:**
  - *Given* 300 submitted ideas and 30 active evaluators,
  - *When* the Coordinator triggers "Auto-Assign Reviewers",
  - *Then* exactly 900 evaluation assignment records are created, every team has 3 distinct reviewers, and each evaluator has an equal load (30 ideas ± 1).

#### FR-SC-003: Evaluator Split-Screen Cockpit
- **Description:** The evaluation interface shall render an accessible split-screen workspace: the embedded Google Slides deck with full keyboard navigation controls on the left, and the dynamic rubric scoring form with auto-saving score sliders/inputs and mandatory qualitative feedback on the right.
- **Acceptance Criteria:**
  - *Given* an evaluator opening an assigned team review,
  - *When* the page loads,
  - *Then* the Google Slides deck renders in an iframe without leaving the platform, rubric inputs trigger optimistic client-side score calculations, and draft inputs debounce auto-save to the server every 3 seconds.

#### FR-SC-004: Ideathon Score Normalization Engine
- **Description:** To eliminate bias across harsh and lenient evaluators, the system shall execute statistical score normalization across all Ideathon reviews using Z-score standardization adjusted to a common 0–100 scale:
  $$Z_{i,j} = \frac{X_{i,j} - \mu_j}{\sigma_j}, \quad S_{\text{norm}, i,j} = \mu_{\text{cohort}} + Z_{i,j} \cdot \sigma_{\text{cohort}}$$
  (Where $X_{i,j}$ is evaluator $j$'s raw score for team $i$, $\mu_j$ and $\sigma_j$ are evaluator $j$'s mean and standard deviation, and $\mu_{\text{cohort}}, \sigma_{\text{cohort}}$ are target cohort distribution constants).
- **Acceptance Criteria:**
  - *Given* an evaluator who consistently scores between 30 and 45 (harsh) and another who scores 85 to 98 (lenient),
  - *When* the Coordinator triggers "Run Ideathon Normalization",
  - *Then* both evaluators' score distributions are scaled to a unified mean (e.g., 70) and standard deviation (e.g., 15), resulting in equitable comparative percentiles.

---

### 2.5 Continuous Mentorship & Milestones (FR-MM)

#### FR-MM-001: Rolling Milestone Checklist & Proof of Work
- **Description:** Teams progressing through Continuous Project Reviews shall have a rolling milestone board where they submit progress deliverables, GitHub commit tags, and weekly blockers.
- **Acceptance Criteria:**
  - *Given* an active CPR round,
  - *When* a team marks a milestone complete and attaches a commit URL,
  - *Then* the assigned mentor receives a notification and can verify or request revisions.

#### FR-MM-002: Mentor Check-In Logging
- **Description:** Mentors shall log structured check-in reports (Meeting Date, Attendance, Technical Health: Green/Yellow/Red, Notes, Action Items).
- **Acceptance Criteria:**
  - *Given* a mentor meeting with team `HT26-T014`,
  - *When* submitting a check-in log,
  - *Then* the record is linked to the team and visible to Coordinators for escalation.

---

### 2.6 Governance & Auditability (FR-AU)

#### FR-AU-001: Immutable Audit Trail
- **Description:** All gate promotions, score overrides, rubric changes, and reviewer re-assignments shall write an append-only audit log capturing `timestamp`, `userId`, `actionType`, `targetEntity`, `previousState`, and `newState`.
- **Acceptance Criteria:**
  - *Given* a Coordinator (Manage) overriding a normalized score,
  - *When* the change is committed,
  - *Then* an audit log entry is persisted and cannot be updated or deleted by any user role.

---

## 3. Non-Functional Requirements (NFR)

### 3.1 Performance & Latency (NFR-PERF)
- **NFR-PERF-001:** 95th percentile (p95) server response time for API requests shall be under 300ms under standard operational conditions.
- **NFR-PERF-002:** The Evaluator Cockpit page (including iframe initialization and rubric controls) shall achieve Largest Contentful Paint (LCP) under 1.8 seconds on standard broadband connections.
- **NFR-PERF-003:** The automated 3-reviewer allocation algorithm for 300 teams (900 assignments) shall complete execution in under 5.0 seconds.

### 3.2 Security & Data Protection (NFR-SEC)
- **NFR-SEC-001:** Strict Role-Based Access Control (RBAC) enforced via server-side middleware and Prisma query filters. `Coordinator View` must be barred from executing any HTTP `POST`, `PUT`, `PATCH`, or `DELETE` mutation endpoints.
- **NFR-SEC-002:** The Google Slides embed URL shall be validated and rendered in a sandboxed iframe to prevent XSS and clickjacking.
- **NFR-SEC-003:** Embedded Google Slides links must be sanitized to prevent XSS and clickjacking; iframes must enforce `sandbox="allow-scripts allow-same-origin allow-popups"`.

### 3.3 Scalability & Concurrency (NFR-SCALE)
- **NFR-SCALE-001:** The system shall support 1,500 concurrent authenticated sessions and 150 requests/sec burst traffic during submission deadline windows without 5xx errors or dropped connections.
- **NFR-SCALE-002:** Database connections shall be pooled using Prisma Accelerate or PgBouncer to prevent connection exhaustion.

### 3.4 Accessibility (NFR-A11Y)
- **NFR-A11Y-001:** All web pages shall comply with WCAG 2.1 Level AA standards, ensuring proper semantic HTML, ARIA attributes for dynamic score widgets, high color contrast ratios (> 4.5:1 for normal text), and full keyboard navigability.
- **NFR-A11Y-002:** The split-screen evaluator cockpit shall support responsive layout stacking on viewports below 1024px.

### 3.5 Reliability & Fault Tolerance (NFR-RELIAB)
- **NFR-RELIAB-001:** Evaluator scoring forms shall incorporate local client-side caching (`IndexedDB` / `localStorage`) and debounced background sync so that temporary network dropouts do not result in lost evaluator commentary or grades.
- **NFR-RELIAB-002:** Daily automated database backups with a Recovery Point Objective (RPO) < 1 hour and Recovery Time Objective (RTO) < 4 hours.
