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
- 导出服务为纯服务端栅格化，不依赖浏览器/WebGL。
- 可通过 `SOURCE_FETCH_TIMEOUT_MS` 控制单个矢量瓦片请求超时（默认 `8000`）。
- 可通过 `TILE_RENDER_TIMEOUT_MS` 控制单瓦片渲染超时（默认 `15000`）。
- 可通过 `RENDER_MAX_FEATURES_PER_LAYER` 控制每个 source-layer 的最大渲染要素数（默认 `20000`）。

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
bash VectorTileToCesiumImageryLayerTiles/service/scripts/export-demo.sh [样式文件路径] [minZoom] [maxZoom]
```

- **默认行为（不传参数）**：

```bash
# 使用共享默认样式 + 导出 0–17 级
bash VectorTileToCesiumImageryLayerTiles/service/scripts/export-demo.sh
```

- **使用 Web 导出的样式，仅导出 7–14 级**：

```bash
bash VectorTileToCesiumImageryLayerTiles/service/scripts/export-demo.sh \
  /path/to/web-exported-style.json \
  7 \
  14
```

脚本会先在标准错误输出一份请求体预览，随后通过 `curl` 调用 `http://localhost:4100/api/exports`，方便你复制该 JSON 到其他 HTTP 客户端中复用。
