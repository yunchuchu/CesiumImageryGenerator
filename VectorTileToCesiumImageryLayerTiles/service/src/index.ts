import { VectorTile, type VectorTileLayer } from "@mapbox/vector-tile";
import { createCanvas } from "@napi-rs/canvas";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import Pbf from "pbf";
import { compileStyle, type MapLibreLayer, type MapLibreStyle, type StyleConfig } from "@vttc/shared";

const app = express();
const port = Number(process.env.PORT ?? 4100);
const jobs = new Map<string, ExportJob>();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

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

  const { minZoom, maxZoom, bounds } = payload.export;
  if (!Number.isFinite(minZoom) || !Number.isFinite(maxZoom)) {
    throw new Error("minZoom/maxZoom 必须为数字");
  }
  if (!Array.isArray(bounds) || bounds.length !== 4) {
    throw new Error("bounds 必须为 [minLng, minLat, maxLng, maxLat]");
  }

  return {
    style: payload.style,
    export: {
      format: payload.export.format ?? "png",
      tileSize: payload.export.tileSize ?? 256,
      minZoom,
      maxZoom,
      bounds: bounds as [number, number, number, number],
      outputPath: payload.export.outputPath
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
  const tileRenderTimeoutMs = Number(process.env.TILE_RENDER_TIMEOUT_MS ?? 15000);
  const bounds = normalizeBounds(options.bounds);
  const style = compileStyle(job.style);

  const tileRanges = buildTileRanges(bounds, options.minZoom, options.maxZoom);
  job.totalTiles = tileRanges.reduce((sum, item) => sum + item.count, 0);
  job.completedTiles = 0;

  await mkdir(job.outputPath, { recursive: true });
  for (const range of tileRanges) {
    for (let x = range.minX; x <= range.maxX; x += 1) {
      for (let y = range.minY; y <= range.maxY; y += 1) {
        const buffer = await withTimeout(
          renderRasterTile(style, options.format ?? "png", tileSize, range.zoom, x, y),
          tileRenderTimeoutMs,
          `瓦片渲染超时: z${range.zoom}/${x}/${y}`
        );
        const outputDir = path.join(job.outputPath, `${range.zoom}`, `${x}`);
        await mkdir(outputDir, { recursive: true });
        await writeFile(path.join(outputDir, `${y}.${options.format ?? "png"}`), buffer);
        job.completedTiles += 1;
        job.updatedAt = new Date().toISOString();
      }
    }
  }

  await writeMetadata(job, tileRanges);
  job.status = "completed";
  job.updatedAt = new Date().toISOString();
}

async function renderRasterTile(
  style: MapLibreStyle,
  format: "png" | "jpg",
  tileSize: number,
  z: number,
  x: number,
  y: number
) {
  const canvas = createCanvas(tileSize, tileSize);
  const ctx = canvas.getContext("2d");
  const sourceTileCache = new Map<string, VectorTile | null>();

  for (const layer of style.layers) {
    if (!isLayerVisible(layer)) continue;
    if (layer.type === "background") {
      const backgroundColor = getPaintColor(layer.paint, "background-color", "#ffffff");
      ctx.fillStyle = backgroundColor;
      ctx.globalAlpha = 1;
      ctx.fillRect(0, 0, tileSize, tileSize);
      continue;
    }
    if (layer.type !== "fill" && layer.type !== "line" && layer.type !== "circle") continue;
    const sourceId = layer.source;
    const sourceLayer = layer["source-layer"];
    if (!sourceId || !sourceLayer) continue;
    const source = style.sources[sourceId];
    if (!source?.tiles?.length) continue;
    const vectorTile = await loadVectorTile(source.tiles[0], z, x, y, sourceTileCache, sourceId);
    if (!vectorTile) continue;
    const vtLayer = vectorTile.layers[sourceLayer];
    if (!vtLayer) continue;
    drawVectorLayer(ctx, layer, vtLayer, tileSize);
  }

  const encoded = format === "jpg" ? await canvas.encode("jpeg") : await canvas.encode("png");
  return Buffer.from(encoded);
}

async function loadVectorTile(
  template: string,
  z: number,
  x: number,
  y: number,
  cache: Map<string, VectorTile | null>,
  sourceId: string
) {
  if (cache.has(sourceId)) {
    return cache.get(sourceId) ?? null;
  }
  const url = buildTileUrl(template, z, x, y);
  const fetchTimeoutMs = Number(process.env.SOURCE_FETCH_TIMEOUT_MS ?? 8000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), fetchTimeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      cache.set(sourceId, null);
      return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const tile = new VectorTile(new Pbf(bytes));
    cache.set(sourceId, tile);
    return tile;
  } catch (error) {
    console.warn(`获取矢量瓦片失败: ${url}`, error);
    cache.set(sourceId, null);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function buildTileUrl(template: string, z: number, x: number, y: number) {
  return template
    .replace(/\{z\}/g, String(z))
    .replace(/\{x\}/g, String(x))
    .replace(/\{y\}/g, String(y));
}

function drawVectorLayer(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  layer: MapLibreLayer,
  vtLayer: VectorTileLayer,
  tileSize: number
) {
  if (layer.type === "fill") {
    drawFillLayer(ctx, layer, vtLayer, tileSize);
    return;
  }
  if (layer.type === "line") {
    drawLineLayer(ctx, layer, vtLayer, tileSize);
    return;
  }
  if (layer.type === "circle") {
    drawCircleLayer(ctx, layer, vtLayer, tileSize);
  }
}

function drawFillLayer(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  layer: MapLibreLayer,
  vtLayer: VectorTileLayer,
  tileSize: number
) {
  const color = getPaintColor(layer.paint, "fill-color", "#000000");
  const opacity = clamp(getPaintNumber(layer.paint, "fill-opacity", 1), 0, 1);
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = opacity;
  const limit = Math.min(vtLayer.length, Number(process.env.RENDER_MAX_FEATURES_PER_LAYER ?? 20000));
  for (let i = 0; i < limit; i += 1) {
    const feature = vtLayer.feature(i);
    if (feature.type !== 3) continue;
    const extent = feature.extent || vtLayer.extent || 4096;
    const geometry = feature.loadGeometry();
    ctx.beginPath();
    for (const ring of geometry) {
      if (!ring.length) continue;
      const [firstX, firstY] = toPixel(ring[0], extent, tileSize);
      ctx.moveTo(firstX, firstY);
      for (let j = 1; j < ring.length; j += 1) {
        const [px, py] = toPixel(ring[j], extent, tileSize);
        ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
    ctx.fill("evenodd");
  }
  ctx.restore();
}

function drawLineLayer(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  layer: MapLibreLayer,
  vtLayer: VectorTileLayer,
  tileSize: number
) {
  const color = getPaintColor(layer.paint, "line-color", "#000000");
  const opacity = clamp(getPaintNumber(layer.paint, "line-opacity", 1), 0, 1);
  const width = Math.max(0.5, getPaintNumber(layer.paint, "line-width", 1));
  const dash = layer.paint?.["line-dasharray"];
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = opacity;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (Array.isArray(dash)) {
    const dashValues = dash.filter((item): item is number => typeof item === "number");
    if (dashValues.length) {
      ctx.setLineDash(dashValues);
    }
  }
  const limit = Math.min(vtLayer.length, Number(process.env.RENDER_MAX_FEATURES_PER_LAYER ?? 20000));
  for (let i = 0; i < limit; i += 1) {
    const feature = vtLayer.feature(i);
    if (feature.type !== 2 && feature.type !== 3) continue;
    const extent = feature.extent || vtLayer.extent || 4096;
    const geometry = feature.loadGeometry();
    for (const line of geometry) {
      if (!line.length) continue;
      const [firstX, firstY] = toPixel(line[0], extent, tileSize);
      ctx.beginPath();
      ctx.moveTo(firstX, firstY);
      for (let j = 1; j < line.length; j += 1) {
        const [px, py] = toPixel(line[j], extent, tileSize);
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawCircleLayer(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  layer: MapLibreLayer,
  vtLayer: VectorTileLayer,
  tileSize: number
) {
  const color = getPaintColor(layer.paint, "circle-color", "#000000");
  const opacity = clamp(getPaintNumber(layer.paint, "circle-opacity", 1), 0, 1);
  const radius = Math.max(0.5, getPaintNumber(layer.paint, "circle-radius", 3));
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = opacity;
  const limit = Math.min(vtLayer.length, Number(process.env.RENDER_MAX_FEATURES_PER_LAYER ?? 20000));
  for (let i = 0; i < limit; i += 1) {
    const feature = vtLayer.feature(i);
    if (feature.type !== 1) continue;
    const extent = feature.extent || vtLayer.extent || 4096;
    const geometry = feature.loadGeometry();
    for (const points of geometry) {
      for (const point of points) {
        const [px, py] = toPixel(point, extent, tileSize);
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

function isLayerVisible(layer: MapLibreLayer) {
  const visibility = layer.layout?.visibility;
  return visibility !== "none";
}

function getPaintColor(paint: MapLibreLayer["paint"], key: string, fallback: string) {
  const value = paint?.[key];
  return typeof value === "string" ? value : fallback;
}

function getPaintNumber(paint: MapLibreLayer["paint"], key: string, fallback: number) {
  const value = paint?.[key];
  return typeof value === "number" ? value : fallback;
}

function toPixel(point: { x: number; y: number }, extent: number, tileSize: number): [number, number] {
  return [(point.x / extent) * tileSize, (point.y / extent) * tileSize];
}

async function writeMetadata(job: ExportJob, tileRanges: TileRange[]) {
  await writeFile(
    path.join(job.outputPath, "metadata.json"),
    JSON.stringify(
      {
        style: job.style,
        export: job.export,
        tiles: tileRanges,
        createdAt: job.createdAt
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
