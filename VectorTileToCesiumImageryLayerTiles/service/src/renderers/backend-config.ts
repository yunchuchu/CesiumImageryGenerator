import type { RenderBackend } from "./types.js";

export interface BackendConfig {
  backend: RenderBackend;
  tileRenderTimeoutMs: number;
  webglTileRenderTimeoutMs: number;
  headless?: boolean;
  renderArgs: string[];
  exportConcurrency?: number;
}

export function parseBackendConfig(env: NodeJS.ProcessEnv | Record<string, string | undefined>): BackendConfig {
  return {
    backend: parseBackend(env.RENDER_BACKEND),
    tileRenderTimeoutMs: parsePositiveNumber(env.TILE_RENDER_TIMEOUT_MS, 15000),
    webglTileRenderTimeoutMs: parsePositiveNumber(env.WEBGL_TILE_RENDER_TIMEOUT_MS, 30000),
    headless: parseOptionalBoolean(env.RENDER_HEADLESS),
    renderArgs: parseRenderArgs(env.RENDER_ARGS),
    exportConcurrency: parsePositiveInteger(env.EXPORT_CONCURRENCY)
  };
}

export function resolveExportConcurrency(
  config: BackendConfig,
  backend: Exclude<RenderBackend, "auto"> | RenderBackend = config.backend
): number {
  if (config.exportConcurrency) {
    return config.exportConcurrency;
  }
  return backend === "webgl" ? 2 : 4;
}

function parseBackend(value: string | undefined): RenderBackend {
  if (value === "webgl" || value === "auto") {
    return value;
  }
  return "canvas";
}

function parseRenderArgs(value: string | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }
  return value
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value?.trim()) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return undefined;
  }
  return parsed;
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  if (!value?.trim()) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return undefined;
}
