#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
DEFAULT_STYLE="$SCRIPT_DIR/../../shared/default-style-config.json"

STYLE_PATH="${1:-$DEFAULT_STYLE}"
MIN_ZOOM="${2:-0}"
MAX_ZOOM="${3:-17}"

if [[ ! -f "$STYLE_PATH" ]]; then
  echo "找不到样式文件: $STYLE_PATH" >&2
  exit 1
fi

payload=$(node -e '
const fs = require("fs");
const stylePath = process.argv[1];
const minZoom = Number(process.argv[2] ?? "0");
const maxZoom = Number(process.argv[3] ?? "17");
const style = JSON.parse(fs.readFileSync(stylePath, "utf-8"));
const body = {
  style,
  export: {
    format: "png",
    tileSize: 256,
    minZoom,
    maxZoom,
    bounds: [120.0, 31.0, 121.0, 32.0],
    outputPath: "output/demo"
  }
};
console.log(JSON.stringify(body));
' "$STYLE_PATH" "$MIN_ZOOM" "$MAX_ZOOM")

echo "请求体预览：" >&2
echo "$payload" | sed 's/\\\\n/ /g' >&2

curl -sS -X POST \
  -H "Content-Type: application/json" \
  -d "$payload" \
  http://localhost:4100/api/exports
