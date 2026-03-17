import type { MapLibreStyle } from "@vttc/shared";

export type RenderBackend = "canvas" | "webgl" | "auto";
export type TileFormat = "png" | "jpg";

export interface TileRenderer {
  backend: Exclude<RenderBackend, "auto">;
  init(): Promise<void>;
  renderTile(z: number, x: number, y: number): Promise<Buffer>;
  dispose(): Promise<void>;
}

export interface BaseRendererOptions {
  format: TileFormat;
  tileSize: number;
  style: MapLibreStyle;
}

export interface CanvasRendererOptions extends BaseRendererOptions {
  backend: "canvas";
}

export interface WebglRendererOptions extends BaseRendererOptions {
  backend: "webgl";
  rendererBaseUrl?: string;
  headless?: boolean;
  launchArgs?: string[];
  pixelRatio?: number;
  launchBrowser?: (options: {
    headless?: boolean;
    args?: string[];
  }) => Promise<{
    newContext: (options: {
      viewport: { width: number; height: number };
      deviceScaleFactor: number;
    }) => Promise<{
      newPage: () => Promise<{
        goto: (url: string, options: { waitUntil: "load" }) => Promise<unknown>;
        evaluate: <T, R>(pageFunction: (request: T) => R, request: T) => Promise<R>;
        screenshot: (options: { type: "png" | "jpeg" }) => Promise<Buffer>;
      }>;
      close: () => Promise<void>;
    }>;
    close: () => Promise<void>;
  }>;
}

export interface CreateTileRendererOptions extends BaseRendererOptions {
  backend: RenderBackend;
  rendererBaseUrl?: string;
  headless?: boolean;
  launchArgs?: string[];
  pixelRatio?: number;
  webglInitTimeoutMs?: number;
  createCanvasRenderer?: (options: CanvasRendererOptions) => Promise<TileRenderer>;
  createWebglRenderer?: (options: WebglRendererOptions) => Promise<TileRenderer>;
}
