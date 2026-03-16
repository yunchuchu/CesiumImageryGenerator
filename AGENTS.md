# AGENTS 工作记录

## 本次已完成内容（至 2026-03-12）

### 1) 新增 VectorTileToCesiumImageryLayerTiles 工程骨架
- 新建目录：`VectorTileToCesiumImageryLayerTiles/{web,service,shared}`。
- 新增 `pnpm-workspace.yaml` 与根 `package.json`（Node >= 20，workspace 脚本）。
- `shared` 最小包结构与类型导出。
- `service` 最小 Node/TS 包结构（`tsx` 运行）。
- `web` 最小 Vue 3 + Vite 包结构。

### 2) 抽离共享样式与图层目录
- 从 `Vector-Tiles-Server/maplibre/index.html` 提取：
  - `shared/src/layer-catalog.ts`（5 个 tileset + 15 个图层目录与默认 paint）。
  - `shared/default-style-config.json`（业务层样式配置）。
  - `shared/src/compile-style.ts`（业务配置编译为 MapLibre Style）。
  - `shared/src/index.ts` 导出。

### 3) Web 样式编辑器 + MapLibre 预览
- Web 端集成 `maplibre-gl`，实时预览样式。
- 左侧分组/图层控制：显隐、颜色、透明度、线宽、点半径、zIndex。
- 支持 JSON 导入/导出与重置。
- UI 已做初版设计（非最终）。

### 4) 服务端导出 API + 无头渲染流程
- `service` 接入 `express` + `playwright` + `maplibre-gl`。
- API：
  - `POST /api/styles/validate`
  - `POST /api/exports`
  - `GET /api/exports/:id`
- 使用本地 `renderer` 页面渲染并截图输出 XYZ。
- 输出目录：`service/output/<jobId>/{z}/{x}/{y}.png|jpg` + `metadata.json`。
- 增加 `RENDER_HEADLESS` 和 `RENDER_ARGS` 以便在有 GUI 环境中尝试 WebGL。

### 5) README 与示例脚本
- 新增 `VectorTileToCesiumImageryLayerTiles/README.md`。
- 新增 `service/scripts/export-demo.sh`（默认样式导出示例）。

## 当前验证状态
- ✅ Martin `http://localhost:3000/catalog` 可用。
- ✅ 导出服务可启动并接受任务。
- ❌ 导出任务在当前无头环境失败（WebGL 初始化失败）。

## 主要问题与建议
- Playwright + MapLibre 在当前无头环境无法创建 WebGL Context。
- 建议在具备 GUI/GPU 的环境中使用：
  - `RENDER_HEADLESS=false` 启动服务
  - 或通过 `RENDER_ARGS` 传入 Chromium 参数

## 后续建议（待办）
- 第 5 项验证：
  - 用本机 GUI 环境完成导出与 Cesium 加载验证。
- 若仍需无头服务器导出：
  - 评估 maplibre-native / headless-gl 等替代后端。
