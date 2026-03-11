CREATE OR REPLACE FUNCTION vt.base_transport(z integer, x integer, y integer)
RETURNS bytea AS $$
WITH
  bounds AS (SELECT ST_TileEnvelope(z, x, y) AS geom),
  road_motorway AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           bridge, tunnel, oneway, layer, maxspeed,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.road_motorway AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  road_trunk AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           bridge, tunnel, oneway, layer, maxspeed,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.road_trunk AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  road_primary AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           bridge, tunnel, oneway, layer, maxspeed,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.road_primary AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  road_secondary AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           bridge, tunnel, oneway, layer, maxspeed,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.road_secondary AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  road_tertiary AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           bridge, tunnel, oneway, layer, maxspeed,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.road_tertiary AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  road_minor AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           bridge, tunnel, oneway, layer, maxspeed,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.road_minor AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  road_path AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           bridge, tunnel, oneway, layer, maxspeed,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.road_path AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  railway_line AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.railway_line AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  )
SELECT
  COALESCE((SELECT ST_AsMVT(road_motorway, 'road_motorway', 4096, 'geom') FROM road_motorway), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(road_trunk, 'road_trunk', 4096, 'geom') FROM road_trunk), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(road_primary, 'road_primary', 4096, 'geom') FROM road_primary), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(road_secondary, 'road_secondary', 4096, 'geom') FROM road_secondary), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(road_tertiary, 'road_tertiary', 4096, 'geom') FROM road_tertiary), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(road_minor, 'road_minor', 4096, 'geom') FROM road_minor), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(road_path, 'road_path', 4096, 'geom') FROM road_path), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(railway_line, 'railway_line', 4096, 'geom') FROM railway_line), ''::bytea);
$$ LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE;

CREATE OR REPLACE FUNCTION vt.base_hydro(z integer, x integer, y integer)
RETURNS bytea AS $$
WITH
  bounds AS (SELECT ST_TileEnvelope(z, x, y) AS geom),
  water_polygon AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.water_polygon AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  lake_reservoir AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.lake_reservoir AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  wetland AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.wetland AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  waterway_line AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.waterway_line AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  waterway_river AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.waterway_river AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  waterway_canal AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.waterway_canal AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  waterway_stream AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.waterway_stream AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  waterway_drain AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.waterway_drain AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  )
SELECT
  COALESCE((SELECT ST_AsMVT(water_polygon, 'water_polygon', 4096, 'geom') FROM water_polygon), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(lake_reservoir, 'lake_reservoir', 4096, 'geom') FROM lake_reservoir), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(wetland, 'wetland', 4096, 'geom') FROM wetland), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(waterway_line, 'waterway_line', 4096, 'geom') FROM waterway_line), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(waterway_river, 'waterway_river', 4096, 'geom') FROM waterway_river), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(waterway_canal, 'waterway_canal', 4096, 'geom') FROM waterway_canal), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(waterway_stream, 'waterway_stream', 4096, 'geom') FROM waterway_stream), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(waterway_drain, 'waterway_drain', 4096, 'geom') FROM waterway_drain), ''::bytea);
$$ LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE;

CREATE OR REPLACE FUNCTION vt.base_landcover(z integer, x integer, y integer)
RETURNS bytea AS $$
WITH
  bounds AS (SELECT ST_TileEnvelope(z, x, y) AS geom),
  landuse AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.landuse AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  natural_area AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.natural_area AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  park AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.park AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  forest AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.forest AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  scenic_area AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.scenic_area AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  )
SELECT
  COALESCE((SELECT ST_AsMVT(landuse, 'landuse', 4096, 'geom') FROM landuse), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(natural_area, 'natural_area', 4096, 'geom') FROM natural_area), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(park, 'park', 4096, 'geom') FROM park), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(forest, 'forest', 4096, 'geom') FROM forest), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(scenic_area, 'scenic_area', 4096, 'geom') FROM scenic_area), ''::bytea);
$$ LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE;

CREATE OR REPLACE FUNCTION vt.base_building(z integer, x integer, y integer)
RETURNS bytea AS $$
WITH
  bounds AS (SELECT ST_TileEnvelope(z, x, y) AS geom),
  building AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.building AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  )
SELECT COALESCE((SELECT ST_AsMVT(building, 'building', 4096, 'geom') FROM building), ''::bytea);
$$ LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE;

CREATE OR REPLACE FUNCTION vt.base_poi(z integer, x integer, y integer)
RETURNS bytea AS $$
WITH
  bounds AS (SELECT ST_TileEnvelope(z, x, y) AS geom),
  poi_point AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.poi_point AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  poi_area AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.poi_area AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  transport_point AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.transport_point AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  transport_area AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.transport_area AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  traffic_point AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.traffic_point AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  traffic_area AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.traffic_area AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  pofw_point AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.pofw_point AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  pofw_area AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.pofw_area AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  place_point AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.place_point AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  ),
  place_area AS (
    SELECT osm_id, name, name_zh, ref, feature_class, feature_subclass, source_layer, minzoom_suggest,
           ST_AsMVTGeom(src.geom, bounds.geom, 4096, 256, true) AS geom
    FROM vt.place_area AS src, bounds
    WHERE src.geom && bounds.geom AND z >= minzoom_suggest
  )
SELECT
  COALESCE((SELECT ST_AsMVT(poi_point, 'poi_point', 4096, 'geom') FROM poi_point), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(poi_area, 'poi_area', 4096, 'geom') FROM poi_area), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(transport_point, 'transport_point', 4096, 'geom') FROM transport_point), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(transport_area, 'transport_area', 4096, 'geom') FROM transport_area), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(traffic_point, 'traffic_point', 4096, 'geom') FROM traffic_point), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(traffic_area, 'traffic_area', 4096, 'geom') FROM traffic_area), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(pofw_point, 'pofw_point', 4096, 'geom') FROM pofw_point), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(pofw_area, 'pofw_area', 4096, 'geom') FROM pofw_area), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(place_point, 'place_point', 4096, 'geom') FROM place_point), ''::bytea)
  || COALESCE((SELECT ST_AsMVT(place_area, 'place_area', 4096, 'geom') FROM place_area), ''::bytea);
$$ LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE;
