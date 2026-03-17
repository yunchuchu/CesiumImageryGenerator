import { describe, expect, it } from "vitest";
import { parseBackendConfig } from "./backend-config.js";

describe("parseBackendConfig", () => {
  it("defaults to canvas when render backend is not set", () => {
    const config = parseBackendConfig({});

    expect(config.backend).toBe("canvas");
    expect(config.tileRenderTimeoutMs).toBe(15000);
  });

  it("reads a separate webgl tile timeout", () => {
    const config = parseBackendConfig({
      WEBGL_TILE_RENDER_TIMEOUT_MS: "45000"
    });

    expect(config.webglTileRenderTimeoutMs).toBe(45000);
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
});
