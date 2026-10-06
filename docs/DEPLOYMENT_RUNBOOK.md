# HackTrack Production Deployment & Operations Runbook

This runbook provides the standard operating procedures for provisioning, deploying, maintaining, and recovering the HackTrack collegiate platform in production.

---

## 1. System Requirements & Architecture

- **Runtime**: Node.js 18.18+ or Node.js 20 LTS
- **Database**: PostgreSQL 14+ (Managed AWS RDS, Supabase, or on-premise college cluster)
- **Minimum Compute**: 2 vCPU, 4GB RAM (Supports 1,000+ concurrent participants and 300 teams)
- **Persistent Storage**: Local SSD or S3-compatible storage mounted for file uploads (`/uploads`)

---

## 2. Environment Configuration

Ensure the following environment variables are set in `.env.production`:

```ini
# Application
NODE_ENV=production
NEXTAUTH_URL=https://hacktrack.college.edu
NEXTAUTH_SECRET=generate_strong_64_char_hex_secret

# Database
DATABASE_URL=postgresql://hacktrack_app:STRONG_PASSWORD@db.college.edu:5432/hacktrack_prod?schema=public&sslmode=require

# Storage
UPLOAD_STORAGE_PATH=/var/data/hacktrack/uploads
MAX_FILE_SIZE_MB=25

# Email & Notifications (Optional SMTP)
SMTP_HOST=smtp.college.edu
SMTP_PORT=587
SMTP_USER=hacktrack-noreply@college.edu
SMTP_PASSWORD=smtp_secure_password
SMTP_FROM="HackTrack Collegiate Platform <hacktrack-noreply@college.edu>"

# Security & Rate Limiting
RATE_LIMIT_ENABLED=true
TRUSTED_PROXY_HOPS=1
```

---

## 3. Step-by-Step Deployment Procedure

### Step 3.1: Install Dependencies
```bash
git fetch origin main
git checkout main
npm ci --prefer-offline --no-audit
```

### Step 3.2: Run Database Migrations
```bash
npx prisma migrate deploy
npx prisma generate
```

### Step 3.3: Production Build
```bash
npm run build
```

### Step 3.4: Process Management (PM2 or Systemd)
With PM2:
```bash
pm2 start npm --name "hacktrack" -- start -- -p 3000
pm2 save
```

Or with Docker:
```bash
docker build -t hacktrack:v1.0 .
docker run -d --name hacktrack -p 3000:3000 --env-file .env.production hacktrack:v1.0
```

---

## 4. Post-Deployment Verification & Smoke Tests

Verify deployment health immediately after start:

```bash
# 1. Check Health Endpoint
curl -i https://hacktrack.college.edu/api/health
# Expected Output: HTTP 200 OK, "status": "healthy", "database": { "connected": true }

# 2. Check Security Headers
curl -I https://hacktrack.college.edu
# Verify presence of:
# X-Content-Type-Options: nosniff
# X-Frame-Options: SAMEORIGIN
# X-XSS-Protection: 1; mode=block
```

---

## 5. Automated Cron Jobs (Milestones & Reminders)

Configure system crontab (`crontab -e`) to trigger rolling milestone alerts and mentor cadence reminders:

```cron
# Run daily at 09:00 UTC: Check milestone deadlines and send 48h/24h warnings
0 9 * * * curl -X POST https://hacktrack.college.edu/api/cron/milestone-alerts -H "Authorization: Bearer ${CRON_SECRET}"

# Run every Monday at 10:00 UTC: Fortnightly mentor check-in cadence nudge
0 10 * * 1 curl -X POST https://hacktrack.college.edu/api/cron/reminders -H "Authorization: Bearer ${CRON_SECRET}"
```

---

## 6. Backup & Disaster Recovery Procedures

### 6.1 Daily Automated PostgreSQL Backup
```bash
#!/bin/bash
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/var/backups/hacktrack"
mkdir -p ${BACKUP_DIR}

# Full PostgreSQL Database Dump with Compression
pg_dump -U hacktrack_app -h db.college.edu -Fc hacktrack_prod > ${BACKUP_DIR}/hacktrack_${TIMESTAMP}.dump

# Retention: Retain backups for 30 days
find ${BACKUP_DIR} -name "hacktrack_*.dump" -mtime +30 -exec rm {} \;
```

### 6.2 Point-in-Time Database Restore
To restore from a backup file during an incident:
```bash
# 1. Stop web process
pm2 stop hacktrack

# 2. Restore Database Snapshot
pg_restore -U hacktrack_app -h db.college.edu -d hacktrack_prod --clean --if-exists /var/backups/hacktrack/hacktrack_TARGET_TIMESTAMP.dump

# 3. Verify Health
npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM \"Team\";"

# 4. Restart web process
pm2 start hacktrack
```

---

## 7. Emergency Rollback Plan

If a release exhibits critical regressions:
1. Revert to previous Git tag:
   ```bash
   git checkout tags/v1.0.prev
   npm ci
   npm run build
   pm2 restart hacktrack
   ```
2. If database schema was altered, apply rollback migration script or restore pre-deployment database backup snapshot.
3. Validate `/api/health`.
