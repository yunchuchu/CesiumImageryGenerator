## ADDED Requirements

### Requirement: 导出请求体包含样式与导出参数
导出服务 SHALL 要求 `POST /api/exports` 的请求体中包含顶层 `style` 与 `export` 两个字段，其中 `style` 提供完整样式配置，`export` 提供导出相关参数（如格式、缩放级别与范围）。

#### Scenario: 有效的导出请求体
- **WHEN** 调用方在请求体中提供 `style`（样式 JSON）与 `export`（包含导出参数）的对象
- **THEN** 导出服务 SHALL 接受该请求并进入导出任务创建流程

### Requirement: 导出参数支持瓦片格式与大小配置
导出服务 SHALL 在 `export` 字段中至少支持 `format` 与 `tileSize` 两个参数，用于控制输出影像瓦片的文件格式与单瓦片尺寸。

#### Scenario: 设置 PNG 格式与 256 像素瓦片
- **WHEN** 调用方在 `export` 参数中设置 `format = 'png'` 且 `tileSize = 256`
- **THEN** 导出服务 SHALL 生成 256×256 像素大小的 PNG 影像瓦片

