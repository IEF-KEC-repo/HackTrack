-- Scope cut: remove the non-Slides file upload feature entirely.
-- The Google Slides link (Team.slidesUrl / Submission.slidesUrl) is unaffected.

-- DropForeignKey
ALTER TABLE "TeamMilestone" DROP CONSTRAINT IF EXISTS "TeamMilestone_evidenceFileId_fkey";

-- AlterTable: milestone evidence is now link-only
ALTER TABLE "TeamMilestone" DROP COLUMN IF EXISTS "evidenceFileId";
ALTER TABLE "TeamMilestone" DROP COLUMN IF EXISTS "evidenceType";

-- AlterTable: per-event upload governance is no longer used
ALTER TABLE "Event" DROP COLUMN IF EXISTS "uploadsEnabled";

-- DropTable: the Artifact table only ever stored uploaded-file records
DROP TABLE IF EXISTS "Artifact";

-- DropEnum
DROP TYPE IF EXISTS "EvidenceType";
