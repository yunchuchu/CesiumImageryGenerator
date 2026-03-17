# VTTC WebGL Renderer Design

**日期:** 2026-03-16

**状态:** 已确认

**背景**

`VectorTileToCesiumImageryLayerTiles/service` 当前导出链路完全运行在 `@napi-rs/canvas` 的 CPU 渲染上。实际任务中已经出现单瓦片渲染超时，且在较大范围、较高缩放级别下整体吞吐不足，无法满足本机快速验证和中等规模导出的需求。

当前仓库已经存在浏览器侧 `service/renderer/` 页面骨架，但尚未接入服务端任务流，也没有引入 `playwright` 和 `maplibre-gl` 依赖。因此，现状不是 WebGL 路径性能不够，而是根本没有启用 GPU 渲染路径。

## 目标

- 在本机 GUI 环境下优先启用 GPU / WebGL 渲染以显著提升导出速度。
- 保留现有 CPU 渲染器作为回退路径，避免 GPU 初始化失败时完全不可用。
- 尽量保持现有 API 与任务模型不变，减少对脚本和调用方的影响。
- 为后续并发、失败重试、跳过失败瓦片等增强能力预留扩展点。

## 非目标

- 本轮不追求在纯无头服务器环境下实现最优性能。
- 本轮不引入 `maplibre-native`、`headless-gl` 或其他原生渲染后端。
- 本轮不优先实现多页面并发池、超时跳过继续导出等高级调度能力。

## 方案结论

采用“双后端、统一任务调度”的架构：

- 保留 `canvas` CPU 渲染后端。
- 新增 `webgl` 渲染后端，基于 `Playwright + Chromium + MapLibre GL JS`。
- 导出任务通过统一接口选择 `canvas` / `webgl` / `auto` 三种模式。
- `auto` 模式优先尝试 `webgl`，失败时回退到 `canvas`。

这是当前实现成本、收益和可维护性最平衡的方案。它最大化复用了已经存在的 `service/renderer/` 页面骨架，同时不会破坏已工作的 CPU 路径。

## 架构设计

### 1. 服务层职责拆分

`service/src/index.ts` 只保留以下职责：

- API 注册
- 导出任务创建与进度管理
- 输出目录和元数据写入
- 根据配置选择渲染后端
- 在任务结束时释放渲染资源

具体绘制逻辑从 `index.ts` 中拆出，避免服务层继续耦合 CPU 实现细节。

### 2. 渲染后端抽象

新增统一渲染器接口，典型生命周期如下：

- `init()`：初始化渲染环境
- `renderTile(z, x, y)`：返回单个瓦片的栅格 buffer
- `dispose()`：释放资源

推荐目录：

- `service/src/renderers/types.ts`
- `service/src/renderers/canvas-renderer.ts`
- `service/src/renderers/webgl-renderer.ts`
- `service/src/renderers/factory.ts`

其中：

- `canvas-renderer.ts` 承接现有 `@napi-rs/canvas` CPU 逻辑。
- `webgl-renderer.ts` 负责浏览器启动、页面注入、瓦片定位和截图。
- `factory.ts` 根据环境变量返回具体实现，并支持 `auto` 回退。

### 3. 浏览器渲染页面

沿用现有：

- `service/renderer/index.html`
- `service/renderer/renderer.css`
- `service/renderer/renderer.js`

但需要把它从“演示页骨架”补成“可被 Node 进程控制的稳定渲染页”。

浏览器页职责：

- 初始化 MapLibre 地图
- 接收编译后的 style
- 根据传入的 XYZ 计算应显示的中心点与缩放
- 等待地图稳定
- 允许 Playwright 截取当前页面作为瓦片输出

## WebGL 单瓦片渲染数据流

建议采用“单浏览器实例 + 单页面复用 + 单任务串行渲染”的第一阶段实现。

任务启动时：

1. Node 侧读取 `RENDER_BACKEND`。
2. 如果选中 `webgl` 或 `auto`，启动 Chromium。
3. 创建固定尺寸 page，尺寸与导出 `tileSize` 一致。
4. 打开本地 `renderer/index.html`。
5. 调用页面端 `__initRenderer({ style, tileSize, pixelRatio })` 完成地图初始化。

单瓦片渲染时：

1. Node 调用页面端 `__renderTile({ z, x, y, tileSize })`。
2. 浏览器侧根据 `z/x/y` 计算视图参数。
3. 地图跳转到目标视图。
4. 等待 `idle`。
5. 额外等待 1 到 2 帧 `requestAnimationFrame`，降低刚 idle 但图层仍在收尾渲染的风险。
6. Playwright 对页面进行截图，返回 buffer。
7. Node 将 buffer 写入目标瓦片文件。

任务结束时：

1. 写入 `metadata.json`。
2. 调用 `dispose()` 关闭 page / browser。

