# Style-Driven Imagery Export

## Requirements

### Requirement: 通过外部样式 JSON 驱动导出

导出服务 SHALL 接受一个完整的样式 JSON 对象（与 Web 端样式编辑器导出的格式兼容），并使用该样式对所有输出瓦片进行渲染，而不是仅依赖内置默认样式。

#### Scenario: 使用 Web 导出样式进行导出

- **WHEN** 调用方在 `POST /api/exports` 请求体中提供 `style` 字段，内容为 Web 端导出的样式 JSON
- **THEN** 导出服务 SHALL 使用该样式渲染所有生成的 XYZ 影像瓦片

### Requirement: 默认导出 0-17 级

当请求体未显式提供 `minZoom` 或 `maxZoom` 时，导出服务 SHALL 默认导出缩放级别 0 至 17（含边界），以覆盖常规底图的完整层级范围。

#### Scenario: 未提供缩放级别配置

- **WHEN** 调用方在 `POST /api/exports` 请求体的 `export` 字段中未包含 `minZoom` 和 `maxZoom`
- **THEN** 导出服务 SHALL 使用 `minZoom = 0` 与 `maxZoom = 17` 进行导出

### Requirement: 支持可配置缩放级别范围

导出服务 SHALL 允许调用方在 `export` 参数中同时提供 `minZoom` 与 `maxZoom`，用于控制实际导出的缩放级别区间；服务 MUST 仅导出该闭区间内的所有级别瓦片。

#### Scenario: 收窄导出级别到 7-14

- **WHEN** 调用方在 `export` 参数中设置 `minZoom = 7` 且 `maxZoom = 14`
- **THEN** 导出服务 SHALL 仅渲染并输出缩放级别 7 到 14（含 7 与 14）的瓦片，不生成其他级别瓦片
