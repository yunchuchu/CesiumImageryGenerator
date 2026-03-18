import { createCleanupFailure, createInitializationFailure, type ExportFailure } from "./failure-log.js";
import type { BackendConfig } from "../renderers/backend-config.js";
import { createTileRenderer } from "../renderers/factory.js";
import type { CreateTileRendererOptions, TileRenderer } from "../renderers/types.js";

interface InitializePrimaryRendererOptions {
  backendConfig: BackendConfig;
  rendererOptions: CreateTileRendererOptions;
  createRenderer?: (options: CreateTileRendererOptions) => Promise<TileRenderer>;
}

interface InitializePrimaryRendererResult {
  renderer: TileRenderer;
  resolvedBackend: TileRenderer["backend"];
  failures: ExportFailure[];
}

export class PrimaryRendererInitializationError extends Error {
  backend: TileRenderer["backend"];
  failures: ExportFailure[];

  constructor(backend: TileRenderer["backend"], error: unknown, failures: ExportFailure[]) {
    super(error instanceof Error ? error.message : String(error));
    this.name = "PrimaryRendererInitializationError";
    this.backend = backend;
    this.failures = failures;
    this.cause = error;
  }
}

export async function initializePrimaryRenderer(
  options: InitializePrimaryRendererOptions
): Promise<InitializePrimaryRendererResult> {
  const createRenderer = options.createRenderer ?? createTileRenderer;
  const failures: ExportFailure[] = [];

  if (options.backendConfig.backend !== "auto") {
    const renderer = await createRenderer(options.rendererOptions);
    try {
      await initRendererWithTimeout(renderer, options.backendConfig);
      return { renderer, resolvedBackend: renderer.backend, failures };
    } catch (error) {
      const rendererFailures = [createInitializationFailure(renderer.backend, error)];
      const cleanupFailure = await disposeRendererWithFailure(renderer);
      if (cleanupFailure) {
        rendererFailures.push(cleanupFailure);
      }
      throw new PrimaryRendererInitializationError(renderer.backend, error, rendererFailures);
    }
  }

  let webglRenderer: TileRenderer | undefined;
  try {
    webglRenderer = await createRenderer({
      ...options.rendererOptions,
      backend: "webgl"
    });
    await initRendererWithTimeout(webglRenderer, options.backendConfig);
    return { renderer: webglRenderer, resolvedBackend: "webgl", failures };
  } catch (error) {
    failures.push(createInitializationFailure("webgl", error));
    if (webglRenderer) {
      try {
        await webglRenderer.dispose();
      } catch (disposeError) {
        failures.push(createCleanupFailure("webgl", disposeError));
      }
    }
  }

  let canvasRenderer: TileRenderer | undefined;
  try {
    canvasRenderer = await createRenderer({
      ...options.rendererOptions,
      backend: "canvas"
    });
    await initRendererWithTimeout(canvasRenderer, options.backendConfig);
    return { renderer: canvasRenderer, resolvedBackend: "canvas", failures };
  } catch (error) {
    failures.push(createInitializationFailure("canvas", error));
    if (canvasRenderer) {
      const cleanupFailure = await disposeRendererWithFailure(canvasRenderer);
      if (cleanupFailure) {
        failures.push(cleanupFailure);
      }
    }
    throw new PrimaryRendererInitializationError("canvas", error, failures);
  }
}

async function initRendererWithTimeout(renderer: TileRenderer, backendConfig: BackendConfig) {
  const timeoutMs = renderer.backend === "webgl"
    ? backendConfig.webglTileRenderTimeoutMs
    : backendConfig.tileRenderTimeoutMs;
  await withTimeout(
    renderer.init(),
    timeoutMs,
    `${renderer.backend} 渲染器初始化超时`
  );
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

async function disposeRendererWithFailure(renderer: TileRenderer): Promise<ExportFailure | undefined> {
  try {
    await renderer.dispose();
    return undefined;
  } catch (error) {
    return createCleanupFailure(renderer.backend, error);
  }
}
