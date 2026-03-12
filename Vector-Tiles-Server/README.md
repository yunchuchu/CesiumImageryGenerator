# PostGIS + Martin 矢量瓦片服务器

本目录用于搭建本地 PostGIS + Martin 环境，导入已有的 OSM GeoJSON 输出，并提供经过整理的矢量瓦片，便于进行 MapLibre 校验与 Cesium 栅格化工作。

技术说明（架构/数据流/目录结构等）请查看：
`/Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/Vector-Tiles-Server/TECHNICAL_OVERVIEW.md`

## 需求

- Docker（包含 `docker compose`）
- 可选：宿主机安装 `ogr2ogr`。若缺失，将使用 GDAL 容器进行导入。
- 建议先复制配置模板：`cp .env.example .env`

## 快速开始

0. 准备配置

```bash
cd Vector-Tiles-Server
cp .env.example .env
```

1. 启动服务

```bash
cd Vector-Tiles-Server
make up
```

2. 将 GeoJSON 导入 PostGIS

```bash
make import
```

说明：若未设置 `OSM_GEOJSON_INPUT_DIR` / `OSM_GEOJSON_RAW_DIR` / `OSM_GEOJSON_ELEM_DIR`，会提示输入 GeoJSON 根目录（留空使用默认 `../resource/geojsonData`）。

3. 构建整理后的视图与瓦片集

```bash
make vt
```

4. 重启 Martin 以加载新创建的 `vt` schema

```bash
docker compose restart martin
```

说明：如果先 `make up` 再执行 `make vt`，需要重启 Martin，否则 `/catalog` 可能为空。

5. 打开目录页

`http://localhost:3000/catalog`

6. 在 MapLibre 中做烟雾测试

```bash
cd Vector-Tiles-Server/maplibre
python3 -m http.server 8000
```

然后在浏览器中打开 `http://localhost:8000`。

## 端口与镜像配置

编辑 `/Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/Vector-Tiles-Server/.env`：

```
POSTGRES_PORT=5432
MARTIN_PORT=3000
POSTGIS_IMAGE=swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/postgis/postgis:16-3.4
MARTIN_IMAGE=swr.cn-north-4.myhuaweicloud.com/ddn-k8s/ghcr.io/maplibre/martin:latest-linuxarm64
```

修改后重启：

```bash
make down
make up
```

## 数据导入说明

- `make import` 若未设置环境变量，会提示输入 GeoJSON 根目录（留空使用默认 `../resource/geojsonData`）。
- 若先启动服务再执行 `make vt`，需要重启 Martin 才能加载 `vt` schema。
- 默认读取：
  - `../resource/geojsonData/raw/`
  - `../resource/geojsonData/elements/`
- 仓库内 `../geojsonDataExample/` 为约 1MB 的最小示例数据，可用于快速提交和流程验证。
- 完整数据建议放在 `../resource/`（默认被 git 忽略）。
- 所有数据会导入到 `osm_raw` schema 中，几何列 `geom` 采用 EPSG:4326。
- 会在几何列以及 `fclass`、`name`、`ref`、`element`、`source_layer`（存在时）上建立常用索引。

如果要导入其他数据集，可设置输入目录（支持两种方式）：

```
OSM_GEOJSON_INPUT_DIR=/absolute/path/to/geojsonData
OSM_GEOJSON_RAW_DIR=/absolute/path/to/raw
OSM_GEOJSON_ELEM_DIR=/absolute/path/to/elements
```

说明：
- 设置 `OSM_GEOJSON_INPUT_DIR` 时，会自动读取其下的 `raw/` 与 `elements/`。
- `OSM_GEOJSON_RAW_DIR` / `OSM_GEOJSON_ELEM_DIR` 优先级更高，可分别覆盖。

## 服务输出目录（PostGIS 数据目录）

默认数据库文件输出到 `Vector-Tiles-Server/pgdata`。可在 `.env` 中自定义：

```
POSTGIS_DATA_DIR=./pgdata
```

例如输出到仓库外部或 `resource`：

```
POSTGIS_DATA_DIR=../resource/Vector-Tiles-Server/pgdata
```

## 查看数据（PostGIS）

进入 psql：

```bash
make psql
```

常用查询：

```sql
SELECT count(*) FROM information_schema.tables WHERE table_schema='osm_raw';
SELECT count(*) FROM osm_raw.roads;
SELECT count(*) FROM vt.road_primary;
```

## 瓦片集与图层

瓦片集以 SQL 函数形式实现，位于 `vt` schema 中，并由 Martin 暴露为 MVT 端点。

瓦片集端点（注意：Martin 默认不需要 `.mvt` 后缀）：

- `http://localhost:3000/base_transport/{z}/{x}/{y}`
- `http://localhost:3000/base_hydro/{z}/{x}/{y}`
- `http://localhost:3000/base_landcover/{z}/{x}/{y}`
- `http://localhost:3000/base_building/{z}/{x}/{y}`
- `http://localhost:3000/base_poi/{z}/{x}/{y}`

每个瓦片集包含稳定的图层 ID。示例：

- 交通：`road_motorway`、`road_trunk`、`road_primary`、`road_secondary`、`road_tertiary`、`road_minor`、`road_path`、`railway_line`
- 水系：`water_polygon`、`lake_reservoir`、`wetland`、`waterway_line`、`waterway_river`、`waterway_canal`、`waterway_stream`、`waterway_drain`
- 地表覆盖：`landuse`、`natural_area`、`park`、`forest`、`scenic_area`
- 建筑：`building`
- POI：`poi_point`、`poi_area`、`transport_point`、`transport_area`、`traffic_point`、`traffic_area`、`pofw_point`、`pofw_area`、`place_point`、`place_area`

## 验证方式

- 目录页：`http://localhost:3000/catalog`
- 直接请求瓦片：
  - `http://localhost:3000/base_transport/7/106/52`
- MapLibre 验证页：
  - `cd /Users/yunchuchu/Documents/项目文件/GS/GS-imagery/CesiumImageryGenerator/Vector-Tiles-Server/maplibre`
  - `python3 -m http.server 8000`
  - 浏览器访问 `http://localhost:8000`

## 重建流程

- 重启服务：`make down` 然后 `make up`
- 重新导入数据：`make import`
- 重建视图/瓦片集：`make vt`

## 停止与清理

- 停止服务：`make down`
- 删除数据库数据：先 `make down`，再删除 `POSTGIS_DATA_DIR` 指向的目录

## 故障排查

- 如果 `make import` 无法连接 PostGIS，请通过 `make ps` 确认容器健康，并确保端口 `5432` 未被占用。
- 如果 Martin 返回空瓦片，请确认 `vt` schema 存在且瓦片集函数已应用。
