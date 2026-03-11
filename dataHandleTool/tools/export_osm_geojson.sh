#!/usr/bin/env bash
set -euo pipefail

SRC="${OSM_GPKG_PATH:-jiangsu-260307-free.gpkg/jiangsu.gpkg}"
RAW_DIR="${OSM_GEOJSON_RAW_OUT_DIR:-resource/geojsonData/raw}"
ELEM_DIR="${OSM_GEOJSON_ELEM_OUT_DIR:-resource/geojsonData/elements}"
OUTPUT_ROOT="$(dirname "$RAW_DIR")"

mkdir -p "$OUTPUT_ROOT" "$RAW_DIR" "$ELEM_DIR"

export_layer() {
  local layer="$1"
  local out="$2"
  local element="$3"
  local element_zh="$4"
  local out_path="$5"
  if [ -f "$out_path" ]; then
    echo "Skip existing $out_path"
    return 0
  fi
  ogr2ogr -f GeoJSON -lco RFC7946=YES -lco WRITE_BBOX=YES \
    -sql "SELECT *, '${out}' AS element, '${element_zh}' AS element_zh, '${layer}' AS source_layer FROM ${layer}" \
    "$out_path" "$SRC"
}

export_sql() {
  local sql="$1"
  local out_path="$2"
  if [ -f "$out_path" ]; then
    echo "Skip existing $out_path"
    return 0
  fi
  ogr2ogr -f GeoJSON -lco RFC7946=YES -lco WRITE_BBOX=YES \
    -sql "$sql" \
    "$out_path" "$SRC"
}

layers=(
  "gis_osm_roads_free|roads|道路"
  "gis_osm_railways_free|railways|铁路"
  "gis_osm_waterways_free|waterways|水系线"
  "gis_osm_water_a_free|water_area|水域面"
  "gis_osm_landuse_a_free|landuse|土地利用"
  "gis_osm_buildings_a_free|buildings|建筑物"
  "gis_osm_places_free|place_point|地名点"
  "gis_osm_places_a_free|place_area|地名面"
  "gis_osm_pois_free|poi_point|兴趣点"
  "gis_osm_pois_a_free|poi_area|兴趣点面"
  "gis_osm_transport_free|transport_point|交通设施点"
  "gis_osm_transport_a_free|transport_area|交通设施面"
  "gis_osm_traffic_free|traffic_point|交通要素点"
  "gis_osm_traffic_a_free|traffic_area|交通要素面"
  "gis_osm_natural_free|natural_point|自然地物点"
  "gis_osm_natural_a_free|natural_area|自然地物面"
  "gis_osm_pofw_free|pofw_point|宗教场所点"
  "gis_osm_pofw_a_free|pofw_area|宗教场所面"
)

for item in "${layers[@]}"; do
  IFS='|' read -r layer outbase zh <<< "$item"
  out_path="$RAW_DIR/${outbase}.geojson"
  echo "Exporting $layer -> $out_path"
  export_layer "$layer" "$outbase" "$outbase" "$zh" "$out_path"
done

# Curated elements (heuristic filters)
SCENIC_LANDUSE="('park','recreation_ground','nature_reserve','forest','meadow','heath','scrub','grass')"
SCENIC_POIS="('attraction','park','zoo','museum','golf_course','theme_park','viewpoint','picnic_site','camp_site','caravan_site')"
SCENIC_NATURAL="('beach','cliff','cave_entrance')"

echo "Exporting scenic area subsets"
export_sql \
  "SELECT *, 'scenic_area' AS element, '风景区' AS element_zh, 'gis_osm_landuse_a_free' AS source_layer FROM gis_osm_landuse_a_free WHERE fclass IN ${SCENIC_LANDUSE}" \
  "$ELEM_DIR/scenic_landuse.geojson"

export_sql \
  "SELECT *, 'scenic_area' AS element, '风景区' AS element_zh, 'gis_osm_pois_a_free' AS source_layer FROM gis_osm_pois_a_free WHERE fclass IN ${SCENIC_POIS}" \
  "$ELEM_DIR/scenic_pois_area.geojson"

export_sql \
  "SELECT *, 'scenic_area' AS element, '风景区' AS element_zh, 'gis_osm_natural_a_free' AS source_layer FROM gis_osm_natural_a_free WHERE fclass IN ${SCENIC_NATURAL}" \
  "$ELEM_DIR/scenic_natural.geojson"

# Lakes / water bodies (approximation)
echo "Exporting lakes/reservoirs (approx)"
export_sql \
  "SELECT *, 'lake' AS element, '湖泊/水域' AS element_zh, 'gis_osm_water_a_free' AS source_layer FROM gis_osm_water_a_free WHERE fclass IN ('water','reservoir')" \
  "$ELEM_DIR/lakes_reservoirs.geojson"

