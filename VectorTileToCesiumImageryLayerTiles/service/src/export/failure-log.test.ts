import { describe, expect, it } from "vitest";
import {
  createInitializationFailure,
  createTileFailure
} from "./failure-log.js";

describe("failure-log", () => {
  it("records initialization failures with backend and timestamp", () => {
    const failure = createInitializationFailure(
      "webgl",
      new Error("WebGL context unavailable"),
      "2026-03-16T10:00:00.000Z"
    );

    expect(failure).toEqual({
      stage: "init",
      backend: "webgl",
      error: "WebGL context unavailable",
      timestamp: "2026-03-16T10:00:00.000Z"
    });
  });

  it("records tile failures with xyz coordinates", () => {
    const failure = createTileFailure(
      "canvas",
      { z: 12, x: 3412, y: 1677 },
      new Error("tile timeout"),
      "2026-03-16T10:00:01.000Z"
    );

    expect(failure).toEqual({
      stage: "tile",
      backend: "canvas",
      tile: { z: 12, x: 3412, y: 1677 },
      error: "tile timeout",
      timestamp: "2026-03-16T10:00:01.000Z"
    });
  });
});
