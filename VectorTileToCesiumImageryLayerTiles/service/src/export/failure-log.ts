import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TileRenderer } from "../renderers/types.js";

export interface TileCoordinate {
  z: number;
  x: number;
  y: number;
}

export interface InitializationFailure {
  stage: "init";
  backend: TileRenderer["backend"];
  error: string;
  timestamp: string;
}

export interface TileFailure {
  stage: "tile";
  backend: TileRenderer["backend"];
  tile: TileCoordinate;
  error: string;
  timestamp: string;
}

export interface CleanupFailure {
  stage: "cleanup";
  backend: TileRenderer["backend"];
  error: string;
  timestamp: string;
}

export type ExportFailure = InitializationFailure | TileFailure | CleanupFailure;

export function createInitializationFailure(
  backend: TileRenderer["backend"],
  error: unknown,
  timestamp = new Date().toISOString()
): InitializationFailure {
  return {
    stage: "init",
    backend,
    error: getErrorMessage(error),
    timestamp
  };
}

export function createTileFailure(
  backend: TileRenderer["backend"],
  tile: TileCoordinate,
  error: unknown,
  timestamp = new Date().toISOString()
): TileFailure {
  return {
    stage: "tile",
    backend,
    tile,
    error: getErrorMessage(error),
    timestamp
  };
}

export function createCleanupFailure(
  backend: TileRenderer["backend"],
  error: unknown,
  timestamp = new Date().toISOString()
): CleanupFailure {
  return {
    stage: "cleanup",
    backend,
    error: getErrorMessage(error),
    timestamp
  };
}

export async function writeFailureLog(outputPath: string, failures: ExportFailure[]) {
  const failureLogPath = path.join(outputPath, "failures.json");
  if (!failures.length) {
    await rm(failureLogPath, { force: true });
    return;
  }
  await writeFile(
    failureLogPath,
    JSON.stringify(failures, null, 2)
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
