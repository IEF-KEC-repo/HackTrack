# HackTrack Security & Privacy Audit Checklist

This checklist documents the security controls, authorization matrix, threat mitigations, and data privacy safeguards implemented across the HackTrack collegiate platform.

---

## 1. Security Architecture Summary

```
[ Client Browser ]
        │
        ▼ (HTTPS / TLS 1.3)
[ Next.js Edge Middleware ] ────────► [ Sliding-Window Rate Limiter ] (10-200 req/min)
        │
        ├──► Inject Security Headers (CSP, X-Frame-Options, NoSniff, XSS-Protection)
        ├──► Extract & Verify JWT Session Cookie (httpOnly, sameSite=lax)
        ├──► RBAC Matrix Verification (canAccessRoute & canMutateEventConfig)
        │
        ▼
[ Protected API Handlers / Server Actions ]
        │
        ├──► Input Sanitization & Type Validation
        ├──► File Upload Inspector (25MB max, MIME & Ext Whitelist, Stored-as-RegCode)
        ├──► Double-Blind Gating (Zero score/deck leaks prior to official publication)
        │
        ▼
[ PostgreSQL Database (Prisma ORM) ] ── (Parameterized Queries, No Raw Unsafe SQL)
```

---

## 2. Endpoint Authorization Matrix

Every API route and server action enforces strict role-based access control (RBAC):

| Endpoint / Action | Allowed Roles | Method Restrictions | Security Mechanism |
| :--- | :--- | :--- | :--- |
| `/api/auth/*` | All (Public) | POST | Rate limited to 10 req/min (brute-force defense) |
| `/api/teams/*` | `PARTICIPANT`, `COORDINATOR_MANAGE`, `SUPER_ADMIN` | GET, POST, PATCH | Team leads only can mutate rosters; 6-member cap enforced |
| `/api/artifacts/upload` | `PARTICIPANT`, `COORDINATOR_MANAGE` | POST | 15 req/min; 25MB max; renamed to `${REGCODE}_...` |
| `/api/evaluator/*` | `EVALUATOR`, `SUPER_ADMIN` | GET, POST | Only assigned evaluators can score; double-blind sandboxed deck |
| `/api/evaluator/scoring/submit`| `EVALUATOR` | POST | Enforces $\ge 20$ chars feedback; review locks upon submit |
| `/api/coordinator/events/*` | `COORDINATOR_MANAGE`, `SUPER_ADMIN` | GET, POST, PUT, DELETE | `COORDINATOR_VIEW` blocked with `403` |
| `/api/coordinator/scoring/allocate`| `COORDINATOR_MANAGE`, `SUPER_ADMIN` | POST | Circular balanced allocation with COI exclusion |
| `/api/coordinator/scoring/reopen` | `COORDINATOR_MANAGE`, `SUPER_ADMIN` | POST | Reopening requires mandatory written audit rationale |
| `/api/coordinator/analytics/*` | `COORDINATOR_MANAGE`, `COORDINATOR_VIEW`, `SUPER_ADMIN` | GET | Read-only analytics visible to both coordinator tiers |
| `/api/coordinator/decisions/*` | `COORDINATOR_MANAGE`, `SUPER_ADMIN` | POST | `COORDINATOR_VIEW` blocked; `CONDITIONAL`/`EXIT` require notes |
| `/api/leaderboard/results` | All Roles | GET | Hidden from participants until `leaderboardPublished === true` |
| `/api/team/feedback` | `PARTICIPANT` | GET | Blocked with `403` until `feedbackReleased === true` |
| `/api/export/*` | `COORDINATOR_MANAGE`, `COORDINATOR_VIEW`, `SUPER_ADMIN` | GET | RFC 4180 CSV with UTF-8 BOM; 100% numerical parity |
| `/api/health` | Public / Monitoring | GET | Reports latency, memory, uptime; no sensitive keys leaked |

---

## 3. Threat Mitigation Checklist

### 3.1 Input Validation & Path Traversal Prevention
- [x] **File Sanitization**: `sanitizeFilename` strips directory traversal (`../`, `..\`), special characters, and shell injection tokens.
- [x] **RegCode Storage Renaming**: Stored files are always renamed to `${cleanRegCode}_${cleanBase}_${timestamp}.${cleanExt}`.
- [x] **File Size & Type Whitelist**: Strict 25MB maximum limit. Whitelist: `.pdf`, `.zip`, `.png`, `.jpg`, `.jpeg`, `.docx`.
- [x] **Google Slides Verification**: RegEx validation ensures presentation URL starts with `https://docs.google.com/presentation/d/{ID}`.

### 3.2 SQL & Query Injection Defense
- [x] **Prisma Parameterized Queries**: All database queries use Prisma's strongly typed query generator.
- [x] **No String-Concatenated SQL**: Zero dynamic raw string interpolation in database operations.

### 3.3 Privilege Escalation & Role Bypasses
- [x] **Two-Tier Coordinator Isolation**: `canMutateEventConfig` explicitly excludes `COORDINATOR_VIEW`. All mutation endpoints return `403 COORDINATOR_VIEW_WRITE_BLOCKED`.
- [x] **Team Role Boundaries**: Only members with role `LEAD` can issue invitations, update slides URLs, or delete team assets.
- [x] **Conflict of Interest Enforcement**: Evaluators with mentorship, co-authorship, or personal links cannot be assigned or score affiliated teams.

### 3.4 Rate Limiting & Denial of Service
- [x] **Sliding-Window Limiter**: In-memory rate limiting with automatic background eviction of expired windows.
- [x] **Tiered Capacity**:
  - `AUTH`: 10 requests / minute per IP
  - `UPLOAD`: 15 requests / minute per IP
  - `EVALUATOR`: 60 requests / minute per IP
  - `GENERAL`: 200 requests / minute per IP
- [x] **HTTP 429 Compliance**: Exceeded requests receive `429 Too Many Requests` with `Retry-After: <seconds>` headers.

### 3.5 Session Security & Transport Protection
- [x] **Cookie Security**: Auth cookies configured with `httpOnly: true`, `secure: true` (in production), and `sameSite: "lax"`.
- [x] **JWT Token Expiry**: Configured with 7-day rolling session validity.
- [x] **HTTP Security Headers**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

## 4. Student Data Privacy & FERPA Compliance

1. **Double-Blind Evaluation**: During Ideathon screening, evaluators score ideas based solely on problem statement, solution abstract, tech stack, and pitch deck. Student names, GPAs, and personal contact info are suppressed from evaluator cockpits.
2. **Controlled Feedback Release**: Scores and written remarks are strictly withheld until the coordinator team completes normalization and calibration.
3. **Data Retention & Snapshots**: Automated backups are encrypted and checksum-validated using SHA-256 to ensure data authenticity.
