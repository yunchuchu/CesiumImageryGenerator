import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  renderTilesWithWorkerPool,
  TileRenderPoolError,
  TileRenderPoolExecutionError,
  type TileTaskSource,
  type TileRenderTask
} from "./scheduler.js";
import type { TileRenderer } from "../renderers/types.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

function createTask(outputRoot: string, z: number, x: number, y: number): TileRenderTask {
  return {
    z,
    x,
    y,
    outputFile: path.join(outputRoot, `${z}`, `${x}`, `${y}.png`)
  };
}

function createMockRenderer(
  backend: TileRenderer["backend"],
  renderTile: TileRenderer["renderTile"] = vi.fn(async (z, x, y) => Buffer.from(`${z}/${x}/${y}`))
): TileRenderer {
  return {
    backend,
    init: vi.fn().mockResolvedValue(undefined),
    renderTile: vi.fn(renderTile),
    dispose: vi.fn().mockResolvedValue(undefined)
  };
}

function createTaskSource(tasks: TileRenderTask[]): TileTaskSource {
  let index = 0;
  return {
    total: tasks.length,
    next: () => tasks[index++]
  };
}

describe("renderTilesWithWorkerPool", () => {
  it("renders all tiles with multiple workers and reports progress", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "vttc-scheduler-success-"));
    createdDirs.push(outputRoot);
    const progress = vi.fn();
    const primaryRenderer = createMockRenderer("canvas");
    const secondaryRenderer = createMockRenderer("canvas");

    await renderTilesWithWorkerPool({
      taskSource: createTaskSource([
        createTask(outputRoot, 10, 1, 1),
        createTask(outputRoot, 10, 1, 2),
        createTask(outputRoot, 10, 2, 1)
      ]),
      concurrency: 2,
      rendererInitTimeoutMs: 100,
      tileRenderTimeoutMs: 100,
      initialRenderer: primaryRenderer,
      createRenderer: vi.fn().mockResolvedValue(secondaryRenderer),
      onTileComplete: progress
    });

    expect(primaryRenderer.renderTile).toHaveBeenCalled();
    expect(secondaryRenderer.init).toHaveBeenCalledOnce();
    expect(secondaryRenderer.renderTile).toHaveBeenCalled();
    expect(progress).toHaveBeenCalledTimes(3);
    await expect(readFile(path.join(outputRoot, "10", "1", "1.png"), "utf8")).resolves.toBe("10/1/1");
    await expect(readFile(path.join(outputRoot, "10", "1", "2.png"), "utf8")).resolves.toBe("10/1/2");
    await expect(readFile(path.join(outputRoot, "10", "2", "1.png"), "utf8")).resolves.toBe("10/2/1");
    expect(primaryRenderer.dispose).toHaveBeenCalledOnce();
    expect(secondaryRenderer.dispose).toHaveBeenCalledOnce();
  });

  it("wraps tile failures with backend and coordinates and disposes every renderer", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "vttc-scheduler-failure-"));
    createdDirs.push(outputRoot);
    const failingRenderTile: TileRenderer["renderTile"] = async (z, x, y) => {
      if (x === 2) {
        throw new Error("boom");
      }
      return Buffer.from(`${z}/${x}/${y}`);
    };
    const primaryRenderer = createMockRenderer("canvas", failingRenderTile);
    const secondaryRenderer = createMockRenderer("canvas", failingRenderTile);

    await expect(
      renderTilesWithWorkerPool({
        taskSource: createTaskSource([
          createTask(outputRoot, 10, 1, 1),
          createTask(outputRoot, 10, 2, 1),
          createTask(outputRoot, 10, 3, 1)
        ]),
        concurrency: 2,
        rendererInitTimeoutMs: 100,
        tileRenderTimeoutMs: 100,
        initialRenderer: primaryRenderer,
        createRenderer: vi.fn().mockResolvedValue(secondaryRenderer)
      })
    ).rejects.toMatchObject({
      failures: [
        {
          stage: "tile",
          backend: "canvas",
          tile: { z: 10, x: 2, y: 1 }
        }
      ]
    } satisfies Partial<TileRenderPoolExecutionError>);

    expect(primaryRenderer.dispose).toHaveBeenCalledOnce();
    expect(secondaryRenderer.dispose).toHaveBeenCalledOnce();
  });

  it("wraps worker init failures and disposes initialized renderers", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "vttc-scheduler-init-"));
    createdDirs.push(outputRoot);
    const primaryRenderer = createMockRenderer("webgl");
    const failingRenderer = createMockRenderer("webgl");
    vi.mocked(failingRenderer.init).mockRejectedValue(new Error("init failed"));

    await expect(
      renderTilesWithWorkerPool({
        taskSource: createTaskSource([
          createTask(outputRoot, 10, 1, 1),
          createTask(outputRoot, 10, 2, 1)
        ]),
        concurrency: 2,
        rendererInitTimeoutMs: 100,
        tileRenderTimeoutMs: 100,
        initialRenderer: primaryRenderer,
        createRenderer: vi.fn().mockResolvedValue(failingRenderer)
      })
    ).rejects.toMatchObject({
      failures: [
        {
          stage: "init",
          backend: "webgl"
        }
      ]
    } satisfies Partial<TileRenderPoolExecutionError>);

    expect(primaryRenderer.dispose).toHaveBeenCalledOnce();
    expect(failingRenderer.dispose).toHaveBeenCalledOnce();
  });

  it("can continue with fewer workers when an extra worker fails to initialize", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "vttc-scheduler-reduced-pool-"));
    createdDirs.push(outputRoot);
    const primaryRenderer = createMockRenderer("webgl");
    const failingRenderer = createMockRenderer("webgl");
    const reducedPoolFailures: TileRenderPoolError[] = [];
    vi.mocked(failingRenderer.init).mockRejectedValue(new Error("gpu busy"));

    await renderTilesWithWorkerPool({
      taskSource: createTaskSource([
        createTask(outputRoot, 10, 1, 1),
        createTask(outputRoot, 10, 1, 2)
      ]),
      concurrency: 2,
      rendererInitTimeoutMs: 100,
      tileRenderTimeoutMs: 100,
      initialRenderer: primaryRenderer,
      createRenderer: vi.fn().mockResolvedValue(failingRenderer),
      allowReducedWorkerPoolOnInitFailure: true,
      onRendererInitFailure: (failure) => {
        reducedPoolFailures.push(failure);
      }
    });

    expect(primaryRenderer.renderTile).toHaveBeenCalledTimes(2);
    expect(failingRenderer.dispose).toHaveBeenCalledOnce();
    expect(reducedPoolFailures).toMatchObject([
      {
        stage: "init",
        backend: "webgl"
      }
    ]);
    await expect(readFile(path.join(outputRoot, "10", "1", "1.png"), "utf8")).resolves.toBe("10/1/1");
    await expect(readFile(path.join(outputRoot, "10", "1", "2.png"), "utf8")).resolves.toBe("10/1/2");
  });

  it("can continue with fewer workers when creating an extra worker fails immediately", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "vttc-scheduler-create-reject-"));
    createdDirs.push(outputRoot);
    const primaryRenderer = createMockRenderer("webgl");
    const reducedPoolFailures: TileRenderPoolError[] = [];

    await renderTilesWithWorkerPool({
      taskSource: createTaskSource([
        createTask(outputRoot, 10, 1, 1),
        createTask(outputRoot, 10, 1, 2)
      ]),
      concurrency: 2,
      rendererInitTimeoutMs: 100,
      tileRenderTimeoutMs: 100,
      initialRenderer: primaryRenderer,
      createRenderer: vi.fn().mockRejectedValue(new Error("launch failed")),
      allowReducedWorkerPoolOnInitFailure: true,
      onRendererInitFailure: (failure) => {
        reducedPoolFailures.push(failure);
      }
    });

    expect(primaryRenderer.renderTile).toHaveBeenCalledTimes(2);
    expect(reducedPoolFailures).toMatchObject([
      {
        stage: "init",
        backend: "webgl"
      }
    ]);
  });

  it("records cleanup failure when a discarded worker also fails to dispose", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "vttc-scheduler-init-dispose-"));
    createdDirs.push(outputRoot);
    const primaryRenderer = createMockRenderer("webgl");
    const failingRenderer = createMockRenderer("webgl");
    const reducedPoolFailures: TileRenderPoolError[] = [];
    vi.mocked(failingRenderer.init).mockRejectedValue(new Error("gpu busy"));
    vi.mocked(failingRenderer.dispose).mockRejectedValue(new Error("dispose failed"));

    await renderTilesWithWorkerPool({
      taskSource: createTaskSource([
        createTask(outputRoot, 10, 1, 1),
        createTask(outputRoot, 10, 1, 2)
      ]),
      concurrency: 2,
      rendererInitTimeoutMs: 100,
      tileRenderTimeoutMs: 100,
      initialRenderer: primaryRenderer,
      createRenderer: vi.fn().mockResolvedValue(failingRenderer),
      allowReducedWorkerPoolOnInitFailure: true,
      onRendererInitFailure: (failure) => {
        reducedPoolFailures.push(failure);
      }
    });

    expect(reducedPoolFailures).toMatchObject([
      {
        stage: "cleanup",
        backend: "webgl"
      },
      {
        stage: "init",
        backend: "webgl"
      }
    ]);
  });

  it("aggregates concurrent tile failures and avoids writing tiles that finish after cancellation", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "vttc-scheduler-aggregate-"));
    createdDirs.push(outputRoot);
    let started = 0;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const concurrentFailure: TileRenderer["renderTile"] = async (z, x, y) => {
      started += 1;
      if (started === 2) {
        release?.();
      }
      await gate;
      if (x === 1 || x === 2) {
        throw new Error(`boom-${x}`);
      }
      return Buffer.from(`${z}/${x}/${y}`);
    };
    const primaryRenderer = createMockRenderer("canvas", concurrentFailure);
    const secondaryRenderer = createMockRenderer("canvas", concurrentFailure);

    await expect(
      renderTilesWithWorkerPool({
        taskSource: createTaskSource([
          createTask(outputRoot, 10, 1, 1),
          createTask(outputRoot, 10, 2, 1),
          createTask(outputRoot, 10, 3, 1)
        ]),
        concurrency: 2,
        rendererInitTimeoutMs: 100,
        tileRenderTimeoutMs: 100,
        initialRenderer: primaryRenderer,
        createRenderer: vi.fn().mockResolvedValue(secondaryRenderer)
      })
    ).rejects.toMatchObject({
      failures: [
        { stage: "tile", tile: { z: 10, x: 1, y: 1 } },
        { stage: "tile", tile: { z: 10, x: 2, y: 1 } }
      ]
    } satisfies Partial<TileRenderPoolExecutionError>);

    await expect(readFile(path.join(outputRoot, "10", "3", "1.png"), "utf8")).rejects.toThrow();
  });

  it("surfaces cleanup failures when rendering itself succeeded", async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), "vttc-scheduler-dispose-"));
    createdDirs.push(outputRoot);
    const primaryRenderer = createMockRenderer("canvas");
    const secondaryRenderer = createMockRenderer("canvas");
    vi.mocked(secondaryRenderer.dispose).mockRejectedValue(new Error("dispose failed"));

    await expect(
      renderTilesWithWorkerPool({
        taskSource: createTaskSource([
          createTask(outputRoot, 10, 1, 1),
          createTask(outputRoot, 10, 2, 1)
        ]),
        concurrency: 2,
        rendererInitTimeoutMs: 100,
        tileRenderTimeoutMs: 100,
        initialRenderer: primaryRenderer,
        createRenderer: vi.fn().mockResolvedValue(secondaryRenderer)
      })
    ).rejects.toMatchObject({
      failures: [
        {
          stage: "cleanup",
          backend: "canvas"
        }
      ]
    } satisfies Partial<TileRenderPoolExecutionError>);
  });
});
