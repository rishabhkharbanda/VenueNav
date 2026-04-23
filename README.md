# VenueNav

Indoor event navigation: PDF map ingestion, graph-based routing, and interactive maps for web and mobile.

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | Services, data flow, scaling, and performance |
| [API](docs/openapi.yaml) | REST API (OpenAPI 3) |
| [Database](docs/DATABASE.md) | Entity model, PostGIS usage, and migrations |
| [Wireframes](docs/WIREFRAMES.md) | Admin and public app layouts and flows |
| [Deployment](docs/DEPLOYMENT.md) | Environments, infrastructure, and operations |

## Run locally

### Docker (recommended)

Requires [Docker](https://docs.docker.com/get-docker/) and Docker Compose.

```bash
docker compose up --build
```

- API: `http://localhost:8080` (OpenAPI: `/docs`)
- Postgres, Redis, MinIO, and the map worker start with the stack.

### Python venv (API only)

Use **Python 3.12+** (3.14 works with current dependency pins). PostgreSQL and Redis must be running and match `DATABASE_URL` / `REDIS_URL`.

```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
export PYTHONPATH=src
uvicorn venuenav.main:app --host 127.0.0.1 --port 8080
```

- Health: `GET http://127.0.0.1:8080/health`
- API routes are under `/v1/...` (e.g. `/v1/organizations`).

If MinIO is not running, startup logs a warning but the process still serves traffic.

## Database

PostgreSQL 15+ with PostGIS. Apply migrations in order:

```bash
psql "$DATABASE_URL" -f sql/001_init.sql
```

## License

Proprietary (update as needed).
