<template>
  <div class="app">
    <header class="topbar">
      <div>
        <p class="eyebrow">Vector Tile Atelier</p>
        <h1>样式配置与预览</h1>
      </div>
      <div class="topbar-actions">
        <button class="button ghost" @click="resetToDefault">重置为默认</button>
        <button class="button" @click="exportConfig">导出 JSON</button>
      </div>
    </header>

    <aside class="sidebar">
      <section class="panel">
        <h2>服务连接</h2>
        <label class="field">
          <span>Tile Server</span>
          <input v-model="config.tileServerUrl" type="text" placeholder="http://localhost:3000" />
        </label>
        <label class="field">
          <span>背景色</span>
          <input v-model="config.backgroundColor" type="color" />
        </label>
      </section>

      <section class="panel">
        <h2>样式文件</h2>
        <div class="file-actions">
          <label class="button ghost">
            导入 JSON
            <input ref="fileInput" type="file" accept="application/json" @change="importConfig" />
          </label>
          <button class="button subtle" @click="exportConfig">导出 JSON</button>
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <p class="hint">导入后会立即刷新预览，未校验字段的会被忽略。</p>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>图层分组</h2>
          <span class="tag">{{ totalLayers }} layers</span>
        </div>

        <div v-for="group in config.groups" :key="group.id" class="group">
          <div class="group-title">
            <label class="toggle">
              <input v-model="group.visible" type="checkbox" />
              <span>{{ groupLabel(group) }}</span>
            </label>
          </div>
          <div class="group-body">
            <div v-for="layer in group.layers" :key="layer.id" class="layer">
              <div class="layer-head">
                <label class="toggle">
                  <input v-model="layer.visible" type="checkbox" />
                  <span>{{ layerLabel(layer.id) }}</span>
                </label>
                <span class="meta">{{ layerType(layer.id) }}</span>
              </div>
              <div class="controls">
                <label class="mini">
                  颜色
                  <input v-model="layer.color" type="color" />
                </label>
                <label class="mini" v-if="supportsOpacity(layer.id)">
                  透明度
                  <input v-model.number="layer.opacity" type="range" min="0" max="1" step="0.05" />
                  <span>{{ formatNumber(layer.opacity, 2) }}</span>
                </label>
                <label class="mini" v-if="supportsLineWidth(layer.id)">
                  线宽
                  <input v-model.number="layer.lineWidth" type="range" min="0.5" max="6" step="0.1" />
                  <span>{{ formatNumber(layer.lineWidth, 1) }}</span>
                </label>
                <label class="mini" v-if="supportsCircleRadius(layer.id)">
                  点半径
                  <input v-model.number="layer.circleRadius" type="range" min="2" max="10" step="0.5" />
                  <span>{{ formatNumber(layer.circleRadius, 1) }}</span>
                </label>
                <label class="mini">
                  顺序
                  <input v-model.number="layer.zIndex" type="number" min="0" max="50" />
                </label>
              </div>
            </div>
          </div>
        </div>
      </section>
    </aside>

    <section class="map-panel">
      <div class="map-card">
        <div ref="mapEl" class="map"></div>
        <div class="map-overlay">
          <p>MapLibre 预览</p>
          <small>中心点：{{ center[0].toFixed(2) }}, {{ center[1].toFixed(2) }} · Zoom {{ zoom }}</small>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import maplibregl from "maplibre-gl";
import defaultStyleConfig from "@vttc/shared/default-style-config.json";
import { LAYER_CATALOG, compileStyle, type StyleConfig, type StyleGroupConfig } from "@vttc/shared";

const mapEl = ref<HTMLDivElement | null>(null);
const mapRef = ref<maplibregl.Map | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const error = ref<string | null>(null);

const center = ref<[number, number]>([120.4, 31.5]);
const zoom = ref(7);
let styleUpdateTimer: number | undefined;
let isApplyingStyle = false;
let pendingStyleConfig: StyleConfig | null = null;

const copyStyleConfig = (source: StyleConfig): StyleConfig =>
  JSON.parse(JSON.stringify(source)) as StyleConfig;

const defaultConfig = copyStyleConfig(defaultStyleConfig as StyleConfig);
const config = ref<StyleConfig>(copyStyleConfig(defaultConfig));

const layerMeta = new Map(LAYER_CATALOG.map((layer) => [layer.id, layer]));
const totalLayers = computed(() => config.value.groups.reduce((sum, group) => sum + group.layers.length, 0));

const groupLabel = (group: StyleGroupConfig) => group.label ?? group.id;
const layerLabel = (id: string) => layerMeta.get(id)?.label ?? id;
const layerType = (id: string) => layerMeta.get(id)?.type ?? "unknown";

const supportsOpacity = (id: string) => {
  const type = layerMeta.get(id)?.type;
  return type === "fill" || type === "line" || type === "circle";
};

const supportsLineWidth = (id: string) => layerMeta.get(id)?.type === "line";
const supportsCircleRadius = (id: string) => layerMeta.get(id)?.type === "circle";

const formatNumber = (value: number | undefined, fraction = 1) => {
  if (value === undefined || Number.isNaN(value)) return "-";
  return value.toFixed(fraction);
};

const flushStyleUpdate = () => {
  const map = mapRef.value;
  if (!map || !pendingStyleConfig || isApplyingStyle) return;
  isApplyingStyle = true;
  const style = JSON.parse(JSON.stringify(compileStyle(pendingStyleConfig))) as maplibregl.StyleSpecification;
  pendingStyleConfig = null;
  const release = () => {
    isApplyingStyle = false;
    if (pendingStyleConfig) {
      flushStyleUpdate();
    }
  };
  map.once("idle", release);
  map.once("error", release);
  map.setStyle(style);
};

