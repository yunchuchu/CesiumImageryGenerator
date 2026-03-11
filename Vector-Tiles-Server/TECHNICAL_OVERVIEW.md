# Vector-Tiles-Server 技术说明

## 项目目标

- 在本机搭建 PostGIS + Martin 的动态矢量瓦片服务。
- 将既有 OSM GeoJSON 数据导入 PostGIS，构建细粒度语义层并发布为 tileset。
- 为 MapLibre/Cesium 等上游可视化提供稳定的矢量瓦片接口。

## 架构组成

- PostGIS：数据存储与空间查询。
- Martin：将 PostGIS 表/视图/函数发布为矢量瓦片服务。
- 导入脚本：将 `resource/geojsonData/raw` 与 `resource/geojsonData/elements` 导入 PostGIS。

## 数据流

1. GeoJSON 存放于 `../resource/geojsonData/raw` 与 `../resource/geojsonData/elements`（仓库内 `../geojsonDataExample` 为最小示例数据）。
2. `scripts/import_geojson.sh` 导入至 `osm_raw` schema。
3. `sql/10_vt_views.sql` 将 raw 数据整理为语义视图（`vt` schema）。
4. `sql/20_vt_tilesets.sql` 通过 SQL 函数生成 tileset（`vt` schema）。
5. Martin 发布 tileset（见 `martin.yml`）。

## 目录结构

- `docker-compose.yml`：PostGIS + Martin 容器编排。
- `.env`：端口与镜像源配置。
- `scripts/import_geojson.sh`：GeoJSON 导入脚本。
- `scripts/apply_vt_sql.sh`：应用 `vt` 视图与函数。
- `sql/00_vt_schema.sql`：创建 `vt` schema。
- `sql/10_vt_views.sql`：细粒度视图层。
- `sql/20_vt_tilesets.sql`：tileset 函数。
- `martin.yml`：Martin 发布配置，仅发布 `vt` 函数。
- `maplibre/index.html`：最小验证页面。

## 数据库组织

- `osm_raw`：导入后的原始表/组合表。
- `vt`：语义视图（road、水系、landcover 等）与 tileset 函数。

## tileset 约定

- `base_transport`：交通道路与铁路。
- `base_hydro`：水系面与线。
- `base_landcover`：土地利用、自然地表、景区等。
- `base_building`：建筑物。
- `base_poi`：POI/地名/交通/宗教等点面。

## Martin 发布策略

- 通过 `martin.yml` 限制仅发布 `vt` schema 的函数。
- tileset 端点形式：
  - `http://localhost:3000/base_transport/{z}/{x}/{y}`
  - `http://localhost:3000/base_hydro/{z}/{x}/{y}`
  - `http://localhost:3000/base_landcover/{z}/{x}/{y}`
  - `http://localhost:3000/base_building/{z}/{x}/{y}`
  - `http://localhost:3000/base_poi/{z}/{x}/{y}`

## 关键注意事项

- Martin 默认不需要 `.mvt` 后缀。
- 若更换数据源或分类规则，建议先更新 `resource/geojsonData` 或 `sql/10_vt_views.sql`。
- `vt` 视图为实时查询（非物化），数据量很大时可考虑物化视图优化。
- 输入目录可通过 `OSM_GEOJSON_INPUT_DIR` 或 `OSM_GEOJSON_RAW_DIR`/`OSM_GEOJSON_ELEM_DIR` 自定义。
- PostGIS 数据输出目录可通过 `POSTGIS_DATA_DIR` 自定义。
