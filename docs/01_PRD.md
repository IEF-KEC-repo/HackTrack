# Product Requirements Document (PRD)
## Project: HackTrack — Multi-Edition Collegiate Innovation & Hackathon Management Platform
**Document Version:** 1.0.0  
**Phase:** Phase 0 — Discovery and Documentation  
**Status:** Approved for Implementation Planning  

---

## 1. Executive Summary & Vision
**HackTrack** is an enterprise-grade, reusable web platform engineered to orchestrate an annual multi-stage hackathon program for a premier collegiate institution. Operating over a multi-month lifecycle per edition, the platform guides 1,000+ participants across ~300 multidisciplinary teams through a sequential, gated innovation journey: **Ideathon → Innovatz (Idea Screening/Review) → Continuous Project Reviews (CPR 1 to N) → Proof of Concept (POC) → Demo Day**.

Unlike rigid off-the-shelf hackathon platforms, HackTrack provides:
- Complete **Edition Isolation & Pipeline Configurability** (stages can be reordered, added, or weighted per annual cycle).
- **Dynamic Multi-Reviewer Scoring & Normalization** to mitigate evaluator bias across large cohorts.
- Integrated **Artifact Governance** (embedded Google Slides viewer, automated standardized file renaming using team registration codes).
- Granular **Role-Based Access Control (RBAC)** distinguishing operational managers (`Coordinator Manage`) from administrative supervisors (`Coordinator View`), evaluators, mentors, and participants.

---

## 2. Problem Statement
Running large-scale collegiate innovation programs using fragmented spreadsheets, disconnected Google Forms, manual drive uploads, and ad-hoc communication tools results in:
1. **Evaluator Variance & Scoring Inconsistency:** Subjective score distributions between lenient and strict reviewers skew Ideathon qualification.
2. **Operational Bottlenecks for Organizers:** Managing 300+ teams, assigning 3+ reviewers per idea, and tracking rolling check-ins across multiple rounds consumes hundreds of coordinator hours.
3. **Artifact Disorganization:** Broken deck links, unauthorized file modifications after deadlines, and missing team registration identifiers hinder panel reviews.
4. **Lack of Year-Over-Year Continuity:** Custom software built for one year is typically abandoned, requiring reinvention each academic cycle.

---

## 3. Goals & Success Metrics

### 3.1 Business & Academic Goals
- **Single Source of Truth:** Unify team registration, milestone tracking, artifact submission, mentor check-ins, evaluation scoring, and stage promotions into one platform.
- **Year-Over-Year Reusability:** Spin up a new edition (e.g., `HackTrack 2026`, `HackTrack 2027`) in under 10 minutes without code modification or database resets.
- **Fair & Auditable Progression:** Eliminate evaluator bias via algorithmic normalization and maintain an immutable audit trail for every gate promotion decision.

### 3.2 Key Performance Indicators (KPIs) & Success Metrics
| Metric Category | Target Indicator | Baseline / Target | Measurement Method |
| :--- | :--- | :--- | :--- |
| **System Scale** | Concurrent active users during submission deadlines | 1,000+ participants (~300 teams) | APM load monitoring, p95 latency < 500ms |
| **Operational Efficiency** | Time spent assigning reviewers to 300 teams | Reduced from 12 hours to < 30 seconds | Automated round-robin balancing job |
| **Evaluation Integrity** | Inter-evaluator scoring drift reduction | > 80% reduction in variance post-normalization | Standard deviation analysis across normalized cohort scores |
| **Artifact Compliance** | Presentations rendered seamlessly without permission issues | 99.5% successful iframe embed rate | Client-side error telemetry on Google Slides embeds |
| **Submission Reliability** | Failed uploads or corrupted team registration tags | 0% failure rate; 100% files prefixed with `REG_CODE` | Server-side upload verification checks |

---

## 4. User Personas
HackTrack serves six primary personas across the collegiate ecosystem:

### Persona 1: Participant (Team Lead / Member)
- **Profile:** Undergraduate/graduate engineering students working solo or in teams of 1 to 6.
- **Pain Points:** Missed deadlines, unclear rubric guidelines, anxiety over whether submitted slides render properly, lack of structured feedback.
- **Needs:** Clear progress stepper, team invitation management, embedded preview of their Google Slides deck, transparent milestone checklists, and post-round feedback visibility.

### Persona 2: Faculty / Industry Mentor
- **Profile:** Professors or alumni industry professionals assigned to guide 3–10 teams through CPR cycles.
- **Pain Points:** No visibility into team progress between review panels; messy email check-ins.
- **Needs:** Dedicated dashboard listing assigned teams, log check-in meeting notes, flag blocked teams, and track milestone velocity.

