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

/**
 * Расстояние от точки до отрезка (двух GPS-точек) в метрах.
 * Проецирует точку на отрезок и возвращает кратчайшее расстояние.
 * @param {{ lat: number, lng: number }} point
 * @param {{ lat: number, lng: number }} lineStart
 * @param {{ lat: number, lng: number }} lineEnd
 * @returns {number} расстояние в метрах
 */
export function pointToSegmentDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.lng - lineStart.lng;
  const dy = lineEnd.lat - lineStart.lat;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return haversineDistance(point, lineStart);

  let t = ((point.lng - lineStart.lng) * dx + (point.lat - lineStart.lat) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const closest = {
    lat: lineStart.lat + t * dy,
    lng: lineStart.lng + t * dx,
  };

  return haversineDistance(point, closest);
}

/**
 * Находит ближайший сегмент к указанной позиции.
 * @param {{ lat: number, lng: number }} position — позиция пользователя
 * @param {{ lat: number, lng: number }[]} path — точки пути маршрута
 * @param {Object[]} segments — массив сегментов с pathIndex
 * @param {number} [maxDistance=50] — макс. расстояние в метрах
 * @returns {Object|null} ближайший сегмент или null
 */
export function findNearestSegment(position, path, segments, maxDistance = 50) {
  if (!segments?.length || !path?.length) return null;

  let best = null;
  let bestDist = Infinity;

  for (const seg of segments) {
    const i = seg.pathIndex;
    if (i < 0 || i >= path.length - 1) continue;

    const dist = pointToSegmentDistance(position, path[i], path[i + 1]);
    if (dist < bestDist && dist <= maxDistance) {
      bestDist = dist;
      best = seg;
    }
  }

  return best;
}

/**
 * Интерполяция позиции вдоль пути по progress (0→1).
 * @param {{ lat: number, lng: number }[]} path
 * @param {number} progress — от 0 до 1
 * @returns {{ lat: number, lng: number }}
 */
export function interpolateAlongPath(path, progress) {
  if (!path || path.length === 0) return { lat: 0, lng: 0 };
  if (path.length === 1 || progress <= 0) return { lat: path[0].lat, lng: path[0].lng };
  if (progress >= 1) return { lat: path[path.length - 1].lat, lng: path[path.length - 1].lng };

  const total = totalPathDistance(path);
  if (total === 0) return { lat: path[0].lat, lng: path[0].lng };

  const targetDist = progress * total;
  let accumulated = 0;

  for (let i = 1; i < path.length; i++) {
    const segDist = haversineDistance(path[i - 1], path[i]);
    if (accumulated + segDist >= targetDist) {
      const t = segDist > 0 ? (targetDist - accumulated) / segDist : 0;
      return {
        lat: path[i - 1].lat + t * (path[i].lat - path[i - 1].lat),
        lng: path[i - 1].lng + t * (path[i].lng - path[i - 1].lng),
      };
    }
    accumulated += segDist;
  }

  return { lat: path[path.length - 1].lat, lng: path[path.length - 1].lng };
}

/**
 * Вычисляет кумулятивные расстояния для каждого узла пути.
 * cumDist[0] = 0, cumDist[i] = расстояние от path[0] до path[i].
 * @param {{ lat: number, lng: number }[]} path
 * @returns {number[]}
 */
export function cumulativeDistances(path) {
  const cum = [0];
  for (let i = 1; i < path.length; i++) {
    cum.push(cum[i - 1] + haversineDistance(path[i - 1], path[i]));
  }
  return cum;
}

/**
 * Конвертирует sortKey события в progress (0-1) вдоль пути.
 * sortKey = pathIndex + fraction (0-1 в пределах ребра).
 * @param {number} sortKey
 * @param {number[]} cumDist — кумулятивные расстояния
 * @returns {number} progress 0-1
 */
export function sortKeyToProgress(sortKey, cumDist) {
  const total = cumDist[cumDist.length - 1];
  if (total === 0) return 0;
  const idx = Math.floor(sortKey);
  const frac = sortKey - idx;
  const maxIdx = cumDist.length - 2; // последнее ребро
  const i = Math.min(idx, maxIdx);
  const edgeDist = (i < cumDist.length - 1) ? cumDist[i + 1] - cumDist[i] : 0;
  return Math.min(1, (cumDist[i] + frac * edgeDist) / total);
}

