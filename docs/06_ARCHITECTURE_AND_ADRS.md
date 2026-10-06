# Architecture Document & Architecture Decision Records (ADRs)
## Project: HackTrack — Multi-Edition Collegiate Innovation Platform
**Document Version:** 1.0.0  
**Phase:** Phase 1 — Foundation Architecture & Data Model  
**Status:** Approved  

---

## 1. System Architecture Context

HackTrack is architected as a modular, edition-partitioned web platform designed for continuous annual reuse. It decouples core domain models from hardcoded assumptions, allowing event sequences, weighted rubrics, and team lifecycles to be configured per edition without code modifications.

```mermaid
flowchart TB
    subgraph Client_Tier [Client Presentation Layer]
        P[Participant Team Portal]
        E[Evaluator Cockpit]
        M[Mentor Dashboard]
        CV[Coordinator View-Only Console]
        CM[Coordinator Manage Console]
        SA[Super Admin Panel]
    end

    subgraph App_Tier [Application & Security Layer - Next.js 15]
        MW[Edge RBAC Middleware]
        AUTH[Auth.js / JWT Session Engine]
        NORM[Ideathon Normalization Engine]
        ART[Artifact & Slide Embed Handler]
        API[Server Actions & Route Handlers]
    end

    subgraph Data_Tier [Persistence Layer]
        PRISMA[Prisma ORM Client]
        PG[(PostgreSQL Database)]
        STORAGE[(Object Storage - S3 / R2)]
    end

    P & E & M & CV & CM & SA -->|HTTPS| MW
    MW --> AUTH
    AUTH --> API
    API --> NORM
    API --> ART
    API --> PRISMA
    PRISMA --> PG
    ART --> STORAGE
```

---

