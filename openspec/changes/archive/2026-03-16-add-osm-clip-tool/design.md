## Context

- **现状**：`dataHandleTool` 已有 `export_osm_geojson.sh`，从 Geofabrik GPKG 导出完整 GeoJSON（raw + elements），无按区域裁剪能力。
- **约束**：沿用现有技术栈（Shell + ogr2ogr/GDAL），与现有脚本风格一致，便于在本地/CI 中串联使用。
- **干系人**：使用 Cesium 影像/矢量管线、需按省/市或自定义范围处理 OSM 数据的开发者。

## Goals / Non-Goals

**Goals:**

- 提供按 bbox 或 GeoJSON polygon 裁剪 OSM 数据（GPKG/GeoJSON 入，GPKG/GeoJSON 出）的 CLI 工具。
- 与 `dataHandleTool/tools/` 现有脚本风格一致（环境变量 + 命令行参数，优先级：CLI > 环境变量）。
- 可与 `export_osm_geojson.sh` 串联为「先裁剪 → 再导出 GeoJSON」流水线。

**Non-Goals:**

- 不实现 OSM 在线下载或实时切片；不提供 Web API 或图形界面。
- 不改变现有 `export_osm_geojson.sh` 的接口或行为，仅在其上游增加可选裁剪步骤。

## Decisions

1. **裁剪实现：ogr2ogr -spat / -clipsrc**
   - **选择**：使用 GDAL/OGR 的 `ogr2ogr`，bbox 用 `-spat xmin ymin xmax ymax`，多边形用 `-clipsrc <geojson_or_gpkg>`。
   - **理由**：与现有 `export_osm_geojson.sh` 依赖一致，无需新运行时；GPKG 与 GeoJSON 均被 OGR 支持。
   - **备选**：专用 OSM 裁剪库（如 osmium）—— 增加依赖与维护成本，当前需求用 OGR 即可满足。

2. **入口形态：Shell 脚本**
   - **选择**：在 `dataHandleTool/tools/` 下新增 Shell 脚本（如 `clip_osm_by_region.sh`），参数与环境变量命名与 `export_osm_geojson.sh` 对齐（如 `OSM_*` 前缀、`-i/-o` 等）。
   - **理由**：与现有工具一致，易被现有文档与流水线脚本调用。
   - **备选**：Node/Python 脚本—— 可后续在保持 CLI 契约前提下替换实现，首版以 Shell 降低复杂度。

3. **边界输入形式**
   - **选择**：同时支持 (1) bbox 四元组（如 `min_lon min_lat max_lon max_lat`）和 (2) 从 GeoJSON 文件读取 polygon（取第一个 polygon 或 MultiPolygon 的第一外环）。
   - **理由**：bbox 覆盖常见矩形区域；polygon 支持省界、市界等复杂边界，与 GIS 工作流兼容。

4. **输出格式与图层**
   - **选择**：输出保持与输入相同的几何类型；若输入为 GPKG，则按图层（layer）逐个裁剪并写回同一 GPKG；若输入为 GeoJSON，则单文件裁剪输出。
   - **理由**：与现有「GPKG → 多 GeoJSON」导出流程兼容，用户可先裁剪 GPKG 再跑 `export_osm_geojson`，或直接裁剪已有 GeoJSON。

## Risks / Trade-offs

- **[Risk] 大 GPKG 多图层裁剪耗时较长** → 在 README 中说明适用场景（区域不宜过大、可按需只裁剪部分图层）；后续若有需求可增加「仅裁剪指定图层」参数。
- **[Risk] -clipsrc 对极大 polygon 或复杂 MultiPolygon 可能慢** → 文档建议简化边界或先用 bbox 做粗裁；必要时可限制为单 polygon 或单外环。
- **[Trade-off] 不自动做拓扑修复** → 裁剪后可能出现边界处细小裂缝或重复边；若下游有严格要求，需用户自行用 GIS 工具后处理或后续迭代增加可选简化/修复步骤。

## Migration Plan

- 无迁移：纯新增工具，不修改现有脚本或数据格式。
- 部署：将新脚本加入仓库，更新 `dataHandleTool/README.md`；使用者需本机已安装 GDAL/OGR（与现有要求一致）。
- 回滚：删除新脚本并还原 README 即可。

## Open Questions

- 是否在第一版就支持「仅裁剪指定图层」以缩短大 GPKG 耗时？（可放在后续迭代根据使用反馈决定。）
