## 1. 渲染器抽象与基础测试

- [x] 1.1 为 `service` 补充测试运行配置，并新增渲染器类型定义与工厂选择逻辑测试。
- [x] 1.2 抽离现有 canvas 渲染实现到独立渲染器模块，保持 `RENDER_BACKEND=canvas` 路径可继续工作。
- [x] 1.3 实现渲染器工厂，支持 `canvas`、`webgl`、`auto` 三种模式以及 `auto` 初始化回退。

## 2. WebGL 渲染后端

- [x] 2.1 为 `service` 引入 Playwright、MapLibre GL JS 及必要的浏览器渲染依赖。
- [x] 2.2 完善 `service/renderer/` 页面协议，暴露稳定的初始化与单瓦片渲染入口，并补充 XYZ 视图计算辅助逻辑。
- [x] 2.3 实现 `webgl-renderer`，完成浏览器启动、本地页面加载、页面复用、截图输出与资源释放。

## 3. 导出任务流接线与失败记录

- [x] 3.1 在服务启动时暴露 renderer 相关静态资源，并解析 `RENDER_BACKEND`、`WEBGL_TILE_RENDER_TIMEOUT_MS`、`RENDER_HEADLESS`、`RENDER_ARGS` 等运行配置。
- [x] 3.2 将导出任务改为“按任务创建渲染器、逐瓦片渲染、任务结束释放资源”的执行流。
- [x] 3.3 为初始化失败和单瓦片失败补充结构化记录，确保输出中可定位后端、瓦片坐标、错误信息与时间。

## 4. 文档与验证

- [x] 4.1 更新 `VectorTileToCesiumImageryLayerTiles/README.md`，说明 `canvas`、`webgl`、`auto` 的使用方式、GUI 推荐配置与回退行为。
- [x] 4.2 更新现有示例脚本并新增 WebGL 示例脚本，提供本机快速验证命令。
- [x] 4.3 以小范围样例分别验证 `canvas`、`webgl` 与 `auto` 路径，确认现有导出能力不回归且失败记录可用。
