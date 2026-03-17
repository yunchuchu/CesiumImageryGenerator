import { VectorTile, type VectorTileLayer } from "@mapbox/vector-tile";
import { createCanvas } from "@napi-rs/canvas";
import Pbf from "pbf";
import type { MapLibreLayer, MapLibreStyle } from "@vttc/shared";
import type { CanvasRendererOptions, TileFormat, TileRenderer } from "./types.js";

export async function createCanvasRenderer(options: CanvasRendererOptions): Promise<TileRenderer> {
  return {
    backend: "canvas",
    async init() {},
    async renderTile(z, x, y) {
      return renderRasterTileCanvas(options.style, options.format, options.tileSize, z, x, y);
    },
    async dispose() {}
  };
}

export async function renderRasterTileCanvas(
  style: MapLibreStyle,
  format: TileFormat,
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
