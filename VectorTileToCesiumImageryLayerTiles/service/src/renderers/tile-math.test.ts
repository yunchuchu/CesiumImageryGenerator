import { describe, expect, it } from "vitest";
import { xyzToCenter, xyzToMapLibreZoom } from "./tile-math.js";

describe("tile-math", () => {
  it("returns the geographic center of an xyz tile", () => {
    const center = xyzToCenter(10, 853, 415);

    expect(center[0]).toBeGreaterThan(119);
    expect(center[0]).toBeLessThan(121);
    expect(center[1]).toBeGreaterThan(31);
    expect(center[1]).toBeLessThan(33);
  });

  it("converts xyz zoom into a maplibre zoom for 256px tiles", () => {
    expect(xyzToMapLibreZoom(10, 256)).toBe(9);
  });

  it("keeps the same zoom when the viewport matches maplibre's 512 tile size", () => {
    expect(xyzToMapLibreZoom(10, 512)).toBe(10);
  });
});
