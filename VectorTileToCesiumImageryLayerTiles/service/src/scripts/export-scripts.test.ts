import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("export scripts", () => {
  it("passes outputPath, tileSize, format, bounds, and service url through export-demo.sh", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "vttc-export-script-"));
    createdDirs.push(tempDir);

    const stylePath = path.join(tempDir, "style.json");
    const fakeBinDir = path.join(tempDir, "bin");
    const capturePath = path.join(tempDir, "payload.json");
    const captureUrlPath = path.join(tempDir, "url.txt");

    await writeFile(stylePath, JSON.stringify({ version: 8, sources: {}, layers: [] }), "utf8");
    await mkdir(fakeBinDir, { recursive: true });
    await writeFile(
      path.join(fakeBinDir, "curl"),
      `#!/usr/bin/env bash
set -euo pipefail
payload=""
url=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "-d" ]]; then
    payload="$2"
    shift 2
    continue
  fi
  url="$1"
  shift
done
printf '%s' "$payload" > "$CAPTURE_PATH"
printf '%s' "$url" > "$CAPTURE_URL_PATH"
printf '{"id":"fake-job"}'
`,
      { encoding: "utf8", mode: 0o755 }
    );

    const scriptPath = path.resolve(import.meta.dirname, "../../scripts/export-demo.sh");
    const result = spawnSync(
      "bash",
      [
        scriptPath,
        stylePath,
        "7",
        "14",
        "output/custom-demo",
        "512",
        "jpg",
        "120,31,121,32"
      ],
      {
        env: {
          ...process.env,
          CAPTURE_PATH: capturePath,
          CAPTURE_URL_PATH: captureUrlPath,
          SERVICE_URL: "http://localhost:9999",
          PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`
        },
        encoding: "utf8"
      }
    );

    expect(result.status, result.stderr).toBe(0);

    const payload = JSON.parse(await readFile(capturePath, "utf8"));
    expect(payload.export.outputPath).toBe("output/custom-demo");
    expect(payload.export.tileSize).toBe(512);
    expect(payload.export.format).toBe("jpg");
    expect(payload.export.bounds).toEqual([120, 31, 121, 32]);
    expect(await readFile(captureUrlPath, "utf8")).toBe("http://localhost:9999/api/exports");
  });

  it("derives bounds from a geojson file when provided", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "vttc-export-geojson-"));
    createdDirs.push(tempDir);

    const stylePath = path.join(tempDir, "style.json");
    const geojsonPath = path.join(tempDir, "bounds.geojson");
    const fakeBinDir = path.join(tempDir, "bin");
    const capturePath = path.join(tempDir, "payload.json");

    await writeFile(stylePath, JSON.stringify({ version: 8, sources: {}, layers: [] }), "utf8");
    await writeFile(
      geojsonPath,
      JSON.stringify({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [119.5, 30.5],
                  [121.2, 30.5],
                  [121.2, 32.3],
                  [119.5, 32.3],
                  [119.5, 30.5]
                ]
              ]
            }
          }
        ]
      }),
      "utf8"
    );
    await mkdir(fakeBinDir, { recursive: true });
    await writeFile(
      path.join(fakeBinDir, "curl"),
      `#!/usr/bin/env bash
set -euo pipefail
payload=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "-d" ]]; then
    payload="$2"
    shift 2
    continue
  fi
  shift
done
printf '%s' "$payload" > "$CAPTURE_PATH"
printf '{"id":"fake-job"}'
`,
      { encoding: "utf8", mode: 0o755 }
    );

    const scriptPath = path.resolve(import.meta.dirname, "../../scripts/export-demo.sh");
    const result = spawnSync(
      "bash",
      [
        scriptPath,
        stylePath,
        "7",
        "14",
        "output/custom-demo",
        "512",
        "png",
        "0,0,0,0",
        geojsonPath
      ],
      {
        env: {
          ...process.env,
          CAPTURE_PATH: capturePath,
          PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`
        },
        encoding: "utf8"
      }
    );

    expect(result.status, result.stderr).toBe(0);

    const payload = JSON.parse(await readFile(capturePath, "utf8"));
    expect(payload.export.bounds).toEqual([119.5, 30.5, 121.2, 32.3]);
  });

  it("forwards extended args in export-all-webgl.sh", async () => {
    const scriptPath = path.resolve(import.meta.dirname, "../../scripts/export-all-webgl.sh");
    const script = await readFile(scriptPath, "utf8");

    expect(script).toContain('"$OUTPUT_PATH" "$TILE_SIZE" "$FORMAT" "$BOUNDS" "$GEOJSON_PATH"');
  });

  it("passes resume flags through export-demo.sh when env vars are enabled", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "vttc-export-resume-flags-"));
    createdDirs.push(tempDir);

    const stylePath = path.join(tempDir, "style.json");
    const fakeBinDir = path.join(tempDir, "bin");
    const capturePath = path.join(tempDir, "payload.json");

    await writeFile(stylePath, JSON.stringify({ version: 8, sources: {}, layers: [] }), "utf8");
    await mkdir(fakeBinDir, { recursive: true });
    await writeFile(
      path.join(fakeBinDir, "curl"),
      `#!/usr/bin/env bash
set -euo pipefail
payload=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "-d" ]]; then
    payload="$2"
    shift 2
    continue
  fi
  shift
done
printf '%s' "$payload" > "$CAPTURE_PATH"
printf '{"id":"fake-job"}'
`,
      { encoding: "utf8", mode: 0o755 }
    );

    const scriptPath = path.resolve(import.meta.dirname, "../../scripts/export-demo.sh");
    const result = spawnSync(
      "bash",
      [scriptPath, stylePath],
      {
        env: {
          ...process.env,
          CAPTURE_PATH: capturePath,
          SKIP_EXISTING: "true",
          RETRY_FAILURES_ONLY: "true",
          PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`
        },
        encoding: "utf8"
      }
    );

    expect(result.status, result.stderr).toBe(0);

    const payload = JSON.parse(await readFile(capturePath, "utf8"));
    expect(payload.export.skipExisting).toBe(true);
    expect(payload.export.retryFailuresOnly).toBe(true);
  });
});
