# Hand gesture drawing (Next.js + MediaPipe)

Minimal module: webcam background, index-finger air drawing on a canvas overlay.

## Setup

1. **Install dependencies** (Node 18+ recommended):

```bash
npm install
```

2. **Run the dev server**:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

3. **Camera permissions**

- The browser will prompt for **camera** access when the page loads (MediaPipe `Camera` uses `getUserMedia` under the hood).
- Use **Chrome or Edge** for best WebGL + WASM performance.
- **HTTPS or localhost** is required for camera APIs in most browsers.
- If the prompt was denied, reset the site permission in the browser lock icon → Site settings → Camera → Allow, then reload.

4. **Network**

- MediaPipe `.wasm` / binary assets load from **jsDelivr** (`locateFile` in `HandTracker.tsx`). The machine needs outbound HTTPS to that CDN (or change `locateFile` to serve files from `/public`).

## Project layout

| Path | Role |
|------|------|
| `app/page.tsx` | Server entry; `dynamic(..., { ssr: false })` so webcam/MediaPipe never run on the server |
| `components/App.tsx` | Gesture state machine, stroke refs, minimal overlay UI |
| `components/HandTracker.tsx` | Webcam + MediaPipe Hands + smoothed index tip |
| `components/DrawingCanvas.tsx` | `requestAnimationFrame` render loop, glowing strokes |
| `lib/gestureDetection.ts` | “Index raised” heuristic + mirror X for selfie view |
| `lib/smoothing.ts` | EMA + Chaikin-style polyline smoothing for display |

## How gesture detection works

1. **Landmarks**: MediaPipe outputs 21 normalized points per hand. We use **index MCP (5)**, **PIP (6)**, and **tip (8)**.

2. **“Index raised” (drawing mode)**: We treat the index as extended when the tip is farther from the MCP than the PIP is (`distance(tip, MCP) > ratio × distance(PIP, MCP)`), combined with a minimum **hand scale** (wrist → middle MCP distance) to ignore tiny jitter when the hand is far or poorly detected.

3. **Pointer**: The draw position is the **index tip**, with **X mirrored** (`1 - x`) so the stroke lines up with the horizontally flipped webcam preview.

4. **Stroke lifecycle**: **Idle → Drawing** starts a new stroke; while drawing we append EMA-smoothed points (minimum spacing in normalized space); **Drawing → Idle** commits the stroke to the completed list.

## Performance notes

- Hand inference runs on MediaPipe’s internal scheduling; the **canvas** redraw uses **`requestAnimationFrame`** and reads only refs (no per-frame React state).
- UI badge state is **coalesced to one update per animation frame** to avoid React thrash.
