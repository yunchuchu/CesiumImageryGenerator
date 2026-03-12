# dataHandleTool

## 目录说明

- `tools/`：OSM 数据处理工具脚本。
- `dataExample/`：小体量示例 GeoJSON 数据（用于流程验证）。

## Remark

### 工具介绍

`dataHandleTool/tools/export_osm_geojson.sh` 用于从 Geofabrik 的 `.gpkg` 数据导出可用于导入的 GeoJSON。

依赖：
- `ogr2ogr`

输入参数（环境变量）：
- `OSM_GPKG_PATH`：输入的 `.gpkg` 路径
- `OSM_GEOJSON_OUT_DIR`：输出根目录（默认 `resource/geojsonData`）
- `OSM_GEOJSON_RAW_OUT_DIR`：raw 输出目录（默认 `resource/geojsonData/raw`）
- `OSM_GEOJSON_ELEM_OUT_DIR`：elements 输出目录（默认 `resource/geojsonData/elements`）

输入参数（命令行）：
- `-i, --input`：输入 GPKG 文件
- `-o, --output-root`：输出根目录
- `-r, --raw-dir`：raw 输出目录（覆盖 `-o`）
- `-e, --elem-dir`：elements 输出目录（覆盖 `-o`）
- 位置参数：`INPUT_GPKG`、`OUTPUT_ROOT`

### 使用说明

```bash
# 指向下载/转换后的 GPKG
export OSM_GPKG_PATH=/path/to/output.gpkg

# 导出目录 默认目录（resource/geojsonData）
./dataHandleTool/tools/export_osm_geojson.sh

# 命令行参数（优先级高于环境变量）
./dataHandleTool/tools/export_osm_geojson.sh -i /path/to/output.gpkg -o resource/geojsonData
```

### 产出数据说明

导出结构：
- `resource/geojsonData/raw/`：原始图层导出（完整要素）
- `resource/geojsonData/elements/`：组合筛选后的细分类别

每个 GeoJSON 会附加字段：
- `element`：英文类别标签
- `element_zh`：中文类别标签
- `source_layer`：原始 OSM 图层名

更多导出数据说明参看 dataExample 目录下的 reamrk.md
