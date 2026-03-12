# Cesium Imagery Generator

矢量底图构建工具链：从 OSM / GeoJSON 生成可用于 Cesium 栅格化与 MapLibre 验证的矢量瓦片服务。

**目录结构**

- `dataHandleTool/`：OSM 数据导出工具与示例数据。
- `Vector-Tiles-Server/`：PostGIS + Martin 矢量瓦片服务。
- `resource/`：默认数据输出目录（被 git 忽略）。

**运行环境**

- Docker（包含 `docker compose`）。
- 可选：本机 `ogr2ogr`（缺失时可用容器导入，详见 `Vector-Tiles-Server/README.md`）。

**快速开始（使用示例数据）**

1. 启动服务

```bash
cd Vector-Tiles-Server
cp .env.example .env
make up
```

2. 使用示例数据导入

```bash
cd Vector-Tiles-Server
export OSM_GEOJSON_INPUT_DIR=../dataHandleTool/dataExample
make import
make vt
```

3. 验证

```
http://localhost:3000/catalog
```

或启动 MapLibre：

```bash
cd Vector-Tiles-Server/maplibre

python3 -m http.server 8000
```

浏览器访问 `http://localhost:8000`。

说明：若未设置 `OSM_GEOJSON_INPUT_DIR` / `OSM_GEOJSON_RAW_DIR` / `OSM_GEOJSON_ELEM_DIR`，`make import` 会提示输入 GeoJSON 根目录。

**完整流程（OSM -> GeoJSON -> 矢量瓦片）**

1. 下载 OSM 数据

建议从 Geofabrik 获取： [https://download.geofabrik.de/](https://download.geofabrik.de/)

优先下载 `.gpkg`

2. 导出 GeoJSON

```bash
bash ./dataHandleTool/tools/export_osm_geojson.sh -i /path/to/output.gpkg -o resource/geojsonData
# 或使用位置参数
bash ./dataHandleTool/tools/export_osm_geojson.sh /path/to/output.gpkg resource/geojsonData
```

默认输出：

- `resource/geojsonData/raw/`
- `resource/geojsonData/elements/`

说明：命令行参数优先于环境变量。

如果这里只能提供 Shapefile，可使用下方指令先转换为 GPKG。

```bash
ogr2ogr -f GPKG output.gpkg /path/to/shapefile_dir/*.shp
```

3. 启动矢量瓦片服务并导入数据

```bash
cd Vector-Tiles-Server
# 复制环境变量模板（首次执行）
cp .env.example .env
# 启动 PostGIS + Martin（导入与建视图都需要数据库服务）
make up
# 导入 GeoJSON 到 PostGIS
make import
# 生成 vt schema 与 tilesets
make vt
# 重启 Martin 重新加载新建的 vt schema
docker compose restart martin
```

4. 验证瓦片输出

```
http://localhost:3000/catalog
```

更多细节见：`Vector-Tiles-Server/README.md` 与 `Vector-Tiles-Server/TECHNICAL_OVERVIEW.md`。

**环境变量速查**

导出相关（`export_osm_geojson.sh`）：

- `OSM_GPKG_PATH`：输入的 `.gpkg` 路径。
- `OSM_GEOJSON_OUT_DIR`：输出根目录（默认 `resource/geojsonData`）。
- `OSM_GEOJSON_RAW_OUT_DIR`：raw 输出目录（默认 `resource/geojsonData/raw`）。
- `OSM_GEOJSON_ELEM_OUT_DIR`：elements 输出目录（默认 `resource/geojsonData/elements`）。

导入相关（`Vector-Tiles-Server/scripts/import_geojson.sh`）：

- `OSM_GEOJSON_INPUT_DIR`：输入 GeoJSON 根目录，自动读取其下 `raw/` 与 `elements/`。
- `OSM_GEOJSON_RAW_DIR`：覆盖 raw 输入目录。
- `OSM_GEOJSON_ELEM_DIR`：覆盖 elements 输入目录。

**说明**

- `resource/` 默认不提交到仓库，适合存放大体量数据。
- 当前仓库侧重矢量瓦片与验证流程，后续 Cesium 栅格化可基于 Martin 输出进行扩展。
