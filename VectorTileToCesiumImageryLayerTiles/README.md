# VectorTileToCesiumImageryLayerTiles

样式编辑 + 服务器端批量渲染导出 XYZ 瓦片。

验收与回归可参考：`ACCEPTANCE.md`

## 前置条件

- Node.js >= 20
- pnpm
- 已运行 `Vector-Tiles-Server`（默认 `http://localhost:3000`）

## 启动服务

```bash
pnpm -C /Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator install
pnpm -C /Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/VectorTileToCesiumImageryLayerTiles/service dev
```

服务默认端口：`http://localhost:4100`

### 渲染后端

服务支持三种渲染后端，通过环境变量 `RENDER_BACKEND` 选择：

- `canvas`：默认值，继续使用 `@napi-rs/canvas` CPU 路径，兼容性最好。
- `webgl`：通过 `Playwright + Chromium + MapLibre GL JS` 进行浏览器渲染。
- `auto`：优先尝试 `webgl`，初始化失败后自动回退到 `canvas`。

推荐启动命令：

```bash
# 稳定回归路径
RENDER_BACKEND=canvas pnpm -C /Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/VectorTileToCesiumImageryLayerTiles/service dev

# 本机 GUI / GPU 验证路径（macOS 推荐）
RENDER_BACKEND=webgl RENDER_HEADLESS=false pnpm -C /Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/VectorTileToCesiumImageryLayerTiles/service dev

# 优先 WebGL，失败自动回退
RENDER_BACKEND=auto RENDER_HEADLESS=false pnpm -C /Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/VectorTileToCesiumImageryLayerTiles/service dev
```

如果需要自定义 Chromium 参数，可追加 `RENDER_ARGS`：

```bash
RENDER_BACKEND=webgl \
RENDER_HEADLESS=false \
RENDER_ARGS="--use-angle=metal --disable-gpu-sandbox" \
pnpm -C /Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/VectorTileToCesiumImageryLayerTiles/service dev
```

## 启动 Web 编辑器

```bash
pnpm -C /Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/VectorTileToCesiumImageryLayerTiles/web dev
```

浏览器访问：`http://localhost:5173`

## API 简表

- `POST /api/styles/validate`：校验样式 JSON（共享 `compileStyle`）
- `POST /api/exports`：创建导出任务（后台执行）
- `GET /api/exports/:id`：查询任务进度

## 示例：创建导出任务

```bash
bash /Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/VectorTileToCesiumImageryLayerTiles/service/scripts/export-demo.sh
```

如需自定义输出目录、瓦片尺寸、格式与范围：

```bash
bash /Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/VectorTileToCesiumImageryLayerTiles/service/scripts/export-demo.sh \
  /path/to/style.json \
  10 \
  12 \
  output/custom-demo \
  512 \
  jpg \
  "120,31,121,32"
```

如需从 `GeoJSON` 文件自动计算导出范围：

```bash
bash /Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/VectorTileToCesiumImageryLayerTiles/service/scripts/export-demo.sh \
  /path/to/style.json \
  10 \
  12 \
  output/custom-demo \
  512 \
  png \
  "" \
  /path/to/area.geojson
```

WebGL/auto 小范围冒烟：

```bash
bash /Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/VectorTileToCesiumImageryLayerTiles/service/scripts/export-demo-webgl.sh
```

返回示例：

```json
{ "id": "<job-id>" }
```

查询进度：

```bash
curl -sS http://localhost:4100/api/exports/<job-id>
```

输出默认在：

```
/Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/VectorTileToCesiumImageryLayerTiles/service/output/<job-id>
```

## 注意事项

- 样式配置的 `tileServerUrl` 默认为 `http://localhost:3000`。
- `bounds` 为 `[minLng, minLat, maxLng, maxLat]`，超出 Web Mercator 范围会被裁剪。
- 这是最小实现，未加入任务队列与并发控制。
- 可通过 `SOURCE_FETCH_TIMEOUT_MS` 控制单个矢量瓦片请求超时（默认 `8000`）。
- 可通过 `TILE_RENDER_TIMEOUT_MS` 控制单瓦片渲染超时（默认 `15000`）。
- 可通过 `WEBGL_TILE_RENDER_TIMEOUT_MS` 控制 WebGL 单瓦片渲染超时（默认 `30000`）。
- 可通过 `RENDER_MAX_FEATURES_PER_LAYER` 控制每个 source-layer 的最大渲染要素数（默认 `20000`）。
- `RENDER_HEADLESS=false` 更适合在本机 GUI 环境下验证 WebGL；无 GUI 或 GPU 不稳定时建议先用 `canvas`。
- `RENDER_BACKEND=auto` 只在渲染器初始化阶段做一次回退决策；任务开始后不会在中途切换后端。
- 初始化失败或单瓦片失败会写入输出目录中的 `failures.json`，`metadata.json` 中也会记录最终采用的后端与失败摘要。

