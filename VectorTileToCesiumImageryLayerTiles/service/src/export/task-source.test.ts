import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTileTaskSource } from "./task-source.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("createTileTaskSource", () => {
  it("skips tiles that already exist when skipExisting is enabled", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "vttc-task-source-skip-"));
    createdDirs.push(outputRoot);
    await mkdir(path.join(outputRoot, "10", "1"), { recursive: true });
    await writeFile(path.join(outputRoot, "10", "1", "1.png"), "existing", "utf8");

    const taskSource = await createTileTaskSource({
      ranges: [
        { zoom: 10, minX: 1, maxX: 1, minY: 1, maxY: 2, count: 2 }
      ],
      outputPath: outputRoot,
      format: "png",
      skipExisting: true
    });

    expect(taskSource.total).toBe(1);
    expect(taskSource.next()).toMatchObject({
      z: 10,
      x: 1,
      y: 2
    });
    expect(taskSource.next()).toBeUndefined();
  });

  it("only emits failed tile entries when retryFailuresOnly is enabled", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "vttc-task-source-failures-"));
    createdDirs.push(outputRoot);
    await writeFile(
      path.join(outputRoot, "failures.json"),
      JSON.stringify([
        {
          stage: "tile",
          backend: "webgl",
          tile: { z: 10, x: 1, y: 2 },
          error: "timeout",
          timestamp: new Date().toISOString()
        },
        {
          stage: "tile",
          backend: "webgl",
          tile: { z: 11, x: 8, y: 8 },
          error: "timeout",
          timestamp: new Date().toISOString()
        },
        {
          stage: "init",
          backend: "webgl",
          error: "ignored",
          timestamp: new Date().toISOString()
        }
      ]),
      "utf8"
    );

    const taskSource = await createTileTaskSource({
      ranges: [
        { zoom: 10, minX: 1, maxX: 1, minY: 1, maxY: 3, count: 3 }
      ],
      outputPath: outputRoot,
      format: "png",
      retryFailuresOnly: true
    });

    expect(taskSource.total).toBe(1);
    expect(taskSource.next()).toMatchObject({
      z: 10,
      x: 1,
      y: 2
    });
    expect(taskSource.next()).toBeUndefined();
  });

  it("fails clearly when retryFailuresOnly is enabled without a failure log", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "vttc-task-source-missing-log-"));
    createdDirs.push(outputRoot);

    await expect(createTileTaskSource({
      ranges: [
        { zoom: 10, minX: 1, maxX: 1, minY: 1, maxY: 1, count: 1 }
      ],
      outputPath: outputRoot,
      format: "png",
      retryFailuresOnly: true
    })).rejects.toThrow("未找到失败日志");
  });
});