### Persona 3: Evaluator (Ideathon Reviewer / CPR Panelist)
- **Profile:** Domain experts reviewing either ideas asynchronously (Ideathon, 3 reviews per idea) or live panel presentations (Innovatz, CPR, Demo Day).
- **Pain Points:** Switching tabs between scoring spreadsheets, video calls, and presentation decks; cognitive fatigue.
- **Needs:** Unified split-screen evaluation cockpit: embedded Google Slides deck on the left, interactive weighted rubric with criteria tooltips and comment boxes on the right. Instant auto-save.

### Persona 4: Coordinator (Manage)
- **Profile:** 2 to 3 core student/faculty organizers responsible for operations, logistics, team approvals, panel scheduling, and gate cuts.
- **Pain Points:** High-stress manual coordination, spreadsheet merge conflicts, dispute resolution.
- **Needs:** Full CRUD operations over teams, bulk reviewer assignment, configurable rubric builders, gate promotion controls with cutoff thresholds, and normalization triggers.

### Persona 5: Coordinator (View-Only)
- **Profile:** Executive college leadership, department heads, and observer faculty requiring macro visibility without edit permissions.
- **Pain Points:** Accidental data corruption, unauthorized grade tweaks, fragmented status reports.
- **Needs:** Read-only access to all submissions, real-time leaderboard analytics, reviewer completion status, and downloadable CSV audit reports.

### Persona 6: Super Admin
- **Profile:** Platform system administrators and lead product engineers.
- **Pain Points:** Maintaining legacy codebases, managing database migrations, configuring institutional security.
- **Needs:** Edition lifecycle provisioning, global RBAC elevation, event sequence reconfiguration, audit log inspection, and system health telemetry.

---

## 5. Scope & Features

### 5.1 In-Scope (Phase 0 – Production Release)
1. **Multi-Edition Engine:** Edition switcher, cloning configuration from prior editions, distinct database partitioning by `editionId`.
2. **Configurable Stage Pipeline:** Custom event sequence (Ideathon → Innovatz → CPR 1..N → POC → Demo Day), dynamic stage status (Upcoming, Registration, Submission, Evaluation, Completed), and gate transitions.
3. **Team & Identity Lifecycle:** 
   - Team registration (1 to 6 members, solo allowed).
   - Auto-generation of unique, collision-proof Registration Codes (e.g., `HT26-T042`).
   - Team Lead delegation, invite link generation, member approval.
4. **Artifact Management:**
   - Single Google Slides shareable link validation and automatic conversion to embeddable URL.
   - Secondary file attachments (PDFs, ZIPs, schematics) uploaded and automatically renamed server-side to `{REG_CODE}_{ORIGINAL_FILENAME}`.
5. **Dynamic Rubric & Scoring Engine:**
   - Weighted scoring rubrics customizable per event.
   - 3-Reviewer assignment engine for Ideathon with balanced distribution.
   - Evaluator Cockpit: side-by-side embedded slide deck and responsive rubric input.
   - Statistical score normalization (Z-score / Min-Max / Mean-shift) per evaluator cohort.
6. **Milestone & Check-in Tracker:**
   - Rolling deliverables between review gates.
   - Mentor check-in logging and verification.
7. **Role-Based Access Control (RBAC):**
   - Distinct authorization policies for Super Admin, Coordinator (Manage), Coordinator (View), Evaluator, Mentor, Participant.

### 5.2 Out-of-Scope (Non-Goals for v1)
- **Integrated Video Conferencing:** The platform will not host internal WebRTC video streams; coordinators provide external Zoom/Google Meet links.
- **Direct Code Repository Hosting:** HackTrack will not replace GitHub; teams submit repository URLs and release tags.
- **Direct Financial Prize Disbursement:** Winner announcements and certificates are supported, but automated banking/UPI transfers are excluded.
- **Native Mobile Apps (iOS/Android):** HackTrack is architected as a mobile-responsive Progressive Web App (PWA) optimized for desktop review cockpits.

---

## 6. Assumptions & Dependencies
- **Institutional Identity:** Email domain restriction (e.g., `@college.edu`) can be enforced via Auth.js, with optional guest evaluator credential bypass.
- **Google Slides Permissions:** Teams are instructed to set Google Slides permissions to *"Anyone with the link can view"*. The system will perform client-side verification to detect inaccessible URLs.
- **Storage Subsystem:** Local or S3-compatible object storage (e.g., AWS S3, Cloudflare R2, MinIO) for secondary attachments.
- **Concurrency:** Peak loads will occur during the 2 hours preceding Ideathon submission deadlines and during live Demo Day evaluations.
