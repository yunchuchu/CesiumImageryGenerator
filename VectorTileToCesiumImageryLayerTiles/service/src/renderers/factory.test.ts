import { describe, expect, it, vi } from "vitest";
import { createTileRenderer } from "./factory.js";

function createMockRenderer(backend: "canvas" | "webgl") {
  return {
    backend,
    init: vi.fn(),
    renderTile: vi.fn(),
    dispose: vi.fn()
  };
}

describe("createTileRenderer", () => {
  it("returns canvas renderer when backend is canvas", async () => {
    const renderer = await createTileRenderer({
      backend: "canvas",
      format: "png",
      tileSize: 256,
      style: {} as never,
      createCanvasRenderer: vi.fn().mockResolvedValue(createMockRenderer("canvas"))
    });

    expect(renderer.backend).toBe("canvas");
  });

  it("falls back to canvas when backend is auto and webgl init fails", async () => {
    const createCanvasRenderer = vi.fn().mockResolvedValue(createMockRenderer("canvas"));

    const renderer = await createTileRenderer({
      backend: "auto",
      format: "png",
      tileSize: 256,
      style: {} as never,
      createWebglRenderer: vi.fn().mockRejectedValue(new Error("webgl init failed")),
      createCanvasRenderer
    });

    expect(renderer.backend).toBe("canvas");
    expect(createCanvasRenderer).toHaveBeenCalledOnce();
  });

  it("falls back to canvas when auto webgl renderer fails during init", async () => {
    const webglRenderer = createMockRenderer("webgl");
    webglRenderer.init.mockRejectedValue(new Error("webgl init failed"));
    webglRenderer.dispose.mockResolvedValue(undefined);
    const createCanvasRenderer = vi.fn().mockResolvedValue(createMockRenderer("canvas"));

    const renderer = await createTileRenderer({
      backend: "auto",
      format: "png",
      tileSize: 256,
      style: {} as never,
      createWebglRenderer: vi.fn().mockResolvedValue(webglRenderer),
      createCanvasRenderer
    });

    expect(webglRenderer.init).toHaveBeenCalledOnce();
    expect(webglRenderer.dispose).toHaveBeenCalledOnce();
    expect(renderer.backend).toBe("canvas");
    expect(createCanvasRenderer).toHaveBeenCalledOnce();
  });

  it("falls back to canvas when auto webgl init times out", async () => {
    vi.useFakeTimers();
    try {
      const webglRenderer = createMockRenderer("webgl");
      webglRenderer.init.mockImplementation(() => new Promise(() => {}));
      webglRenderer.dispose.mockResolvedValue(undefined);
      const createCanvasRenderer = vi.fn().mockResolvedValue(createMockRenderer("canvas"));

      const rendererPromise = createTileRenderer({
        backend: "auto",
        format: "png",
        tileSize: 256,
        style: {} as never,
        webglInitTimeoutMs: 5,
        createWebglRenderer: vi.fn().mockResolvedValue(webglRenderer),
        createCanvasRenderer
      });

      await vi.advanceTimersByTimeAsync(5);
      const renderer = await rendererPromise;

      expect(webglRenderer.dispose).toHaveBeenCalledOnce();
      expect(renderer.backend).toBe("canvas");
      expect(createCanvasRenderer).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
