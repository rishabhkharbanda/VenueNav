"""Prometheus metrics (optional; low overhead counters/histograms)."""

from __future__ import annotations

from prometheus_client import Counter, Histogram

# HTTP is covered by prometheus_fastapi_instrumentator

ROUTING_COMPUTE_SECONDS = Histogram(
    "venuenav_routing_compute_seconds",
    "Time spent computing a route (graph load, A*, response build)",
    ["phase"],
    buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0),
)

ROUTING_OUTCOME = Counter(
    "venuenav_routing_total",
    "Routing outcomes",
    ["outcome"],
)

REDIS_ROUTE_CACHE = Counter(
    "venuenav_redis_route_cache_total",
    "Redis-backed route cache hits and misses",
    ["result"],
)

DB_QUERIES_SLOW = Counter(
    "venuenav_db_queries_slow_total",
    "SQL queries exceeding slow_query_ms threshold",
)
