import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TileRenderer } from "../renderers/types.js";
import type { TileCoordinate } from "./failure-log.js";

export interface TileRenderTask extends TileCoordinate {
  outputFile: string;
}

export interface TileTaskSource {
  total: number;
  next: () => TileRenderTask | undefined;
}

export interface RenderTilesWithWorkerPoolOptions {
  taskSource: TileTaskSource;
  concurrency: number;
  rendererInitTimeoutMs: number;
  tileRenderTimeoutMs: number;
  initialRenderer: TileRenderer;
  createRenderer: () => Promise<TileRenderer>;
  allowReducedWorkerPoolOnInitFailure?: boolean;
  onRendererInitFailure?: (failure: TileRenderPoolError) => Promise<void> | void;
  onTileComplete?: (task: TileRenderTask) => Promise<void> | void;
}

export class TileRenderPoolError extends Error {
  stage: "init" | "tile" | "cleanup";
  backend: TileRenderer["backend"];
  tile?: TileCoordinate;

  constructor(
    stage: "init" | "tile" | "cleanup",
    backend: TileRenderer["backend"],
    error: unknown,
    tile?: TileCoordinate
  ) {
    super(getErrorMessage(error));
    this.name = "TileRenderPoolError";
    this.stage = stage;
    this.backend = backend;
    this.tile = tile;
    this.cause = error;
  }
}

export class TileRenderPoolExecutionError extends Error {
  failures: TileRenderPoolError[];

  constructor(failures: TileRenderPoolError[]) {
    super(failures[0]?.message ?? "tile render pool failed");
    this.name = "TileRenderPoolExecutionError";
    this.failures = failures;
  }
}

export async function renderTilesWithWorkerPool(options: RenderTilesWithWorkerPoolOptions): Promise<void> {
  if (!options.taskSource.total) {
    await safelyDisposeRenderer(options.initialRenderer);
    return;
  }

  const workerCount = Math.max(1, Math.min(options.concurrency, options.taskSource.total));
  const renderers: TileRenderer[] = [options.initialRenderer];
  const ensuredDirectories = new Map<string, Promise<void>>();
  const poolErrors: TileRenderPoolError[] = [];

  try {
    for (let index = 1; index < workerCount; index += 1) {
      let renderer: TileRenderer | undefined;
      try {
        renderer = await options.createRenderer();
        await withTimeout(
          renderer.init(),
          options.rendererInitTimeoutMs,
          `${renderer.backend} 渲染器初始化超时`
        );
        renderers.push(renderer);
      } catch (error) {
        let cleanupFailure: TileRenderPoolError | undefined;
        if (renderer) {
          const cleanupError = await safelyDisposeRenderer(renderer);
          if (cleanupError) {
            cleanupFailure = new TileRenderPoolError("cleanup", renderer.backend, cleanupError);
          }
        }
        const initFailure = new TileRenderPoolError("init", options.initialRenderer.backend, error);
        if (options.allowReducedWorkerPoolOnInitFailure) {
          if (cleanupFailure) {
            await options.onRendererInitFailure?.(cleanupFailure);
          }
          await options.onRendererInitFailure?.(initFailure);
          continue;
        }
        if (cleanupFailure) {
          poolErrors.push(cleanupFailure);
        }
        poolErrors.push(initFailure);
        throw new TileRenderPoolExecutionError(poolErrors);
      }
    }

    await Promise.all(renderers.map(async (renderer) => {
      while (!poolErrors.length) {
        const task = options.taskSource.next();
        if (!task) {
          return;
        }
        try {
          const buffer = await withTimeout(
            renderer.renderTile(task.z, task.x, task.y),
            options.tileRenderTimeoutMs,
            `瓦片渲染超时: z${task.z}/${task.x}/${task.y}`
          );
          if (poolErrors.length) {
            return;
          }
          await ensureOutputDirectory(path.dirname(task.outputFile), ensuredDirectories);
          if (poolErrors.length) {
            return;
          }
          await writeFile(task.outputFile, buffer);
          await options.onTileComplete?.(task);
        } catch (error) {
          poolErrors.push(error instanceof TileRenderPoolError
            ? error
            : new TileRenderPoolError("tile", renderer.backend, error, task));
        }
      }
    }));

    if (poolErrors.length) {
      throw new TileRenderPoolExecutionError(poolErrors);
    }
  } finally {
    const disposeErrors = await Promise.all(renderers.map((renderer) => safelyDisposeRenderer(renderer)));
    const cleanupFailures = disposeErrors.flatMap((error, index) => (
      error ? [new TileRenderPoolError("cleanup", renderers[index]?.backend ?? "canvas", error)] : []
    ));
    if (cleanupFailures.length) {
      poolErrors.push(...cleanupFailures);
    }
    if (poolErrors.length) {
      throw new TileRenderPoolExecutionError(poolErrors);
    }
  }
}

async function ensureOutputDirectory(directory: string, cache: Map<string, Promise<void>>) {
  const existing = cache.get(directory);
  if (existing) {
    await existing;
    return;
  }

  const promise = mkdir(directory, { recursive: true });
  cache.set(directory, promise);
  await promise;
}

async function safelyDisposeRenderer(renderer: TileRenderer) {
  try {
    await renderer.dispose();
    return undefined;
  } catch (error) {
    return error;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
