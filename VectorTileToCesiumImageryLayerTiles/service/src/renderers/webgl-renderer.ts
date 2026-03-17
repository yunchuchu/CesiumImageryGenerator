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

  async function ensureInitialized() {
    if (initialized) {
      return;
    }

    browser = await launchBrowser({
      headless,
      args: launchArgs
    });
    context = await browser.newContext({
      viewport: {
        width: options.tileSize,
        height: options.tileSize
      },
      deviceScaleFactor: pixelRatio
    });
    page = await context.newPage();
    await page.goto(new URL("/renderer/index.html", rendererBaseUrl).toString(), {
      waitUntil: "load"
    });
    await callPageApi(page, {
      method: "init",
      payload: {
        style: options.style,
        tileSize: options.tileSize,
        pixelRatio
      }
    });
    initialized = true;
  }

  return {
    backend: "webgl",
    async init() {
      await ensureInitialized();
    },
    async renderTile(z, x, y) {
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
      if (context) {
        await context.close();
        context = undefined;
      }
      if (browser) {
        await browser.close();
        browser = undefined;
      }
      page = undefined;
    }
  };
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
