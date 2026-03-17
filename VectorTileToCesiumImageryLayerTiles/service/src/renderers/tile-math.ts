const MAPLIBRE_TILE_SIZE = 512;

export function xyzToCenter(z: number, x: number, y: number): [number, number] {
  const west = tileXToLng(x, z);
  const east = tileXToLng(x + 1, z);
  const north = tileYToLat(y, z);
  const south = tileYToLat(y + 1, z);

  return [(west + east) / 2, (north + south) / 2];
}

export function xyzToMapLibreZoom(z: number, tileSize: number): number {
  return z + Math.log2(tileSize / MAPLIBRE_TILE_SIZE);
}

function tileXToLng(x: number, z: number): number {
  return (x / (2 ** z)) * 360 - 180;
}

function tileYToLat(y: number, z: number): number {
  const mercatorY = Math.PI * (1 - (2 * y) / (2 ** z));
  return (Math.atan(Math.sinh(mercatorY)) * 180) / Math.PI;
}
