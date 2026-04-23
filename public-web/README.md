# VenueNav — public navigation

Mobile-first client for published maps: search shops, pan/zoom, and route on the floor plan.

## Run

1. API on `http://127.0.0.1:8080` (see repo root).
2. `npm install && npm run dev` (port **5174**).

## URLs

- Event link: `/e/{event-slug}/m/{map-slug}` (matches `GET /v1/public/events/...`)
- Dev: `/m?mapId={uuid}` loads `GET /v1/public/maps/{id}/payload` directly

Override API base: `VITE_API_BASE=https://api.example.com`.

## Caching

React Query keeps the map payload for 5 minutes (`staleTime`) per `map_id`.
