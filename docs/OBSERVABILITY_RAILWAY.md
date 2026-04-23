# Observability and reliability (Railway / production)

## What was added

- **JSON logs** (stdout) with `event`, `request_id` (or `X-Request-ID` from clients), `path`, `latency_ms`, `status_code`, `method`.
- **Request middleware** (low overhead) on all routes except downgraded log noise for `/health`, `/ready`, `/healthz`, `/metrics` (logged at DEBUG).
- **Sentry** (optional): set `SENTRY_DSN` and `SENTRY_TRACES_SAMPLE_RATE` (default `0.1`).
- **Prometheus**: `GET /metrics` (disable with `PROMETHEUS_ENABLED=false`). Includes default HTTP metrics and custom routing metrics (see below).
- **Health**:
  - `GET /healthz` — **liveness**; always `200` if the process is up. Use for Railway *Healthcheck Path* if you want zero false restarts.
  - `GET /health` and `GET /ready` — **readiness**; `200` if PostgreSQL and Redis respond, else `503` and JSON with `ready: false`. Use for alerts and for orchestrators that should stop traffic when dependencies fail.
- **DB**: connection timeout, optional `statement_timeout` (see settings), **slow query logging** (default 100ms, `SLOW_QUERY_LOG_MS=0` to disable).
- **Redis**: socket timeouts, exponential backoff **retries** on connection/timeouts (see `REDIS_MAX_RETRIES`).
- **Routing**: structured logs, Prometheus counters/histograms, WARNING when end-to-end compute (excluding Redis hit) &gt; 200ms.
- **Worker** (`venuenav.workers.map_worker`): JSON logs for dequeue, success, failure, queue depth after dequeue.
- **Config validation**: in `staging` / `production`, optional strict checks; set `FAIL_ON_INVALID_CONFIG=true` to exit on bad config; `REQUIRE_NON_LOCAL_SERVICES=true` to warn when `DATABASE_URL` / `REDIS_URL` look local.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `ENVIRONMENT` | `development` | `development` \| `staging` \| `production` |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `LOG_JSON` | `true` | `false` for human-readable lines in dev |
| `APP_VERSION` | `0.0.0` | Release / git SHA, shown in health + Sentry |
| `SENTRY_DSN` | (empty) | Enable Sentry error + trace sampling |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.1` | Performance traces |
| `PROMETHEUS_ENABLED` | `true` | Expose `GET /metrics` |
| `SLOW_QUERY_LOG_MS` | `100` | Log SQL slower than this (0 = off) |
| `DB_CONNECT_TIMEOUT_SECONDS` | `10` | psycopg connect timeout |
| `DB_STATEMENT_TIMEOUT_MS` | `60000` | Server-side `statement_timeout` (0 to omit) |
| `REDIS_SOCKET_TIMEOUT_SECONDS` | `5` | Redis read/write |
| `REDIS_CONNECT_TIMEOUT_SECONDS` | `5` | Redis connect |
| `REDIS_MAX_RETRIES` | `2` | redis-py retry on connection errors |
| `REQUIRE_NON_LOCAL_SERVICES` | `false` | If true, warn on localhost URLs in prod-like envs |
| `FAIL_ON_INVALID_CONFIG` | `false` | If true, abort startup on validation errors |

## Custom Prometheus metrics (names)

- `venuenav_routing_compute_seconds` (histogram, label `phase`: `graph` | `astar`)
- `venuenav_routing_total` (counter, label `outcome`)
- `venuenav_redis_route_cache_total` (counter, label `result`: `hit` | `miss`)
- `venuenav_db_queries_slow_total` (counter, increments on each slow query log)

## Alerts (suggested)

Wire your platform (Grafana, Datadog, Railway, etc.) to:

1. **HTTP 5xx rate** from logs or from Prometheus (instrumentator’s error metrics). Alert &gt; 1–2% of traffic over 5m.
2. **Readiness**: alert when `GET /ready` returns **503** for &gt; 1–2 minutes (SLO-dependent).
3. **Latency**: `p95(venuenav_routing_compute_seconds_sum/...)` or `http_request_duration_highr` from the instrumentator; alert if p95 &gt; **0.2s** (align with product SLO for routing).
4. **Sentry**: enable issue alerts for new unresolved errors, session crash rate, etc.

**UptimeRobot** (or similar): use `https://&lt;host&gt;/ready` with keyword `"ready":true` in body, or use `/healthz` for availability-only checks.

## Performance notes

- Logging is to **stdout** (synchronous) as typical for 12‑factor; volume is one line per request (INFO) plus warnings/errors. For very high RPS, reduce `LOG_LEVEL` or ship logs to a collector that handles backpressure.
- Sentry and Prometheus add minimal overhead; trace sampling is 10% by default.

## Circuit breaker

Not shipped in this iteration; rely on **timeouts + Redis retries** and horizontal scaling. Add a breaker around flaky downstreams if you introduce external HTTP dependencies beyond Redis/DB.

## Staging vs production

Use separate Railway **projects** or **environments** with different `ENVIRONMENT`, `SENTRY_DSN` (or separate Sentry project), and secrets. `APP_VERSION` / deploy SHA helps correlate releases with errors.

## Deployment checklist

- [ ] Set `ENVIRONMENT=production`, `APP_VERSION` (git SHA or tag).
- [ ] Set `DATABASE_URL` (SQLAlchemy: `postgresql+psycopg://...`), `REDIS_URL`.
- [ ] Run migrations: `psql` against production DB with `001_init.sql` and `002_graph_edge_live.sql` (and PostGIS enabled).
- [ ] Healthcheck path: use **`/healthz`** (always 200) for “is process alive”, or **`/ready`** to fail the deploy when DB/Redis are down.
- [ ] Optional: `SENTRY_DSN`, scrape `/metrics` with Prometheus, or Railway metrics.
- [ ] Restrict public **admin** and `/metrics` if needed (Railway private network, or auth in front; metrics may be IP-restricted at the load balancer).
- [ ] CORS: tighten `allow_origins` in `main.py` for production (currently `*`).