## 为什么外部协议使用 XYZ 而不是 center/zoom

Node 侧只传入目标 `z/x/y`，不直接传 `center/zoom`。原因如下：

- 可以把 XYZ 对应的视图计算统一收敛到浏览器页内部，避免 Node 和浏览器对缩放语义各算一遍。
- 便于后续支持不同 `tileSize`、不同 `devicePixelRatio` 和不同截图策略。
- 调用层更简单，导出任务天然按 XYZ 组织，不需要做额外几何转换。

## 配置设计

新增或保留以下环境变量：

- `RENDER_BACKEND=canvas|webgl|auto`
- `RENDER_HEADLESS=false|true`
- `RENDER_ARGS=<chromium args>`
- `TILE_RENDER_TIMEOUT_MS=<ms>`：CPU 路径可继续使用
- `WEBGL_TILE_RENDER_TIMEOUT_MS=<ms>`：WebGL 单瓦片渲染超时
- `SOURCE_FETCH_TIMEOUT_MS=<ms>`：保留现有含义

默认建议：

- 本机验证时使用 `RENDER_BACKEND=webgl`
- macOS 上使用 `RENDER_HEADLESS=false`
- 通用部署默认可保持 `RENDER_BACKEND=canvas`，避免未配置 GUI 时直接失败

## 错误处理与回退策略

第一阶段必须支持：

- WebGL 初始化失败时，在 `auto` 模式下回退到 `canvas`
- 单瓦片渲染超时后明确报错，不静默吞掉
- 浏览器 page 崩溃或上下文异常时，终止当前任务并记录失败原因
- 在输出目录中记录失败瓦片信息，便于后续排查

失败记录建议至少包含：

- `z`
- `x`
- `y`
- `backend`
- `error`
- `timestamp`

建议先写入 `failures.json` 或扩展 `metadata.json`，而不是第一阶段就实现“跳过失败瓦片继续跑完整任务”。

## 为什么暂不做并发池

当前主要风险不是“吞吐调度不够先进”，而是“GPU 链路还未接通”。因此第一阶段优先目标是：

- 验证 GPU 路径真的可用
- 验证输出图像与现有样式一致
- 获取单页面复用下的真实性能数据

在缺少这些数据之前，引入多 page / 多 browser 并发会增加以下复杂度：

- 资源回收和崩溃恢复
- GPU/内存占用不可预测
- 错误定位更困难

因此并发池留作第二阶段增强项。

## 预期代码改动范围

主要改动：

- `VectorTileToCesiumImageryLayerTiles/service/package.json`
- `VectorTileToCesiumImageryLayerTiles/service/src/index.ts`
- `VectorTileToCesiumImageryLayerTiles/service/src/renderers/*`
- `VectorTileToCesiumImageryLayerTiles/service/renderer/index.html`
- `VectorTileToCesiumImageryLayerTiles/service/renderer/renderer.js`
- `VectorTileToCesiumImageryLayerTiles/README.md`
- `VectorTileToCesiumImageryLayerTiles/service/scripts/export-demo.sh`

## 验收标准

功能验收：

- 使用 `RENDER_BACKEND=webgl` 能成功导出指定范围瓦片
- 使用 `RENDER_BACKEND=canvas` 现有路径不回归
- 使用 `RENDER_BACKEND=auto` 时，WebGL 初始化失败会自动回退

性能验收：

- 在相同样式、相同范围、相同缩放条件下，`webgl` 总耗时明显优于当前 `canvas`
- 单瓦片高频超时问题显著下降

稳定性验收：

- 小范围导出连续运行成功
- 导出失败时错误信息明确，且能定位到具体瓦片

## 测试策略

第一阶段以冒烟测试和人工对比为主：

- 小范围导出 `10-12` 级，验证 WebGL 路径可用
- 同一范围分别用 `canvas` 和 `webgl` 导出，抽样比对图像
- 检查 `metadata.json` 和失败记录是否完整

若本轮引入基础测试框架，则补充：

- 渲染器选择逻辑单元测试
- `auto` 回退逻辑测试
- XYZ 到视图参数转换的辅助函数测试

## 第二阶段增强项

- `RENDER_CONCURRENCY` 多页面并发
- `RENDER_RETRY_COUNT` 自动重试
- `EXPORT_CONTINUE_ON_TILE_ERROR` 跳过失败瓦片继续完成任务
- 更细粒度性能统计与日志

## 决策摘要

本设计选择“Playwright + MapLibre GL JS”的 WebGL 路线作为第一优先级，并保留现有 CPU 渲染器作为回退。第一阶段只打通双后端切换、浏览器页复用和明确的失败记录，不提前引入并发池和复杂容错策略，先用最小实现拿到真实性能收益与稳定性数据。
