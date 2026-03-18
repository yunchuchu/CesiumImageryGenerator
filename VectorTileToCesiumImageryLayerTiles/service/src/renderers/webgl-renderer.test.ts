import { describe, expect, it, vi } from "vitest";
import type { MapLibreStyle } from "@vttc/shared";
import { createWebglRenderer } from "./webgl-renderer.js";

function buildTestStyle(): MapLibreStyle {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: {
          "background-color": "#ffffff"
        },
        layout: {}
      }
    ]
  };
}

describe("createWebglRenderer", () => {
  it("initializes the renderer page once and screenshots tiles from it", async () => {
    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue(undefined),
      screenshot: vi.fn().mockResolvedValue(Buffer.from("png")),
      close: vi.fn().mockResolvedValue(undefined)
    };
    const context = {
      newPage: vi.fn().mockResolvedValue(page),
      close: vi.fn().mockResolvedValue(undefined)
    };
    const browser = {
      newContext: vi.fn().mockResolvedValue(context),
      close: vi.fn().mockResolvedValue(undefined)
    };
    const launchBrowser = vi.fn().mockResolvedValue(browser);

    const renderer = await createWebglRenderer({
      backend: "webgl",
      format: "png",
      tileSize: 256,
      style: buildTestStyle(),
      rendererBaseUrl: "http://127.0.0.1:4100",
      headless: true,
      launchArgs: ["--use-angle=metal"],
      launchBrowser
    });

    const buffer = await renderer.renderTile(10, 853, 415);
    await renderer.dispose();

    expect(renderer.backend).toBe("webgl");
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(launchBrowser).toHaveBeenCalledWith(
      expect.objectContaining({
        headless: true,
        args: ["--use-angle=metal"]
      })
    );
    expect(page.goto).toHaveBeenCalledWith(
      "http://127.0.0.1:4100/renderer/index.html",
      expect.objectContaining({ waitUntil: "load" })
    );
    expect(page.evaluate).toHaveBeenCalledTimes(2);
    expect(page.evaluate.mock.calls[0]?.[1]).toMatchObject({
      method: "init",
      payload: expect.objectContaining({
        style: buildTestStyle(),
        tileSize: 256,
        pixelRatio: 1
      })
    });
    expect(page.evaluate.mock.calls[1]?.[1]).toMatchObject({
      method: "renderTile",
      payload: {
        z: 10,
        x: 853,
        y: 415,
        tileSize: 256
      }
    });
    expect(page.screenshot).toHaveBeenCalledWith(
      expect.objectContaining({ type: "png" })
    );
    expect(context.close).toHaveBeenCalledOnce();
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it("still closes the browser when context cleanup fails", async () => {
    const page = {
      goto: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue(undefined),
      screenshot: vi.fn().mockResolvedValue(Buffer.from("png")),
      close: vi.fn().mockResolvedValue(undefined)
    };
    const context = {
      newPage: vi.fn().mockResolvedValue(page),
      close: vi.fn().mockRejectedValue(new Error("context close failed"))
    };
    const browser = {
      newContext: vi.fn().mockResolvedValue(context),
      close: vi.fn().mockResolvedValue(undefined)
    };
    const launchBrowser = vi.fn().mockResolvedValue(browser);
    const renderer = await createWebglRenderer({
      backend: "webgl",
      format: "png",
      tileSize: 256,
      style: buildTestStyle(),
      launchBrowser
    });

    await renderer.init();
    await expect(renderer.dispose()).rejects.toThrow("context close failed");

    expect(context.close).toHaveBeenCalledOnce();
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it("closes late browser instances when dispose races with initialization", async () => {
    const context = {
      newPage: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined)
    };
    const browser = {
      newContext: vi.fn().mockResolvedValue(context),
      close: vi.fn().mockResolvedValue(undefined)
    };
    let resolveBrowser: ((value: typeof browser) => void) | undefined;
    const launchBrowser = vi.fn().mockImplementation(() => new Promise((resolve) => {
      resolveBrowser = resolve;
    }));
    const renderer = await createWebglRenderer({
      backend: "webgl",
      format: "png",
      tileSize: 256,
      style: buildTestStyle(),
      launchBrowser
    });

    const initPromise = renderer.init();
    await renderer.dispose();
    resolveBrowser?.(browser);

    await expect(initPromise).rejects.toThrow("renderer disposed during initialization");
    expect(browser.close).toHaveBeenCalledOnce();
    expect(browser.newContext).not.toHaveBeenCalled();
  });

  it("closes the browser if dispose races while newContext is still pending", async () => {
    let resolveContext: ((value: { newPage: () => Promise<unknown>; close: () => Promise<void> }) => void) | undefined;
    const context = {
      newPage: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined)
    };
    const browser = {
      newContext: vi.fn().mockImplementation(() => new Promise((resolve) => {
        resolveContext = resolve;
      })),
      close: vi.fn().mockResolvedValue(undefined)
    };
    const launchBrowser = vi.fn().mockResolvedValue(browser);
    const renderer = await createWebglRenderer({
      backend: "webgl",
      format: "png",
      tileSize: 256,
      style: buildTestStyle(),
      launchBrowser
    });

    const initPromise = renderer.init();
    await Promise.resolve();
    await renderer.dispose();
    resolveContext?.(context);

    await expect(initPromise).rejects.toThrow();
    expect(browser.close).toHaveBeenCalledOnce();
  });
});
