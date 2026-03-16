## ADDED Requirements

### Requirement: Clip OSM data by bounding box

The tool SHALL accept a bounding box as four numbers (min_lon, min_lat, max_lon, max_lat) and SHALL clip all input geometries to that rectangle. The output SHALL contain only features that intersect the bbox (or their clipped geometry).

#### Scenario: Clip GPKG with bbox

- **WHEN** the user invokes the tool with an input GPKG path, an output path, and a bbox (e.g. `min_lon min_lat max_lon max_lat`)
- **THEN** the tool SHALL produce an output GPKG (or GeoJSON, if so specified) containing only data within the bbox, preserving layer structure for GPKG

#### Scenario: Clip GeoJSON with bbox

- **WHEN** the user invokes the tool with an input GeoJSON path, an output path, and a bbox
- **THEN** the tool SHALL produce an output GeoJSON containing only features that intersect the bbox

### Requirement: Clip OSM data by polygon

The tool SHALL accept a boundary defined by a GeoJSON file containing a Polygon or MultiPolygon and SHALL clip input data to that boundary. The tool SHALL use the first polygon (or the first ring of the first polygon in MultiPolygon) as the clipping region.

#### Scenario: Clip with GeoJSON polygon file

- **WHEN** the user invokes the tool with an input data path, an output path, and a path to a GeoJSON file with a Polygon or MultiPolygon
- **THEN** the tool SHALL clip the input to that polygon and write the result to the output path

### Requirement: CLI and environment variables

The tool SHALL provide a CLI with explicit arguments for input path, output path, and boundary (bbox or polygon file). The tool SHALL also support the same options via environment variables. Command-line arguments SHALL override environment variables when both are set. Naming SHALL be consistent with existing `dataHandleTool` scripts (e.g. `OSM_*` prefix where applicable).

#### Scenario: Boundary from command line overrides environment

- **WHEN** the user sets a bbox via environment variable and also passes a different bbox (or polygon file) on the command line
- **THEN** the tool SHALL use the command-line boundary

#### Scenario: Invocation with minimal required args

- **WHEN** the user provides only input path, output path, and boundary (bbox or polygon path) on the command line
- **THEN** the tool SHALL run and produce clipped output without requiring environment variables

### Requirement: Input and output format support

The tool SHALL accept input in GPKG or GeoJSON format and SHALL support output in GPKG or GeoJSON format. For GPKG input, the tool SHALL process all layers (or a documented subset) and write them to the output GPKG.

#### Scenario: GPKG in, GPKG out

- **WHEN** input is a GPKG file and output path has `.gpkg` extension (or output format is explicitly GPKG)
- **THEN** the tool SHALL clip each layer and write a single output GPKG

#### Scenario: GeoJSON in, GeoJSON out

- **WHEN** input is a GeoJSON file and output path has `.geojson` or `.json` extension (or output format is explicitly GeoJSON)
- **THEN** the tool SHALL clip the FeatureCollection and write a single output GeoJSON file

### Requirement: Pipeline compatibility with export_osm_geojson

The tool SHALL be usable as an upstream step before `export_osm_geojson.sh`: the output of the clip tool (GPKG or GeoJSON) SHALL be consumable by existing workflows. Output GPKG SHALL be valid for use as input to `export_osm_geojson.sh` (e.g. same layer naming expectations where applicable).

#### Scenario: Clip then export GeoJSON

- **WHEN** the user runs the clip tool to produce a GPKG, then runs `export_osm_geojson.sh` with that GPKG as input
- **THEN** the export script SHALL run without error and produce GeoJSON from the clipped data only
