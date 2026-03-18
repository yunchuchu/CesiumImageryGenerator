import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createCleanupFailure,
  createInitializationFailure,
  createTileFailure,
  writeFailureLog
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

  it("records cleanup failures with backend and timestamp", () => {
    const failure = createCleanupFailure(
      "webgl",
      new Error("browser close failed"),
      "2026-03-16T10:00:02.000Z"
    );

    expect(failure).toEqual({
      stage: "cleanup",
      backend: "webgl",
      error: "browser close failed",
      timestamp: "2026-03-16T10:00:02.000Z"
    });
  });

  it("removes stale failure logs when a rerun succeeds", async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "vttc-failure-log-"));
    const failureLogPath = path.join(outputDir, "failures.json");

    try {
      await writeFile(failureLogPath, JSON.stringify([{ stale: true }]), "utf8");
      await writeFailureLog(outputDir, []);

      await expect(readFile(failureLogPath, "utf8")).rejects.toThrow();
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});
