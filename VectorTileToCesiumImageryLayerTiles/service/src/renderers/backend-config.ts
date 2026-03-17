import type { RenderBackend } from "./types.js";

export interface BackendConfig {
  backend: RenderBackend;
  tileRenderTimeoutMs: number;
  webglTileRenderTimeoutMs: number;
  headless: boolean;
  renderArgs: string[];
}

export function parseBackendConfig(env: NodeJS.ProcessEnv | Record<string, string | undefined>): BackendConfig {
  return {
    backend: parseBackend(env.RENDER_BACKEND),
    tileRenderTimeoutMs: Number(env.TILE_RENDER_TIMEOUT_MS ?? 15000),
    webglTileRenderTimeoutMs: Number(env.WEBGL_TILE_RENDER_TIMEOUT_MS ?? 30000),
    headless: env.RENDER_HEADLESS === "true",
    renderArgs: parseRenderArgs(env.RENDER_ARGS)
  };
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