const applyStyle = () => {
  pendingStyleConfig = config.value as StyleConfig;
  if (styleUpdateTimer !== undefined) {
    window.clearTimeout(styleUpdateTimer);
  }
  styleUpdateTimer = window.setTimeout(() => {
    styleUpdateTimer = undefined;
    flushStyleUpdate();
  }, 120);
};

const resetToDefault = () => {
  config.value = copyStyleConfig(defaultConfig);
};

const exportConfig = () => {
  const payload = JSON.stringify(config.value, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `style-config-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

const importConfig = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.groups)) {
      throw new Error("JSON 格式不符合预期：缺少 groups 数组。");
    }
    config.value = parsed as StyleConfig;
    error.value = null;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "导入失败";
  } finally {
    target.value = "";
  }
};

onMounted(() => {
  if (!mapEl.value) return;
  mapRef.value = new maplibregl.Map({
    container: mapEl.value,
    style: compileStyle(config.value) as unknown as maplibregl.StyleSpecification,
    center: center.value,
    zoom: zoom.value,
    attributionControl: true
  });

  mapRef.value.addControl(new maplibregl.NavigationControl({ showCompass: true }), "bottom-right");

  mapRef.value.on("moveend", () => {
    if (!mapRef.value) return;
    const centerValue = mapRef.value.getCenter();
    center.value = [centerValue.lng, centerValue.lat];
    zoom.value = Number(mapRef.value.getZoom().toFixed(2));
  });
});

watch(
  () => config.value,
  () => applyStyle(),
  { deep: true }
);
</script>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Fraunces:wght@500;700&family=Albert+Sans:wght@300;400;500;600&display=swap");

:global(body) {
  margin: 0;
  background: #f0ede7;
  color: #141414;
  font-family: "Albert Sans", "Helvetica Neue", sans-serif;
}

:global(*) {
  box-sizing: border-box;
}

.app {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(300px, 380px) 1fr;
  grid-template-rows: auto 1fr;
  gap: 18px;
  padding: 20px 24px 24px;
  background: radial-gradient(circle at 20% 20%, rgba(245, 228, 200, 0.7), transparent 55%),
    radial-gradient(circle at 80% 20%, rgba(189, 209, 221, 0.45), transparent 50%),
    linear-gradient(120deg, rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.35));
}

.topbar {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: 0 18px 40px rgba(17, 24, 39, 0.12);
  backdrop-filter: blur(14px);
}

.eyebrow {
  margin: 0 0 6px;
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.25em;
  color: #7a6e5a;
}

h1 {
  margin: 0;
  font-family: "Fraunces", serif;
  font-size: 28px;
}

.topbar-actions {
  display: flex;
  gap: 12px;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel {
  padding: 16px 18px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 16px 30px rgba(17, 24, 39, 0.08);
}

.panel h2 {
  margin: 0 0 12px;
  font-size: 16px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.tag {
  font-size: 11px;
  padding: 4px 8px;
  background: #111827;
  color: #fef3c7;
  border-radius: 999px;
}

.field {
  display: grid;
  gap: 6px;
  font-size: 12px;
  margin-bottom: 12px;
}

.field input[type="text"] {
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  padding: 8px 10px;
  font-size: 13px;
}

.file-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.hint {
  margin: 10px 0 0;
  font-size: 11px;
  color: #6b7280;
}

.error {
  margin: 8px 0 0;
  padding: 6px 8px;
  background: #fee2e2;
  color: #b91c1c;
  border-radius: 8px;
  font-size: 12px;
}

.group {
  padding: 10px 0;
  border-top: 1px dashed rgba(0, 0, 0, 0.08);
}

.group:first-of-type {
  border-top: none;
}

.group-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.group-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.layer {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.layer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.meta {
  font-size: 11px;
  color: #6b7280;
  text-transform: uppercase;
}

.controls {
  display: grid;
  gap: 8px;
}

.mini {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  font-size: 11px;
  color: #374151;
  align-items: center;
}

.mini input[type="range"] {
  width: 100%;
}

.mini input[type="number"] {
  width: 70px;
  padding: 4px 6px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.button {
  appearance: none;
  border: none;
  padding: 8px 14px;
  border-radius: 999px;
  background: #111827;
  color: white;
  font-size: 12px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
}

.button.ghost {
  background: transparent;
  color: #111827;
  border: 1px solid #111827;
}

.button.subtle {
  background: #f59e0b;
  color: #1f1300;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.toggle input {
  accent-color: #111827;
}

.map-panel {
  position: relative;
}

.map-card {
  height: calc(100vh - 120px);
  min-height: 520px;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.7);
}

.map {
  width: 100%;
  height: 100%;
}

.map-overlay {
  position: absolute;
  bottom: 18px;
  left: 18px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(17, 24, 39, 0.7);
  color: #fef3c7;
  font-size: 12px;
  box-shadow: 0 12px 22px rgba(0, 0, 0, 0.3);
}

.map-overlay small {
  display: block;
  margin-top: 4px;
  color: #fde68a;
}

input[type="file"] {
  display: none;
}

@media (max-width: 1100px) {
  .app {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto 1fr;
  }

  .map-card {
    height: 520px;
  }
}
</style>
