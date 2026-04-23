# VenueNav admin — map editor

## Run locally

1. Start the API on port **8080** (see repo root `README` / Docker).
2. From this folder:

```bash
npm install
npm run dev
```

3. Open `http://127.0.0.1:5173/?orgId=<org-uuid>&mapId=<map-uuid>`

Vite proxies `/v1` to `http://127.0.0.1:8080`. To call an API on another host, set `VITE_API_BASE` in `.env` (e.g. `VITE_API_BASE=https://api.example.com`).

## Build

```bash
npm run build
```

Output is in `dist/`. Preview with `npm run preview`.