# Refined categories
echo "Exporting refined categories"
export_sql \
  "SELECT *, 'park' AS element, '公园' AS element_zh, 'gis_osm_landuse_a_free' AS source_layer FROM gis_osm_landuse_a_free WHERE fclass='park'" \
  "$ELEM_DIR/parks_landuse.geojson"

export_sql \
  "SELECT *, 'park' AS element, '公园' AS element_zh, 'gis_osm_pois_a_free' AS source_layer FROM gis_osm_pois_a_free WHERE fclass='park'" \
  "$ELEM_DIR/parks_pois_area.geojson"

export_sql \
  "SELECT *, 'forest' AS element, '森林' AS element_zh, 'gis_osm_landuse_a_free' AS source_layer FROM gis_osm_landuse_a_free WHERE fclass='forest'" \
  "$ELEM_DIR/forests.geojson"

export_sql \
  "SELECT *, 'wetland' AS element, '湿地' AS element_zh, 'gis_osm_water_a_free' AS source_layer FROM gis_osm_water_a_free WHERE fclass='wetland'" \
  "$ELEM_DIR/wetlands.geojson"

export_sql \
  "SELECT *, 'river' AS element, '河道' AS element_zh, 'gis_osm_waterways_free' AS source_layer FROM gis_osm_waterways_free WHERE fclass='river'" \
  "$ELEM_DIR/rivers.geojson"

export_sql \
  "SELECT *, 'canal' AS element, '运河/渠道' AS element_zh, 'gis_osm_waterways_free' AS source_layer FROM gis_osm_waterways_free WHERE fclass='canal'" \
  "$ELEM_DIR/canals.geojson"

export_sql \
  "SELECT *, 'stream' AS element, '溪流' AS element_zh, 'gis_osm_waterways_free' AS source_layer FROM gis_osm_waterways_free WHERE fclass='stream'" \
  "$ELEM_DIR/streams.geojson"

export_sql \
  "SELECT *, 'drain' AS element, '排水渠' AS element_zh, 'gis_osm_waterways_free' AS source_layer FROM gis_osm_waterways_free WHERE fclass='drain'" \
  "$ELEM_DIR/drains.geojson"

export_sql \
  "SELECT *, 'highway_motorway' AS element, '高速' AS element_zh, 'gis_osm_roads_free' AS source_layer FROM gis_osm_roads_free WHERE fclass IN ('motorway','motorway_link')" \
  "$ELEM_DIR/highway_motorway.geojson"

export_sql \
  "SELECT *, 'highway_trunk' AS element, '快速路/国省干线' AS element_zh, 'gis_osm_roads_free' AS source_layer FROM gis_osm_roads_free WHERE fclass IN ('trunk','trunk_link')" \
  "$ELEM_DIR/highway_trunk.geojson"

export_sql \
  "SELECT *, 'highway_primary' AS element, '主干道' AS element_zh, 'gis_osm_roads_free' AS source_layer FROM gis_osm_roads_free WHERE fclass IN ('primary','primary_link')" \
  "$ELEM_DIR/highway_primary.geojson"

export_sql \
  "SELECT *, 'highway_secondary' AS element, '次干道/省道' AS element_zh, 'gis_osm_roads_free' AS source_layer FROM gis_osm_roads_free WHERE fclass IN ('secondary','secondary_link')" \
  "$ELEM_DIR/highway_secondary.geojson"

export_sql \
  "SELECT *, 'highway_tertiary' AS element, '支路' AS element_zh, 'gis_osm_roads_free' AS source_layer FROM gis_osm_roads_free WHERE fclass IN ('tertiary','tertiary_link')" \
  "$ELEM_DIR/highway_tertiary.geojson"

export_sql \
  "SELECT *, 'provincial_road' AS element, '省道(S*)' AS element_zh, 'gis_osm_roads_free' AS source_layer FROM gis_osm_roads_free WHERE fclass IN ('primary','secondary','primary_link','secondary_link') AND (ref LIKE 'S%' OR ref LIKE 's%')" \
  "$ELEM_DIR/provincial_roads.geojson"

cat <<'README' > "$OUTPUT_ROOT/README.md"
# OSM GeoJSON exports

## Raw layers
Each GeoJSON contains all features from the corresponding OSM layer and adds:
- `element`: English label for the output type
- `element_zh`: Chinese label
- `source_layer`: original OSM layer name

Output directory: `raw/`

## Curated elements (heuristic)
Directory: `elements/`
- `scenic_landuse.geojson`: scenic areas from landuse polygons
- `scenic_pois_area.geojson`: scenic areas from POI polygons
- `scenic_natural.geojson`: scenic areas from natural polygons
- `lakes_reservoirs.geojson`: water bodies (approx: `fclass` in `water`,`reservoir`)

Notes:
- OSM `fclass` values vary by layer. Use `fclass` for finer filtering.
- “Lakes” are approximated because this dataset uses `fclass=water` for most lakes.
- If you want a different classification, tell me the target list and I can adjust filters.
README
