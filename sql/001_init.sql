-- VenueNav initial schema: PostgreSQL 15+ with PostGIS
-- Run: psql $DATABASE_URL -f sql/001_init.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Local map plane: we use 3857 as placeholder; replace with a dedicated custom SRID if you standardize map-local coords differently.
-- For pure pixel coordinates you may use ST_MakePoint without geography casts and store SRID 0; here we use a single SRID for all geometries in a version.

CREATE TABLE organization (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE app_user (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_membership (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organization (id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  UNIQUE (user_id, organization_id)
);

CREATE TABLE event (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organization (id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);

CREATE TABLE venue (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES event (id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  address    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE map (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL REFERENCES event (id) ON DELETE CASCADE,
  venue_id            UUID NOT NULL REFERENCES venue (id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  draft_map_version_id   UUID, -- set after first draft
  published_map_version_id UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, slug)
);

CREATE TABLE map_version (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id     UUID NOT NULL REFERENCES map (id) ON DELETE CASCADE,
  version    INTEGER NOT NULL,
  width      DOUBLE PRECISION NOT NULL,
  height     DOUBLE PRECISION NOT NULL,
  unit       TEXT NOT NULL CHECK (unit IN ('pixel', 'meter')),
  srid       INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (map_id, version)
);

-- Optional FKs from map to map_version (added after map_version exists)
ALTER TABLE map
  ADD CONSTRAINT map_draft_fk
    FOREIGN KEY (draft_map_version_id) REFERENCES map_version (id) ON DELETE SET NULL;
ALTER TABLE map
  ADD CONSTRAINT map_published_fk
    FOREIGN KEY (published_map_version_id) REFERENCES map_version (id) ON DELETE SET NULL;

CREATE TABLE map_asset (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id          UUID NOT NULL REFERENCES map (id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('pdf', 'raster', 'mask_walk', 'mask_walls', 'ocr_json', 'other')),
  storage_url     TEXT NOT NULL,
  byte_size       BIGINT,
  meta            JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE map_processing_job (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id     UUID NOT NULL REFERENCES map (id) ON DELETE CASCADE,
  asset_id   UUID REFERENCES map_asset (id) ON DELETE SET NULL,
  status     TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'rasterizing', 'detecting', 'ocr', 'completed', 'failed', 'awaiting_review'
  )),
  progress   DOUBLE PRECISION DEFAULT 0 CHECK (progress >= 0 AND progress <= 1),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE graph_node (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_version_id  UUID NOT NULL REFERENCES map_version (id) ON DELETE CASCADE,
  external_id     TEXT,
  node_type       TEXT NOT NULL DEFAULT 'generic' CHECK (node_type IN (
    'intersection', 'entrance', 'exit', 'shop_entry', 'generic'
  )),
  label           TEXT,
  geom            geometry(Point, 0) NOT NULL,
  UNIQUE (map_version_id, external_id)
);

CREATE TABLE graph_edge (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_version_id  UUID NOT NULL REFERENCES map_version (id) ON DELETE CASCADE,
  from_node_id    UUID NOT NULL REFERENCES graph_node (id) ON DELETE CASCADE,
  to_node_id      UUID NOT NULL REFERENCES graph_node (id) ON DELETE CASCADE,
  weight          DOUBLE PRECISION NOT NULL CHECK (weight > 0),
  path            geometry(LineString, 0),
  UNIQUE (map_version_id, from_node_id, to_node_id)
);

CREATE TABLE shop (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_version_id  UUID NOT NULL REFERENCES map_version (id) ON DELETE CASCADE,
  external_id     TEXT,
  name            TEXT NOT NULL,
  category        TEXT,
  location_node_id UUID NOT NULL REFERENCES graph_node (id) ON DELETE RESTRICT,
  footprint       geometry(Polygon, 0),
  metadata        JSONB DEFAULT '{}',
  search_vector   tsvector,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE shop_tag (
  shop_id UUID NOT NULL REFERENCES shop (id) ON DELETE CASCADE,
  tag     TEXT NOT NULL,
  PRIMARY KEY (shop_id, tag)
);

CREATE INDEX idx_graph_node_map_version ON graph_node (map_version_id);
CREATE INDEX idx_graph_node_geom ON graph_node USING GIST (geom);
CREATE INDEX idx_graph_edge_map_version ON graph_edge (map_version_id);
CREATE INDEX idx_graph_edge_from ON graph_edge (from_node_id);
CREATE INDEX idx_graph_edge_to ON graph_edge (to_node_id);
CREATE INDEX idx_shop_map_version ON shop (map_version_id);
CREATE INDEX idx_shop_footprint ON shop USING GIST (footprint) WHERE footprint IS NOT NULL;
CREATE INDEX idx_shop_search ON shop USING GIN (search_vector);

CREATE OR REPLACE FUNCTION shop_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.category, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_shop_search
  BEFORE INSERT OR UPDATE OF name, category ON shop
  FOR EACH ROW EXECUTE PROCEDURE shop_search_vector_update();

-- Helpful comments
COMMENT ON TABLE map_version IS 'Immutable published snapshot or draft row; version increments on publish.';
COMMENT ON COLUMN graph_node.external_id IS 'Stable id for API JSON (e.g. N1); unique per map_version.';
COMMENT ON COLUMN graph_edge.weight IS 'Routing cost, typically geometric distance in map units.';
