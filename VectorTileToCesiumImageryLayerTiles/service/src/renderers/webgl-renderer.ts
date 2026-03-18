import { chromium } from "playwright";
import type { TileRenderer, WebglRendererOptions } from "./types.js";

interface RendererPageRequest {
  method: "init" | "renderTile";
  payload: unknown;
}

interface RendererPageApi {
  __initRenderer?: (payload: unknown) => Promise<void>;
  __renderTile?: (payload: unknown) => Promise<void>;
}

export async function createWebglRenderer(options: WebglRendererOptions): Promise<TileRenderer> {
  const launchBrowser = options.launchBrowser ?? chromium.launch.bind(chromium);
  const rendererBaseUrl = options.rendererBaseUrl ?? "http://127.0.0.1:4100";
  const headless = options.headless ?? true;
  const launchArgs = options.launchArgs ?? [];
  const pixelRatio = options.pixelRatio ?? 1;

  let browser: Awaited<ReturnType<typeof launchBrowser>> | undefined;
  let context: Awaited<ReturnType<Awaited<ReturnType<typeof launchBrowser>>["newContext"]>> | undefined;
  let page: Awaited<ReturnType<Awaited<ReturnType<Awaited<ReturnType<typeof launchBrowser>>["newContext"]>>["newPage"]>> | undefined;
  let initialized = false;
  let initPromise: Promise<void> | undefined;
  let initAttempt = 0;
  let disposedInitAttempt = 0;

  async function ensureAttemptIsActive(
    attempt: number,
    resources: {
      browser?: { close: () => Promise<void> };
      context?: { close: () => Promise<void> };
    }
  ) {
    if (attempt <= disposedInitAttempt) {
      await cleanupPendingResources(resources);
      throw new Error("renderer disposed during initialization");
    }
  }

  async function ensureInitialized() {
    if (initialized) {
      return;
    }
    if (initPromise) {
      await initPromise;
      return;
    }

    const attempt = ++initAttempt;
    const pendingInit = (async () => {
      const nextBrowser = await launchBrowser({
        headless,
        args: launchArgs
      });
      await ensureAttemptIsActive(attempt, { browser: nextBrowser });
      browser = nextBrowser;

      const nextContext = await nextBrowser.newContext({
        viewport: {
          width: options.tileSize,
          height: options.tileSize
        },
        deviceScaleFactor: pixelRatio
      });
      await ensureAttemptIsActive(attempt, { browser: nextBrowser, context: nextContext });
      context = nextContext;

      const nextPage = await nextContext.newPage();
      await ensureAttemptIsActive(attempt, { browser: nextBrowser, context: nextContext });
      page = nextPage;

      await nextPage.goto(new URL("/renderer/index.html", rendererBaseUrl).toString(), {
        waitUntil: "load"
      });
      await ensureAttemptIsActive(attempt, { browser: nextBrowser, context: nextContext });

      await callPageApi(nextPage, {
        method: "init",
        payload: {
          style: options.style,
          tileSize: options.tileSize,
          pixelRatio
        }
      });
      await ensureAttemptIsActive(attempt, { browser: nextBrowser, context: nextContext });

      initialized = true;
    })();

    const trackedInitPromise = pendingInit.finally(() => {
      if (initPromise === trackedInitPromise) {
        initPromise = undefined;
      }
    });
    initPromise = trackedInitPromise;
    await trackedInitPromise;
  }

  return {
    backend: "webgl",
    async init() {
      await ensureInitialized();
    },
    async renderTile(z, x, y) {
      // This renderer wraps one mutable page/map instance, so callers must serialize renderTile calls per renderer.
      await ensureInitialized();
      if (!page) {
        throw new Error("renderer page not available");
      }
      await callPageApi(page, {
        method: "renderTile",
        payload: {
          z,
          x,
          y,
          tileSize: options.tileSize
        }
      });
      return page.screenshot({
        type: options.format === "jpg" ? "jpeg" : "png"
      });
    },
    async dispose() {
      initialized = false;
      disposedInitAttempt = initAttempt;
      let closeError: unknown;
      if (context) {
        try {
          await context.close();
        } catch (error) {
          closeError = error;
        }
        context = undefined;
      }
      if (browser) {
        try {
          await browser.close();
        } catch (error) {
          closeError ??= error;
        }
        browser = undefined;
      }
      page = undefined;
      if (closeError) {
        throw closeError;
      }
    }
  };
}

async function cleanupPendingResources(resources: {
  browser?: { close: () => Promise<void> };
  context?: { close: () => Promise<void> };
}) {
  if (resources.context) {
    try {
      await resources.context.close();
    } catch {
      // Best-effort cleanup for abandoned init attempts.
    }
  }
  if (resources.browser) {
    try {
      await resources.browser.close();
    } catch {
      // Best-effort cleanup for abandoned init attempts.
    }
  }
}

async function callPageApi(
  page: { evaluate: <T, R>(pageFunction: (request: T) => R, request: T) => Promise<R> },
  request: RendererPageRequest
) {
  await page.evaluate((pageRequest) => {
    const api = window as typeof window & RendererPageApi;
    if (pageRequest.method === "init") {
      if (!api.__initRenderer) {
        throw new Error("renderer page is missing __initRenderer");
      }
      return api.__initRenderer(pageRequest.payload);
    }
    if (!api.__renderTile) {
      throw new Error("renderer page is missing __renderTile");
    }
    return api.__renderTile(pageRequest.payload);
  }, request);
}
