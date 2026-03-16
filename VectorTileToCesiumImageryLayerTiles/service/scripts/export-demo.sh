#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
DEFAULT_STYLE="$SCRIPT_DIR/../../shared/default-style-config.json"

if [[ ! -f "$DEFAULT_STYLE" ]]; then
  echo "找不到默认样式文件: $DEFAULT_STYLE" >&2
  exit 1
fi

payload=$(node -e "
const fs = require('fs');
const style = JSON.parse(fs.readFileSync(process.argv[1], 'utf-8'));
const body = {
  style,
  export: {
    format: 'png',
    tileSize: 256,
    minZoom: 6,
    maxZoom: 7,
    bounds: [120.0, 31.0, 121.0, 32.0],
    outputPath: 'output/demo'
  }
};
console.log(JSON.stringify(body));
" "$DEFAULT_STYLE")

curl -sS -X POST \
  -H "Content-Type: application/json" \
  -d "$payload" \
  http://localhost:4100/api/exports
