# HackTrack — Multi-Edition Collegiate Innovation Platform

HackTrack is a high-scale, reusable web platform engineered to orchestrate an annual multi-stage hackathon program for a premier collegiate institution.

Each annual edition runs an ordered, configurable pipeline:
**Ideathon → Innovatz (Idea Review) → 3 to 5 Continuous Project Reviews (CPR) → Proof of Concept (POC) → Demo Day**, with rolling milestones and bi-weekly mentor check-ins.

---

## 🛠️ Tech Stack
- **Framework:** Next.js 14+ / 15 (TypeScript, App Router)
- **Database:** PostgreSQL managed via Prisma ORM
- **Authentication:** Custom JWT sessions with HTTP-only cookies and invite-only registration
- **Styling:** Tailwind CSS with responsive, WCAG 2.1 AA accessible UI
- **Testing:** Vitest test suite for RBAC and permission rules

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+ (tested on Node v20+)
- npm / pnpm / yarn
- PostgreSQL instance (local or hosted, e.g. Neon, Supabase)

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env` and configure your database connection string and authentication secret:
```bash
cp .env.example .env
```

### 4. Database Setup & Seeding
```bash
# Validate Prisma schema
npm run prisma:validate

# Generate Prisma Client
npm run prisma:generate

# Push schema to database (or create migration)
npx prisma db push

# Seed 1 active edition, 7 stages, rubrics, sample team, and users for all roles
npm run prisma:seed
```

### 5. Running the Application
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the platform.

---

## 👥 Seeded User Accounts (Password: `Password123!`)

| Role | Email | Description | Default Route |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin@hacktrack.edu` | Full platform control, edition lifecycle, audit logs | `/admin` |
| **Coordinator (Manage)** | `coord.manage@hacktrack.edu` | Event pipeline setup, 3-reviewer allocation, normalization | `/coordinator/manage` |
| **Coordinator (View)** | `coord.view@hacktrack.edu` | Read-only macro visibility across all cohorts and scoreboards | `/coordinator` |
| **Evaluator** | `evaluator@hacktrack.edu` | Split-screen cockpit (embedded Google Slides + rubric) | `/evaluator` |
| **Mentor** | `mentor@hacktrack.edu` | Assigned CPR teams and check-in meeting logs | `/mentor` |
| **Participant (Lead)** | `lead@hacktrack.edu` | Team QuantumForge lead (`HT26-T001`), slide deck link | `/team` |
| **Participant (Member)** | `member@hacktrack.edu` | Team QuantumForge member | `/team` |

---

## 🧪 Testing & CI
Run unit tests verifying the RBAC matrix and route permission rules:
```bash
npm run test
```

Run TypeScript type check and lint:
```bash
npm run type-check
npm run lint
```

---

## 📚 Documentation
- [01_PRD.md](docs/01_PRD.md): Product Requirements Document
- [02_SRS.md](docs/02_SRS.md): Software Requirements Specification with FR/NFR IDs
- [03_USER_STORIES.md](docs/03_USER_STORIES.md): User Stories by Role grouped by Epic
- [04_EVENT_GATE_PLAYBOOK.md](docs/04_EVENT_GATE_PLAYBOOK.md): Event-and-Gate Playbook & Lifecycle States
- [05_OPEN_DECISIONS.md](docs/05_OPEN_DECISIONS.md): Architectural Decisions & Normalization Formula
- [06_ARCHITECTURE_AND_ADRS.md](docs/06_ARCHITECTURE_AND_ADRS.md): ADRs and Mermaid Entity-Relationship Diagram
