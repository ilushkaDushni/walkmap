"use client";

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { interpolateAlongPath, buildRouteEvents, buildRouteEventsWithBranches, cumulativeDistances, sortKeyToProgress, computeForkDirection } from "@/lib/geo";
import { MapPin, Play, Pause, RotateCcw, ChevronRight, ChevronLeft } from "lucide-react";
import AudioPlayer from "@/components/AudioPlayer";

const SPEED_OPTIONS = [0.5, 1, 2, 4];

export default function SimulationPanel({ route, simulatedPosition, onPositionChange }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);

  // Упорядоченные события маршрута (с ветками)
  const events = useMemo(() => {
    if (!route.path || route.path.length < 2) return [];
    if (route.branches?.length) {
      return buildRouteEventsWithBranches(route).mainEvents;
    }
    return buildRouteEvents(
      route.path,
      route.checkpoints || [],
      route.segments || [],
      route.finish
    );
  }, [route]);

  // Кумулятивные расстояния и пороги событий
  const cumDist = useMemo(() => {
    if (!route.path || route.path.length < 2) return [0];
    return cumulativeDistances(route.path);
  }, [route.path]);

  const eventThresholds = useMemo(() => {
    return events.map((ev) => sortKeyToProgress(ev.sortKey, cumDist));
  }, [events, cumDist]);

  // Текущее событие по progress
  const currentEventIndex = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < eventThresholds.length; i++) {
      if (progress >= eventThresholds[i]) idx = i;
    }
    return idx;
  }, [progress, eventThresholds]);

  const currentEvent = currentEventIndex >= 0 ? events[currentEventIndex] : null;

  // Авто-прохождение: анимация
  const animate = useCallback(
    (timestamp) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      setProgress((prev) => {
        const next = Math.min(1, prev + dt * (1 / 60) * speed);
        const pos = interpolateAlongPath(route.path, next);
        onPositionChange?.(pos);
        if (next >= 1) {
          setIsPlaying(false);
          return 1;
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(animate);
    },
    [route.path, speed, onPositionChange]
  );

  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = null;
      rafRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, animate]);

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleReset = () => {
    setIsPlaying(false);
    setProgress(0);
    if (route.path.length > 0) {
      onPositionChange?.(interpolateAlongPath(route.path, 0));
    }
  };

  const handleProgressChange = (e) => {
    const val = parseFloat(e.target.value);
    setProgress(val);
    const pos = interpolateAlongPath(route.path, val);
    onPositionChange?.(pos);
  };

  // Переход к следующему/предыдущему событию
  const jumpToEvent = (idx) => {
    if (idx < 0 || idx >= events.length) return;
    const p = eventThresholds[idx];
    setProgress(p);
    const pos = interpolateAlongPath(route.path, p);
    onPositionChange?.(pos);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-blue-500/30 bg-[var(--bg-surface)] p-4 space-y-3">
        <h3 className="text-sm font-bold text-blue-600">Симуляция</h3>

        {/* Контролы */}
        {route.path.length >= 2 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {isPlaying ? (
                <button
                  onClick={handlePause}
                  className="rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700 transition"
                  title="Пауза"
                >
                  <Pause className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handlePlay}
                  disabled={progress >= 1}
                  className="rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700 transition disabled:opacity-50"
                  title="Старт"
                >
                  <Play className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={handleReset}
                className="rounded-lg bg-[var(--bg-elevated)] p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
                title="Сбросить"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              {/* Выбор скорости */}
              <div className="flex items-center gap-1 ml-auto">
                {SPEED_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={`rounded-lg px-2 py-1 text-xs font-medium transition ${
                      speed === s
                        ? "bg-blue-600 text-white"
                        : "bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* Прогресс-бар */}
            <input
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={progress}
              onChange={handleProgressChange}
              className="w-full h-1.5 rounded-full appearance-none bg-[var(--bg-elevated)] accent-blue-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
              <span>{Math.round(progress * 100)}%</span>
              {events.length > 0 && (
                <span>Событие {currentEventIndex + 1} / {events.length}</span>
              )}
            </div>
          </div>
        )}

        {!simulatedPosition && route.path.length < 2 && (
          <div className="text-center py-2">
            <MapPin className="mx-auto mb-2 h-6 w-6 text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-muted)]">
              Нажмите на карту, чтобы поставить точку пользователя
            </p>
          </div>
        )}

        {/* Текущее событие */}
        {currentEvent && (
          <div
            key={currentEventIndex}
            className="rounded-xl bg-[var(--bg-elevated)] p-3 space-y-2 animate-[fadeIn_0.3s_ease]"
          >
            {/* Сегмент */}
            {currentEvent.type === "segment" && (
              <>
                <p className="text-xs font-medium text-orange-500">
                  Отрезок #{currentEvent.data.pathIndex + 1}
                </p>
                {currentEvent.data.title && (
                  <p className="font-semibold text-[var(--text-primary)]">
                    {currentEvent.data.title}
                  </p>
                )}
                {currentEvent.data.text && (
                  <div className="max-h-[40vh] overflow-y-auto scrollbar-thin text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                    {currentEvent.data.text}
                  </div>
                )}
                {currentEvent.data.photos?.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {currentEvent.data.photos.map((url, i) => (
                      <img key={i} src={url} alt="" className="h-20 w-20 rounded-lg object-cover shrink-0" />
                    ))}
                  </div>
                )}
                {currentEvent.data.audio?.length > 0 && (
                  <AudioPlayer
                    key={`sim-seg-${currentEventIndex}`}
                    urls={currentEvent.data.audio}
                    autoPlay={isPlaying}
                    variant="full"
                  />
                )}
              </>
            )}

            {/* Чекпоинт */}
            {currentEvent.type === "checkpoint" && (
              currentEvent.data.isEmpty ? (
                <p className="text-xs font-medium text-[var(--text-muted)]">
                  Раздел #{currentEvent.data.order + 1}
                </p>
              ) : (
                <>
                  <p className="text-xs font-medium" style={{ color: currentEvent.data.color || "#f59e0b" }}>
                    Точка #{currentEvent.data.order + 1}
                  </p>
                  {currentEvent.data.title && (
                    <p className="font-semibold text-[var(--text-primary)]">{currentEvent.data.title}</p>
                  )}
                  {currentEvent.data.description && (
                    <div className="max-h-[30vh] overflow-y-auto scrollbar-thin text-xs text-[var(--text-muted)] whitespace-pre-wrap">
                      {currentEvent.data.description}
                    </div>
                  )}
                  {currentEvent.data.photos?.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto">
                      {currentEvent.data.photos.map((url, i) => (
                        <img key={i} src={url} alt="" className="h-16 w-16 rounded-lg object-cover shrink-0" />
                      ))}
                    </div>
                  )}
                  {currentEvent.data.audio?.length > 0 && (
                    <AudioPlayer
                      key={`sim-cp-${currentEventIndex}`}
                      urls={currentEvent.data.audio}
                      autoPlay={isPlaying}
                      variant="full"
                    />
                  )}
                  {currentEvent.data.coinsReward > 0 && (
                    <p className="text-xs font-medium text-amber-600">
                      +{currentEvent.data.coinsReward} монет
                    </p>
                  )}
                </>
              )
            )}

            {/* Финиш */}
            {currentEvent.type === "finish" && (
              <div className="text-center py-2">
                <p className="font-bold text-green-600">Финиш!</p>
                {currentEvent.data.coinsReward > 0 && (
                  <p className="text-sm text-green-600">+{currentEvent.data.coinsReward} монет</p>
                )}
              </div>
            )}

            {/* Fork */}
            {currentEvent.type === "fork" && (() => {
              const { mainDir, branchDir } = computeForkDirection(route.path, currentEvent.data);
              const dirLabel = { left: "← Налево", right: "→ Направо", straight: "↑ Прямо" };
              return (
                <div className="space-y-1">
                  <p className="text-xs font-medium" style={{ color: currentEvent.data.color || "#10b981" }}>
                    Развилка
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Main: {dirLabel[mainDir]} · {currentEvent.data.name || "Ветка"}: {dirLabel[branchDir]}
                  </p>
                </div>
              );
            })()}
          </div>
        )}

        {/* Навигация по событиям */}
        {events.length > 0 && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => jumpToEvent(currentEventIndex - 1)}
              disabled={currentEventIndex <= 0}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] transition hover:bg-[var(--bg-elevated)] disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-[10px] text-[var(--text-muted)]">
              {currentEventIndex >= 0 ? currentEventIndex + 1 : 0} / {events.length}
            </span>
            <button
              onClick={() => jumpToEvent(currentEventIndex + 1)}
              disabled={currentEventIndex >= events.length - 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
