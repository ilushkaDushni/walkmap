/**
 * Нормализация coverImage из старого формата (строка) в новый (объект).
 * - null / "" / undefined → null
 * - string (старый формат URL) → { url, posX: 50, posY: 50, zoom: 1 }
 * - object → возвращает как есть
 */
export function normalizeCoverImage(val) {
  if (!val) return null;
  if (typeof val === "string") {
    return { url: val, posX: 50, posY: 50, zoom: 1 };
  }
  return val;
}

/**
 * CSS props для отображения обложки с позицией и зумом.
 * Возвращает объект стилей для <img>.
 */
export function coverImageStyle(cover) {
  if (!cover) return {};
  const { posX = 50, posY = 50, zoom = 1 } = cover;
  return {
    objectPosition: `${posX}% ${posY}%`,
    transform: `scale(${zoom})`,
  };
}
