import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("renderer assets", () => {
  it("exposes init api script exactly once", async () => {
    const script = await readFile(new URL("../../renderer/renderer.js", import.meta.url), "utf8");

    expect(script.match(/window\.__initRenderer\s*=/g) ?? []).toHaveLength(1);
    expect(script.match(/\blet map;/g) ?? []).toHaveLength(1);
  });

  it("serves a single html document", async () => {
    const html = await readFile(new URL("../../renderer/index.html", import.meta.url), "utf8");

    expect(html.match(/<!doctype html>/gi) ?? []).toHaveLength(1);
    expect(html.match(/<html\b/gi) ?? []).toHaveLength(1);
  });
});
