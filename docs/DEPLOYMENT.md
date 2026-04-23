# Deployment Strategy

## 1. Environments

| Environment | Purpose | Data |
|-------------|---------|------|
| **dev** | Local or shared; fast iteration. | synthetic / anonymized |
| **staging** | Pre-prod, load test, full pipeline. | prod-like, masked |
| **production** | Live events. | real |

**Config:** 12-factor; secrets from vault (AWS Secrets Manager, HashiCorp Vault) or platform secrets.

## 2. Containerization

- **One image** for API; **separate image** (or same with different CMD) for **workers** (map processing) to scale CPU/GPU independently.
- **Non-root** user, read-only root filesystem where possible, `HEALTHCHECK` in Dockerfile.

## 3. Orchestration (Recommended)

**Kubernetes (EKS, GKE, AKS)** or **ECS Fargate**:

- **API** deployment: HPA on CPU/requests per second, min 2 replicas for availability.
- **Workers:** KEDA or HPA on **queue depth**; GPU node pool for CV if self-hosted; alternatively **managed** OCR/CV API to avoid GPU ops.
- **Migrations:** Job pre-hook or init container **before** new version serves traffic; backward-compatible changes only.

## 4. Data Stores

- **PostgreSQL:** RDS / Cloud SQL / Azure Database, **Multi-AZ**, automated backups, PITR. PostGIS extension enabled. Connection pooling: **PgBouncer** in transaction mode.
- **Redis:** ElastiCache / MemoryStore for **route cache**, **sessions**, **rate limits**.
- **Object storage:** S3 / GCS / Azure Blob for PDFs, rasters, derived masks, **tiled** pyramids (optional) for very large images.

## 5. Network & Security

- **TLS** end-to-end; TLS 1.2+ at load balancer.
- **Private** subnets for DB and Redis; API in public or private+LB.
- **WAF** (AWS WAF, Cloudflare) for OWASP top 10; rate limit by IP and API key for public `GET` map payload.
- **CORS** restricted to known web origins; **CSP** on static admin and public frontends.

## 6. CDN & Static Assets

- Admin and public **SPA** on S3+CloudFront or Vercel/Netlify; **long cache** for hashed assets.
- **Map rasters:** `Cache-Control: public, max-age=86400, immutable` for versioned URLs; ETag on JSON payloads.

## 7. Observability

- **Metrics:** RED (rate, errors, duration) for API; queue lag for workers. Prometheus + Grafana or cloud-native.
- **Logs:** structured JSON to stdout; ship to CloudWatch / Datadog / Loki. **Trace IDs** across API → DB → queue.
- **Tracing:** OpenTelemetry, sample 1–5% in prod, 100% in staging for debugging.

## 8. Release & Rollback

- **Blue/green** or **rolling** deploys; **feature flags** for new CV models.
- **Rollback:** keep previous `Deployment`; DB migrations must stay **expand-only** in risky releases (add column, dual-write, then backfill, then cut over).

## 9. Disaster Recovery

- **RPO** target: 1 hour (frequent DB snapshots) or stricter for paid tiers.
- **RTO** target: 1 hour multi-AZ fail; document runbook for full region fail (replica promote, DNS flip).

## 10. Cost Controls

- **Autoscale** workers to zero in idle staging.
- **Lifecycle policies** on object store (move old PDFs to cold after event end).
- **Read replicas** for event peak; scale down after.

## 11. CI/CD (Outline)

- **On PR:** lint, unit tests, `openapi` validation, migration dry-run.
- **On main:** build images, sign, push to registry; deploy to **staging** automatically.
- **Production:** manual approval; smoke tests: health, sample route query.

## 12. SLOs (Suggested)

- API **availability** 99.9% during active events.
- **p95** route `GET` < 200ms from edge (with cache) / < 50ms in-process.
- **Job completion** within minutes for typical floor plans (10–50MB PDFs).

This aligns with the architecture in [ARCHITECTURE.md](ARCHITECTURE.md) and the schema in [DATABASE.md](DATABASE.md).
