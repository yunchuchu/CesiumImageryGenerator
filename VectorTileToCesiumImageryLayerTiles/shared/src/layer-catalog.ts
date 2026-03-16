export type LayerGroupId = "transport" | "hydro" | "landcover" | "building" | "poi";
export type LayerKind = "fill" | "line" | "circle";

export type SourceId = LayerGroupId;

export interface SourceCatalogItem {
  id: SourceId;
  label: string;
  tileset: string;
}

export interface LayerCatalogItem {
  id: string;
  label: string;
  group: LayerGroupId;
  type: LayerKind;
  source: SourceId;
  sourceLayer: string;
  defaultPaint: Record<string, unknown>;
}

export const SOURCE_CATALOG: Record<SourceId, SourceCatalogItem> = {
  transport: { id: "transport", label: "Transport", tileset: "base_transport" },
  hydro: { id: "hydro", label: "Hydro", tileset: "base_hydro" },
  landcover: { id: "landcover", label: "Landcover", tileset: "base_landcover" },
  building: { id: "building", label: "Building", tileset: "base_building" },
  poi: { id: "poi", label: "POI & Place", tileset: "base_poi" }
};

export const LAYER_CATALOG: LayerCatalogItem[] = [
  {
    id: "landuse",
    label: "Landuse",
    group: "landcover",
    type: "fill",
    source: "landcover",
    sourceLayer: "landuse",
    defaultPaint: { "fill-color": "#dfe8d8", "fill-opacity": 0.7 }
  },
  {
    id: "natural-area",
    label: "Natural Area",
    group: "landcover",
    type: "fill",
    source: "landcover",
    sourceLayer: "natural_area",
    defaultPaint: { "fill-color": "#cbe6d1", "fill-opacity": 0.6 }
  },
  {
    id: "park",
    label: "Park",
    group: "landcover",
    type: "fill",
    source: "landcover",
    sourceLayer: "park",
    defaultPaint: { "fill-color": "#b9e1a1", "fill-opacity": 0.7 }
  },
  {
    id: "forest",
    label: "Forest",
    group: "landcover",
    type: "fill",
    source: "landcover",
    sourceLayer: "forest",
    defaultPaint: { "fill-color": "#9ed18b", "fill-opacity": 0.7 }
  },
  {
    id: "scenic",
    label: "Scenic Area",
    group: "landcover",
    type: "fill",
    source: "landcover",
    sourceLayer: "scenic_area",
    defaultPaint: { "fill-color": "#f2d095", "fill-opacity": 0.6 }
  },
  {
    id: "water",
    label: "Water",
    group: "hydro",
    type: "fill",
    source: "hydro",
    sourceLayer: "water_polygon",
    defaultPaint: { "fill-color": "#8fc5ea", "fill-opacity": 0.8 }
  },
  {
    id: "water-lines",
    label: "Water Lines",
    group: "hydro",
    type: "line",
    source: "hydro",
    sourceLayer: "waterway_line",
    defaultPaint: { "line-color": "#5ea9dd", "line-width": 1 }
  },
  {
    id: "railway",
    label: "Railway",
    group: "transport",
    type: "line",
    source: "transport",
    sourceLayer: "railway_line",
    defaultPaint: { "line-color": "#444", "line-width": 1, "line-dasharray": [2, 2] }
  },
  {
    id: "road-motorway",
    label: "Motorway",
    group: "transport",
    type: "line",
    source: "transport",
    sourceLayer: "road_motorway",
    defaultPaint: { "line-color": "#f15a4a", "line-width": 2.5 }
  },
  {
    id: "road-trunk",
    label: "Trunk",
    group: "transport",
    type: "line",
    source: "transport",
    sourceLayer: "road_trunk",
    defaultPaint: { "line-color": "#f7864a", "line-width": 2 }
  },
  {
    id: "road-primary",
    label: "Primary",
    group: "transport",
    type: "line",
    source: "transport",
    sourceLayer: "road_primary",
    defaultPaint: { "line-color": "#f2b35c", "line-width": 1.6 }
  },
  {
    id: "road-secondary",
    label: "Secondary",
    group: "transport",
    type: "line",
    source: "transport",
    sourceLayer: "road_secondary",
    defaultPaint: { "line-color": "#f7d48a", "line-width": 1.2 }
  },
  {
    id: "road-tertiary",
    label: "Tertiary",
    group: "transport",
    type: "line",
    source: "transport",
    sourceLayer: "road_tertiary",
    defaultPaint: { "line-color": "#f9e2b5", "line-width": 1 }
  },
  {
    id: "building",
    label: "Building",
    group: "building",
    type: "fill",
    source: "building",
    sourceLayer: "building",
    defaultPaint: { "fill-color": "#c8b2a6", "fill-opacity": 0.75 }
  },
  {
    id: "poi",
    label: "POI",
    group: "poi",
    type: "circle",
    source: "poi",
    sourceLayer: "poi_point",
    defaultPaint: { "circle-color": "#1d4ed8", "circle-radius": 3, "circle-opacity": 0.8 }
  },
  {
    id: "place",
    label: "Place",
    group: "poi",
    type: "circle",
    source: "poi",
    sourceLayer: "place_point",
    defaultPaint: { "circle-color": "#111827", "circle-radius": 4, "circle-opacity": 0.7 }
  }
];

export const GROUP_ORDER: LayerGroupId[] = ["landcover", "hydro", "transport", "building", "poi"];
