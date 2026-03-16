let map;

const waitForEvent = (target, event, timeoutMs = 15000) =>
  new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
      target.off(event, onSuccess);
      target.off("error", onError);
      if (timer) {
        window.clearTimeout(timer);
      }
    };
    const onSuccess = () => {
      cleanup();
      resolve();
    };
    const onError = (err) => {
      cleanup();
      reject(new Error(err?.error?.message || err?.message || "MapLibre 渲染错误"));
    };
    timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(`等待事件超时: ${event}`));
    }, timeoutMs);
    target.on(event, onSuccess);
    target.on("error", onError);
  });

window.__initRenderer = async function initRenderer(style) {
  if (!map) {
    map = new maplibregl.Map({
      container: "map",
      style,
      center: [0, 0],
      zoom: 0,
      interactive: false,
      attributionControl: false,
      preserveDrawingBuffer: true
    });
    await waitForEvent(map, "load");
  } else {
    map.setStyle(style);
  }
  await waitForEvent(map, "idle");
};

window.__renderTile = async function renderTile(center, zoom) {
  if (!map) {
    throw new Error("renderer not initialized");
  }
  map.jumpTo({ center, zoom });
  await waitForEvent(map, "idle");
};
