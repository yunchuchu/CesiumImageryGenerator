# VTTC WebGL Renderer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Playwright + MapLibre GL JS WebGL rendering backend for VTTC exports while preserving the existing canvas backend as a fallback.

**Architecture:** Extract the current CPU renderer behind a common renderer interface, add a browser-backed WebGL renderer that reuses one page per export job, and let the service select `canvas`, `webgl`, or `auto` at runtime. Keep the API shape stable and record backend-specific failures for debugging.

**Tech Stack:** TypeScript, Express, Playwright, Chromium, MapLibre GL JS, @napi-rs/canvas, pnpm workspace

---

### Task 1: Add test harness and renderer selection scaffolding

**Files:**
- Modify: `VectorTileToCesiumImageryLayerTiles/service/package.json`
- Create: `VectorTileToCesiumImageryLayerTiles/service/vitest.config.ts`
- Create: `VectorTileToCesiumImageryLayerTiles/service/src/renderers/types.ts`
- Create: `VectorTileToCesiumImageryLayerTiles/service/src/renderers/factory.ts`
- Create: `VectorTileToCesiumImageryLayerTiles/service/src/renderers/factory.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";
import { createTileRenderer } from "./factory";

describe("createTileRenderer", () => {
  it("returns canvas renderer when backend is canvas", async () => {
    const renderer = await createTileRenderer({
      backend: "canvas",
      format: "png",
      tileSize: 256,
      style: {} as never
    });

    expect(renderer.backend).toBe("canvas");
  });

  it("falls back to canvas when backend is auto and webgl init fails", async () => {
    const renderer = await createTileRenderer({
      backend: "auto",
      format: "png",
      tileSize: 256,
      style: {} as never,
      createWebglRenderer: vi.fn().mockRejectedValue(new Error("webgl init failed")),
      createCanvasRenderer: vi.fn().mockResolvedValue({ backend: "canvas" })
    });

    expect(renderer.backend).toBe("canvas");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/VectorTileToCesiumImageryLayerTiles/service test`

Expected: FAIL because `vitest` is not installed and `createTileRenderer` does not exist yet.

**Step 3: Write minimal implementation**

```ts
export type RenderBackend = "canvas" | "webgl" | "auto";

export interface TileRenderer {
  backend: Exclude<RenderBackend, "auto">;
  init(): Promise<void>;
  renderTile(z: number, x: number, y: number): Promise<Buffer>;
  dispose(): Promise<void>;
}

export async function createTileRenderer(options: CreateTileRendererOptions): Promise<TileRenderer> {
  if (options.backend === "canvas") {
    return options.createCanvasRenderer
      ? options.createCanvasRenderer(options)
      : createCanvasRenderer(options);
  }

  if (options.backend === "webgl") {
    return options.createWebglRenderer
      ? options.createWebglRenderer(options)
      : createWebglRenderer(options);
  }

  try {
    return options.createWebglRenderer
      ? await options.createWebglRenderer(options)
      : await createWebglRenderer(options);
  } catch {
    return options.createCanvasRenderer
      ? options.createCanvasRenderer(options)
      : createCanvasRenderer(options);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm -C /Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/VectorTileToCesiumImageryLayerTiles/service test`

Expected: PASS for renderer selection tests.

**Step 5: Commit**

```bash
git add VectorTileToCesiumImageryLayerTiles/service/package.json \
  VectorTileToCesiumImageryLayerTiles/service/vitest.config.ts \
  VectorTileToCesiumImageryLayerTiles/service/src/renderers/types.ts \
  VectorTileToCesiumImageryLayerTiles/service/src/renderers/factory.ts \
  VectorTileToCesiumImageryLayerTiles/service/src/renderers/factory.test.ts
git commit -m "test: add renderer factory coverage"
```

### Task 2: Extract the existing canvas implementation behind the shared interface

**Files:**
- Modify: `VectorTileToCesiumImageryLayerTiles/service/src/index.ts`
- Create: `VectorTileToCesiumImageryLayerTiles/service/src/renderers/canvas-renderer.ts`
- Create: `VectorTileToCesiumImageryLayerTiles/service/src/renderers/canvas-renderer.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { createCanvasRenderer } from "./canvas-renderer";

describe("createCanvasRenderer", () => {
  it("reports canvas backend and renders a tile buffer", async () => {
    const renderer = await createCanvasRenderer({
      backend: "canvas",
      format: "png",
      tileSize: 256,
      style: buildTestStyle()
    });

    const buffer = await renderer.renderTile(10, 853, 415);

    expect(renderer.backend).toBe("canvas");
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/VectorTileToCesiumImageryLayerTiles/service test -- canvas-renderer`

Expected: FAIL because the renderer module does not exist yet.

**Step 3: Write minimal implementation**

