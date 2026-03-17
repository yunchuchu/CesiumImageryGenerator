## Why

当前 `VectorTileToCesiumImageryLayerTiles/service` 仅依赖 `@napi-rs/canvas` 的 CPU 渲染链路，在较大范围或较高缩放级别导出时已经出现单瓦片超时与整体吞吐不足的问题。仓库内虽然已有浏览器渲染页骨架，但尚未真正接入服务端任务流，因此需要补齐可用的 WebGL 渲染后端，在本机 GUI 环境下显著提升导出效率，同时保留现有 CPU 路径作为稳妥回退。

## What Changes

- 为导出服务增加可选渲染后端配置，支持 `canvas`、`webgl`、`auto` 三种模式。
- 在 `auto` 模式下优先尝试 WebGL 初始化，失败时自动回退到现有 canvas 渲染器，避免任务完全不可用。
- 将当前 CPU 渲染逻辑抽离到统一渲染器接口下，并接入基于 `Playwright + Chromium + MapLibre GL JS` 的浏览器 WebGL 渲染实现。
- 在导出任务中区分不同后端的超时与失败记录，输出明确的失败原因和失败瓦片信息，便于排查。
- 更新 README 与示例脚本，说明本机 GUI 模式下的 WebGL 启动方式、回退行为与验证方法。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `vector-tiles-to-cesium-imagery-export`: 扩展导出服务的渲染后端选择、自动回退、失败记录和相关运行配置要求。

## Impact

- 影响 `VectorTileToCesiumImageryLayerTiles/service` 的渲染器结构、导出任务执行流、静态资源暴露与环境变量解析。
- 影响服务依赖，需要引入浏览器/WebGL 相关包并维护本地渲染页与 Node 侧控制逻辑。
- 影响导出产物元数据与故障排查方式，需要记录后端类型、失败瓦片和错误原因。
- 影响 `VectorTileToCesiumImageryLayerTiles/README.md` 及 `service/scripts/*.sh`，需要补充双后端使用方式与验证脚本。
