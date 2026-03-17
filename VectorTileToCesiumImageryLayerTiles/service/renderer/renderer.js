let map;
let currentTileSize = 256;

const MAPLIBRE_TILE_SIZE = 512;

function waitForEvent(target, event, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
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
}

function waitForFrames(frameCount = 2) {
  return new Promise((resolve) => {
    const tick = (remaining) => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      window.requestAnimationFrame(() => tick(remaining - 1));
    };
    tick(frameCount);
  });
}

function setMapSize(tileSize) {
  const mapElement = document.getElementById("map");
  mapElement.style.width = `${tileSize}px`;
  mapElement.style.height = `${tileSize}px`;
}

function tileXToLng(x, z) {
  return (x / (2 ** z)) * 360 - 180;
}

function tileYToLat(y, z) {
  const mercatorY = Math.PI * (1 - (2 * y) / (2 ** z));
  return (Math.atan(Math.sinh(mercatorY)) * 180) / Math.PI;
}

function xyzToCenter(z, x, y) {
  const west = tileXToLng(x, z);
  const east = tileXToLng(x + 1, z);
  const north = tileYToLat(y, z);
  const south = tileYToLat(y + 1, z);

  return [(west + east) / 2, (north + south) / 2];
}

function xyzToMapLibreZoom(z, tileSize) {
  return z + Math.log2(tileSize / MAPLIBRE_TILE_SIZE);
}

window.__initRenderer = async function initRenderer({ style, tileSize }) {
  currentTileSize = tileSize;
  setMapSize(tileSize);

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

  map.resize();
  await waitForEvent(map, "idle");
  await waitForFrames(2);
};

window.__renderTile = async function renderTile({ z, x, y, tileSize }) {
  if (!map) {
    throw new Error("renderer not initialized");
  }

  if (tileSize !== currentTileSize) {
    currentTileSize = tileSize;
    setMapSize(tileSize);
    map.resize();
  }

  map.jumpTo({
    center: xyzToCenter(z, x, y),
    zoom: xyzToMapLibreZoom(z, tileSize)
  });

  await waitForEvent(map, "idle");
  await waitForFrames(2);
};
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
