## Context

当前导出服务把 API、任务调度与 `@napi-rs/canvas` CPU 渲染逻辑都耦合在 `service/src/index.ts` 中。仓库虽然已经存在 `service/renderer/` 浏览器页骨架，但还没有把它接入任务流，也没有补齐 Playwright、MapLibre GL JS 与页面控制协议，因此 WebGL 路径实际上不可用。

本次改动需要在不破坏现有导出 API 的前提下，引入可选的浏览器 WebGL 渲染能力，并保留 canvas 作为稳定回退路径。由于这项变更会同时影响服务依赖、渲染器结构、导出执行流、文档与脚本，因此需要先明确统一的渲染器抽象、回退策略与失败记录方式。

## Goals / Non-Goals

**Goals:**

- 为导出服务提供 `canvas`、`webgl`、`auto` 三种后端模式，并让 `auto` 优先尝试 WebGL、失败后回退到 canvas。
- 将现有 CPU 渲染逻辑抽离为统一渲染器接口，避免服务层继续直接依赖具体实现细节。
- 让浏览器渲染页成为可被 Node 控制的稳定渲染终端，支持单任务内复用同一个 page 渲染多个瓦片。
- 在导出输出中记录后端类型、失败瓦片与错误原因，便于验证与排障。
- 保持现有 API 路径和请求体结构稳定，仅新增运行时后端配置与相关文档说明。

**Non-Goals:**

- 本轮不引入 `maplibre-native`、`headless-gl` 等新的原生渲染后端。
- 本轮不实现多页面并发池、自动重试或“跳过失败继续导出”等高级调度能力。
- 本轮不把后端选择做成 API 请求体字段，仍以服务端环境变量为主。
- 本轮不追求纯无头服务器环境中的最优 GPU 兼容性，优先满足本机 GUI 验证场景。

## Decisions

### 1. 使用统一渲染器接口承接双后端

新增 `renderers/types.ts`、`canvas-renderer.ts`、`webgl-renderer.ts` 与 `factory.ts`，把渲染能力统一收敛为 `init()`、`renderTile(z, x, y)`、`dispose()` 生命周期接口。

选择该方案而不是继续把逻辑堆在 `index.ts` 中，是因为后续还需要区分初始化、按瓦片渲染、任务结束释放资源等阶段；统一接口可以让导出任务只依赖行为契约，不依赖具体后端实现。

备选方案是仅在 `index.ts` 中加 `if/else` 切换 canvas 与 browser 调用，但这会继续加重服务入口文件的耦合度，也不利于单元测试和后续回退策略演进，因此不采用。

### 2. WebGL 路径采用 Playwright + Chromium + 现有 renderer 页面

WebGL 后端将复用已有 `service/renderer/` 页面，并通过 Playwright 打开本地页面、初始化 MapLibre 地图，再以页面函数协议完成单瓦片渲染和截图。

选择该方案是因为它最大化复用仓库内已有前端骨架，能直接利用 Chromium 的 GPU/WebGL 能力，且比引入新的原生渲染栈更容易在当前 TypeScript 服务中落地。相较于 `maplibre-native` 或 `headless-gl`，这一路线依赖更少、调试成本更低，也更贴近实际浏览器渲染结果。

### 3. 单任务复用一个浏览器 page，先不做并发池

每个导出任务最多创建一个渲染器实例；如果后端为 WebGL，则对应一个浏览器实例和一个 page，在任务生命周期内复用同一页面逐瓦片渲染。

这样做的原因是当前第一优先级是打通 GPU 链路并获得真实的可用性和性能数据，而不是立即追求最大吞吐。单页面复用能明显降低浏览器初始化成本，也避免多 page 并发带来的 GPU 资源竞争、崩溃恢复和日志归因复杂度。

### 4. `auto` 模式只在初始化阶段做一次回退决策

`factory.ts` 在 `RENDER_BACKEND=auto` 时优先创建 WebGL 渲染器；若初始化阶段失败，则直接回退到 canvas 渲染器，并在整个任务中保持该选择不变。

选择“初始化时一次性决策”而不是“每个瓦片都尝试 WebGL，失败后再切 canvas”，是为了避免任务中途混用两种后端导致性能抖动、输出差异和日志难以理解。若 WebGL 在运行过程中崩溃，本轮直接让任务失败并记录原因，不做自动中途切换。

### 5. 失败记录优先落到输出元数据

导出任务在失败时至少记录 `z/x/y`、`backend`、`error`、`timestamp` 等字段，并写入 `failures.json` 或 `metadata.json` 中的失败列表。

这样做能够满足当前验证和排障需求，同时保持实现简单。相比单独引入数据库或复杂任务日志系统，这种文件级记录更符合当前子项目的轻量化定位。

### 6. 后端选择与超时参数保留为环境变量

本次继续沿用服务级环境变量管理运行时行为，新增或规范 `RENDER_BACKEND`、`WEBGL_TILE_RENDER_TIMEOUT_MS`、`RENDER_HEADLESS`、`RENDER_ARGS` 等配置。

之所以不把这些参数扩展到 `POST /api/exports` 请求体，是为了避免把宿主环境能力暴露成单次任务参数，导致 API 职责混乱。后端选择本质上是部署与运行时问题，仍应由服务实例自身控制。

## Risks / Trade-offs

- [macOS/不同机器上的 Chromium GPU 能力差异] → 在 README 与脚本中明确推荐本机 GUI 模式，保留 `canvas` 回退路径，并支持传入自定义 `RENDER_ARGS`。
- [WebGL 页面初始化成功但单瓦片渲染仍可能超时] → 为 WebGL 单独提供超时配置，并把超时作为明确失败记录写入输出元数据。
- [双后端输出结果可能存在细微差异] → 在首轮验收中要求对同一范围进行 canvas/webgl 抽样对比，以人工冒烟为主验证正确性。
- [服务入口拆分期间引入回归] → 优先保持现有 API 形状不变，并补充渲染器工厂、回退逻辑与辅助函数测试。

## Migration Plan

1. 先抽离现有 canvas 渲染逻辑并引入统一渲染器工厂，确保 `RENDER_BACKEND=canvas` 仍能工作。
2. 接入 Playwright 与 renderer 页面协议，实现 WebGL 渲染器与本地静态资源暴露。
3. 在导出任务流中替换直接调用 CPU 渲染函数的逻辑，改为“按任务创建渲染器、按瓦片调用、结束时释放”。
4. 补充 README 和 demo 脚本，分别验证 `canvas`、`webgl` 与 `auto` 路径。
5. 若 WebGL 路径在目标机器上不稳定，可通过 `RENDER_BACKEND=canvas` 立即回退，不影响既有 API 使用方式。

## Open Questions

- WebGL 路径的截图格式是否需要针对 `jpg`/`png` 做额外质量参数区分，还是沿用 Playwright 默认能力即可。
- 失败记录最终落在独立 `failures.json` 还是并入 `metadata.json`，可以在实现时根据代码侵入性选择其一，但外部要求是必须可定位到失败瓦片与后端。
