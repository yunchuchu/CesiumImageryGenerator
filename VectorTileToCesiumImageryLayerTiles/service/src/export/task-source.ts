import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ExportFailure, TileFailure } from "./failure-log.js";
import type { TileTaskSource, TileRenderTask } from "./scheduler.js";

export interface TileRange {
  zoom: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  count: number;
}

interface CreateTileTaskSourceOptions {
  ranges: TileRange[];
  outputPath: string;
  format: "png" | "jpg";
  skipExisting?: boolean;
  retryFailuresOnly?: boolean;
}

export async function createTileTaskSource(
  options: CreateTileTaskSourceOptions
): Promise<TileTaskSource> {
  const failedTileKeys = options.retryFailuresOnly
    ? await loadFailedTileKeys(options.outputPath)
    : undefined;

  const taskFactory = createTaskFactory(options.ranges, options.outputPath, options.format, {
    skipExisting: options.skipExisting ?? false,
    failedTileKeys
  });

  let total = 0;
  while (taskFactory.peek()) {
    taskFactory.next();
    total += 1;
  }

  const iterator = createTaskFactory(options.ranges, options.outputPath, options.format, {
    skipExisting: options.skipExisting ?? false,
    failedTileKeys
  });

  return {
    total,
    next: () => iterator.next()
  };
}

async function loadFailedTileKeys(outputPath: string): Promise<Set<string>> {
  const failureLogPath = path.join(outputPath, "failures.json");
  if (!existsSync(failureLogPath)) {
    throw new Error("未找到失败日志，无法只重跑失败瓦片");
  }

  const failures = JSON.parse(await readFile(failureLogPath, "utf8")) as ExportFailure[];
  return new Set(
    failures
      .filter((failure): failure is TileFailure => failure.stage === "tile")
      .map((failure) => toTileKey(failure.tile.z, failure.tile.x, failure.tile.y))
  );
}

function createTaskFactory(
  ranges: TileRange[],
  outputPath: string,
  format: "png" | "jpg",
  filters: {
    skipExisting: boolean;
    failedTileKeys?: Set<string>;
  }
) {
  let rangeIndex = 0;
  let currentX = ranges[0]?.minX ?? 0;
  let currentY = ranges[0]?.minY ?? 0;
  let buffered: TileRenderTask | undefined;

  const advance = (): TileRenderTask | undefined => {
    while (rangeIndex < ranges.length) {
      const range = ranges[rangeIndex];
      if (!range) {
        return undefined;
      }
      if (currentX > range.maxX) {
        rangeIndex += 1;
        currentX = ranges[rangeIndex]?.minX ?? 0;
        currentY = ranges[rangeIndex]?.minY ?? 0;
        continue;
      }

      const task: TileRenderTask = {
        z: range.zoom,
        x: currentX,
        y: currentY,
        outputFile: path.join(outputPath, `${range.zoom}`, `${currentX}`, `${currentY}.${format}`)
      };

      currentY += 1;
      if (currentY > range.maxY) {
        currentX += 1;
        currentY = range.minY;
      }

      if (!matchesFilters(task, filters)) {
        continue;
      }

      return task;
    }

    return undefined;
  };

  return {
    peek() {
      buffered ??= advance();
      return buffered;
    },
    next() {
      const nextTask = this.peek();
      buffered = undefined;
      return nextTask;
    }
  };
}

function matchesFilters(
  task: TileRenderTask,
  filters: {
    skipExisting: boolean;
    failedTileKeys?: Set<string>;
  }
) {
  if (filters.failedTileKeys && !filters.failedTileKeys.has(toTileKey(task.z, task.x, task.y))) {
    return false;
  }
  if (filters.skipExisting && existsSync(task.outputFile)) {
    return false;
  }
  return true;
}

function toTileKey(z: number, x: number, y: number) {
  return `${z}/${x}/${y}`;
}
