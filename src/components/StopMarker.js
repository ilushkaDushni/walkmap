"use client";

/**
 * SVG-маркер остановки.
 * Разные стили: пройденная (зелёный), активная (оранжевый + пульсация), предстоящая (серый).
 *
 * @param {{ stop: object, index: number, state: 'passed'|'active'|'upcoming', onClick: function }} props
 */
export default function StopMarker({ stop, index, state = "upcoming", onClick }) {
  const colors = {
    passed: { fill: "#22c55e", stroke: "#15803d", text: "#fff" },
    active: { fill: "#f97316", stroke: "#c2410c", text: "#fff" },
    upcoming: { fill: "#d1d5db", stroke: "#9ca3af", text: "#4b5563" },
  };

  const c = colors[state];
  const r = 18;

  return (
    <g
      className={`cursor-pointer ${state === "active" ? "animate-pulse-stop" : ""}`}
      onClick={() => onClick?.(stop)}
      role="button"
      tabIndex={0}
    >
      {/* Кольцо пульсации для активной остановки */}
      {state === "active" && (
        <circle
          cx={stop.position.x}
          cy={stop.position.y}
          r={r + 10}
          fill="none"
          stroke={c.fill}
          strokeWidth="2"
          opacity="0.4"
          className="animate-ping-slow"
        />
      )}

      {/* Основной круг */}
      <circle
        cx={stop.position.x}
        cy={stop.position.y}
        r={r}
        fill={c.fill}
        stroke={c.stroke}
        strokeWidth="2.5"
      />

      {/* Номер остановки */}
      <text
        x={stop.position.x}
        y={stop.position.y}
        textAnchor="middle"
        dominantBaseline="central"
        fill={c.text}
        fontSize="14"
        fontWeight="bold"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {index + 1}
      </text>
    </g>
  );
}
