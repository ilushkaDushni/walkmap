"use client";

/**
 * SVG-маркер текущей позиции пользователя.
 * Синяя точка с полупрозрачным кругом точности.
 *
 * @param {{ position: { x: number, y: number } | null, accuracy: number }} props
 */
export default function UserMarker({ position, accuracy = 30 }) {
  if (!position) return null;

  // Масштаб точности: примерный радиус в пикселях карты
  const accuracyRadius = Math.min(Math.max(accuracy / 2, 10), 60);

  return (
    <g>
      {/* Круг точности */}
      <circle
        cx={position.x}
        cy={position.y}
        r={accuracyRadius}
        fill="rgba(59, 130, 246, 0.15)"
        stroke="rgba(59, 130, 246, 0.3)"
        strokeWidth="1"
      />

      {/* Внешний контур */}
      <circle
        cx={position.x}
        cy={position.y}
        r={10}
        fill="white"
        stroke="rgba(59, 130, 246, 0.5)"
        strokeWidth="2"
      />

      {/* Основная точка */}
      <circle
        cx={position.x}
        cy={position.y}
        r={7}
        fill="#3b82f6"
      />
    </g>
  );
}