/**
 * Проецирует точку на ближайшую позицию на пути.
 * Возвращает { position, pathIndex, fraction, distance }.
 * @param {{ lat: number, lng: number }} point
 * @param {{ lat: number, lng: number }[]} path
 * @returns {{ position: { lat: number, lng: number }, pathIndex: number, fraction: number, distance: number } | null}
 */
export function projectPointOnPath(point, path) {
  if (!path || path.length < 2) return null;
  let bestIdx = 0;
  let bestFrac = 0;
  let bestDist = Infinity;
  let bestPos = null;

  for (let i = 0; i < path.length - 1; i++) {
    const dx = path[i + 1].lng - path[i].lng;
    const dy = path[i + 1].lat - path[i].lat;
    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq > 0) {
      t = ((point.lng - path[i].lng) * dx + (point.lat - path[i].lat) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }
    const closest = {
      lat: path[i].lat + t * dy,
      lng: path[i].lng + t * dx,
    };
    const dist = haversineDistance(point, closest);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
      bestFrac = t;
      bestPos = closest;
    }
  }
  return { position: bestPos, pathIndex: bestIdx, fraction: bestFrac, distance: bestDist };
}

/**
 * Доля проекции точки на отрезок (0 = начало, 1 = конец).
 */
function projectionFraction(point, lineStart, lineEnd) {
  const dx = lineEnd.lng - lineStart.lng;
  const dy = lineEnd.lat - lineStart.lat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return 0;
  const t = ((point.lng - lineStart.lng) * dx + (point.lat - lineStart.lat) * dy) / lenSq;
  return Math.max(0, Math.min(1, t));
}

/**
 * Собирает упорядоченный список событий маршрута вдоль пути.
 *
 * Порядок определяется позицией на пути:
 * - Сегмент → в самом начале ребра (sortKey = pathIndex + 0.01)
 * - Чекпоинт → по доле проекции на ближайшее ребро (sortKey = pathIndex + fraction)
 *   Если чекпоинт в самом начале ребра (fraction < 0.02), ставим 0.02
 *   чтобы сегмент того же ребра шёл раньше.
 *
 * Итог: сегмент (начал идти → слушаешь) → чекпоинт (дошёл до точки) → следующий сегмент.
 */
export function buildRouteEvents(path, checkpoints = [], segments = [], finish = null) {
  const events = [];

  // Сегменты → sortKey = pathIndex + 0.01 (начало ребра)
  for (const seg of segments) {
    if (seg.pathIndex < 0 || seg.pathIndex >= path.length - 1) continue;
    if (!seg.title && !seg.text && !seg.audio?.length) continue;
    events.push({ type: "segment", data: seg, sortKey: seg.pathIndex + 0.01 });
  }

  // Чекпоинты → sortKey = bestIdx + fraction (реальная позиция на ребре)
  for (const cp of checkpoints) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < path.length - 1; i++) {
      const d = pointToSegmentDistance(cp.position, path[i], path[i + 1]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    let frac = projectionFraction(cp.position, path[bestIdx], path[bestIdx + 1]);
    // Если чекпоинт почти в начале ребра — сдвигаем чуть вперёд,
    // чтобы сегмент этого ребра шёл раньше
    if (frac < 0.02) frac = 0.02;
    events.push({ type: "checkpoint", data: cp, sortKey: bestIdx + frac });
  }

  // Финиш → в конце
  if (finish?.position) {
    events.push({ type: "finish", data: finish, sortKey: path.length });
  }

  events.sort((a, b) => a.sortKey - b.sortKey);
  return events;
}

/**
 * Разбивает путь на сегменты по позициям чекпоинтов.
 * Возвращает массив подпутей (каждый — массив {lat, lng}).
 * Чередующиеся цвета отображают разбиение.
 * @param {{ lat: number, lng: number }[]} path
 * @param {Object[]} checkpoints — с полем position
 * @returns {{ lat: number, lng: number }[][] }
 */
/**
 * Возвращает path/checkpoints/segments для main или ветки.
 * @param {Object} route
 * @param {string|null} branchId — null = main
 * @returns {{ path: Array, checkpoints: Array, segments: Array }}
 */
