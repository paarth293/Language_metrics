# Language Metrics — Production On-Call & Operational Runbook

**Version:** 1.0.0  
**Target System:** Production (Teacher Portal, Student Portal, Admin Panel)  
**Last Updated:** September 7, 2026

---

## 1. Incident Severity Matrix & SLA

| Severity | Definition | Target Response | Target Resolution (RTO) |
| :--- | :--- | :--- | :--- |
| **P1 - Critical** | Platform-wide outage, database corruption, or complete payment/video breakdown | < 5 minutes | < 1 hour |
| **P2 - High** | Degraded feature (e.g. video connection slow, search slow, Redis down with DB fallback) | < 15 minutes | < 4 hours |
| **P3 - Medium** | Non-critical component issue (e.g. avatar upload delayed, notification retry) | < 1 hour | < 24 hours |
| **P4 - Low** | Minor cosmetic defect or non-blocking UI inquiry | Next business day | Next sprint release |

---

## 2. Fast Rollback Procedure (RTO < 5 Minutes)

If a newly deployed release introduces unexpected exceptions or breaks core workflows:

1. **Vercel Instant Rollback (Fastest - < 60s):**
   - Open Vercel Project Dashboard (`teacher-web`, `student-web`, or `admin-panel`).
   - Navigate to **Deployments**.
   - Locate the last known good deployment.
   - Click the **`...`** menu and select **Instant Rollback**.
   - Confirm domain traffic promotion.

2. **Git Revert Procedure:**
   ```bash
   # Revert the faulty commit
   git revert <bad-commit-hash> -m 1
   git push origin main
   # Vercel CI/CD automatically detects the push and re-deploys (< 2 min)
   ```

---

## 3. Disaster Recovery Scenarios & Procedures

### Scenario 1: Database Outage or Data Corruption
- **Symptom**: Database connection timeouts or duplicate booking anomalies.
- **RTO**: < 1 hour | **RPO**: < 24 hours (Automated daily snapshots)
- **Mitigation Procedure**:
  1. Access Supabase Database Dashboard.
  2. Switch to **Backups** tab and select the most recent point-in-time snapshot.
  3. Initiate restore to new instance or current instance during a scheduled 10-minute maintenance window.
  4. Verify data integrity:
     ```sql
     SELECT COUNT(*) FROM "User";
     SELECT COUNT(*) FROM "Booking";
     ```
  5. Restart Next.js serverless functions (re-deploys cache warmers).

### Scenario 2: LiveKit Video Cloud Outage
- **Symptom**: Students/teachers receive connection errors entering `/live/[sessionId]`.
- **RTO**: Dependent on LiveKit status (< 30 min)
- **Mitigation Procedure**:
  1. Check LiveKit Cloud status (`https://status.livekit.io`).
  2. If down, activate platform notice banner via Admin Panel.
  3. Students whose classes were interrupted are granted automatic 100% coin refund via Admin Panel or `/api/students/classes/[id]/cancel`.

### Scenario 3: Payment Gateway (Razorpay) Outage
- **Symptom**: Order creation or webhook signature verification fails.
- **RTO**: < 24 hours (Queue-backed)
- **Mitigation Procedure**:
  1. All webhook events are logged in Redis with idempotency keys.
  2. Once Razorpay status recovers, unverified orders are reconciled using Razorpay Payment ID lookup.
  3. No student is double-debited due to Redis idempotency checks (`checkAndSetIdempotency`).

### Scenario 4: Redis Cache Degradation
- **Symptom**: Redis connection timeouts reported in `/api/health`.
- **RTO**: 0 min (Automatic fail-open)
- **Mitigation Procedure**:
  1. The application architecture implements automatic fail-open / DB fallback when Redis is unreachable.
  2. API endpoints continue functioning directly against PostgreSQL.
  3. Restart Upstash Redis instance or verify network credentials (`REDIS_URL`).

---

## 4. Health & Performance Monitoring Endpoints

Each application exposes a deep probing health endpoint:
- `GET /api/health`
  - Validates PostgreSQL connectivity (`SELECT 1`).
  - Validates Redis responsiveness (`ping`).
  - Returns HTTP 200 when healthy, HTTP 503 when critical services are degraded.

---

## 5. Escalation & Contact Directory

- **Technical Lead**: Priyanshu Raj (Co-Founder & Technical Lead)
- **Full Stack Developer**: Paarth Gupta
- **Status Page**: `https://language-metrics.status.io`
