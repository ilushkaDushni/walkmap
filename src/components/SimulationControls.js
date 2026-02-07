"use client";

import { PlayCircle } from "lucide-react";

/**
 * Панель управления режимом симуляции движения по маршруту.
 */
export default function SimulationControls({
  isRunning,
  progress,
  speed,
  onStart,
  onPause,
  onReset,
  onSpeedChange,
}) {
  const progressPercent = Math.round(progress * 100);

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-lg transition-colors">
      <div className="mb-3 flex items-center gap-2">
        <PlayCircle className="h-5 w-5 text-blue-500" />
        <span className="text-sm font-semibold text-[var(--text-primary)]">Симуляция</span>
      </div>

      {/* Прогресс-бар */}
      <div className="mb-3">
        <div className="mb-1 flex justify-between text-xs text-[var(--text-muted)]">
          <span>Прогресс</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Кнопки управления */}
      <div className="mb-3 flex gap-2">
        {!isRunning ? (
          <button
            onClick={onStart}
            className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-green-700"
          >
            {progress > 0 && progress < 1 ? "Продолжить" : "Старт"}
          </button>
        ) : (
          <button
            onClick={onPause}
            className="flex-1 rounded-lg bg-yellow-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-yellow-600"
          >
            Пауза
          </button>
        )}
        <button
          onClick={onReset}
          className="rounded-lg border border-[var(--border-color)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)]"
        >
          Сброс
        </button>
      </div>

      {/* Выбор скорости */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--text-muted)]">Скорость:</span>
        {[0.5, 1, 2, 4].map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`rounded px-2 py-1 text-xs font-medium transition ${
              speed === s
                ? "bg-blue-600 text-white"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
