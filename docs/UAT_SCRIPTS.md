# HackTrack Master Test Plan & User Acceptance Testing (UAT) Scripts

This document provides the formal User Acceptance Testing (UAT) scripts for the HackTrack platform prior to production release. Every critical journey across all six personas is covered with preconditions, execution steps, expected outcomes, and sign-off criteria.

---

## 1. Test Strategy & Scope Overview

| Test Dimension | Scope | Target Benchmark / SLA |
| :--- | :--- | :--- |
| **Cohort Scale** | 1,000+ Participants, 300 Teams | Solo allowed, 1 to 6 members/team |
| **Ideathon Reviews** | 900 Overlapping Evaluations | Strictly 3 reviewers/team, Workload variance $\Delta \le 1$ |
| **Normalization** | Standardized Z-Score Engine | Execution latency $< 500\text{ms}$, Hand-calculation match |
| **Leaderboard Gating** | Unreleased Results Concealment | Zero data leak to participants until published |
| **Security & RBAC** | 6-Role Permission Matrix | View-only write block (`403`), Rate limit triggers (`429`) |
| **Accessibility** | WCAG 2.1 AA Compliance | Contrast $\ge 4.5:1$, Keyboard navigable, ARIA compliant |

---

## 2. UAT Script 1: Participant Team Registration, Deck Ingestion & Milestone Evidence

**Persona**: `PARTICIPANT` (Team Lead & Members)  
**Objective**: Verify team creation, member invitation within capacity (1–6), Google Slides verification, and upload renaming.

| Step | Action | Expected Result |
| :--- | :--- | :--- |
| **1.1** | Navigate to `/auth/register` and create a student account. | Account created with global role `USER`. |
| **1.2** | Navigate to `/team` and initialize a new team: Name: `QuantumForge`, Track: `AI/ML & Edge Computing`. | Team created with registration code `HT26-T001`. Current user becomes `LEAD`. |
| **1.3** | From Team Hub, send invitation to `teammate@college.edu`. | Invite token generated; pending invite appears in roster table. |
| **1.4** | Attempt to invite a 7th member after 6 slots are claimed. | System blocks action with error: *"Team roster limit reached (maximum 6 members allowed)."* |
| **1.5** | Paste valid Google Slides shareable URL: `https://docs.google.com/presentation/d/.../edit?usp=sharing`. | System validates link and generates sandboxed embed URL. Green "Verified Public" badge appears. |
| **1.6** | Paste an invalid URL (e.g. Dropbox link or raw Google Drive folder). | Validation fails with clear format requirement error message. |
| **1.7** | Upload milestone evidence PDF `architecture_v1.pdf`. | Server sanitizes and stores file as `HT26-T001_architecture_v1_<timestamp>.pdf`. |

---

## 3. UAT Script 2: Full Event-by-Event Progression Lifecycle (Ideathon → Demo Day)

**Persona**: `PARTICIPANT` & `COORDINATOR_MANAGE`  
**Objective**: Validate full pipeline progression through all 6 gates, testing `CONTINUE`, `CONDITIONAL`, and `EXIT` transitions.

| Stage | Action | Expected Result |
| :--- | :--- | :--- |
| **Stage 1: Ideathon** | 3 Evaluators complete double-blind scoring. Coordinator Manage records `CONTINUE`. | Team advances to Stage 2. Stepper displays "Stage 1: Completed ✅". Team score: 92.45. |
| **Stage 2: Innovatz** | Panel evaluation concludes. Coordinator Manage records `CONTINUE`. | Team advances to Stage 3 (CPR 1). Stepper updates. |
| **Stage 3: CPR 1** | Team submits architecture deliverable. Coordinator records `CONDITIONAL` with note: *"Must submit hardware BOM and bench latency report before CPR 2."* | Team receives Amber Alert on `/team/progress` detailing mandatory condition notes. Stepper reflects Conditional status. |
| **Stage 4: CPR 2** | Team uploads required hardware BOM. Coordinator verifies and records `CONTINUE`. | Conditional status clears. Team clears mid-point stress review. |
| **Stage 5: POC** | Working prototype video link verified. Coordinator records `CONTINUE`. | Team qualifies as Demo Day Finalist. |
| **Stage 6: Demo Day** | Final live jury panel scores team. Leaderboard is published. | Team places #1 Champion on Gold Podium. Official standing displays on `/results`. |

