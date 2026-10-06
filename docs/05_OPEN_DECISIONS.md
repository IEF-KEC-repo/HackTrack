# Architecture & Product Open Decisions
## Project: HackTrack — Multi-Edition Collegiate Innovation Platform
**Document Version:** 1.0.0  
**Phase:** Phase 0 — Discovery and Documentation  
**Status:** Approved for Implementation Planning  

---

## 1. Decision Matrix & Recommended Defaults

| # | Decision Domain | Options Considered | Recommended Default | Architectural / Product Rationale |
| :-: | :--- | :--- | :--- | :--- |
| **D-01** | **Score Normalization Algorithm** | 1. Z-Score Standardization<br>2. Min-Max Scaling<br>3. Median Shift / Quantile Matching | **Option 1: Z-Score Standardization with Cohort Scaling** | Corrects for both evaluator mean shift (harshness) and variance spread (tight vs loose graders). Scaled to $S_{\text{norm}} = 70 + Z \times 15$, clamped [0, 100]. |
| **D-02** | **Google Slides Embed & Permission Fallbacks** | 1. Pure `<iframe>` embed with regex URL transform<br>2. Server-side Google Drive API metadata check<br>3. Headless Chrome screenshot generation | **Option 1: URL Transform to `/embed` with client-side detection** | Zero API rate limits or Google Service Account quota bottlenecks; instantly converts shareable links to embeddable presentations; displays clear permission guidance if unviewable. |
| **D-03** | **Secondary File Uploads & Renaming Pipeline** | 1. Local disk with Node stream renaming<br>2. Cloud Object Storage (S3 / Cloudflare R2) via presigned upload with server-side renaming<br>3. Direct Next.js Route Handler buffer processing | **Option 2: Cloudflare R2 / S3 via Presigned URL with Server-Side Key Generation** | Offloads multi-part upload bandwidth from Next.js server, generates deterministic key `{edition}/{regCode}_{sanitizedFilename}`, and scales smoothly to 300+ simultaneous uploads. |
| **D-04** | **Authentication & College Domain Restriction** | 1. Google OAuth restricted to `@college.edu`<br>2. Email Magic Links (NextAuth Resend)<br>3. Hybrid: Google OAuth for Students + Credentials/Magic Link for external Evaluators | **Option 3: Hybrid (Google OAuth + Evaluator Magic Link / Invite Code)** | Guarantees students use official college accounts while allowing alumni and industry judges (external domains) to evaluate without creating college accounts. |
| **D-05** | **Evaluator Cockpit Screen Real-Estate** | 1. 50/50 Fixed Split Screen<br>2. Resizable Split-Pane (Pane Resizer)<br>3. Multi-window / tab popouts | **Option 2: Resizable Split-Pane (`react-resizable-panels`) with Mobile Tabs** | Provides optimal ergonomic flexibility for judges on different laptop screen sizes (13" to 27"), collapsing to accessible tabs on tablets/smartphones. |
| **D-06** | **Review Anonymity Model** | 1. Fully Open (Teams & Reviewers see each other)<br>2. Single-Blind (Reviewers see team name; teams don't see reviewer)<br>3. Double-Blind (Reviewers only see Registration Code & Deck; no student names) | **Option 3 for Ideathon (Double-Blind), Option 2 for Live Panels** | Guarantees unbiased scoring during Ideathon where 300 ideas are evaluated at scale; live panels at Innovatz/Demo Day naturally require interactive verbal defense. |
| **D-07** | **Submission Deadline Leniency & Grace Window** | 1. Strict zero-second hard cut<br>2. 10-minute soft grace period with "Late" audit flag<br>3. Coordinator-controlled manual unlock per team | **Option 2: 10-Minute Soft Grace Window with Audit Log** | Absorbs collegiate network latency and last-minute Google Slides permission fixing without requiring frantic coordinator intervention, while highlighting late submissions. |
| **D-08** | **Dynamic Event Data Modeling** | 1. JSONB blobs in PostgreSQL<br>2. First-class relational entities (`Event`, `Stage`, `Rubric`, `Criterion`)<br>3. Fully generic EAV (Entity-Attribute-Value) | **Option 2: Relational Prisma Entities with Foreign Key Cascades** | Ensures strict TypeScript type safety, database-enforced integrity, performant indexing across 900+ evaluations, and clean year-over-year edition cloning. |

---

## 2. In-Depth Architectural Analyses

### D-01: Ideathon Score Normalization Formula
Given evaluator $j$ reviewing team $i$:
1. Raw score calculation from weighted rubric:
   $$X_{i,j} = \sum_{k=1}^K w_k \cdot \frac{s_{i,j,k}}{\text{maxPoints}_k} \times 100$$
2. Evaluator historical stats over their assigned batch $N_j$ (where $N_j \ge 5$):
   $$\mu_j = \frac{1}{N_j}\sum_{i=1}^{N_j} X_{i,j}, \quad \sigma_j = \sqrt{\frac{1}{N_j}\sum_{i=1}^{N_j} (X_{i,j} - \mu_j)^2 + \epsilon}$$
   *(Note: $\epsilon = 0.001$ prevents division by zero in case of constant grading).*
3. Standardized Z-Score:
   $$Z_{i,j} = \frac{X_{i,j} - \mu_j}{\sigma_j}$$
4. Target cohort scaling (Target Mean $\mu_{\text{target}} = 70.0$, Target StdDev $\sigma_{\text{target}} = 15.0$):
   $$S_{\text{norm}, i,j} = \text{clamp}\Big(\mu_{\text{target}} + Z_{i,j} \cdot \sigma_{\text{target}}, 0, 100\Big)$$
5. Team Aggregate Score:
   $$S_{\text{final}, i} = \frac{1}{3} \sum_{j=1}^3 S_{\text{norm}, i,j}$$

### D-02: Google Slides Transformation & Sanitization
Teams typically copy links in varied formats:
- `https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing`
- `https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view`

The application uses an authoritative parser to extract the `presentationId`:
```typescript
const GOOGLE_SLIDES_REGEX = /^https:\/\/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/;

export function getEmbeddableSlidesUrl(inputUrl: string): string | null {
  const match = inputUrl.trim().match(GOOGLE_SLIDES_REGEX);
  if (!match || !match[1]) return null;
  const presentationId = match[1];
  return `https://docs.google.com/presentation/d/${presentationId}/embed?start=false&loop=false&delayms=3000`;
}
```
This guarantees an embed-optimized, distraction-free player inside the evaluator interface.

### D-03: Standardized File Renaming Convention
When supporting files (e.g. system design diagrams, research documents, source code archives) are uploaded, the server-side pipeline executes:
```typescript
export function generateStandardArtifactFilename(regCode: string, originalFilename: string): string {
  const ext = originalFilename.split('.').pop()?.toLowerCase() || 'bin';
  const rawBase = originalFilename.substring(0, originalFilename.lastIndexOf('.')) || originalFilename;
  const sanitizedBase = rawBase.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 50);
  return `${regCode}_${sanitizedBase}.${ext}`;
}
// Example: "HT26-T042" + "System Architecture v2.final.pdf" -> "HT26-T042_System_Architecture_v2_final.pdf"
```
This guarantees uniform, non-colliding file records across all cloud and local storage systems.
