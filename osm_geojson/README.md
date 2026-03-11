# OSM GeoJSON 说明（江苏）

本目录当前存放的是 **约 1MB 的最小示例数据集**（用于 Git 提交与流程验证）。

完整数据已迁移到（默认被 git 忽略）：
- `../.resource/osm_geojson/raw_full/`
- `../.resource/osm_geojson/elements_full/`
- `../.resource/jiangsu-260307-free.gpkg/jiangsu.gpkg`

导出脚本支持自定义输入/输出目录（见 `tools/export_osm_geojson.sh` 的环境变量）：
- `OSM_GPKG_PATH`
- `OSM_GEOJSON_RAW_OUT_DIR`
- `OSM_GEOJSON_ELEM_OUT_DIR`

## 原始图层导出
每个 GeoJSON 都包含对应 OSM 图层的全部要素，并附加字段：
- `element`：英文类别标签
- `element_zh`：中文类别标签
- `source_layer`：原始 OSM 图层名

输出目录：`osm_geojson/raw/`

## 组合筛选（经验规则）
输出目录：`osm_geojson/elements/`
- `scenic_landuse.geojson`：从 landuse 面提取的风景区相关要素
- `scenic_pois_area.geojson`：从 POI 面提取的风景区相关要素
- `scenic_natural.geojson`：从 natural 面提取的风景区相关要素
- `lakes_reservoirs.geojson`：水域面（近似：`fclass` 为 `water` 或 `reservoir`）

说明：
- 不同图层的 `fclass` 取值不同，建议在使用时进一步细分。
- 该数据中湖泊多数标为 `fclass=water`，因此“湖泊/水域”为近似集合。

## 细分类别
输出目录：`osm_geojson/elements/`

公园与森林：
- `parks_landuse.geojson`：`gis_osm_landuse_a_free` 中 `fclass='park'`
- `parks_pois_area.geojson`：`gis_osm_pois_a_free` 中 `fclass='park'`
- `forests.geojson`：`gis_osm_landuse_a_free` 中 `fclass='forest'`

湿地：
- `wetlands.geojson`：`gis_osm_water_a_free` 中 `fclass='wetland'`

河道（线）：
- `rivers.geojson`：`gis_osm_waterways_free` 中 `fclass='river'`
- `canals.geojson`：`gis_osm_waterways_free` 中 `fclass='canal'`
- `streams.geojson`：`gis_osm_waterways_free` 中 `fclass='stream'`
- `drains.geojson`：`gis_osm_waterways_free` 中 `fclass='drain'`

道路等级：
- `highway_motorway.geojson`：`fclass in ('motorway','motorway_link')`（高速）
- `highway_trunk.geojson`：`fclass in ('trunk','trunk_link')`
- `highway_primary.geojson`：`fclass in ('primary','primary_link')`
- `highway_secondary.geojson`：`fclass in ('secondary','secondary_link')`
- `highway_tertiary.geojson`：`fclass in ('tertiary','tertiary_link')`

省道（近似）：
- `provincial_roads.geojson`：`fclass in ('primary','secondary','primary_link','secondary_link')` 且 `ref` 以 `S/s` 开头
  - OSM 中国数据常用 `ref` 编码道路等级，`S` 作为省道的实用近似条件。
