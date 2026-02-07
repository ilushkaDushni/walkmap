"use client";

/**
 * SVG-полилиния маршрута с отображением прогресса.
 *
 * @param {{ routePath: Array<{x,y}>, activeStopIndex: number, stops: Array }} props
 */
export default function RoutePath({ routePath, activeStopIndex = 0, stops }) {
  if (!routePath || routePath.length < 2) return null;

  const fullPoints = routePath.map((p) => `${p.x},${p.y}`).join(" ");

  // Вычисляем пройденную часть: до позиции активной остановки на маршруте
  const activeStop = stops?.[activeStopIndex];
  let passedPoints = fullPoints;

  if (activeStop) {
    // Находим ближайшую точку routePath к активной остановке
    let closestIdx = 0;
    let closestDist = Infinity;

    routePath.forEach((p, i) => {
      const dx = p.x - activeStop.position.x;
      const dy = p.y - activeStop.position.y;
      const dist = dx * dx + dy * dy;
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    });

    const passedPath = routePath.slice(0, closestIdx + 1);
    passedPoints = passedPath.map((p) => `${p.x},${p.y}`).join(" ");
  }

  return (
    <g>
      {/* Полный маршрут — серая линия */}
      <polyline
        points={fullPoints}
        fill="none"
        stroke="#d1d5db"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Пройденная часть — зелёная линия */}
      <polyline
        points={passedPoints}
        fill="none"
        stroke="#22c55e"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Анимированная пунктирная линия направления */}
      <polyline
        points={fullPoints}
        fill="none"
        stroke="#16a34a"
        strokeWidth="2"
        strokeDasharray="8 12"
        strokeLinecap="round"
        opacity="0.5"
        className="animate-dash"
      />
    </g>
  );
}
