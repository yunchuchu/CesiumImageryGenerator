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
