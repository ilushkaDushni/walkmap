"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useUser } from "@/components/UserProvider";
import LeafletMap from "./LeafletMap";
import RouteEditorToolbar from "./RouteEditorToolbar";
import CheckpointPanel from "./CheckpointPanel";
import SegmentPanel from "./SegmentPanel";
import RouteMediaSection from "./RouteMediaSection";
import SimulationPanel from "./SimulationPanel";
import { X } from "lucide-react";

const RouteMapLeaflet = dynamic(() => import("./RouteMapLeaflet"), { ssr: false });

const MODE_KEYS = { "1": "view", "2": "drawPath", "3": "addCheckpoint", "4": "addSegment", "5": "setFinish", "6": "simulate" };

function validateRoute(route) {
  const errors = [];
  if (!route.title?.trim()) errors.push("Не указано название маршрута");
  if ((route.path?.length || 0) < 2) errors.push("Путь содержит менее 2 точек");
  if ((route.checkpoints?.length || 0) === 0) errors.push("Нет ни одного чекпоинта");
  if (!route.finish?.position) errors.push("Не установлен финиш");
  return errors;
}

export default function RouteEditor({ routeId, onSaved }) {
  const { authFetch } = useUser();
  const [route, setRoute] = useState(null);
  const [mode, setMode] = useState("view");
  const [selectedCheckpointId, setSelectedCheckpointId] = useState(null);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState(null);
  const [simulatedPosition, setSimulatedPosition] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const historyRef = useRef([]);
  const handleSaveRef = useRef(null);

  // Загрузка маршрута
  useEffect(() => {
    (async () => {
      const res = await authFetch(`/api/routes/${routeId}`);
      if (res.ok) setRoute(await res.json());
    })();
  }, [routeId, authFetch]);

  // Предупреждение о несохранённых изменениях
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const updateRoute = useCallback((updater) => {
    setRoute((prev) => {
      historyRef.current = [...historyRef.current.slice(-49), JSON.parse(JSON.stringify(prev))];
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      return next;
    });
    setIsDirty(true);
  }, []);

  const handleUndo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current.pop();
    setRoute(prev);
    setIsDirty(true);
  }, []);

  // Сохранение
  const handleSave = useCallback(async () => {
    if (!route) return;
    setSaving(true);
    try {
      const { _id, ...body } = route;
      const res = await authFetch(`/api/routes/${routeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        setRoute(updated);
        setIsDirty(false);
        onSaved?.();
        setSaveMessage({ type: "success", text: "Сохранено" });
      } else {
        setSaveMessage({ type: "error", text: "Ошибка сохранения" });
      }
    } catch {
      setSaveMessage({ type: "error", text: "Ошибка сохранения" });
    }
    setSaving(false);
  }, [route, routeId, authFetch, onSaved]);

  // Keep ref updated for hotkeys
  handleSaveRef.current = handleSave;

  // Auto-hide save message
  useEffect(() => {
    if (!saveMessage) return;
    const t = setTimeout(() => setSaveMessage(null), 3000);
    return () => clearTimeout(t);
  }, [saveMessage]);

  // Горячие клавиши (объединённый listener)
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      // Ctrl+S — сохранить (работает даже в input)
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveRef.current?.();
        return;
      }

      // Ctrl+Z — undo (не в input/textarea)
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        if (isInput) return;
        e.preventDefault();
        handleUndo();
        return;
      }

      // Остальные шорткаты — не в input/textarea
      if (isInput) return;

      // Escape — снять выделение / переключить в view
      if (e.key === "Escape") {
        if (selectedCheckpointId || selectedSegmentIndex !== null) {
          setSelectedCheckpointId(null);
          setSelectedSegmentIndex(null);
        } else {
          setMode("view");
        }
        return;
      }

      // Delete/Backspace — удалить выделенный элемент
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedCheckpointId) {
          if (window.confirm("Удалить точку?")) {
            handleCheckpointDeleteRef.current?.(selectedCheckpointId);
          }
        } else if (selectedSegmentIndex !== null) {
          if (window.confirm("Удалить отрезок?")) {
            handleSegmentDeleteRef.current?.(selectedSegmentIndex);
          }
        }
        return;
      }

      // 1-6 — переключение режимов
      const modeId = MODE_KEYS[e.key];
      if (modeId) {
        setMode(modeId);
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo, selectedCheckpointId, selectedSegmentIndex]);

  // Клик по карте
  const handleMapClick = useCallback(
    (latlng, clickMode) => {
      if (clickMode === "drawPath") {
        updateRoute((prev) => ({
          ...prev,
          path: [...prev.path, { lat: latlng.lat, lng: latlng.lng, order: prev.path.length }],
        }));
      } else if (clickMode === "addCheckpoint") {
        const id = crypto.randomUUID();
        updateRoute((prev) => ({
          ...prev,
          checkpoints: [
            ...prev.checkpoints,
            {
              id,
              title: "",
              description: "",
              position: { lat: latlng.lat, lng: latlng.lng },
              triggerRadiusMeters: 20,
              coinsReward: 0,
              photos: [],
              audio: [],
              order: prev.checkpoints.length,
            },
          ],
        }));
        setSelectedCheckpointId(id);
      } else if (clickMode === "setFinish") {
        updateRoute((prev) => ({
          ...prev,
          finish: {
            position: { lat: latlng.lat, lng: latlng.lng },
            coinsReward: prev.finish?.coinsReward || 0,
          },
        }));
      } else if (clickMode === "simulate") {
        setSimulatedPosition({ lat: latlng.lat, lng: latlng.lng });
      }
    },
    [updateRoute]
  );

  // Вставка точки в середину пути
  const handlePathInsert = useCallback(
    (insertIndex, latlng) => {
      updateRoute((prev) => {
        const newPath = [...prev.path];
        newPath.splice(insertIndex, 0, { lat: latlng.lat, lng: latlng.lng, order: 0 });
        // Re-index orders
        const reindexed = newPath.map((p, i) => ({ ...p, order: i }));
        // Shift segment pathIndex
        const newSegments = (prev.segments || []).map((s) =>
          s.pathIndex >= insertIndex ? { ...s, pathIndex: s.pathIndex + 1 } : s
        );
        return { ...prev, path: reindexed, segments: newSegments };
      });
    },
    [updateRoute]
  );

  // Клик по отрезку линии (режим addSegment)
  const handleSegmentLineClick = useCallback(
    (pathIndex) => {
      const segments = route?.segments || [];
      const existing = segments.find((s) => s.pathIndex === pathIndex);
      if (existing) {
        setSelectedSegmentIndex(pathIndex);
      } else {
        const id = crypto.randomUUID();
        updateRoute((prev) => ({
          ...prev,
          segments: [
            ...(prev.segments || []),
            { id, pathIndex, title: "", text: "", photos: [], audio: [] },
          ],
        }));
        setSelectedSegmentIndex(pathIndex);
      }
    },
    [route, updateRoute]
  );

  // Перетаскивание точки пути
  const handlePathPointDrag = useCallback(
    (index, newPos) => {
      updateRoute((prev) => {
        const newPath = [...prev.path];
        newPath[index] = { ...newPath[index], lat: newPos.lat, lng: newPos.lng };
        return { ...prev, path: newPath };
      });
    },
    [updateRoute]
  );

  // Удаление точки пути (правый клик) — с фиксом segment indices
  const handlePathPointRightClick = useCallback(
    (index) => {
      updateRoute((prev) => {
        const newPath = prev.path.filter((_, i) => i !== index).map((p, i) => ({ ...p, order: i }));
        // Shift segment pathIndex: декремент для pathIndex >= index, удалить если == index
        const newSegments = (prev.segments || [])
          .filter((s) => s.pathIndex !== index)
          .map((s) => (s.pathIndex > index ? { ...s, pathIndex: s.pathIndex - 1 } : s));
        return { ...prev, path: newPath, segments: newSegments };
      });
    },
    [updateRoute]
  );

  // Клик по чекпоинту
  const handleCheckpointClick = useCallback((id) => {
    setSelectedCheckpointId(id);
  }, []);

  // Перетаскивание чекпоинта
  const handleCheckpointDrag = useCallback(
    (id, newPos) => {
      updateRoute((prev) => ({
        ...prev,
        checkpoints: prev.checkpoints.map((cp) =>
          cp.id === id ? { ...cp, position: newPos } : cp
        ),
      }));
    },
    [updateRoute]
  );

  // Перетаскивание финиша
  const handleFinishDrag = useCallback(
    (newPos) => {
      updateRoute((prev) => ({
        ...prev,
        finish: { ...prev.finish, position: newPos },
      }));
    },
    [updateRoute]
  );

  // Обновление чекпоинта
  const handleCheckpointUpdate = useCallback(
    (id, updates) => {
      updateRoute((prev) => ({
        ...prev,
        checkpoints: prev.checkpoints.map((cp) =>
          cp.id === id ? { ...cp, ...updates } : cp
        ),
      }));
    },
    [updateRoute]
  );

  // Удаление чекпоинта
  const handleCheckpointDelete = useCallback(
    (id) => {
      updateRoute((prev) => ({
        ...prev,
        checkpoints: prev.checkpoints
          .filter((cp) => cp.id !== id)
          .map((cp, i) => ({ ...cp, order: i })),
      }));
      setSelectedCheckpointId(null);
    },
    [updateRoute]
  );

  // Refs for hotkey access
  const handleCheckpointDeleteRef = useRef(handleCheckpointDelete);
  handleCheckpointDeleteRef.current = handleCheckpointDelete;
  const handleSegmentDeleteRef = useRef(null);

  // Обновление сегмента (по pathIndex)
  const handleSegmentUpdate = useCallback(
    (pathIndex, updates) => {
      updateRoute((prev) => ({
        ...prev,
        segments: (prev.segments || []).map((s) =>
          s.pathIndex === pathIndex ? { ...s, ...updates } : s
        ),
      }));
    },
    [updateRoute]
  );

  // Удаление сегмента (по pathIndex)
  const handleSegmentDelete = useCallback(
    (pathIndex) => {
      updateRoute((prev) => ({
        ...prev,
        segments: (prev.segments || []).filter((s) => s.pathIndex !== pathIndex),
      }));
      setSelectedSegmentIndex(null);
    },
    [updateRoute]
  );
  handleSegmentDeleteRef.current = handleSegmentDelete;

  // Переупорядочивание чекпоинтов (стрелками)
  const handleCheckpointReorder = useCallback(
    (id, direction) => {
      updateRoute((prev) => {
        const cps = [...prev.checkpoints];
        const idx = cps.findIndex((cp) => cp.id === id);
        if (idx === -1) return prev;
        const swapIdx = direction === "up" ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= cps.length) return prev;
        // Swap order values
        const orderA = cps[idx].order;
        const orderB = cps[swapIdx].order;
        cps[idx] = { ...cps[idx], order: orderB };
        cps[swapIdx] = { ...cps[swapIdx], order: orderA };
        return { ...prev, checkpoints: cps };
      });
    },
    [updateRoute]
  );

  // Переупорядочивание чекпоинтов (по номеру)
  const handleCheckpointReorderTo = useCallback(
    (id, newOrder) => {
      updateRoute((prev) => {
        const sorted = [...prev.checkpoints].sort((a, b) => a.order - b.order);
        const currentIdx = sorted.findIndex((cp) => cp.id === id);
        if (currentIdx === -1) return prev;
        // Remove and reinsert at new position
        const [item] = sorted.splice(currentIdx, 1);
        const targetIdx = Math.max(0, Math.min(sorted.length, newOrder));
        sorted.splice(targetIdx, 0, item);
        // Re-assign orders
        const reordered = sorted.map((cp, i) => ({ ...cp, order: i }));
        return { ...prev, checkpoints: reordered };
      });
    },
    [updateRoute]
  );

  // Валидация при публикации
  const handleStatusChange = useCallback(
    (newStatus) => {
      if (newStatus === "published" && route) {
        const errors = validateRoute(route);
        if (errors.length > 0) {
          alert("Нельзя опубликовать:\n\n" + errors.map((e) => "- " + e).join("\n"));
          return;
        }
      }
      updateRoute({ ...route, status: newStatus });
    },
    [route, updateRoute]
  );

  // Массив pathIndex у сегментов с контентом
  const segmentIndicesWithContent = useMemo(() => {
    if (!route?.segments) return [];
    return route.segments
      .filter((s) => (s.title || s.text || s.audio?.length) && s.pathIndex != null)
      .map((s) => s.pathIndex);
  }, [route?.segments]);

  if (!route) return null;

  const selectedCheckpoint = route.checkpoints.find((cp) => cp.id === selectedCheckpointId);
  const selectedSegment = (route.segments || []).find((s) => s.pathIndex === selectedSegmentIndex);

  return (
    <div className="space-y-4">
      {/* Название и описание */}
      <div className="space-y-3">
        <input
          type="text"
          value={route.title}
          onChange={(e) => updateRoute({ ...route, title: e.target.value })}
          placeholder="Название маршрута"
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-lg font-bold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition focus:outline-none focus:ring-2 focus:ring-green-500/50"
        />
        <textarea
          value={route.description}
          onChange={(e) => updateRoute({ ...route, description: e.target.value })}
          placeholder="Описание маршрута"
          rows={2}
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] transition focus:outline-none focus:ring-2 focus:ring-green-500/50 resize-none"
        />
      </div>

      {/* Вступление */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 space-y-2">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Вступление</h3>
        <textarea
          value={route.intro || ""}
          onChange={(e) => updateRoute({ ...route, intro: e.target.value })}
          placeholder="Вступительный текст маршрута (что ожидает пользователя)"
          rows={6}
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-green-500/50 resize-y"
        />
      </div>

      {/* Карта + тулбар */}
      <div className="relative">
        <LeafletMap
          center={route.mapCenter}
          zoom={route.mapZoom}
          mode={mode}
          path={route.path}
          checkpoints={route.checkpoints}
          segments={route.segments || []}
          finish={route.finish}
          onMapClick={handleMapClick}
          onPathPointDrag={handlePathPointDrag}
          onPathPointRightClick={handlePathPointRightClick}
          onPathInsert={handlePathInsert}
          onCheckpointClick={handleCheckpointClick}
          onCheckpointDrag={handleCheckpointDrag}
          onCheckpointDelete={handleCheckpointDelete}
          onSegmentLineClick={handleSegmentLineClick}
          onFinishDrag={handleFinishDrag}
          selectedCheckpointId={selectedCheckpointId}
          selectedSegmentIndex={selectedSegmentIndex}
          segmentIndicesWithContent={segmentIndicesWithContent}
          simulatedPosition={simulatedPosition}
        />
        <RouteEditorToolbar
          mode={mode}
          onModeChange={setMode}
          onSave={handleSave}
          isDirty={isDirty}
          saving={saving}
          onUndo={handleUndo}
          canUndo={historyRef.current.length > 0}
          onPreview={() => setShowPreview(true)}
        />
        {/* Toast */}
        {saveMessage && (
          <div
            className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-20 rounded-xl px-4 py-2 text-sm font-medium shadow-lg transition ${
              saveMessage.type === "success"
                ? "bg-green-600 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            {saveMessage.text}
          </div>
        )}
      </div>

      {/* Инфо */}
      <div className="flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
        <span>Точек пути: {route.path.length}</span>
        <span>Чекпоинтов: {route.checkpoints.length}</span>
        <span>Отрезков: {(route.segments || []).length} (с контентом: {segmentIndicesWithContent.length})</span>
        {route.distance > 0 && (
          <span>
            Дистанция:{" "}
            {route.distance >= 1000
              ? `${(route.distance / 1000).toFixed(1)} км`
              : `${route.distance} м`}
          </span>
        )}
        {route.duration > 0 && <span>~{route.duration} мин</span>}
      </div>

      {/* Медиа маршрута */}
      <RouteMediaSection route={route} updateRoute={updateRoute} />

      {/* Модалка редактирования чекпоинта / сегмента */}
      {(selectedCheckpoint || selectedSegment) && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { setSelectedCheckpointId(null); setSelectedSegmentIndex(null); }}
        >
          <div
            className="w-full max-w-lg mx-0 sm:mx-4 max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-2xl pb-20 sm:pb-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Навигация: тип + номер */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-[var(--border-color)] shrink-0">
              <select
                value={selectedCheckpoint ? "checkpoint" : "segment"}
                onChange={(e) => {
                  if (e.target.value === "checkpoint") {
                    setSelectedSegmentIndex(null);
                    const first = route.checkpoints[0];
                    if (first) setSelectedCheckpointId(first.id);
                  } else {
                    setSelectedCheckpointId(null);
                    const segs = route.segments || [];
                    if (segs.length > 0) setSelectedSegmentIndex(segs[0].pathIndex);
                  }
                }}
                className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2 py-1.5 text-xs font-medium text-[var(--text-primary)] focus:outline-none"
              >
                <option value="checkpoint">Точка</option>
                <option value="segment">Отрезок</option>
              </select>

              <select
                value={selectedCheckpoint ? selectedCheckpoint.id : (selectedSegment?.pathIndex ?? "")}
                onChange={(e) => {
                  if (selectedCheckpoint) {
                    setSelectedCheckpointId(e.target.value);
                  } else {
                    setSelectedSegmentIndex(parseInt(e.target.value));
                  }
                }}
                className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2 py-1.5 text-xs font-medium text-[var(--text-primary)] focus:outline-none"
              >
                {selectedCheckpoint
                  ? route.checkpoints.map((cp) => (
                      <option key={cp.id} value={cp.id}>
                        #{cp.order + 1}{cp.title ? ` — ${cp.title}` : ""}
                      </option>
                    ))
                  : (route.segments || []).map((s) => (
                      <option key={s.pathIndex} value={s.pathIndex}>
                        #{s.pathIndex + 1}{s.title ? ` — ${s.title}` : ""}
                      </option>
                    ))
                }
              </select>

              <button
                onClick={() => { setSelectedCheckpointId(null); setSelectedSegmentIndex(null); }}
                className="ml-auto text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Контент панели */}
            <div className="overflow-y-auto flex-1">
              {selectedCheckpoint && (
                <CheckpointPanel
                  checkpoint={selectedCheckpoint}
                  onUpdate={(updates) => handleCheckpointUpdate(selectedCheckpoint.id, updates)}
                  onDelete={() => handleCheckpointDelete(selectedCheckpoint.id)}
                  onClose={() => setSelectedCheckpointId(null)}
                  onReorder={handleCheckpointReorder}
                  onReorderTo={handleCheckpointReorderTo}
                  totalCheckpoints={route.checkpoints.length}
                />
              )}
              {selectedSegment && (
                <SegmentPanel
                  segment={selectedSegment}
                  onUpdate={(updates) => handleSegmentUpdate(selectedSegment.pathIndex, updates)}
                  onDelete={() => handleSegmentDelete(selectedSegment.pathIndex)}
                  onClose={() => setSelectedSegmentIndex(null)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Панель симуляции */}
      {mode === "simulate" && (
        <SimulationPanel
          route={route}
          simulatedPosition={simulatedPosition}
          onPositionChange={setSimulatedPosition}
        />
      )}

      {/* Статус + финальный Save */}
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <span>Статус:</span>
          <select
            value={route.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none"
          >
            <option value="draft">Черновик</option>
            <option value="published">Опубликован</option>
          </select>
        </label>

        {route.finish && (
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] ml-auto mr-4">
            <span>Монеты за финиш:</span>
            <input
              type="number"
              min="0"
              value={route.finish?.coinsReward || 0}
              onChange={(e) =>
                updateRoute({
                  ...route,
                  finish: { ...route.finish, coinsReward: parseInt(e.target.value) || 0 },
                })
              }
              className="w-20 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none"
            />
          </label>
        )}

        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="ml-auto rounded-xl bg-green-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
      </div>

      {/* Модалка предпросмотра */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative w-full sm:max-w-2xl sm:mx-4 h-full sm:h-auto sm:max-h-[90vh] flex flex-col rounded-none sm:rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] shrink-0">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Предпросмотр маршрута</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="rounded-lg px-3 py-1 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] transition"
              >
                Закрыть
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pb-6">
              <RouteMapLeaflet route={route} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