## 导出样式与缩放级别

- **样式来源**
  - Web 端样式编辑器支持导出样式 JSON；
  - 导出服务的 `POST /api/exports` 顶层请求体结构为：

```jsonc
{
  "style": { /* Web 导出的样式 JSON */ },
  "export": {
    "format": "png",
    "tileSize": 256,
    "minZoom": 0,
    "maxZoom": 17,
    "bounds": [120.0, 31.0, 121.0, 32.0],
    "outputPath": "output/demo"
  }
}
```

- **缩放级别规则**
  - 未显式提供 `minZoom` / `maxZoom` 时，服务端会默认使用 **0–17 级**；
  - 提供 `minZoom` / `maxZoom` 时，只会导出该闭区间内的级别（例如 7–14）。

### 推荐脚本用法（指令版）

我们提供了一个示例脚本，便于从命令行快速发起导出：

```bash
bash VectorTileToCesiumImageryLayerTiles/service/scripts/export-demo.sh [样式文件路径] [minZoom] [maxZoom] [outputPath] [tileSize] [format] [bounds] [geojsonPath]
```

参数说明：

- `format`：可选，默认 `png`，也可传 `jpg`
- `bounds`：可选，默认 `"120.0,31.0,121.0,32.0"`，格式为 `"minLng,minLat,maxLng,maxLat"`
- `geojsonPath`：可选，传入 `GeoJSON` 文件路径后，脚本会先计算 bbox，再覆盖 `bounds`
- `SERVICE_URL`：可选环境变量，默认 `http://localhost:4100`

- **默认行为（不传参数）**：

```bash
# 使用共享默认样式 + 导出 10–12 级 + 输出到 output/demo + 256 像素 PNG 瓦片 + 默认 bounds
bash VectorTileToCesiumImageryLayerTiles/service/scripts/export-demo.sh
```

- **使用 Web 导出的样式，仅导出 7–14 级，并设置输出目录、512 像素 JPG 瓦片与自定义范围**：

```bash
bash VectorTileToCesiumImageryLayerTiles/service/scripts/export-demo.sh \
  /path/to/web-exported-style.json \
  7 \
  14 \
  output/custom-demo \
  512 \
  jpg \
  "120,31,121,32"
```

- **使用 GeoJSON 文件自动计算范围**：

```bash
bash VectorTileToCesiumImageryLayerTiles/service/scripts/export-demo.sh \
  /path/to/web-exported-style.json \
  7 \
  14 \
  output/custom-demo \
  512 \
  png \
  "" \
  /path/to/area.geojson
```

脚本会先在标准错误输出一份请求体预览，随后通过 `curl` 调用 `http://localhost:4100/api/exports`。如果服务不是跑在默认地址，可通过 `SERVICE_URL=http://host:port` 覆盖。

例如：

```bash
SERVICE_URL=http://127.0.0.1:4200 \
bash VectorTileToCesiumImageryLayerTiles/service/scripts/export-demo.sh \
  /path/to/web-exported-style.json \
  7 \
  14 \
  output/custom-demo \
  512 \
  png \
  "120,31,121,32"
```

### WebGL 快速验证

```bash
# 1. 启动服务
RENDER_BACKEND=webgl RENDER_HEADLESS=false \
pnpm -C VectorTileToCesiumImageryLayerTiles/service dev

# 2. 发起一个小范围导出
bash VectorTileToCesiumImageryLayerTiles/service/scripts/export-demo-webgl.sh

# 3. 查询任务状态
curl -sS http://localhost:4100/api/exports/<job-id>
```

如果当前机器的 WebGL 初始化失败，可直接改用：

```bash
RENDER_BACKEND=auto RENDER_HEADLESS=false \
pnpm -C VectorTileToCesiumImageryLayerTiles/service dev
```
