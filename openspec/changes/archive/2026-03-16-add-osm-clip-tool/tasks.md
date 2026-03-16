## 1. 脚本骨架与参数解析

- [x] 1.1 在 `dataHandleTool/tools/` 下新增 `clip_osm_by_region.sh`，实现可执行与 usage 输出
- [x] 1.2 实现 CLI 参数：`-i/--input`、`-o/--output`、bbox（如 `-b/--bbox min_lon min_lat max_lon max_lat`）与 polygon 文件（如 `-p/--polygon path/to.geojson`），二者互斥
- [x] 1.3 实现环境变量：`OSM_CLIP_INPUT`、`OSM_CLIP_OUTPUT`、`OSM_CLIP_BBOX`、`OSM_CLIP_POLYGON`，且命令行参数覆盖环境变量

## 2. Bbox 裁剪

- [x] 2.1 使用 ogr2ogr `-spat xmin ymin xmax ymax` 实现 bbox 裁剪逻辑
- [x] 2.2 支持输入为 GPKG：遍历图层，逐层裁剪并写入同一输出 GPKG
- [x] 2.3 支持输入为 GeoJSON：单文件裁剪并输出 GeoJSON

## 3. Polygon 裁剪

- [x] 3.1 使用 ogr2ogr `-clipsrc` 指定 GeoJSON 多边形文件实现裁剪
- [x] 3.2 对 GPKG 输入逐层应用 polygon 裁剪并写入输出
- [x] 3.3 对 GeoJSON 输入应用 polygon 裁剪并输出 GeoJSON

## 4. 输出格式与校验

- [x] 4.1 根据输出路径扩展名（.gpkg / .geojson 或 .json）或显式参数决定输出格式
- [x] 4.2 在脚本开头校验：输入文件存在、边界参数有且仅有 bbox 或 polygon 之一、ogr2ogr 可用

## 5. 文档与流水线验证

- [x] 5.1 更新 `dataHandleTool/README.md`：裁剪工具说明、参数表、bbox/polygon 示例命令
- [x] 5.2 验证「裁剪输出 GPKG → export_osm_geojson.sh」流水线可正常运行（可手测或补充简短说明）
