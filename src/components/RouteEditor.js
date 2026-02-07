"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/components/UserProvider";
import LeafletMap from "./LeafletMap";
import RouteEditorToolbar from "./RouteEditorToolbar";
import CheckpointPanel from "./CheckpointPanel";
import RouteMediaSection from "./RouteMediaSection";

export default function RouteEditor({ routeId, onSaved }) {
  const { authFetch } = useUser();
  const [route, setRoute] = useState(null);
  const [mode, setMode] = useState("view");
  const [selectedCheckpointId, setSelectedCheckpointId] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Загрузка маршрута
  useEffect(() => {
    (async () => {
      const res = await authFetch(`/api/routes/${routeId}`);
      if (res.ok) setRoute(await res.json());
    })();
  }, [routeId, authFetch]);

  const updateRoute = useCallback((updater) => {
    setRoute((prev) => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      return next;
    });
    setIsDirty(true);
  }, []);

  // Сохранение
  const handleSave = async () => {
    if (!route) return;
    setSaving(true);
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
    }
    setSaving(false);
  };

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
      }
    },
    [updateRoute]
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

  // Удаление точки пути (правый клик)
  const handlePathPointRightClick = useCallback(
    (index) => {
      updateRoute((prev) => ({
        ...prev,
        path: prev.path.filter((_, i) => i !== index).map((p, i) => ({ ...p, order: i })),
      }));
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

  if (!route) return null;

  const selectedCheckpoint = route.checkpoints.find((cp) => cp.id === selectedCheckpointId);

  return (
    <div className="space-y-4">
      {/* Тулбар */}
      <RouteEditorToolbar
        mode={mode}
        onModeChange={setMode}
        onSave={handleSave}
        isDirty={isDirty}
        saving={saving}
      />

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

      {/* Карта */}
      <LeafletMap
        center={route.mapCenter}
        zoom={route.mapZoom}
        mode={mode}
        path={route.path}
        checkpoints={route.checkpoints}
        finish={route.finish}
        onMapClick={handleMapClick}
        onPathPointDrag={handlePathPointDrag}
        onPathPointRightClick={handlePathPointRightClick}
        onCheckpointClick={handleCheckpointClick}
        onCheckpointDrag={handleCheckpointDrag}
        onFinishDrag={handleFinishDrag}
        selectedCheckpointId={selectedCheckpointId}
      />

      {/* Инфо */}
      <div className="flex gap-4 text-xs text-[var(--text-muted)]">
        <span>Точек пути: {route.path.length}</span>
        <span>Чекпоинтов: {route.checkpoints.length}</span>
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

      {/* Панель чекпоинта */}
      {selectedCheckpoint && (
        <CheckpointPanel
          checkpoint={selectedCheckpoint}
          onUpdate={(updates) => handleCheckpointUpdate(selectedCheckpoint.id, updates)}
          onDelete={() => handleCheckpointDelete(selectedCheckpoint.id)}
          onClose={() => setSelectedCheckpointId(null)}
        />
      )}

      {/* Статус + финальный Save */}
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <span>Статус:</span>
          <select
            value={route.status}
            onChange={(e) => updateRoute({ ...route, status: e.target.value })}
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
    </div>
  );
}
