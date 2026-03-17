import { createCanvasRenderer as createCanvasRendererDefault } from "./canvas-renderer.js";
import type { CreateTileRendererOptions, TileRenderer, WebglRendererOptions } from "./types.js";

async function createWebglRendererDefault(options: WebglRendererOptions): Promise<TileRenderer> {
  const modulePath = "./webgl-renderer.js";
  const module = await import(modulePath) as {
    createWebglRenderer: (rendererOptions: WebglRendererOptions) => Promise<TileRenderer>;
  };
  return module.createWebglRenderer(options);
}

export async function createTileRenderer(options: CreateTileRendererOptions): Promise<TileRenderer> {
  const createCanvasRenderer = options.createCanvasRenderer ?? createCanvasRendererDefault;
  const createWebglRenderer = options.createWebglRenderer ?? createWebglRendererDefault;
  const webglInitTimeoutMs = options.webglInitTimeoutMs ?? 30000;

  if (options.backend === "canvas") {
    return createCanvasRenderer({
      backend: "canvas",
      format: options.format,
      tileSize: options.tileSize,
      style: options.style
    });
  }

  if (options.backend === "webgl") {
    return createWebglRenderer({
      backend: "webgl",
      format: options.format,
      tileSize: options.tileSize,
      style: options.style,
      rendererBaseUrl: options.rendererBaseUrl,
      headless: options.headless,
      launchArgs: options.launchArgs,
      pixelRatio: options.pixelRatio
    });
  }

  let webglRenderer: TileRenderer | undefined;

  try {
    webglRenderer = await createWebglRenderer({
      backend: "webgl",
      format: options.format,
      tileSize: options.tileSize,
      style: options.style,
      rendererBaseUrl: options.rendererBaseUrl,
      headless: options.headless,
      launchArgs: options.launchArgs,
      pixelRatio: options.pixelRatio
    });
    await withTimeout(webglRenderer.init(), webglInitTimeoutMs);
    return webglRenderer;
  } catch {
    if (webglRenderer) {
      await webglRenderer.dispose().catch(() => {});
    }
    return createCanvasRenderer({
      backend: "canvas",
      format: options.format,
      tileSize: options.tileSize,
      style: options.style
    });
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`webgl init timeout after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
