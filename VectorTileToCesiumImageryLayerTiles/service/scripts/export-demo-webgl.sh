#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
DEFAULT_STYLE="$SCRIPT_DIR/../../shared/default-style-config.json"
STYLE_PATH="${1:-$DEFAULT_STYLE}"
MIN_ZOOM="${2:-10}"
MAX_ZOOM="${3:-12}"
OUTPUT_PATH="${4:-output/demo-webgl}"

cat >&2 <<'EOF'
请先用 WebGL 或 auto 后端启动服务，例如：
  RENDER_BACKEND=webgl RENDER_HEADLESS=false pnpm -C VectorTileToCesiumImageryLayerTiles/service dev

如果当前机器不支持 WebGL，可改用：
  RENDER_BACKEND=auto RENDER_HEADLESS=false pnpm -C VectorTileToCesiumImageryLayerTiles/service dev
EOF

bash "$SCRIPT_DIR/export-demo.sh" "$STYLE_PATH" "$MIN_ZOOM" "$MAX_ZOOM" "$OUTPUT_PATH"