```ts
export async function createCanvasRenderer(options: CanvasRendererOptions): Promise<TileRenderer> {
  return {
    backend: "canvas",
    async init() {},
    async renderTile(z, x, y) {
      return renderRasterTileCanvas(options.style, options.format, options.tileSize, z, x, y);
    },
    async dispose() {}
  };
}
```

Move these functions from `src/index.ts` into `canvas-renderer.ts` without behavior changes:

- `renderRasterTile`
- `loadVectorTile`
- `buildTileUrl`
- `drawVectorLayer`
- `drawFillLayer`
- `drawLineLayer`
- `drawCircleLayer`
- `isLayerVisible`
- `getPaintColor`
- `getPaintNumber`
- `toPixel`
- `clamp`

Rename `renderRasterTile(...)` to `renderRasterTileCanvas(...)` to make backend ownership obvious.

**Step 4: Run test to verify it passes**

Run: `pnpm -C /Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/VectorTileToCesiumImageryLayerTiles/service test -- canvas-renderer`

Expected: PASS and existing demo export still works with `RENDER_BACKEND=canvas`.

**Step 5: Commit**

```bash
git add VectorTileToCesiumImageryLayerTiles/service/src/index.ts \
  VectorTileToCesiumImageryLayerTiles/service/src/renderers/canvas-renderer.ts \
  VectorTileToCesiumImageryLayerTiles/service/src/renderers/canvas-renderer.test.ts
git commit -m "refactor: extract canvas tile renderer"
```

### Task 3: Add browser dependencies and implement the WebGL renderer page contract

**Files:**
- Modify: `VectorTileToCesiumImageryLayerTiles/service/package.json`
- Modify: `VectorTileToCesiumImageryLayerTiles/service/renderer/index.html`
- Modify: `VectorTileToCesiumImageryLayerTiles/service/renderer/renderer.css`
- Modify: `VectorTileToCesiumImageryLayerTiles/service/renderer/renderer.js`
- Create: `VectorTileToCesiumImageryLayerTiles/service/src/renderers/tile-math.ts`
- Create: `VectorTileToCesiumImageryLayerTiles/service/src/renderers/tile-math.test.ts`
- Create: `VectorTileToCesiumImageryLayerTiles/service/src/renderers/webgl-renderer.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { xyzToCenter } from "./tile-math";

describe("xyzToCenter", () => {
  it("returns the geographic center of an xyz tile", () => {
    const center = xyzToCenter(10, 853, 415);

    expect(center[0]).toBeGreaterThan(119);
    expect(center[0]).toBeLessThan(121);
    expect(center[1]).toBeGreaterThan(31);
    expect(center[1]).toBeLessThan(33);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/VectorTileToCesiumImageryLayerTiles/service test -- tile-math`

Expected: FAIL because tile helpers and browser renderer do not exist yet.

**Step 3: Write minimal implementation**

```ts
export function xyzToCenter(z: number, x: number, y: number): [number, number] {
  const west = tileXToLng(x, z);
  const east = tileXToLng(x + 1, z);
  const north = tileYToLat(y, z);
  const south = tileYToLat(y + 1, z);
  return [(west + east) / 2, (north + south) / 2];
}
```

Update `renderer.js` to expose:

- `window.__initRenderer({ style, tileSize, pixelRatio })`
- `window.__renderTile({ z, x, y, tileSize })`

Expected browser behavior:

- create the map exactly once
- resize the map to the requested tile size
- set the compiled style
- convert XYZ to map view parameters
- wait for `idle`
- wait for 2 animation frames before returning

Create `webgl-renderer.ts` with responsibilities:

- launch Chromium through Playwright
- open the local renderer page
- call `__initRenderer(...)`
- call `__renderTile(...)`
- take a screenshot and return the buffer
- close resources in `dispose()`

**Step 4: Run test to verify it passes**

Run: `pnpm -C /Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/VectorTileToCesiumImageryLayerTiles/service test -- tile-math`

Expected: PASS for tile math tests, and manual browser smoke test reaches the renderer page.

**Step 5: Commit**

```bash
git add VectorTileToCesiumImageryLayerTiles/service/package.json \
  VectorTileToCesiumImageryLayerTiles/service/renderer/index.html \
  VectorTileToCesiumImageryLayerTiles/service/renderer/renderer.css \
  VectorTileToCesiumImageryLayerTiles/service/renderer/renderer.js \
  VectorTileToCesiumImageryLayerTiles/service/src/renderers/tile-math.ts \
  VectorTileToCesiumImageryLayerTiles/service/src/renderers/tile-math.test.ts \
  VectorTileToCesiumImageryLayerTiles/service/src/renderers/webgl-renderer.ts
git commit -m "feat: add webgl tile renderer"
```

### Task 4: Wire backend selection, static asset serving, timeouts, and failure recording into the export job flow

