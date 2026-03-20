#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
DEFAULT_STYLE="$SCRIPT_DIR/../../shared/default-style-config.json"

STYLE_PATH="${1:-$DEFAULT_STYLE}"
MIN_ZOOM="${2:-10}"
MAX_ZOOM="${3:-12}"
OUTPUT_PATH="${4:-output/demo}"
TILE_SIZE="${5:-256}"
FORMAT="${6:-png}"
BOUNDS="${7:-120.0,31.0,121.0,32.0}"
GEOJSON_PATH="${8:-}"
START_FROM="${9:-${START_FROM:-}}"
SERVICE_URL="${SERVICE_URL:-http://localhost:4100}"
SKIP_EXISTING="${SKIP_EXISTING:-false}"
RETRY_FAILURES_ONLY="${RETRY_FAILURES_ONLY:-false}"

if [[ ! -f "$STYLE_PATH" ]]; then
  echo "找不到样式文件: $STYLE_PATH" >&2
  exit 1
fi

payload=$(node -e '
const fs = require("fs");
const stylePath = process.argv[1];
const minZoom = Number(process.argv[2] ?? "0");
const maxZoom = Number(process.argv[3] ?? "17");
const outputPath = process.argv[4] ?? "output/demo";
const tileSize = Number(process.argv[5] ?? "256");
const format = process.argv[6] ?? "png";
const rawBounds = process.argv[7] ?? "120.0,31.0,121.0,32.0";
const geojsonPath = process.argv[8] ?? "";
const skipExisting = process.argv[9] === "true";
const retryFailuresOnly = process.argv[10] === "true";
const startFrom = process.argv[11] ?? "";
const style = JSON.parse(fs.readFileSync(stylePath, "utf-8"));
let bounds = parseBounds(rawBounds);
if (geojsonPath) {
  const geojson = JSON.parse(fs.readFileSync(geojsonPath, "utf-8"));
  bounds = computeGeojsonBounds(geojson);
}
bounds = applyStartFrom(bounds, startFrom, minZoom);
const body = {
  style,
  export: {
    format,
    tileSize,
    minZoom,
    maxZoom,
    bounds,
    outputPath,
    skipExisting,
    retryFailuresOnly
  }
};
console.log(JSON.stringify(body));

function parseBounds(input) {
  const bounds = String(input)
    .split(",")
    .map((value) => Number(value.trim()));
  if (bounds.length !== 4 || bounds.some((value) => !Number.isFinite(value))) {
    throw new Error("bounds 必须是 minLng,minLat,maxLng,maxLat");
  }
  return bounds;
}

function computeGeojsonBounds(geojson) {
  const bbox = [Infinity, Infinity, -Infinity, -Infinity];

  const visit = (node) => {
    if (!node) return;
    if (Array.isArray(node)) {
      if (node.length >= 2 && typeof node[0] === "number" && typeof node[1] === "number") {
        bbox[0] = Math.min(bbox[0], node[0]);
        bbox[1] = Math.min(bbox[1], node[1]);
        bbox[2] = Math.max(bbox[2], node[0]);
        bbox[3] = Math.max(bbox[3], node[1]);
        return;
      }
      for (const child of node) visit(child);
      return;
    }

    if (typeof node !== "object") return;
    if (node.type === "FeatureCollection") {
      for (const feature of node.features ?? []) visit(feature);
      return;
    }
    if (node.type === "Feature") {
      visit(node.geometry);
      return;
    }
    if (node.type === "GeometryCollection") {
      for (const geometry of node.geometries ?? []) visit(geometry);
      return;
    }
    if ("coordinates" in node) {
      visit(node.coordinates);
    }
  };

  visit(geojson);

  if (bbox.some((value) => !Number.isFinite(value))) {
    throw new Error("geojson 中未找到有效坐标");
  }

  return bbox;
}

function applyStartFrom(bounds, startFrom, minZoom) {
  if (!startFrom) return bounds;
  const [zoomText, xText] = String(startFrom).split("/");
  const startZoom = Number(zoomText);
  const startX = Number(xText);
  if (!Number.isInteger(startZoom) || !Number.isInteger(startX)) {
    throw new Error("START_FROM 必须是 z/x，例如 16/54613");
  }
  if (startZoom !== minZoom) {
    throw new Error(`START_FROM zoom(${startZoom}) 必须等于 minZoom(${minZoom})`);
  }
  const startLng = tileXToLng(startX, startZoom);
  const adjusted = [...bounds];
  adjusted[0] = Math.max(adjusted[0], startLng);
  if (adjusted[0] >= adjusted[2]) {
    throw new Error("START_FROM 超出当前 bounds，导致范围为空");
  }
  return adjusted;
}

function tileXToLng(x, z) {
  return (x / (2 ** z)) * 360 - 180;
}
' "$STYLE_PATH" "$MIN_ZOOM" "$MAX_ZOOM" "$OUTPUT_PATH" "$TILE_SIZE" "$FORMAT" "$BOUNDS" "$GEOJSON_PATH" "$SKIP_EXISTING" "$RETRY_FAILURES_ONLY" "$START_FROM")

echo "请求体预览：" >&2
echo "$payload" | sed 's/\\\\n/ /g' >&2

curl -sS -X POST \
  -H "Content-Type: application/json" \
  -d "$payload" \
  "$SERVICE_URL/api/exports"
