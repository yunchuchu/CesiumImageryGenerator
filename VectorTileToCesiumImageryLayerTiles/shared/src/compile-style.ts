import {
  LAYER_CATALOG,
  SOURCE_CATALOG,
  type LayerCatalogItem,
  type LayerGroupId,
  type LayerKind,
  type SourceId
} from "./layer-catalog.js";

export interface StyleLayerConfig {
  id: string;
  visible?: boolean;
  color?: string;
  opacity?: number;
  lineWidth?: number;
  circleRadius?: number;
  zIndex?: number;
}

export interface StyleGroupConfig {
  id: LayerGroupId;
  label?: string;
  visible?: boolean;
  layers: StyleLayerConfig[];
}

export interface StyleConfig {
  tileServerUrl: string;
  backgroundColor?: string;
  groups: StyleGroupConfig[];
}

export interface MapLibreSource {
  type: "vector";
  tiles: string[];
}

export interface MapLibreLayer {
  id: string;
  type: LayerKind | "background";
  source?: string;
  "source-layer"?: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
}

export interface MapLibreStyle {
  version: 8;
  sources: Record<string, MapLibreSource>;
  layers: MapLibreLayer[];
}

interface ResolvedLayer {
  order: number;
  layer: MapLibreLayer;
}

const layerIndex = new Map<string, { order: number; catalog: LayerCatalogItem }>();
LAYER_CATALOG.forEach((layer, index) => {
  layerIndex.set(layer.id, { order: index, catalog: layer });
});

function resolvePaint(type: LayerKind, config: StyleLayerConfig, defaults: Record<string, unknown>) {
  const paint: Record<string, unknown> = { ...defaults };

  if (config.color) {
    if (type === "fill") paint["fill-color"] = config.color;
    if (type === "line") paint["line-color"] = config.color;
    if (type === "circle") paint["circle-color"] = config.color;
  }

  if (config.opacity !== undefined) {
    if (type === "fill") paint["fill-opacity"] = config.opacity;
    if (type === "line") paint["line-opacity"] = config.opacity;
    if (type === "circle") paint["circle-opacity"] = config.opacity;
  }

  if (config.lineWidth !== undefined && type === "line") {
    paint["line-width"] = config.lineWidth;
  }

  if (config.circleRadius !== undefined && type === "circle") {
    paint["circle-radius"] = config.circleRadius;
  }

  return paint;
}

function buildSources(tileServerUrl: string): Record<string, MapLibreSource> {
  const sources: Record<string, MapLibreSource> = {};
  for (const sourceId of Object.keys(SOURCE_CATALOG) as SourceId[]) {
    const source = SOURCE_CATALOG[sourceId];
    sources[source.id] = {
      type: "vector",
      tiles: [`${tileServerUrl}/${source.tileset}/{z}/{x}/{y}`]
    };
  }
  return sources;
}

export function compileStyle(config: StyleConfig): MapLibreStyle {
  const layers: MapLibreLayer[] = [];
  const tileServerUrl = config.tileServerUrl.replace(/\/+$/, "");

  if (config.backgroundColor) {
    layers.push({
      id: "background",
      type: "background",
      paint: { "background-color": config.backgroundColor },
      layout: {}
    });
  }

  const resolvedLayers: ResolvedLayer[] = [];
  for (const group of config.groups) {
    const groupVisible = group.visible !== false;
    for (const layerConfig of group.layers) {
      const entry = layerIndex.get(layerConfig.id);
      if (!entry) continue;
      const { order, catalog } = entry;
      const layerVisible = layerConfig.visible !== false && groupVisible;
      const paint = resolvePaint(catalog.type, layerConfig, catalog.defaultPaint);
      resolvedLayers.push({
        order: layerConfig.zIndex ?? order,
        layer: {
          id: catalog.id,
          type: catalog.type,
          source: catalog.source,
          "source-layer": catalog.sourceLayer,
          paint,
          layout: { visibility: layerVisible ? "visible" : "none" }
        }
      });
    }
  }

  resolvedLayers.sort((a, b) => a.order - b.order).forEach((item) => layers.push(item.layer));

  return {
    version: 8,
    sources: buildSources(tileServerUrl),
    layers
  };
}
