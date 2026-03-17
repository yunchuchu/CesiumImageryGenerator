import cors from "cors";
import express, { type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileStyle, type StyleConfig } from "@vttc/shared";
import {
  createInitializationFailure,
  createTileFailure,
  writeFailureLog,
  type ExportFailure
} from "./export/failure-log.js";
import { parseBackendConfig } from "./renderers/backend-config.js";
import { createTileRenderer } from "./renderers/factory.js";
import type { RenderBackend, TileRenderer } from "./renderers/types.js";

const app = express();
const port = Number(process.env.PORT ?? 4100);
const jobs = new Map<string, ExportJob>();
const backendConfig = parseBackendConfig(process.env);
const serviceRootDir = fileURLToPath(new URL("..", import.meta.url));
const rendererDir = path.join(serviceRootDir, "renderer");
const mapLibreDistDir = path.join(serviceRootDir, "node_modules", "maplibre-gl", "dist");

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/renderer", express.static(rendererDir));
app.use("/vendor/maplibre", express.static(mapLibreDistDir));

app.post("/api/styles/validate", (req: Request, res: Response) => {
  try {
    const styleConfig = req.body as StyleConfig;
    compileStyle(styleConfig);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ ok: false, message: getErrorMessage(error) });
  }
});

app.post("/api/exports", (req: Request, res: Response) => {
  try {
    const payload = normalizeExportPayload(req.body);
    const job = createJob(payload);
    jobs.set(job.id, job);
    res.json({ id: job.id });
    void runExport(job).catch((error) => markFailed(job, error));
  } catch (error) {
    res.status(400).json({ message: getErrorMessage(error) });
  }
});

app.get("/api/exports/:id", (req: Request, res: Response) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    res.status(404).json({ message: "export not found" });
    return;
  }
  res.json({
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    progress: {
      total: job.totalTiles,
      completed: job.completedTiles
    },
    outputPath: job.outputPath,
    error: job.error
  });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`export service ready on http://localhost:${port}`);
});

type ExportStatus = "queued" | "running" | "completed" | "failed";

interface ExportRequest {
  style: StyleConfig;
  export: ExportOptions;
}

interface ExportOptions {
  format?: "png" | "jpg";
  tileSize?: number;
  minZoom: number;
  maxZoom: number;
  bounds: [number, number, number, number];
  outputPath?: string;
}

interface ExportJob extends ExportRequest {
  id: string;
  status: ExportStatus;
  createdAt: string;
  updatedAt: string;
  backend?: TileRenderer["backend"];
  outputPath: string;
  totalTiles: number;
  completedTiles: number;
  error?: string;
}

interface TileRange {
  zoom: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  count: number;
}

function normalizeExportPayload(body: unknown): ExportRequest {
  if (!body || typeof body !== "object") {
    throw new Error("payload 必须是对象");
  }
  const payload = body as { style?: StyleConfig; export?: ExportOptions };
  if (!payload.style) throw new Error("缺少 style");
  if (!payload.export) throw new Error("缺少 export");

  const raw = payload.export as Partial<ExportOptions> & {
    bounds?: ExportOptions["bounds"];
    outputPath?: string;
  };

  const minZoom = Number.isFinite(raw.minZoom as number) ? (raw.minZoom as number) : 0;
  const maxZoom = Number.isFinite(raw.maxZoom as number) ? (raw.maxZoom as number) : 17;

  const { bounds } = raw;
  if (!Array.isArray(bounds) || bounds.length !== 4) {
    throw new Error("bounds 必须为 [minLng, minLat, maxLng, maxLat]");
  }

  return {
    style: payload.style,
    export: {
      format: raw.format ?? "png",
      tileSize: raw.tileSize ?? 256,
      minZoom,
      maxZoom,
      bounds: bounds as [number, number, number, number],
      outputPath: raw.outputPath
    }
  };
}

function createJob(request: ExportRequest): ExportJob {
  const id = randomUUID();
  const timestamp = new Date().toISOString();
  const outputPath = resolveOutputPath(request.export.outputPath ?? path.join("output", id));
  return {
    ...request,
    id,
    status: "queued",
    createdAt: timestamp,
    updatedAt: timestamp,
    outputPath,
    totalTiles: 0,
    completedTiles: 0
  };
}

function markFailed(job: ExportJob, error: unknown) {
  job.status = "failed";
  job.updatedAt = new Date().toISOString();
  job.error = getErrorMessage(error);
  console.error(`[export:${job.id}] failed`, error);
}

function resolveOutputPath(target: string) {
  if (path.isAbsolute(target)) return target;
  return path.resolve(process.cwd(), target);
}

