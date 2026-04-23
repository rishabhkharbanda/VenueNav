-- Live routing overrides: congestion, closure, optional priority. Applied in routing as:
--   cost = max(1e-9, weight * crowd_factor + priority)  when not is_closed; closed edges are omitted.
-- Run: psql $DATABASE_URL -f sql/002_graph_edge_live.sql

CREATE TABLE graph_edge_live (
  graph_edge_id  UUID PRIMARY KEY REFERENCES graph_edge (id) ON DELETE CASCADE,
  crowd_factor  DOUBLE PRECISION NOT NULL DEFAULT 1.0 CHECK (crowd_factor > 0),
  is_closed     BOOLEAN NOT NULL DEFAULT false,
  priority      DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_graph_edge_live_graph_edge_id ON graph_edge_live (graph_edge_id);

COMMENT ON TABLE graph_edge_live IS 'Per-edge dynamic routing overrides; static weight stays on graph_edge.';
