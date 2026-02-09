/**
 * SVG мини-карта маршрута для карточки (без MapLibre).
 * Рисует polyline + кружки чекпоинтов.
 */
export default function RouteCardMiniMap({ path = [], checkpoints = [] }) {
  if (!path.length) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--text-muted)]">
        <span className="text-xs">Нет маршрута</span>
      </div>
    );
  }

  // Вычисляем bounds
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const p of path) {
    const lng = p.lng ?? p[0];
    const lat = p.lat ?? p[1];
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const padding = 16;
  const svgW = 320;
  const svgH = 192;
  const innerW = svgW - padding * 2;
  const innerH = svgH - padding * 2;

  const rangeLng = maxLng - minLng || 0.001;
  const rangeLat = maxLat - minLat || 0.001;
  const scale = Math.min(innerW / rangeLng, innerH / rangeLat);

  const toSvg = (lng, lat) => {
    const x = padding + (lng - minLng) * scale + (innerW - rangeLng * scale) / 2;
    // Y инвертирован: больше lat → меньше y
    const y = padding + (maxLat - lat) * scale + (innerH - rangeLat * scale) / 2;
    return [x, y];
  };

  const pathPoints = path
    .map((p) => {
      const lng = p.lng ?? p[0];
      const lat = p.lat ?? p[1];
      return toSvg(lng, lat).join(",");
    })
    .join(" ");

  const cpCircles = checkpoints
    .filter((cp) => cp.lat != null && cp.lng != null)
    .map((cp) => {
      const [cx, cy] = toSvg(cp.lng, cp.lat);
      return { cx, cy, color: cp.color || "#22c55e", isEmpty: cp.isEmpty };
    });

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="minimap-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--bg-elevated)" />
          <stop offset="100%" stopColor="var(--bg-surface)" />
        </linearGradient>
      </defs>
      <rect width={svgW} height={svgH} fill="url(#minimap-bg)" />
      <polyline
        points={pathPoints}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
      {cpCircles.map((c, i) => (
        <circle
          key={i}
          cx={c.cx}
          cy={c.cy}
          r="5"
          fill={c.isEmpty ? "none" : c.color}
          stroke={c.color}
          strokeWidth={c.isEmpty ? "1.5" : "2"}
          strokeDasharray={c.isEmpty ? "2 2" : "none"}
        />
      ))}
    </svg>
  );
}
