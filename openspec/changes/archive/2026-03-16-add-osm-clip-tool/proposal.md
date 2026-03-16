## Why

当前已有从 Geofabrik GPKG 导出 GeoJSON 的流程，但缺少按区域裁剪 OSM 数据的能力。在 Cesium 影像/矢量管线中常需只处理某一范围（如某省、某市或自定义 bbox），全量数据既占空间又拖慢后续步骤。新增 OSM 裁剪工具可在导入或导出阶段按边界裁剪，减少数据量与处理时间。

## What Changes

- 新增 **OSM 裁剪工具**：支持按边界框（bbox）或 GeoJSON 多边形裁剪 OSM 数据。
- 输入支持：GPKG 或已有 GeoJSON；输出支持：GPKG 或 GeoJSON（与现有 `export_osm_geojson` 流程可衔接）。
- 提供 CLI（脚本或可执行），参数包含输入路径、输出路径、边界定义（bbox 或 polygon 文件）。
- 可选：与 `dataHandleTool` 目录下现有脚本风格一致（环境变量 + 命令行参数），便于串联为「裁剪 → 导出 GeoJSON」流水线。

## Capabilities

### New Capabilities

- `osm-clip-tool`: 按 bbox 或 polygon 裁剪 OSM 数据（GPKG/GeoJSON 进，GPKG/GeoJSON 出），CLI 接口与 dataHandleTool 现有工具一致，可与 export_osm_geojson 串联使用。

### Modified Capabilities

- 无（当前 `openspec/specs/` 无既有能力，不涉及对现有 spec 的修改）。

## Impact

- **代码/目录**：`dataHandleTool/tools/` 下新增裁剪脚本或入口（如 `clip_osm_by_region.sh` 或等价实现）。
- **依赖**：沿用或引入 GIS 裁剪能力（如 GDAL/OGR `ogr2ogr` 的 `-spat` / `-clipsrc`），与现有 `export_osm_geojson.sh` 依赖一致。
- **文档**：更新 `dataHandleTool/README.md`，补充裁剪工具说明与示例。
- **系统**：仅本地/CI 数据处理流水线，无对外 API 或服务变更。