export function getPathContext(route, branchId) {
  if (!branchId) {
    return {
      path: route.path || [],
      checkpoints: route.checkpoints || [],
      segments: route.segments || [],
    };
  }
  const branch = (route.branches || []).find((b) => b.id === branchId);
  if (!branch) return { path: [], checkpoints: [], segments: [] };
  return {
    path: branch.path || [],
    checkpoints: branch.checkpoints || [],
    segments: branch.segments || [],
  };
}

/**
 * Возвращает path родителя ветки (main или другая ветка).
 * @param {Object} route
 * @param {Object} branch
 * @returns {Array} path родителя
 */
export function getParentPath(route, branch) {
  if (!branch.parentId) return route.path || [];
  const parent = (route.branches || []).find((b) => b.id === branch.parentId);
  return parent ? parent.path || [] : route.path || [];
}

/**
 * GPS-позиция на ребре пути по pathIndex и fraction.
 * @param {Array} path
 * @param {number} pathIndex
 * @param {number} fraction — 0-1
 * @returns {{ lat: number, lng: number }}
 */
export function forkPositionOnPath(path, pathIndex, fraction) {
  const i = Math.min(pathIndex, path.length - 2);
  if (i < 0 || path.length < 2) return path[0] || { lat: 0, lng: 0 };
  return {
    lat: path[i].lat + fraction * (path[i + 1].lat - path[i].lat),
    lng: path[i].lng + fraction * (path[i + 1].lng - path[i].lng),
  };
}

/**
 * Собирает события маршрута с учётом веток.
 * @param {Object} route
 * @returns {{ mainEvents: Array, branchEvents: Object<string, Array> }}
 */
export function buildRouteEventsWithBranches(route) {
  const mainEvents = buildRouteEvents(
    route.path || [],
    route.checkpoints || [],
    route.segments || [],
    route.finish
  );

  // Вставляем fork-события в main
  const branches = route.branches || [];
  for (const branch of branches) {
    if (!branch.fork || branch.parentId) continue; // только ветки от main
    const forkSortKey = branch.fork.pathIndex + branch.fork.fraction;
    mainEvents.push({
      type: "fork",
      data: branch,
      sortKey: forkSortKey,
    });
  }
  mainEvents.sort((a, b) => a.sortKey - b.sortKey);

  // События для каждой ветки
  const branchEvents = {};
  for (const branch of branches) {
    const bEvents = buildRouteEvents(
      branch.path || [],
      branch.checkpoints || [],
      branch.segments || [],
      null
    );
    // Добавляем merge-событие в конец ветки если есть
    if (branch.merge) {
      bEvents.push({
        type: "merge",
        data: branch,
        sortKey: (branch.path || []).length,
      });
    }
    branchEvents[branch.id] = bEvents;
  }

  return { mainEvents, branchEvents };
}

export function splitPathByCheckpoints(path, checkpoints) {
  if (!path || path.length < 2 || !checkpoints?.length) return [path];

  // Только isDivider чекпоинты разбивают путь
  const dividers = checkpoints.filter((cp) => cp.isDivider);
  if (dividers.length === 0) return [path];

  // Проецируем разделители на путь и сортируем по позиции
  const splits = dividers
    .map((cp) => projectPointOnPath(cp.position, path))
    .filter(Boolean)
    .sort((a, b) => a.pathIndex - b.pathIndex || a.fraction - b.fraction);

  if (splits.length === 0) return [path];

  const segments = [];
  let currentSegment = [{ lat: path[0].lat, lng: path[0].lng }];
  let splitIdx = 0;

  for (let i = 0; i < path.length - 1; i++) {
    // Добавляем точки разбиения на этом ребре
    while (splitIdx < splits.length && splits[splitIdx].pathIndex === i) {
      const sp = splits[splitIdx];
      currentSegment.push({ lat: sp.position.lat, lng: sp.position.lng });
      segments.push(currentSegment);
      currentSegment = [{ lat: sp.position.lat, lng: sp.position.lng }];
      splitIdx++;
    }
    currentSegment.push({ lat: path[i + 1].lat, lng: path[i + 1].lng });
  }

  // Добавляем оставшиеся split-точки (если pathIndex === last edge)
  if (currentSegment.length > 0) segments.push(currentSegment);

  return segments;
}
