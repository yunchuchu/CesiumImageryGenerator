import { describe, expect, it } from "vitest";
import type { MapLibreStyle } from "@vttc/shared";
import { createCanvasRenderer } from "./canvas-renderer.js";

function buildTestStyle(): MapLibreStyle {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: {
          "background-color": "#123456"
        },
        layout: {}
      }
    ]
  };
}

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
