#!/usr/bin/env bash
#
# Vercel build entrypoint for HackTrack.
#
# This runs on Vercel's Linux runtime, where Supabase's IPv4 shared pooler is
# reachable (the direct db.<ref>.supabase.co host is IPv6-only and cannot be
# reached from Vercel Functions or from the Windows dev machine).
#
# Steps:
#   1. prisma generate  - regenerate the client for the Linux build platform
#   2. [production only] migrate resolve - one-time baseline of the schema
#   3. [production only] migrate deploy  - apply pending migrations (no-op after baseline)
#   4. [production + RUN_SEED=1] seed    - one-off seeding
#   5. next build
#
set -euo pipefail

echo "=== [vercel-build] prisma generate ==="
npx prisma generate

if [ "${VERCEL_ENV:-development}" = "production" ]; then
  # The live schema was created manually in the Supabase SQL editor. `0_init`
  # was never recorded in `_prisma_migrations`, so without this baseline a later
  # `prisma migrate deploy` would try to re-create existing tables and fail.
  # Idempotent: on subsequent builds Prisma returns P3008 (already recorded),
  # which we intentionally swallow.
  echo "=== [vercel-build] baseline 0_init (idempotent) ==="
  npx prisma migrate resolve --applied 0_init \
    || echo "[vercel-build] 0_init already recorded - continuing"

  echo "=== [vercel-build] prisma migrate deploy ==="
  npx prisma migrate deploy
else
  echo "=== [vercel-build] skipping migrations (VERCEL_ENV=${VERCEL_ENV:-local}) ==="
fi

# One-off seeding trigger. `prisma/seed.ts` is NOT safe to run on every build
# (it creates a rubric with prisma.rubric.create), so it only runs when the
# production build is explicitly invoked with `--build-env RUN_SEED=1`.
if [ "${RUN_SEED:-0}" = "1" ] && [ "${VERCEL_ENV:-development}" = "production" ]; then
  echo "=== [vercel-build] RUN_SEED=1 - seeding database ==="
  npx tsx prisma/seed.ts
else
  echo "=== [vercel-build] seed skipped (pass --build-env RUN_SEED=1 to run) ==="
fi

# One-off, sentinel-gated E2E test-data cleanup. It is armed by committing the
# file `scripts/.e2e-cleanup-armed` and disarmed by deleting it; it never runs
# on an ordinary build. See scripts/cleanup-e2e.ts.
if [ -f "scripts/.e2e-cleanup-armed" ] && [ "${VERCEL_ENV:-development}" = "production" ]; then
  echo "=== [vercel-build] e2e cleanup armed - running scripts/cleanup-e2e.ts ==="
  npx tsx scripts/cleanup-e2e.ts
else
  echo "=== [vercel-build] e2e cleanup not armed - skipping ==="
fi

echo "=== [vercel-build] next build ==="
npx next build