**Files:**
- Modify: `VectorTileToCesiumImageryLayerTiles/service/src/index.ts`
- Create: `VectorTileToCesiumImageryLayerTiles/service/src/renderers/backend-config.ts`
- Create: `VectorTileToCesiumImageryLayerTiles/service/src/export/failure-log.ts`
- Create: `VectorTileToCesiumImageryLayerTiles/service/src/export/failure-log.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { parseBackendConfig } from "../renderers/backend-config";

describe("parseBackendConfig", () => {
  it("defaults to canvas when render backend is not set", () => {
    const config = parseBackendConfig({});

    expect(config.backend).toBe("canvas");
  });

  it("reads a separate webgl tile timeout", () => {
    const config = parseBackendConfig({
      WEBGL_TILE_RENDER_TIMEOUT_MS: "45000"
    });

    expect(config.webglTileRenderTimeoutMs).toBe(45000);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm -C /Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/VectorTileToCesiumImageryLayerTiles/service test -- backend-config`

Expected: FAIL because backend config parsing and failure logging modules do not exist.

**Step 3: Write minimal implementation**

```ts
export function parseBackendConfig(env: NodeJS.ProcessEnv) {
  return {
    backend: (env.RENDER_BACKEND as "canvas" | "webgl" | "auto" | undefined) ?? "canvas",
    tileRenderTimeoutMs: Number(env.TILE_RENDER_TIMEOUT_MS ?? 15000),
    webglTileRenderTimeoutMs: Number(env.WEBGL_TILE_RENDER_TIMEOUT_MS ?? 30000),
    headless: env.RENDER_HEADLESS === "true",
    renderArgs: parseRenderArgs(env.RENDER_ARGS)
  };
}
```

Update `src/index.ts` to:

- `app.use("/renderer", express.static(...))`
- `app.use("/vendor/maplibre", express.static(...))`
- build one renderer per export job instead of calling `renderRasterTile(...)` directly
- choose timeout based on `renderer.backend`
- collect per-tile failures into a structured object
- write failures to `failures.json` or `metadata.json`

**Step 4: Run test to verify it passes**

Run: `pnpm -C /Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/VectorTileToCesiumImageryLayerTiles/service test -- backend-config`

Expected: PASS for config tests, and `RENDER_BACKEND=canvas` still exports successfully.

**Step 5: Commit**

```bash
git add VectorTileToCesiumImageryLayerTiles/service/src/index.ts \
  VectorTileToCesiumImageryLayerTiles/service/src/renderers/backend-config.ts \
  VectorTileToCesiumImageryLayerTiles/service/src/export/failure-log.ts \
  VectorTileToCesiumImageryLayerTiles/service/src/export/failure-log.test.ts
git commit -m "feat: wire selectable render backends"
```

### Task 5: Document and manually verify both backends

**Files:**
- Modify: `VectorTileToCesiumImageryLayerTiles/README.md`
- Modify: `VectorTileToCesiumImageryLayerTiles/service/scripts/export-demo.sh`
- Create: `VectorTileToCesiumImageryLayerTiles/service/scripts/export-demo-webgl.sh`

**Step 1: Write the failing test**

```md
Manual doc acceptance checklist:
- README explains canvas, webgl, and auto backends
- README documents macOS recommendation: RENDER_HEADLESS=false
- demo script shows how to launch and export with webgl backend
- smoke test instructions verify both canvas and webgl paths
```

**Step 2: Run test to verify it fails**

Run: review `VectorTileToCesiumImageryLayerTiles/README.md` and the demo scripts

Expected: FAIL because backend selection and GPU-specific instructions are not documented yet.

**Step 3: Write minimal implementation**

Update `README.md` with:

- new backend selection section
- environment variable reference
- recommended local GPU startup command
- smoke test steps for comparing `canvas` vs `webgl`

Update scripts with:

- an example `RENDER_BACKEND=webgl`
- a smaller default zoom range for fast validation
- comments explaining when to use GUI mode

**Step 4: Run test to verify it passes**

Run:
- `pnpm -C /Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/VectorTileToCesiumImageryLayerTiles/service dev`
- `bash /Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/VectorTileToCesiumImageryLayerTiles/service/scripts/export-demo.sh`
- `RENDER_BACKEND=webgl RENDER_HEADLESS=false pnpm -C /Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/VectorTileToCesiumImageryLayerTiles/service dev`
- `bash /Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/VectorTileToCesiumImageryLayerTiles/service/scripts/export-demo-webgl.sh`

Expected:
- both commands return an export job id
- canvas export remains functional
- webgl export produces tile images and finishes faster on the same small range

**Step 5: Commit**

```bash
git add VectorTileToCesiumImageryLayerTiles/README.md \
  VectorTileToCesiumImageryLayerTiles/service/scripts/export-demo.sh \
  VectorTileToCesiumImageryLayerTiles/service/scripts/export-demo-webgl.sh
git commit -m "docs: add webgl export usage"
```
