"use client";

import { useState } from "react";
import RoutePath from "./RoutePath";
import StopMarker from "./StopMarker";
import UserMarker from "./UserMarker";
import StopDetail from "./StopDetail";
import SimulationControls from "./SimulationControls";
import useSimulation from "@/hooks/useSimulation";
import useUserLocation from "@/hooks/useUserLocation";
import { mapGpsToMapXY } from "@/lib/mapGpsToMapXY";

/**
 * Главный компонент карты маршрута.
 * Статичная картинка + SVG overlay с маркерами, линией, пользователем.
 */
export default function RouteMap({ route }) {
  const { mapImage, mapDimensions, routePath, stops, calibration } = route;
  const { width, height } = mapDimensions;

  const [activeStopIndex, setActiveStopIndex] = useState(0);
  const [selectedStop, setSelectedStop] = useState(null);
  const [useGps, setUseGps] = useState(false);

  // GPS-трекинг
  const { position: gpsPosition, accuracy, status: gpsStatus, startTracking, stopTracking } =
    useUserLocation();

  // Симуляция
  const simulation = useSimulation(routePath);

  // Определяем позицию пользователя (GPS или симуляция)
  let userPixel = null;

  if (useGps && gpsPosition && calibration) {
    userPixel = mapGpsToMapXY(gpsPosition, calibration);
  } else if (!useGps && simulation.simulatedPixel) {
    userPixel = simulation.simulatedPixel;
  }

  // Определяем состояние каждой остановки
  const getStopState = (index) => {
    if (index < activeStopIndex) return "passed";
    if (index === activeStopIndex) return "active";
    return "upcoming";
  };

  const handleStopClick = (stop) => {
    setSelectedStop(stop);
  };

  const handleToggleGps = () => {
    if (!useGps) {
      startTracking();
      simulation.pause();
      setUseGps(true);
    } else {
      stopTracking();
      setUseGps(false);
    }
  };

  // Навигация между остановками
  const goPrevStop = () => {
    setActiveStopIndex((i) => Math.max(0, i - 1));
  };

  const goNextStop = () => {
    setActiveStopIndex((i) => Math.min(stops.length - 1, i + 1));
  };

  return (
    <div className="space-y-4">
      {/* Карта */}
      <div className="relative w-full overflow-hidden rounded-2xl border border-[var(--border-color)] shadow-sm" style={{ maxHeight: "280px" }}>
        {/* Картинка карты */}
        <img
          src={mapImage}
          alt="Карта маршрута"
          className="block w-full h-full object-cover"
          draggable={false}
        />

        {/* SVG overlay */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Линия маршрута */}
          <RoutePath
            routePath={routePath}
            activeStopIndex={activeStopIndex}
            stops={stops}
          />

          {/* Маркеры остановок */}
          {stops.map((stop, i) => (
            <StopMarker
              key={stop.id}
              stop={stop}
              index={i}
              state={getStopState(i)}
              onClick={handleStopClick}
            />
          ))}

          {/* Маркер пользователя */}
          <UserMarker position={userPixel} accuracy={accuracy || 30} />
        </svg>
      </div>

      {/* Навигация по остановкам */}
      <div className="flex items-center justify-between rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 shadow-sm transition-colors">
        <button
          onClick={goPrevStop}
          disabled={activeStopIndex === 0}
          className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] disabled:opacity-30"
        >
          &larr; Назад
        </button>

        <div className="text-center">
          <p className="text-xs text-[var(--text-muted)]">
            Остановка {activeStopIndex + 1} из {stops.length}
          </p>
          <p className="font-semibold text-[var(--text-primary)]">
            {stops[activeStopIndex]?.title}
          </p>
        </div>

        <button
          onClick={goNextStop}
          disabled={activeStopIndex === stops.length - 1}
          className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] disabled:opacity-30"
        >
          Далее &rarr;
        </button>
      </div>

      {/* Переключатель GPS / Симуляция */}
      <div className="flex gap-2">
        <button
          onClick={handleToggleGps}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition ${
            useGps
              ? "bg-blue-600 text-white"
              : "border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
          }`}
        >
          {useGps ? (
            <>
              GPS: {gpsStatus === "watching" ? "Отслеживается" : gpsStatus}
            </>
          ) : (
            "Включить GPS"
          )}
        </button>

        {!useGps && (
          <button
            onClick={() => simulation.isRunning ? simulation.pause() : simulation.start()}
            className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)]"
          >
            {simulation.isRunning ? "Пауза симуляции" : "Запустить симуляцию"}
          </button>
        )}
      </div>

      {/* Управление симуляцией (если не GPS) */}
      {!useGps && (
        <SimulationControls
          isRunning={simulation.isRunning}
          progress={simulation.progress}
          speed={simulation.speed}
          onStart={simulation.start}
          onPause={simulation.pause}
          onReset={simulation.reset}
          onSpeedChange={simulation.setSpeed}
        />
      )}

      {/* Детали выбранной остановки */}
      {selectedStop && (
        <StopDetail
          stop={selectedStop}
          onClose={() => setSelectedStop(null)}
        />
      )}
    </div>
  );
}
