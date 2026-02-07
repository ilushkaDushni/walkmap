/**
 * Маппинг GPS-координат → пиксели картинки карты
 * через аффинное преобразование по 3 калибровочным точкам.
 *
 * Каждая калибровочная точка: { gps: { lat, lng }, pixel: { x, y } }
 *
 * Аффинное преобразование:
 *   px = a * lng + b * lat + c
 *   py = d * lng + e * lat + f
 *
 * 3 точки дают систему из 6 уравнений → 6 неизвестных (a,b,c,d,e,f)
 */

/**
 * Вычисляет коэффициенты аффинного преобразования
 * @param {Array} calibration — 3 калибровочные точки
 * @returns {{ a, b, c, d, e, f }} коэффициенты
 */
export function computeAffineTransform(calibration) {
  if (!calibration || calibration.length < 3) {
    return null;
  }

  const [p0, p1, p2] = calibration;

  // Матрица: [lng, lat, 1] для каждой точки
  const lng0 = p0.gps.lng, lat0 = p0.gps.lat;
  const lng1 = p1.gps.lng, lat1 = p1.gps.lat;
  const lng2 = p2.gps.lng, lat2 = p2.gps.lat;

  // Определитель матрицы 3x3
  const det =
    lng0 * (lat1 - lat2) -
    lat0 * (lng1 - lng2) +
    (lng1 * lat2 - lng2 * lat1);

  if (Math.abs(det) < 1e-12) {
    // Точки коллинеарны — преобразование невозможно
    return null;
  }

  const invDet = 1 / det;

  // Обратная матрица * вектор целевых координат → коэффициенты
  // Для px (пиксель X):
  const px0 = p0.pixel.x, px1 = p1.pixel.x, px2 = p2.pixel.x;
  const a =
    (px0 * (lat1 - lat2) + px1 * (lat2 - lat0) + px2 * (lat0 - lat1)) *
    invDet;
  const b =
    (px0 * (lng2 - lng1) + px1 * (lng0 - lng2) + px2 * (lng1 - lng0)) *
    invDet;
  const c =
    (px0 * (lng1 * lat2 - lng2 * lat1) +
      px1 * (lng2 * lat0 - lng0 * lat2) +
      px2 * (lng0 * lat1 - lng1 * lat0)) *
    invDet;

  // Для py (пиксель Y):
  const py0 = p0.pixel.y, py1 = p1.pixel.y, py2 = p2.pixel.y;
  const d =
    (py0 * (lat1 - lat2) + py1 * (lat2 - lat0) + py2 * (lat0 - lat1)) *
    invDet;
  const e =
    (py0 * (lng2 - lng1) + py1 * (lng0 - lng2) + py2 * (lng1 - lng0)) *
    invDet;
  const f =
    (py0 * (lng1 * lat2 - lng2 * lat1) +
      py1 * (lng2 * lat0 - lng0 * lat2) +
      py2 * (lng0 * lat1 - lng1 * lat0)) *
    invDet;

  return { a, b, c, d, e, f };
}

/**
 * Преобразует GPS-координаты в пиксели картинки
 * @param {{ lat: number, lng: number }} gps
 * @param {Array} calibration — 3 калибровочные точки
 * @returns {{ x: number, y: number } | null}
 */
export function mapGpsToMapXY(gps, calibration) {
  const transform = computeAffineTransform(calibration);
  if (!transform) return null;

  const { a, b, c, d, e, f } = transform;
  return {
    x: a * gps.lng + b * gps.lat + c,
    y: d * gps.lng + e * gps.lat + f,
  };
}