---

## 4. UAT Script 3: Evaluator Queue, Anchor Calibration & Split-Screen Scoring Cockpit

**Persona**: `EVALUATOR`  
**Objective**: Validate queue overview, deadline countdown, calibration anchor, COI recusal, and locked scoring.

| Step | Action | Expected Result |
| :--- | :--- | :--- |
| **3.1** | Log in as assigned faculty evaluator (`evaluator@college.edu`). | Redirected to `/evaluator` Queue Dashboard. |
| **3.2** | Verify queue overview header. | Displays evaluator name, completion progress bar (e.g. 33%), and countdown pill (`⏳ Closes In: 2d 14h`). |
| **3.3** | Identify calibration anchor in queue (`ANCHOR-01`). Click "Launch Cockpit". | Split-screen cockpit opens. Purple badge indicates `🎯 Calibration Anchor`. |
| **3.4** | On an assigned team with personal connection, click "Declare Conflict". Enter affiliation note. | Team is immediately removed from evaluator's queue and queued for re-allocation. Evaluator recused. |
| **3.5** | In split-screen cockpit, view left panel Google Slides deck. | Sandboxed iframe renders presentation deck with keyboard arrow controls enabled. |
| **3.6** | Click Level 1, 3, and 5 anchor pills on rubric criteria. | Running composite score updates live; fine-tuning slider reflects score. Auto-save status displays "Draft auto-saved". |
| **3.7** | Attempt to submit with general feedback $< 20$ characters. | Submit button is disabled; character counter displays amber warning. |
| **3.8** | Enter 50 characters of constructive feedback and click "Finalize & Submit Review". | Confirmation modal appears showing raw composite score. Upon confirmation, review locks (`🔒 Evaluation Finalized & Locked`). |

---

## 5. UAT Script 4: Mentor Guidance Cadence & Fortnightly Check-In Tracking

**Persona**: `MENTOR` & `PARTICIPANT`  
**Objective**: Validate assigned team roster, check-in logging, and automated $>14$-day cadence alerts.

| Step | Action | Expected Result |
| :--- | :--- | :--- |
| **4.1** | Log in as assigned mentor (`mentor@college.edu`). | Redirected to `/mentor` dashboard displaying assigned teams. |
| **4.2** | Select team `HT26-T001` and log a check-in: Mode: `VIRTUAL_MEETING`, Topic: `Edge Tensor Quantization`. | Check-in is saved with timestamp and notes. Cadence resets to 0 days. Health badge shows `Healthy ✅`. |
| **4.3** | Inspect a team whose last recorded check-in was 18 days ago. | System flags cadence as overdue. Amber alert appears on both Mentor and Participant dashboards. |
| **4.4** | Check-in reminder cron trigger executes. | Automated reminder notification dispatched to team lead and mentor. |

---

## 6. UAT Script 5: Coordinator (Manage) Operations, Allocations & Leaderboard Publication

**Persona**: `COORDINATOR_MANAGE` & `SUPER_ADMIN`  
**Objective**: Validate full pipeline operations, circular allocation, outlier triage, decision recording, and results publication.

