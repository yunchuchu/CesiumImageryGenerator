import { writeFile } from "node:fs/promises";
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

export type ExportFailure = InitializationFailure | TileFailure;

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

export async function writeFailureLog(outputPath: string, failures: ExportFailure[]) {
  if (!failures.length) {
    return;
  }
  await writeFile(
    path.join(outputPath, "failures.json"),
    JSON.stringify(failures, null, 2)
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
