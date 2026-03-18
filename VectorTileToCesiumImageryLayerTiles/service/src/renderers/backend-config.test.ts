import { describe, expect, it } from "vitest";
import { parseBackendConfig, resolveExportConcurrency } from "./backend-config.js";

describe("parseBackendConfig", () => {
  it("defaults to canvas when render backend is not set", () => {
    const config = parseBackendConfig({});

    expect(config.backend).toBe("canvas");
    expect(config.tileRenderTimeoutMs).toBe(15000);
    expect(config.headless).toBeUndefined();
  });

  it("reads a separate webgl tile timeout", () => {
    const config = parseBackendConfig({
      WEBGL_TILE_RENDER_TIMEOUT_MS: "45000"
    });

    expect(config.webglTileRenderTimeoutMs).toBe(45000);
  });

  it("falls back to defaults for invalid timeout values", () => {
    const config = parseBackendConfig({
      TILE_RENDER_TIMEOUT_MS: "abc",
      WEBGL_TILE_RENDER_TIMEOUT_MS: "-1"
    });

    expect(config.tileRenderTimeoutMs).toBe(15000);
    expect(config.webglTileRenderTimeoutMs).toBe(30000);
  });

  it("parses renderer args into an argv array", () => {
    const config = parseBackendConfig({
      RENDER_ARGS: "--use-angle=metal --disable-gpu-sandbox"
    });

    expect(config.renderArgs).toEqual([
      "--use-angle=metal",
      "--disable-gpu-sandbox"
    ]);
  });

  it("preserves an explicit false headless override", () => {
    const config = parseBackendConfig({
      RENDER_HEADLESS: "false"
    });

    expect(config.headless).toBe(false);
  });

  it("uses backend-specific export concurrency defaults", () => {
    expect(resolveExportConcurrency(parseBackendConfig({}))).toBe(4);
    expect(resolveExportConcurrency(parseBackendConfig({
      RENDER_BACKEND: "webgl"
    }))).toBe(2);
    expect(resolveExportConcurrency(parseBackendConfig({
      RENDER_BACKEND: "auto"
    }), "canvas")).toBe(4);
  });

  it("prefers explicit export concurrency when configured", () => {
    const config = parseBackendConfig({
      RENDER_BACKEND: "webgl",
      EXPORT_CONCURRENCY: "6"
    });

    expect(resolveExportConcurrency(config)).toBe(6);
    expect(resolveExportConcurrency(config, "canvas")).toBe(6);
  });
});