| Step | Action | Expected Result |
| :--- | :--- | :--- |
| **5.1** | Log in as Coordinator Manage (`coord.manage@college.edu`). | Top banner displays `🛠️ Manage Tier Active`. Full CRUD authorized. |
| **5.2** | Navigate to `/coordinator/events`. Reorder CPR 1 and CPR 2 or add a new milestone checkpoint. | Event list reordered successfully; database reflects updated `sequenceIndex`. |
| **5.3** | Navigate to `/coordinator/evaluations` and click "Allocate Reviewers" for Ideathon. | Circular overlapping allocation assigns strictly 3 evaluators per idea with workload variance $\Delta \le 1$. |
| **5.4** | Inspect "Divergence Outliers" section on leaderboards. | Teams with reviewer spread $\ge 20$ pts or $\sigma > 15$ are flagged with `⚠️ Outlier Divergence`. |
| **5.5** | Click "Provision 4th Reviewer" on an outlier team. | Independent tie-breaker evaluator assigned without disrupting existing scores. |
| **5.6** | Click "Reopen Evaluation" on a finalized review, entering audit reason *"Scored wrong deck version"*. | Evaluation status transitions from `SUBMITTED` to `DRAFT`. Audit log records timestamp, coordinator ID, and reason. |
| **5.7** | Navigate to `/results` and toggle "Publish to Participants". | Leaderboard status switches to `Publicly Visible`. Participant access is immediately unblocked. |

---

## 7. UAT Script 6: Coordinator (View-Only) Read Access & Write Protection Enforcement

**Persona**: `COORDINATOR_VIEW`  
**Objective**: Verify complete institutional visibility with strict mutation blocking (`403`).

| Step | Action | Expected Result |
| :--- | :--- | :--- |
| **6.1** | Log in as View-Only Coordinator (`coord.view@college.edu`). | Top banner displays `👁️ View-Only Tier Active`. |
| **6.2** | Navigate to `/coordinator/analytics`. | Cohort funnels, overdue radars, and score distributions load completely. |
| **6.3** | Click "Export Standings CSV" and "Print PDF Report". | Exports download immediately with 100% precision parity. |
| **6.4** | Attempt to click "Send Nudge", "Record Decision", or "Publish Leaderboard". | Action buttons are disabled or hidden with informative tooltip. |
| **6.5** | Attempt direct POST request to `/api/coordinator/decisions/record`. | Server returns `403 Forbidden` with code `COORDINATOR_VIEW_WRITE_BLOCKED`. |

---

## 8. UAT Script 7: Leaderboard Concealment Gating (Zero Leakage)

**Persona**: `PARTICIPANT` vs `COORDINATOR_MANAGE`  
**Objective**: Guarantee that unreleased leaderboards leak zero score or ranking data to participants.

| Step | Action | Expected Result |
| :--- | :--- | :--- |
| **7.1** | With leaderboard unpublished, participant navigates to `/results`. | Institutional placeholder renders: *"Results Pending Official Publication"*. Zero scores, ranks, or team names shown. |
| **7.2** | Participant inspects network traffic / calls `/api/leaderboard/results`. | API returns `{ published: false, message: "..." }`. No competitor scores or rankings in response payload. |
| **7.3** | Coordinator (Manage) visits `/results`. | Preview mode banner renders. Full draft rankings visible for committee review. |
| **7.4** | Coordinator clicks "Publish to Participants". Participant refreshes page. | Top 3 podium cards and complete comparative table display instantly. |

---

## 9. UAT Script 8: Export Precision & Printable Report Parity

**Persona**: `COORDINATOR_MANAGE` & Auditors  
**Objective**: Validate 100% numerical parity between on-screen tables and exported CSV / PDF documents.

| Step | Action | Expected Result |
| :--- | :--- | :--- |
| **8.1** | On `/results`, note on-screen values for Team 1: Normalized: `92.45`, Raw Avg: `89.00`, Z-Score: `+1.452`. | Exact numbers noted. |
| **8.2** | Click "Export CSV" (`/api/export/scores?edition=ht26`). Open file in Excel. | UTF-8 BOM (`\uFEFF`) ensures proper encoding. Row 1 matches: `92.45`, `89.00`, `+1.452`. Zero rounding drift. |
| **8.3** | Click "Print / PDF Report" (`/api/export/report?autoprint=true`). | Clean A4 landscape printable HTML renders with official audit headers, summary cards, and podium styling. |
