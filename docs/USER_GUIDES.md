# HackTrack Persona User Guides

Comprehensive operational manuals for all HackTrack personas:
1. [Participant User Guide](#1-participant-user-guide)
2. [Evaluator User Guide](#2-evaluator-user-guide)
3. [Coordinator (View-Only) User Guide](#3-coordinator-view-only-user-guide)
4. [Coordinator (Manage) User Guide](#4-coordinator-manage-user-guide)

---

## 1. Participant User Guide

Welcome to HackTrack! This guide helps you and your teammates navigate team creation, pitch deck submissions, milestone tracking, and stage advancements.

### 1.1 Team Formation & Invitations
- **Team Size**: Teams can consist of **1 to 6 members** (solo participation is fully supported).
- **Creating a Team**:
  1. Go to **Team Hub** (`/team`).
  2. Enter your team name, select your domain track, and provide your problem statement and solution abstract.
  3. Your team will receive a unique **Registration Code** (e.g. `HT26-T042`).
- **Inviting Members**:
  - The Team Lead can invite teammates via their college email from the Team Hub.
  - Teammates receive an email with an accept/decline link.
  - The roster cannot exceed 6 members.

### 1.2 Google Slides Pitch Deck Submission
- **Important**: Pitch decks must be submitted as a **shareable Google Slides URL** (no file uploads for pitch decks).
- **Permissions Requirement**: Set link sharing in Google Slides to *"Anyone with the link can view"*.
- **Validation**: Paste your link into Team Hub. The platform verifies public access and generates a sandboxed embed preview. If valid, a green **Verified Public** badge appears.
- Evaluators will view your live presentation deck in their split-screen scoring cockpit.

### 1.3 Tracking Event-by-Event Progress
- Navigate to **Event-by-Event Progress** (`/team/progress`).
- The sequential pipeline displays each gate: **Ideathon → Innovatz → Continuous Project Reviews (CPR 1..N) → POC → Demo Day**.
- At each gate, your official decision is displayed:
  - **CONTINUE** (Green): Your team has cleared the gate and advanced to the next review!
  - **CONDITIONAL** (Amber): Advancement granted subject to mandatory remedial conditions. Review the coordinator notes and submit the requested items before the next gate.
  - **EXIT** (Slate): Your active competition journey has concluded at this stage. All reviewer feedback remains accessible.

### 1.4 Milestones & Mentor Cadence
- **Mandatory Deliverables**: Check the deliverable checklist for mandatory checkpoints (e.g. System Architecture Diagram, Bench Latency Benchmarks).
- **Attaching Evidence**: Mark a deliverable complete by attaching an external link (GitHub PR, Figma design, or demo video) as proof of work.
- **Mentor Guidance**: You must meet with your assigned mentor at least once every **14 days**. Your cadence health status will show `Healthy ✅` or flag an amber warning if check-ins lapse.

---

## 2. Evaluator User Guide

Welcome to the HackTrack Evaluation Panel. Evaluators perform double-blind, objective scoring supported by dynamic rubric anchors and automated Z-score standardization.

### 2.1 The Evaluator Queue Dashboard
- Log in and navigate to `/evaluator`.
- **Queue Progress Bar**: Displays your completed evaluations vs total assigned (e.g. `8 / 12 Submitted — 67%`).
- **Deadline Countdown**: Displays remaining time before the evaluation window closes (e.g. `⏳ Closes In: 2d 14h 32m`).
- **Calibration Anchors**: Sample benchmark projects marked with `🎯 Calibration Anchor` help calibrate scoring across the entire reviewer cohort.

### 2.2 Declaring a Conflict of Interest (COI)
- If you have an academic, personal, or mentorship affiliation with any assigned team:
  1. Click the **"Declare Conflict"** button (`⚖️ COI`) on the queue table or cockpit header.
  2. Enter the nature of the affiliation (e.g. *"Undergraduate research advisee"*).
  3. The team is immediately removed from your queue and automatically queued for re-allocation.

### 2.3 Split-Screen Scoring Cockpit
- Click **"Launch Cockpit 🎯"** on any team in your queue:
  - **Left Pane (50%)**: Live Google Slides presentation deck running in a sandboxed iframe. Use keyboard arrow keys to navigate slides.
  - **Right Pane (50%)**: Weighted rubric scoring form.
- **Dynamic Scale Anchors**: Click **Level 1**, **Level 3**, or **Level 5** anchor pills to automatically calibrate the criterion score. Use the slider for fine-tuning.
- **Auto-Save**: Scores are debounced and saved automatically as drafts (`Draft auto-saved`).
- **Mandatory Qualitative Feedback**: General feedback requires at least **20 characters** of constructive commentary before the submission can be finalized.
- **Final Submission Lock**: Click **"Finalize & Submit Review"**. Once locked, reviews cannot be edited unless reopened by a Coordinator (Manage).

---

## 3. Coordinator (View-Only) User Guide

The Coordinator (View-Only) tier provides full institutional transparency for department chairs, deans, and external auditors without risk of accidental data modification.

### 3.1 What You Can View
- **Cohort Analytics Funnel** (`/coordinator/analytics`): View sequential retention and drop-off percentages from registered teams down to Demo Day finalists.
- **Operational Overdue Radar**: View all overdue items across the edition (missing slides, late milestone deliverables, lapsed mentor touchpoints, and incomplete evaluator queues).
- **Score Distribution Metrics**: Inspect statistical quartiles, means, and standard deviations comparing raw scores against calibrated Z-score distributions.
- **Evaluator Harshness Profiles**: Monitor reviewer grading tendencies (`HARSH`, `MODERATE`, `GENEROUS`) and workload balance.
- **Audit Logs** (`/coordinator/audit`): Complete immutable chronological log of all coordinator actions.

### 3.2 Write Protection
- All mutation buttons (Publish, Reopen, Nudge, Allocate, Record Decisions) are automatically disabled or hidden.
- Any direct POST/PUT/DELETE API request returns an HTTP `403 Forbidden` (`COORDINATOR_VIEW_WRITE_BLOCKED`).

### 3.3 Data & Report Exports
- Instant download of official CSV spreadsheets:
  - **Teams & Ideas CSV**: Registration codes, tracks, leads, members, problem statements, and slide links.
  - **Leaderboard CSV**: Exact 100% numerical parity with on-screen standings.
  - **Rubric Feedback CSV**: Criteria ratings and qualitative reviewer feedback.
  - **Milestone Compliance CSV**: Deliverable completion tracking.
- **Printable PDF Reports**: Click **"Print / PDF"** to generate an executive A4 landscape audit document with summary cards and podium badges.

---

## 4. Coordinator (Manage) User Guide

Coordinators in the Manage tier (typically 2 to 3 designated faculty operators) possess full operational authority to configure events, run reviewer allocations, triage score discrepancies, and record progression decisions.

### 4.1 Event Pipeline Configuration
- Navigate to `/coordinator/events`.
- Reorder, rename, or add edition stages (e.g. changing from 3 CPRs to 4 CPRs for a specific year).
- Set stage gates, dates, and review formats (`ASYNC_MULTI_REVIEWER` for Ideathon, `LIVE_PANEL` for Demo Day).

### 4.2 Reviewer Allocation & Workload Balancing
- Navigate to `/coordinator/evaluations`.
- Click **"Allocate Reviewers"** for Ideathon:
  - Enforces strictly **3 reviewers per team**.
  - Employs a circular overlapping offset algorithm guaranteeing that evaluators share overlapping cohorts of teams, preventing isolated evaluation islands and enabling cross-evaluator Z-score normalization.
  - Workload balance guarantee: No evaluator's assignment count differs by more than 1 ($\Delta \le 1$).
  - Automatically respects all declared Conflicts of Interest (COI).

### 4.3 Divergence Outlier Triage
- Teams with significant reviewer disagreement ($(\max - \min) \ge 20.0$ points or reviewer standard deviation $\sigma > 15.0$) are automatically highlighted with an **"Outlier Divergence"** badge.
- Click **"Provision 4th Reviewer"** to assign an independent reviewer to break the panel deadlock without invalidating completed scores.

### 4.4 Reopening Evaluations
- If an evaluator contacted the committee regarding an error:
  1. Find the evaluation record in the scoring console.
  2. Click **"Reopen Evaluation"**.
  3. Enter the mandatory audit reason (e.g. *"Evaluator requested revision after reviewing updated slide deck"*).
  4. The record unlocks for the evaluator, and the action is recorded in the permanent audit trail.

### 4.5 Stage Advancement Decisions
- Navigate to `/results`.
- Select any team and click **"Record Gate Decision"**:
  - **CONTINUE**: Advances the team to the next edition event.
  - **CONDITIONAL**: Requires mandatory remedial conditions (min 5 characters) detailing required actions before the next gate.
  - **EXIT**: Requires a constructive exit rationale note.
- Saving a decision automatically dispatches in-app notifications and branded emails to all team members.

### 4.6 Publishing the Leaderboard
- By default, event rankings and scores are **strictly concealed** from participants during review calibration.
- Once score calibration and outlier resolution conclude:
  1. Click **"Publish to Participants"** on the `/results` page.
  2. Standings, podium badges (Gold, Silver, Bronze), and rubric feedback become immediately visible to all participants.
