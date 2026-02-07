"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Хук для симуляции движения по routePath.
 * Интерполирует позицию между точками маршрута.
 *
 * @param {Array<{ x: number, y: number }>} routePath — массив точек маршрута в пикселях
 * @returns {{
 *   simulatedPixel: { x: number, y: number } | null,
 *   progress: number,  // 0..1
 *   isRunning: boolean,
 *   start: () => void,
 *   pause: () => void,
 *   reset: () => void,
 *   speed: number,
 *   setSpeed: (s: number) => void,
 * }}
 */
export default function useSimulation(routePath) {
  const [progress, setProgress] = useState(0); // 0..1
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1); // множитель скорости
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);

  // Вычисляем общую длину пути
  const totalLength = (() => {
    if (!routePath || routePath.length < 2) return 0;
    let len = 0;
    for (let i = 1; i < routePath.length; i++) {
      const dx = routePath[i].x - routePath[i - 1].x;
      const dy = routePath[i].y - routePath[i - 1].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
  })();

  // Интерполяция позиции по прогрессу (0..1)
  const getPositionAtProgress = useCallback(
    (p) => {
      if (!routePath || routePath.length === 0) return null;
      if (routePath.length === 1) return { ...routePath[0] };

      const clampedP = Math.max(0, Math.min(1, p));
      const targetDist = clampedP * totalLength;

      let accumulated = 0;
      for (let i = 1; i < routePath.length; i++) {
        const dx = routePath[i].x - routePath[i - 1].x;
        const dy = routePath[i].y - routePath[i - 1].y;
        const segLen = Math.sqrt(dx * dx + dy * dy);

        if (accumulated + segLen >= targetDist) {
          const t = segLen > 0 ? (targetDist - accumulated) / segLen : 0;
          return {
            x: routePath[i - 1].x + dx * t,
            y: routePath[i - 1].y + dy * t,
          };
        }
        accumulated += segLen;
      }

      return { ...routePath[routePath.length - 1] };
    },
    [routePath, totalLength]
  );

  // Анимационный цикл
  useEffect(() => {
    if (!isRunning) {
      lastTimeRef.current = null;
      return;
    }

    const animate = (timestamp) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }

      const dt = (timestamp - lastTimeRef.current) / 1000; // секунды
      lastTimeRef.current = timestamp;

      // Базовая скорость: пройти весь маршрут за 30 секунд при speed=1
      const baseSpeed = 1 / 30;

      setProgress((prev) => {
        const next = prev + dt * baseSpeed * speed;
        if (next >= 1) {
          setIsRunning(false);
          return 1;
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isRunning, speed]);

  const start = useCallback(() => {
    if (progress >= 1) setProgress(0);
    setIsRunning(true);
  }, [progress]);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setIsRunning(false);
    setProgress(0);
  }, []);

  const simulatedPixel = getPositionAtProgress(progress);

  return {
    simulatedPixel,
    progress,
    isRunning,
    start,
    pause,
    reset,
    speed,
    setSpeed,
  };
}