## 2. Complete Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    EDITION ||--o{ EVENT : "configures"
    EDITION ||--o{ TEAM : "registers"
    EDITION ||--o{ EDITION_MEMBERSHIP : "scopes"
    EDITION ||--o{ INVITATION : "issues"
    EDITION ||--o{ MILESTONE : "defines"
    EDITION ||--o{ AUDIT_LOG : "records"

    USER ||--o{ EDITION_MEMBERSHIP : "holds"
    USER ||--o{ TEAM_MEMBER : "participates_in"
    USER ||--o{ TEAM : "mentors"
    USER ||--o{ EVALUATION : "evaluates"
    USER ||--o{ CHECK_IN : "logs_mentor_meeting"
    USER ||--o{ INVITATION : "invites"
    USER ||--o{ AUDIT_LOG : "acts_as"

    EVENT ||--o{ RUBRIC : "contains"
    EVENT ||--o{ SUBMISSION : "receives"
    EVENT ||--o{ EVALUATION : "evaluates"
    EVENT ||--o{ MILESTONE : "associates"

    TEAM ||--o{ TEAM_MEMBER : "roster"
    TEAM ||--o{ SUBMISSION : "submits"
    TEAM ||--o{ EVALUATION : "scored_in"
    TEAM ||--o{ CHECK_IN : "participates_in"
    TEAM ||--o{ ARTIFACT : "owns"

    SUBMISSION ||--o{ ARTIFACT : "attaches"

    RUBRIC ||--o{ CRITERION : "specifies"

    EVALUATION ||--o{ EVALUATION_SCORE : "details"
    CRITERION ||--o{ EVALUATION_SCORE : "graded_by"

    EDITION {
        string id PK
        string name
        string slug UK
        string academicYear
        string status
        datetime startDate
        datetime endDate
    }

    USER {
        string id PK
        string email UK
        string name
        string passwordHash
        string globalRole
        boolean isVerified
    }

    EDITION_MEMBERSHIP {
        string id PK
        string userId FK
        string editionId FK
        string role
    }

    EVENT {
        string id PK
        string editionId FK
        string name
        string slug
        int sequenceIndex
        string reviewType
        string status
        datetime submissionDeadline
        datetime evaluationDeadline
    }

    TEAM {
        string id PK
        string editionId FK
        string regCode UK
        string name
        string track
        string status
        string slidesUrl
        string embedSlidesUrl
        string mentorId FK
    }

    TEAM_MEMBER {
        string id PK
        string teamId FK
        string userId FK
        string role
    }

    SUBMISSION {
        string id PK
        string teamId FK
        string eventId FK
        int roundNumber
        string status
        datetime submittedAt
    }

    ARTIFACT {
        string id PK
        string teamId FK
        string submissionId FK
        string fileType
        string originalName
        string storedName
        string fileUrl
    }

    RUBRIC {
        string id PK
        string eventId FK
        string name
        float totalMaxPoints
    }

    CRITERION {
        string id PK
        string rubricId FK
        string title
        float maxPoints
        float weightPercentage
        int sequenceOrder
    }

    EVALUATION {
        string id PK
        string eventId FK
        string teamId FK
        string evaluatorId FK
        string status
        float rawTotalScore
        float normalizedScore
        string generalFeedback
    }

    EVALUATION_SCORE {
        string id PK
        string evaluationId FK
        string criterionId FK
        float score
        string feedback
    }

    CHECK_IN {
        string id PK
        string teamId FK
        string mentorId FK
        datetime meetingDate
        string health
        string notes
    }

    INVITATION {
        string id PK
        string email
        string editionId FK
        string role
        string token UK
        datetime expiresAt
        datetime acceptedAt
    }
```

---

## 3. Architecture Decision Records (ADRs)

### ADR-001: Next.js 15 App Router & Server Actions Architecture
- **Status:** Approved
- **Context:** The platform requires low-latency page loads for evaluators and coordinators, alongside real-time forms for scoring and auto-saving drafts.
- **Decision:** Use Next.js 15 with TypeScript using the App Router. Critical business mutations (evaluations, gate transitions, registrations) use Server Actions and typed Route Handlers with Zod validation.
- **Consequences:** Provides end-to-end type safety, optimistic UI updates, and server-side RBAC verification without exposing business logic or database credentials to the client bundle.

### ADR-002: PostgreSQL & Prisma with Edition-Scoped Partitioning
- **Status:** Approved
- **Context:** The platform is reused across annual editions. Data from prior years must remain immutably preserved while active editions operate with full agility.
- **Decision:** Utilize a unified PostgreSQL database managed by Prisma ORM, where every operational model (`Event`, `Team`, `Milestone`, `EditionMembership`, `Invitation`) includes an indexed foreign key to `Edition`.
- **Consequences:** Simplifies cross-edition analytics for deans while ensuring that queries strictly filter by `editionId` during active operations. Avoids the overhead of managing multi-tenant database clusters.

### ADR-003: JWT Session Management with Per-Edition Role Claims
- **Status:** Approved
- **Context:** Users can hold different roles across different years (e.g. Participant in 2025, Evaluator in 2026), and coordinators need zero-roundtrip authentication checks at the Edge.
- **Decision:** Encode user identity, `globalRole`, and active `editionRole` directly in signed, HTTP-only, encrypted JWT cookies (`ht_session`).
- **Consequences:** Eliminates database lookups on every page navigation. Token refresh automatically updates when switching active editions.

### ADR-004: Strict RBAC Guard Middleware with Write-Protection for Coordinator View
- **Status:** Approved
- **Context:** Institutional stakeholders require read-only macro visibility (`Coordinator View`), but must never be capable of modifying grades, advancing teams, or editing rubrics.
- **Decision:** Implement a declarative route guard in Next.js Middleware that inspects both the route pattern and HTTP verb. If `method` is in `[POST, PUT, PATCH, DELETE]` and the user's role is `COORDINATOR_VIEW`, the request is immediately rejected with HTTP 403 Forbidden.
- **Consequences:** Guarantees tamper-proof protection at the perimeter, even if a user manipulates client-side form controls or sends direct curl requests.

### ADR-005: Sandboxed Google Slides Embed & Sanitized File Naming Pipeline
- **Status:** Approved
- **Context:** Evaluators need instant presentation access without clicking external links or requesting Google Drive permissions. Secondary files (PDFs, ZIPs) must not collide or suffer from inconsistent student naming.
- **Decision:** 
  1. The platform automatically extracts the presentation ID from student Google Slides URLs and converts it to `/embed?start=false&loop=false&delayms=3000`, rendered in a sandboxed iframe.
  2. Uploaded files are renamed server-side to `{REG_CODE}_{SANITIZED_FILENAME}.{ext}` prior to storage persistence.
- **Consequences:** Eliminates presentation tab-switching during evaluations; ensures that every file stored in S3/R2 is deterministically identifiable by team registration code.

### ADR-006: Z-Score Normalization for Ideathon 3-Reviewer Scoring
- **Status:** Approved
- **Context:** Ideathon has 300 ideas evaluated asynchronously across 30+ evaluators. Subjective variance between harsh and lenient evaluators introduces bias.
- **Decision:** Apply per-evaluator Z-score normalization:
  $$Z_{i,j} = \frac{X_{i,j} - \mu_j}{\sigma_j}, \quad S_{\text{norm}, i,j} = \text{clamp}(70 + Z_{i,j} \cdot 15, 0, 100)$$
- **Consequences:** Normalizes all evaluator distributions to an equal mean (70) and standard deviation (15), providing objective, fair rankings for gate cutoffs.
