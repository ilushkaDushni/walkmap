const R = 6371000; // радиус Земли в метрах

/**
 * Расстояние между двумя GPS-точками (формула Haversine).
 * @param {{ lat: number, lng: number }} p1
 * @param {{ lat: number, lng: number }} p2
 * @returns {number} расстояние в метрах
 */
export function haversineDistance(p1, p2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(p2.lat - p1.lat);
  const dLng = toRad(p2.lng - p1.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Суммарная длина пути по массиву GPS-точек.
 * @param {{ lat: number, lng: number }[]} path
 * @returns {number} длина в метрах
 */
export function totalPathDistance(path) {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += haversineDistance(path[i - 1], path[i]);
  }
  return total;
}
