import { describe, expect, it, vi } from "vitest";
import { initializePrimaryRenderer, PrimaryRendererInitializationError } from "./primary-renderer.js";
import type { TileRenderer } from "../renderers/types.js";

function createMockRenderer(backend: TileRenderer["backend"]): TileRenderer {
  return {
    backend,
    init: vi.fn().mockResolvedValue(undefined),
    renderTile: vi.fn(),
    dispose: vi.fn().mockResolvedValue(undefined)
  };
}

describe("initializePrimaryRenderer", () => {
  it("records the initial webgl failure before falling back to canvas in auto mode", async () => {
    const canvasRenderer = createMockRenderer("canvas");
    const createRenderer = vi.fn()
      .mockRejectedValueOnce(new Error("webgl init failed"))
      .mockResolvedValueOnce(canvasRenderer);

    const result = await initializePrimaryRenderer({
      backendConfig: {
        backend: "auto",
        tileRenderTimeoutMs: 15000,
        webglTileRenderTimeoutMs: 30000,
        headless: false,
        renderArgs: [],
        exportConcurrency: undefined
      },
      rendererOptions: {
        backend: "auto",
        format: "png",
        tileSize: 256,
        style: {} as never
      },
      createRenderer
    });

    expect(result.resolvedBackend).toBe("canvas");
    expect(result.renderer).toBe(canvasRenderer);
    expect(result.failures).toMatchObject([
      {
        stage: "init",
        backend: "webgl",
        error: "webgl init failed"
      }
    ]);
    expect(canvasRenderer.init).toHaveBeenCalledOnce();
  });

  it("disposes a created renderer when initialization fails", async () => {
    const webglRenderer = createMockRenderer("webgl");
    vi.mocked(webglRenderer.init).mockRejectedValue(new Error("init failed"));
    const createRenderer = vi.fn().mockResolvedValue(webglRenderer);

    await expect(initializePrimaryRenderer({
      backendConfig: {
        backend: "webgl",
        tileRenderTimeoutMs: 15000,
        webglTileRenderTimeoutMs: 30000,
        headless: false,
        renderArgs: [],
        exportConcurrency: undefined
      },
      rendererOptions: {
        backend: "webgl",
        format: "png",
        tileSize: 256,
        style: {} as never
      },
      createRenderer
    })).rejects.toThrow("init failed");

    expect(webglRenderer.dispose).toHaveBeenCalledOnce();
  });

  it("records cleanup failure when auto fallback disposal also fails", async () => {
    const webglRenderer = createMockRenderer("webgl");
    const canvasRenderer = createMockRenderer("canvas");
    vi.mocked(webglRenderer.init).mockRejectedValue(new Error("webgl init failed"));
    vi.mocked(webglRenderer.dispose).mockRejectedValue(new Error("webgl dispose failed"));
    const createRenderer = vi.fn()
      .mockResolvedValueOnce(webglRenderer)
      .mockResolvedValueOnce(canvasRenderer);

    const result = await initializePrimaryRenderer({
      backendConfig: {
        backend: "auto",
        tileRenderTimeoutMs: 15000,
        webglTileRenderTimeoutMs: 30000,
        headless: false,
        renderArgs: [],
        exportConcurrency: undefined
      },
      rendererOptions: {
        backend: "auto",
        format: "png",
        tileSize: 256,
        style: {} as never
      },
      createRenderer
    });

    expect(result.resolvedBackend).toBe("canvas");
    expect(result.failures).toMatchObject([
      {
        stage: "init",
        backend: "webgl",
        error: "webgl init failed"
      },
      {
        stage: "cleanup",
        backend: "webgl",
        error: "webgl dispose failed"
      }
    ]);
  });

  it("reports canvas as the fatal backend when both auto backends fail", async () => {
    const webglRenderer = createMockRenderer("webgl");
    const canvasRenderer = createMockRenderer("canvas");
    vi.mocked(webglRenderer.init).mockRejectedValue(new Error("webgl init failed"));
    vi.mocked(canvasRenderer.init).mockRejectedValue(new Error("canvas init failed"));
    const createRenderer = vi.fn()
      .mockResolvedValueOnce(webglRenderer)
      .mockResolvedValueOnce(canvasRenderer);

    await expect(initializePrimaryRenderer({
      backendConfig: {
        backend: "auto",
        tileRenderTimeoutMs: 15000,
        webglTileRenderTimeoutMs: 30000,
        headless: false,
        renderArgs: [],
        exportConcurrency: undefined
      },
      rendererOptions: {
        backend: "auto",
        format: "png",
        tileSize: 256,
        style: {} as never
      },
      createRenderer
    })).rejects.toMatchObject({
      backend: "canvas",
      failures: [
        {
          stage: "init",
          backend: "webgl"
        },
        {
          stage: "init",
          backend: "canvas",
          error: "canvas init failed"
        }
      ]
    } satisfies Partial<PrimaryRendererInitializationError>);
  });

  it("preserves prior failures when canvas renderer creation fails after auto fallback", async () => {
    const webglRenderer = createMockRenderer("webgl");
    vi.mocked(webglRenderer.init).mockRejectedValue(new Error("webgl init failed"));
    const createRenderer = vi.fn()
      .mockResolvedValueOnce(webglRenderer)
      .mockRejectedValueOnce(new Error("canvas create failed"));

    await expect(initializePrimaryRenderer({
      backendConfig: {
        backend: "auto",
        tileRenderTimeoutMs: 15000,
        webglTileRenderTimeoutMs: 30000,
        headless: false,
        renderArgs: [],
        exportConcurrency: undefined
      },
      rendererOptions: {
        backend: "auto",
        format: "png",
        tileSize: 256,
        style: {} as never
      },
      createRenderer
    })).rejects.toMatchObject({
      backend: "canvas",
      failures: [
        {
          stage: "init",
          backend: "webgl"
        },
        {
          stage: "init",
          backend: "canvas",
          error: "canvas create failed"
        }
      ]
    } satisfies Partial<PrimaryRendererInitializationError>);
  });
});
