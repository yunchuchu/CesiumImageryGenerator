CREATE OR REPLACE VIEW vt.road_motorway AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  ref,
  'road'::text AS feature_class,
  fclass::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  5 AS minzoom_suggest,
  bridge,
  tunnel,
  oneway,
  layer,
  maxspeed,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.roads
WHERE fclass IN ('motorway', 'motorway_link');

CREATE OR REPLACE VIEW vt.road_trunk AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  ref,
  'road'::text AS feature_class,
  fclass::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  6 AS minzoom_suggest,
  bridge,
  tunnel,
  oneway,
  layer,
  maxspeed,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.roads
WHERE fclass IN ('trunk', 'trunk_link');

CREATE OR REPLACE VIEW vt.road_primary AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  ref,
  'road'::text AS feature_class,
  fclass::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  7 AS minzoom_suggest,
  bridge,
  tunnel,
  oneway,
  layer,
  maxspeed,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.roads
WHERE fclass IN ('primary', 'primary_link');

CREATE OR REPLACE VIEW vt.road_secondary AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  ref,
  'road'::text AS feature_class,
  fclass::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  9 AS minzoom_suggest,
  bridge,
  tunnel,
  oneway,
  layer,
  maxspeed,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.roads
WHERE fclass IN ('secondary', 'secondary_link');

CREATE OR REPLACE VIEW vt.road_tertiary AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  ref,
  'road'::text AS feature_class,
  fclass::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  11 AS minzoom_suggest,
  bridge,
  tunnel,
  oneway,
  layer,
  maxspeed,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.roads
WHERE fclass IN ('tertiary', 'tertiary_link');

CREATE OR REPLACE VIEW vt.road_minor AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  ref,
  'road'::text AS feature_class,
  fclass::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  12 AS minzoom_suggest,
  bridge,
  tunnel,
  oneway,
  layer,
  maxspeed,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.roads
WHERE fclass IN ('residential', 'living_street', 'unclassified');

CREATE OR REPLACE VIEW vt.road_path AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  ref,
  'road'::text AS feature_class,
  fclass::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  13 AS minzoom_suggest,
  bridge,
  tunnel,
  oneway,
  layer,
  maxspeed,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.roads
WHERE fclass IN ('service', 'track', 'path', 'footway', 'cycleway', 'steps');

CREATE OR REPLACE VIEW vt.railway_line AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'railway'::text AS feature_class,
  fclass::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  9 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.railways;

CREATE OR REPLACE VIEW vt.water_polygon AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'water'::text AS feature_class,
  fclass::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  6 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.water_area;

CREATE OR REPLACE VIEW vt.lake_reservoir AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'water'::text AS feature_class,
  fclass::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  7 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.lakes_reservoirs;

CREATE OR REPLACE VIEW vt.wetland AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'water'::text AS feature_class,
  fclass::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  9 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.wetlands;

CREATE OR REPLACE VIEW vt.waterway_line AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'waterway'::text AS feature_class,
  fclass::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  8 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.waterways;

CREATE OR REPLACE VIEW vt.waterway_river AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'waterway'::text AS feature_class,
  'river'::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  8 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.rivers;

CREATE OR REPLACE VIEW vt.waterway_canal AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'waterway'::text AS feature_class,
  'canal'::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  8 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.canals;

CREATE OR REPLACE VIEW vt.waterway_stream AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'waterway'::text AS feature_class,
  'stream'::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  11 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.streams;

CREATE OR REPLACE VIEW vt.waterway_drain AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'waterway'::text AS feature_class,
  'drain'::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  11 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.drains;

CREATE OR REPLACE VIEW vt.landuse AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'landuse'::text AS feature_class,
  fclass::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  8 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.landuse;

CREATE OR REPLACE VIEW vt.natural_area AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'natural'::text AS feature_class,
  fclass::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  9 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.natural_area;

CREATE OR REPLACE VIEW vt.park AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'landuse'::text AS feature_class,
  'park'::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  9 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.parks_landuse
UNION ALL
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'landuse'::text AS feature_class,
  'park'::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  9 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.parks_pois_area;

CREATE OR REPLACE VIEW vt.forest AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'landuse'::text AS feature_class,
  'forest'::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  8 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.forests;

CREATE OR REPLACE VIEW vt.scenic_area AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'landuse'::text AS feature_class,
  'scenic'::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  10 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.scenic_landuse
UNION ALL
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'landuse'::text AS feature_class,
  'scenic'::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  10 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.scenic_pois_area
UNION ALL
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'landuse'::text AS feature_class,
  'scenic'::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  10 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.scenic_natural;

CREATE OR REPLACE VIEW vt.building AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'building'::text AS feature_class,
  COALESCE(type, fclass)::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  13 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.buildings;

CREATE OR REPLACE VIEW vt.poi_point AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'poi'::text AS feature_class,
  fclass::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  12 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.poi_point;

CREATE OR REPLACE VIEW vt.poi_area AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'poi'::text AS feature_class,
  fclass::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  11 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.poi_area;

CREATE OR REPLACE VIEW vt.transport_point AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'transport'::text AS feature_class,
  fclass::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  12 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.transport_point;

CREATE OR REPLACE VIEW vt.transport_area AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'transport'::text AS feature_class,
  fclass::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  11 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.transport_area;

CREATE OR REPLACE VIEW vt.traffic_point AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'traffic'::text AS feature_class,
  fclass::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  12 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.traffic_point;

CREATE OR REPLACE VIEW vt.traffic_area AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'traffic'::text AS feature_class,
  fclass::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  11 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.traffic_area;

CREATE OR REPLACE VIEW vt.pofw_point AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'pofw'::text AS feature_class,
  fclass::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  12 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.pofw_point;

CREATE OR REPLACE VIEW vt.pofw_area AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'pofw'::text AS feature_class,
  fclass::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  11 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.pofw_area;

CREATE OR REPLACE VIEW vt.place_point AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'place'::text AS feature_class,
  fclass::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  6 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.place_point;

CREATE OR REPLACE VIEW vt.place_area AS
SELECT
  osm_id,
  name,
  NULL::text AS name_zh,
  NULL::text AS ref,
  'place'::text AS feature_class,
  fclass::text AS feature_subclass,
  element,
  element_zh,
  source_layer,
  9 AS minzoom_suggest,
  ST_Transform(geom, 3857) AS geom
FROM osm_raw.place_area;