async function runExport(job: ExportJob) {
  job.status = "running";
  job.updatedAt = new Date().toISOString();

  const { export: options } = job;
  const tileSize = options.tileSize ?? 256;
  const failures: ExportFailure[] = [];
  let tileRanges: TileRange[] = [];
  let resolvedBackend: TileRenderer["backend"] | undefined;
  let renderer: TileRenderer | undefined;

  await mkdir(job.outputPath, { recursive: true });

  try {
    const bounds = normalizeBounds(options.bounds);
    const style = compileStyle(job.style);

    tileRanges = buildTileRanges(bounds, options.minZoom, options.maxZoom);
    job.totalTiles = tileRanges.reduce((sum, item) => sum + item.count, 0);
    job.completedTiles = 0;

    renderer = await createTileRenderer({
      backend: backendConfig.backend,
      format: options.format ?? "png",
      tileSize,
      style,
      rendererBaseUrl: `http://127.0.0.1:${port}`,
      headless: backendConfig.headless,
      launchArgs: backendConfig.renderArgs,
      webglInitTimeoutMs: backendConfig.webglTileRenderTimeoutMs
    });
    resolvedBackend = renderer.backend;
    job.backend = renderer.backend;

    try {
      const initTimeoutMs = renderer.backend === "webgl"
        ? backendConfig.webglTileRenderTimeoutMs
        : backendConfig.tileRenderTimeoutMs;
      await withTimeout(
        renderer.init(),
        initTimeoutMs,
        `${renderer.backend} 渲染器初始化超时`
      );
    } catch (error) {
      failures.push(createInitializationFailure(renderer.backend, error));
      throw error;
    }

    const tileRenderTimeoutMs = renderer.backend === "webgl"
      ? backendConfig.webglTileRenderTimeoutMs
      : backendConfig.tileRenderTimeoutMs;

    for (const range of tileRanges) {
      for (let x = range.minX; x <= range.maxX; x += 1) {
        for (let y = range.minY; y <= range.maxY; y += 1) {
          let buffer: Buffer;
          try {
            buffer = await withTimeout(
              renderer.renderTile(range.zoom, x, y),
              tileRenderTimeoutMs,
              `瓦片渲染超时: z${range.zoom}/${x}/${y}`
            );
          } catch (error) {
            failures.push(createTileFailure(renderer.backend, { z: range.zoom, x, y }, error));
            throw error;
          }
          const outputDir = path.join(job.outputPath, `${range.zoom}`, `${x}`);
          await mkdir(outputDir, { recursive: true });
          await writeFile(path.join(outputDir, `${y}.${options.format ?? "png"}`), buffer);
          job.completedTiles += 1;
          job.updatedAt = new Date().toISOString();
        }
      }
    }

    await writeMetadata(job, tileRanges, resolvedBackend, failures);
    await writeFailureLog(job.outputPath, failures);
    job.status = "completed";
    job.updatedAt = new Date().toISOString();
  } catch (error) {
    if (!failures.length) {
      failures.push(createInitializationFailure(
        resolvedBackend ?? resolveRequestedFailureBackend(backendConfig.backend),
        error
      ));
    }
    job.updatedAt = new Date().toISOString();
    job.error = getErrorMessage(error);
    await writeFailureLog(job.outputPath, failures);
    await writeMetadata(job, tileRanges, resolvedBackend, failures);
    throw error;
  } finally {
    if (renderer) {
      try {
        await renderer.dispose();
      } catch (error) {
        console.warn(`[export:${job.id}] dispose renderer failed`, error);
      }
    }
  }
}

async function writeMetadata(
  job: ExportJob,
  tileRanges: TileRange[],
  backend: TileRenderer["backend"] | undefined,
  failures: ExportFailure[]
) {
  await writeFile(
    path.join(job.outputPath, "metadata.json"),
    JSON.stringify(
      {
        style: job.style,
        export: job.export,
        backend,
        tiles: tileRanges,
        failures,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      },
      null,
      2
    )
  );
}

function normalizeBounds(bounds: [number, number, number, number]) {
  const [minLng, minLat, maxLng, maxLat] = bounds;
  const clampedMinLat = clamp(minLat, -85.05112878, 85.05112878);
  const clampedMaxLat = clamp(maxLat, -85.05112878, 85.05112878);
  const clampedMinLng = clamp(minLng, -180, 180);
  const clampedMaxLng = clamp(maxLng, -180, 180);
  if (clampedMinLng >= clampedMaxLng || clampedMinLat >= clampedMaxLat) {
    throw new Error("bounds 范围不合法");
  }
  return [clampedMinLng, clampedMinLat, clampedMaxLng, clampedMaxLat] as [number, number, number, number];
}

function buildTileRanges(bounds: [number, number, number, number], minZoom: number, maxZoom: number): TileRange[] {
  if (minZoom > maxZoom) throw new Error("minZoom 不能大于 maxZoom");
  const ranges: TileRange[] = [];
  for (let zoom = minZoom; zoom <= maxZoom; zoom += 1) {
    const maxIndex = (2 ** zoom) - 1;
    const min = lngLatToTile(bounds[0], bounds[3], zoom);
    const max = lngLatToTile(bounds[2], bounds[1], zoom);
    const minX = Math.max(0, Math.floor(Math.min(min.x, max.x)));
    const maxX = Math.min(maxIndex, Math.floor(Math.max(min.x, max.x)));
    const minY = Math.max(0, Math.floor(Math.min(min.y, max.y)));
    const maxY = Math.min(maxIndex, Math.floor(Math.max(min.y, max.y)));
    const count = (maxX - minX + 1) * (maxY - minY + 1);
    ranges.push({ zoom, minX, maxX, minY, maxY, count });
  }
  return ranges;
}

function lngLatToTile(lng: number, lat: number, zoom: number) {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(latRad) + (1 / Math.cos(latRad))) / Math.PI) / 2 * n;
  return { x, y };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function resolveRequestedFailureBackend(backend: RenderBackend): TileRenderer["backend"] {
  return backend === "canvas" ? "canvas" : "webgl";
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
