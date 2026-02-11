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
import { projectPointOnPath, haversineDistance } from "@/lib/geo";

const RouteMapLeaflet = dynamic(() => import("./RouteMapLeaflet"), { ssr: false });

const MODE_KEYS = { "1": "view", "2": "drawPath", "3": "addCheckpoint", "4": "addSegment", "5": "simulate" };

function validateRoute(route) {
  const errors = [];
  if (!route.title?.trim()) errors.push("Не указано название маршрута");
  if ((route.path?.length || 0) < 2) errors.push("Путь содержит менее 2 точек");
  if ((route.checkpoints?.length || 0) === 0) errors.push("Нет ни одного чекпоинта");
  if (route.finishPointIndex == null) errors.push("Не установлен финиш");
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
  const [pathPointMenu, setPathPointMenu] = useState(null);
  const [pathLineMenu, setPathLineMenu] = useState(null);
  const [toastError, setToastError] = useState(null);

  // Загрузка маршрута (с миграцией finishPointIndex)
  useEffect(() => {
    (async () => {
      const res = await authFetch(`/api/routes/${routeId}`);
      if (res.ok) {
        const data = await res.json();
        // Миграция: если finishPointIndex не задан, но есть finish.position — найти ближайшую точку
        if (data.finishPointIndex === undefined && data.finish?.position && data.path?.length >= 2) {
          const proj = projectPointOnPath(data.finish.position, data.path);
          if (proj) {
            // Ставим на ближайшую вершину пути
            const nearestIdx = proj.fraction > 0.5 ? proj.pathIndex + 1 : proj.pathIndex;
            data.finishPointIndex = Math.min(nearestIdx, data.path.length - 1);
            data.finish.position = data.path[data.finishPointIndex];
          }
        }
        if (data.finishPointIndex === undefined) data.finishPointIndex = null;
        if (data.startPointIndex === undefined) data.startPointIndex = null;
        setRoute(data);
      }
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

  // Хелпер: обновить path/checkpoints/segments в route (main only)
  const updateMainContext = useCallback(
    (updater) => {
      updateRoute((prev) => {
        const ctx = { path: prev.path, checkpoints: prev.checkpoints, segments: prev.segments || [] };
        const next = typeof updater === "function" ? updater(ctx) : { ...ctx, ...updater };
        return { ...prev, ...next };
      });
    },
    [updateRoute]
  );

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

      // 1-5 — переключение режимов
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
      setPathPointMenu(null);
      setPathLineMenu(null);
      if (clickMode === "drawPath") {
        updateMainContext((ctx) => ({
          ...ctx,
          path: [...ctx.path, { lat: latlng.lat, lng: latlng.lng, order: ctx.path.length }],
        }));
      } else if (clickMode === "addCheckpoint") {
        const id = crypto.randomUUID();
        updateMainContext((ctx) => ({
          ...ctx,
          checkpoints: [
            ...ctx.checkpoints,
            {
              id,
              title: "",
              description: "",
              position: { lat: latlng.lat, lng: latlng.lng },
              triggerRadiusMeters: 20,
              coinsReward: 0,
              photos: [],
              audio: [],
              order: ctx.checkpoints.length,
            },
          ],
        }));
        setSelectedCheckpointId(id);
      } else if (clickMode === "simulate") {
        setSimulatedPosition({ lat: latlng.lat, lng: latlng.lng });
      }
    },
    [updateMainContext]
  );

  // Вставка точки в середину пути
  const handlePathInsert = useCallback(
    (insertIndex, latlng) => {
      updateMainContext((ctx) => {
        const newPath = [...ctx.path];
        newPath.splice(insertIndex, 0, { lat: latlng.lat, lng: latlng.lng, order: 0 });
        const reindexed = newPath.map((p, i) => ({ ...p, order: i }));
        const newSegments = (ctx.segments || []).map((s) =>
          s.pathIndex >= insertIndex ? { ...s, pathIndex: s.pathIndex + 1 } : s
        );
        // Корректируем boundToPathIndex
        const newCheckpoints = ctx.checkpoints.map((cp) => {
          if (cp.boundToPathIndex != null && cp.boundToPathIndex >= insertIndex) {
            return { ...cp, boundToPathIndex: cp.boundToPathIndex + 1 };
          }
          return cp;
        });
        return { ...ctx, path: reindexed, segments: newSegments, checkpoints: newCheckpoints };
      });
      // Корректируем finishPointIndex / startPointIndex
      updateRoute((prev) => {
        let fp = prev.finishPointIndex;
        let sp = prev.startPointIndex;
        if (fp != null && fp >= insertIndex) fp++;
        if (sp != null && sp >= insertIndex) sp++;
        return { ...prev, finishPointIndex: fp, startPointIndex: sp };
      });
    },
    [updateMainContext, updateRoute]
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
        updateMainContext((ctx) => ({
          ...ctx,
          segments: [
            ...(ctx.segments || []),
            { id, pathIndex, title: "", text: "", photos: [], audio: [] },
          ],
        }));
        setSelectedSegmentIndex(pathIndex);
      }
    },
    [route, updateMainContext]
  );

  // Перетаскивание точки пути
  const handlePathPointDrag = useCallback(
    (index, newPos) => {
      updateMainContext((ctx) => {
        const newPath = [...ctx.path];
        newPath[index] = { ...newPath[index], lat: newPos.lat, lng: newPos.lng };
        // Двигаем привязанный чекпоинт
        const newCheckpoints = ctx.checkpoints.map((cp) =>
          cp.boundToPathIndex === index ? { ...cp, position: { lat: newPos.lat, lng: newPos.lng } } : cp
        );
        return { ...ctx, path: newPath, checkpoints: newCheckpoints };
      });
      // Синхронизируем finish.position если drag'аем финишную точку
      setRoute((prev) => {
        if (prev?.finishPointIndex === index) {
          return { ...prev, finish: { ...prev.finish, position: newPos } };
        }
        return prev;
      });
    },
    [updateMainContext]
  );

  // Удаление точки пути (правый клик) — с фиксом segment indices, start/finish, bound checkpoints
  const handlePathPointRightClick = useCallback(
    (index) => {
      updateMainContext((ctx) => {
        const newPath = ctx.path.filter((_, i) => i !== index).map((p, i) => ({ ...p, order: i }));
        const newSegments = (ctx.segments || [])
          .filter((s) => s.pathIndex !== index)
          .map((s) => (s.pathIndex > index ? { ...s, pathIndex: s.pathIndex - 1 } : s));
        // Удаляем привязанные чекпоинты и корректируем boundToPathIndex
        const newCheckpoints = ctx.checkpoints
          .filter((cp) => cp.boundToPathIndex !== index)
          .map((cp) => {
            if (cp.boundToPathIndex != null && cp.boundToPathIndex > index) {
              return { ...cp, boundToPathIndex: cp.boundToPathIndex - 1 };
            }
            return cp;
          });
        return { ...ctx, path: newPath, segments: newSegments, checkpoints: newCheckpoints };
      });
      // Корректируем finishPointIndex / startPointIndex
      updateRoute((prev) => {
        let fp = prev.finishPointIndex;
        let sp = prev.startPointIndex;
        if (fp === index) { fp = null; }
        else if (fp != null && fp > index) fp--;
        if (sp === index) { sp = null; }
        else if (sp != null && sp > index) sp--;
        const finish = fp != null && prev.path?.[fp] ? { position: prev.path[fp], coinsReward: prev.finish?.coinsReward || 0 } : (fp == null ? null : prev.finish);
        return { ...prev, finishPointIndex: fp, startPointIndex: sp, finish };
      });
    },
    [updateMainContext, updateRoute]
  );

  // Клик по чекпоинту
  const handleCheckpointClick = useCallback((id) => {
    setSelectedCheckpointId(id);
  }, []);

  // Перетаскивание чекпоинта
  const handleCheckpointDrag = useCallback(
    (id, newPos) => {
      updateMainContext((ctx) => ({
        ...ctx,
        checkpoints: ctx.checkpoints.map((cp) =>
          cp.id === id ? { ...cp, position: newPos } : cp
        ),
      }));
    },
    [updateMainContext]
  );

  // --- Контекстное меню точки пути ---
  const handlePathPointContextMenu = useCallback((index, { x, y }) => {
    setPathPointMenu({ index, x, y });
    setPathLineMenu(null);
  }, []);

  const handleSetAsFinish = useCallback(
    (index) => {
      const routePath = route?.path || [];
      updateRoute((prev) => ({
        ...prev,
        finishPointIndex: index,
        finish: { position: routePath[index], coinsReward: prev.finish?.coinsReward || 0 },
      }));
      setPathPointMenu(null);
    },
    [updateRoute, route]
  );

  const handleClearFinish = useCallback(() => {
    updateRoute((prev) => ({ ...prev, finishPointIndex: null, finish: null }));
    setPathPointMenu(null);
  }, [updateRoute]);

  const handleSetAsStart = useCallback(
    (index) => {
      updateRoute((prev) => ({ ...prev, startPointIndex: index }));
      setPathPointMenu(null);
    },
    [updateRoute]
  );

  const handleClearStart = useCallback(() => {
    updateRoute((prev) => ({ ...prev, startPointIndex: null }));
    setPathPointMenu(null);
  }, [updateRoute]);

  const handleMakeCheckpointAtPoint = useCallback(
    (index) => {
      const point = route?.path?.[index];
      if (!point) return;
      const id = crypto.randomUUID();
      updateMainContext((ctx) => ({
        ...ctx,
        checkpoints: [
          ...ctx.checkpoints,
          {
            id,
            title: "",
            description: "",
            position: { lat: point.lat, lng: point.lng },
            triggerRadiusMeters: 20,
            coinsReward: 0,
            photos: [],
            audio: [],
            order: ctx.checkpoints.length,
            boundToPathIndex: index,
          },
        ],
      }));
      setPathPointMenu(null);
      setSelectedCheckpointId(id);
    },
    [route, updateMainContext]
  );

  const handleMergeAtPoint = useCallback(
    (index) => {
      setPathPointMenu(null);
      updateMainContext((ctx) => {
        const { path: p, segments: segs } = ctx;
        if (index <= 0 || index >= p.length - 1) return ctx;

        const seg1 = (segs || []).find((s) => s.pathIndex === index - 1);
        const seg2 = (segs || []).find((s) => s.pathIndex === index);

        const hasContent = (s) => s && (s.title || s.text || (s.photos && s.photos.length) || (s.audio && s.audio.length));
        const content1 = hasContent(seg1);
        const content2 = hasContent(seg2);

        if (content1 && content2) {
          setToastError("Нельзя объединить два отрезка с контентом. Сделайте один пустым.");
          setTimeout(() => setToastError(null), 3000);
          return ctx;
        }

        let newSegments = [...(segs || [])];

        if (content1 && !content2) {
          // Оставляем seg1 на ребре (index-1), удаляем seg2
          newSegments = newSegments.filter((s) => s.pathIndex !== index);
        } else if (!content1 && content2) {
          // Переносим контент seg2 на ребро (index-1), удаляем оригинал
          newSegments = newSegments.filter((s) => s.pathIndex !== index - 1);
          newSegments = newSegments.map((s) => s.pathIndex === index ? { ...s, pathIndex: index - 1 } : s);
        } else {
          // Оба пустые — удаляем оба
          newSegments = newSegments.filter((s) => s.pathIndex !== index - 1 && s.pathIndex !== index);
        }

        // Убираем isDivider чекпоинт рядом (< 10м)
        const pointPos = p[index];
        const newCheckpoints = ctx.checkpoints.map((cp) => {
          if (cp.isDivider && haversineDistance(cp.position, pointPos) < 10) {
            return { ...cp, isDivider: false };
          }
          return cp;
        });

        // Геометрия пути НЕ меняется — точка остаётся, но становится «склейкой»
        const newPath = p.map((pt, i) => i === index ? { ...pt, isJunction: false, isMerged: true } : pt);

        return { ...ctx, path: newPath, checkpoints: newCheckpoints, segments: newSegments };
      });
    },
    [updateMainContext]
  );

  // --- Контекстное меню линии пути ---
  const handlePathLineContextMenu = useCallback((insertIndex, { x, y, lat, lng }) => {
    setPathLineMenu({ insertIndex, x, y, lat, lng });
    setPathPointMenu(null);
  }, []);

  const handleAddJunction = useCallback(() => {
    if (!pathLineMenu) return;
    const { insertIndex, lat, lng } = pathLineMenu;
    updateMainContext((ctx) => {
      const newPath = [...ctx.path];
      newPath.splice(insertIndex, 0, { lat, lng, order: 0, isJunction: true });
      const reindexed = newPath.map((p, i) => ({ ...p, order: i }));
      const newSegments = (ctx.segments || []).map((s) =>
        s.pathIndex >= insertIndex ? { ...s, pathIndex: s.pathIndex + 1 } : s
      );
      const newCheckpoints = ctx.checkpoints.map((cp) => {
        if (cp.boundToPathIndex != null && cp.boundToPathIndex >= insertIndex) {
          return { ...cp, boundToPathIndex: cp.boundToPathIndex + 1 };
        }
        return cp;
      });
      return { ...ctx, path: reindexed, segments: newSegments, checkpoints: newCheckpoints };
    });
    updateRoute((prev) => {
      let fp = prev.finishPointIndex;
      let sp = prev.startPointIndex;
      if (fp != null && fp >= insertIndex) fp++;
      if (sp != null && sp >= insertIndex) sp++;
      return { ...prev, finishPointIndex: fp, startPointIndex: sp };
    });
    setPathLineMenu(null);
  }, [pathLineMenu, updateMainContext, updateRoute]);

  // Обновление чекпоинта
  const handleCheckpointUpdate = useCallback(
    (id, updates) => {
      const routePath = route?.path || [];
      const routeCheckpoints = route?.checkpoints || [];
      // Предвычисляем insertIdx если isDivider
      let dividerInsertIdx = null;
      if (updates.isDivider === true && routePath.length >= 2) {
        const cp = routeCheckpoints.find((c) => c.id === id);
        if (cp) {
          const proj = projectPointOnPath(cp.position, routePath);
          if (proj && proj.fraction > 0.01 && proj.fraction < 0.99) {
            dividerInsertIdx = proj.pathIndex + 1;
          }
        }
      }

      updateMainContext((ctx) => {
        const updatedCheckpoints = ctx.checkpoints.map((cp) =>
          cp.id === id ? { ...cp, ...updates } : cp
        );
        let next = { ...ctx, checkpoints: updatedCheckpoints };

        // При включении isDivider — вставить точку чекпоинта в path (физический сплит)
        if (updates.isDivider === true && ctx.path.length >= 2) {
          const cp = updatedCheckpoints.find((c) => c.id === id);
          if (cp) {
            const proj = projectPointOnPath(cp.position, ctx.path);
            if (proj && proj.fraction > 0.01 && proj.fraction < 0.99) {
              const insertIdx = proj.pathIndex + 1;
              const newPath = [...ctx.path];
              newPath.splice(insertIdx, 0, {
                lat: proj.position.lat,
                lng: proj.position.lng,
                order: 0,
              });
              const reindexedPath = newPath.map((p, i) => ({ ...p, order: i }));
              const newSegments = (ctx.segments || []).map((s) =>
                s.pathIndex >= insertIdx ? { ...s, pathIndex: s.pathIndex + 1 } : s
              );
              // Корректируем boundToPathIndex у чекпоинтов
              const fixedCheckpoints = (next.checkpoints || updatedCheckpoints).map((c) => {
                if (c.boundToPathIndex != null && c.boundToPathIndex >= insertIdx) {
                  return { ...c, boundToPathIndex: c.boundToPathIndex + 1 };
                }
                return c;
              });
              next = { ...next, path: reindexedPath, segments: newSegments, checkpoints: fixedCheckpoints };
            }
          }
        }

        return next;
      });

      // Корректируем indices при вставке от isDivider
      if (dividerInsertIdx != null) {
        updateRoute((prev) => {
          let fp = prev.finishPointIndex;
          let sp = prev.startPointIndex;
          if (fp != null && fp >= dividerInsertIdx) fp++;
          if (sp != null && sp >= dividerInsertIdx) sp++;
          return { ...prev, finishPointIndex: fp, startPointIndex: sp };
        });
      }
    },
    [updateMainContext, updateRoute, route]
  );

  // Удаление чекпоинта
  const handleCheckpointDelete = useCallback(
    (id) => {
      updateMainContext((ctx) => ({
        ...ctx,
        checkpoints: ctx.checkpoints
          .filter((cp) => cp.id !== id)
          .map((cp, i) => ({ ...cp, order: i })),
      }));
      setSelectedCheckpointId(null);
    },
    [updateMainContext]
  );

  // Refs for hotkey access
  const handleCheckpointDeleteRef = useRef(handleCheckpointDelete);
  handleCheckpointDeleteRef.current = handleCheckpointDelete;
  const handleSegmentDeleteRef = useRef(null);

  // Обновление сегмента (по pathIndex)
  const handleSegmentUpdate = useCallback(
    (pathIndex, updates) => {
      updateMainContext((ctx) => ({
        ...ctx,
        segments: (ctx.segments || []).map((s) =>
          s.pathIndex === pathIndex ? { ...s, ...updates } : s
        ),
      }));
    },
    [updateMainContext]
  );

  // Удаление сегмента (по pathIndex)
  const handleSegmentDelete = useCallback(
    (pathIndex) => {
      updateMainContext((ctx) => ({
        ...ctx,
        segments: (ctx.segments || []).filter((s) => s.pathIndex !== pathIndex),
      }));
      setSelectedSegmentIndex(null);
    },
    [updateMainContext]
  );
  handleSegmentDeleteRef.current = handleSegmentDelete;

  // Переупорядочивание чекпоинтов (стрелками)
  const handleCheckpointReorder = useCallback(
    (id, direction) => {
      updateMainContext((ctx) => {
        const cps = [...ctx.checkpoints];
        const idx = cps.findIndex((cp) => cp.id === id);
        if (idx === -1) return ctx;
        const swapIdx = direction === "up" ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= cps.length) return ctx;
        const orderA = cps[idx].order;
        const orderB = cps[swapIdx].order;
        cps[idx] = { ...cps[idx], order: orderB };
        cps[swapIdx] = { ...cps[swapIdx], order: orderA };
        return { ...ctx, checkpoints: cps };
      });
    },
    [updateMainContext]
  );

  // Переупорядочивание чекпоинтов (по номеру)
  const handleCheckpointReorderTo = useCallback(
    (id, newOrder) => {
      updateMainContext((ctx) => {
        const sorted = [...ctx.checkpoints].sort((a, b) => a.order - b.order);
        const currentIdx = sorted.findIndex((cp) => cp.id === id);
        if (currentIdx === -1) return ctx;
        const [item] = sorted.splice(currentIdx, 1);
        const targetIdx = Math.max(0, Math.min(sorted.length, newOrder));
        sorted.splice(targetIdx, 0, item);
        const reordered = sorted.map((cp, i) => ({ ...cp, order: i }));
        return { ...ctx, checkpoints: reordered };
      });
    },
    [updateMainContext]
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
    const segs = route?.segments;
    if (!segs) return [];
    return segs
      .filter((s) => (s.title || s.text || s.audio?.length) && s.pathIndex != null)
      .map((s) => s.pathIndex);
  }, [route?.segments]);

  if (!route) return null;

  const routePath = route.path || [];
  const routeCheckpoints = route.checkpoints || [];
  const routeSegments = route.segments || [];

  const selectedCheckpoint = routeCheckpoints.find((cp) => cp.id === selectedCheckpointId);
  const selectedSegment = routeSegments.find((s) => s.pathIndex === selectedSegmentIndex);

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
          path={routePath}
          checkpoints={routeCheckpoints}
          segments={routeSegments}
          finish={route.finish}
          startPointIndex={route.startPointIndex}
          finishPointIndex={route.finishPointIndex}
          onMapClick={handleMapClick}
          onPathPointDrag={handlePathPointDrag}
          onPathPointRightClick={handlePathPointRightClick}
          onPathInsert={handlePathInsert}
          onCheckpointClick={handleCheckpointClick}
          onCheckpointDrag={handleCheckpointDrag}
          onCheckpointDelete={handleCheckpointDelete}
          onSegmentLineClick={handleSegmentLineClick}
          onPathPointContextMenu={handlePathPointContextMenu}
          onPathLineContextMenu={handlePathLineContextMenu}
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

      {/* Контекстное меню точки пути */}
      {pathPointMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setPathPointMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setPathPointMenu(null); }}
        >
          <div
            className="fixed z-50 w-fit min-w-[180px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xl py-1"
            style={{ left: pathPointMenu.x, top: pathPointMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Старт */}
            {route.startPointIndex !== pathPointMenu.index && pathPointMenu.index !== (route.startPointIndex ?? 0) && (
              <button
                onClick={() => handleSetAsStart(pathPointMenu.index)}
                className="w-full px-4 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition"
              >
                Назначить стартом
              </button>
            )}
            {route.startPointIndex === pathPointMenu.index && (
              <button
                onClick={handleClearStart}
                className="w-full px-4 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition"
              >
                Сбросить старт
              </button>
            )}
            {/* Финиш */}
            {route.finishPointIndex !== pathPointMenu.index && (
              <button
                onClick={() => handleSetAsFinish(pathPointMenu.index)}
                className="w-full px-4 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition"
              >
                Назначить финишем
              </button>
            )}
            {route.finishPointIndex === pathPointMenu.index && (
              <button
                onClick={handleClearFinish}
                className="w-full px-4 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition"
              >
                Убрать финиш
              </button>
            )}
            {/* Сделать поинтом — если нет привязанного чекпоинта */}
            {!routeCheckpoints.some((cp) => cp.boundToPathIndex === pathPointMenu.index) && (
              <button
                onClick={() => handleMakeCheckpointAtPoint(pathPointMenu.index)}
                className="w-full px-4 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition"
              >
                Сделать поинтом
              </button>
            )}
            {/* Объединить — только для внутренних точек */}
            {pathPointMenu.index > 0 && pathPointMenu.index < routePath.length - 1 && (
              <button
                onClick={() => handleMergeAtPoint(pathPointMenu.index)}
                className="w-full px-4 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition"
              >
                Объединить отрезки
              </button>
            )}
            {/* Удалить */}
            <button
              onClick={() => {
                handlePathPointRightClick(pathPointMenu.index);
                setPathPointMenu(null);
              }}
              className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-[var(--bg-elevated)] transition"
            >
              Удалить точку
            </button>
          </div>
        </div>
      )}

      {/* Контекстное меню линии пути */}
      {pathLineMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setPathLineMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setPathLineMenu(null); }}
        >
          <div
            className="fixed z-50 min-w-[160px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xl py-1"
            style={{ left: pathLineMenu.x, top: pathLineMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleAddJunction}
              className="w-full px-4 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition"
            >
              Добавить стык
            </button>
          </div>
        </div>
      )}

      {/* Toast ошибки */}
      {toastError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-red-600/90 px-4 py-2.5 text-sm text-white shadow-lg">
          {toastError}
        </div>
      )}

      {/* Инфо */}
      <div className="flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
        <span>Точек пути: {routePath.length}</span>
        <span>Чекпоинтов: {routeCheckpoints.length}</span>
        <span>Отрезков: {routeSegments.length} (с контентом: {segmentIndicesWithContent.length})</span>
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
                    const first = routeCheckpoints[0];
                    if (first) setSelectedCheckpointId(first.id);
                  } else {
                    setSelectedCheckpointId(null);
                    const segs = routeSegments;
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
                  ? routeCheckpoints.map((cp) => (
                      <option key={cp.id} value={cp.id}>
                        #{cp.order + 1}{cp.title ? ` — ${cp.title}` : ""}
                      </option>
                    ))
                  : routeSegments.map((s) => (
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
                  totalCheckpoints={routeCheckpoints.length}
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

        {route.finishPointIndex != null && (
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
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setShowPreview(false)} />
          <div className="fixed inset-x-0 top-0 bottom-16 z-50 flex items-end sm:items-center justify-center">
            <div className="relative w-full sm:max-w-2xl sm:mx-4 h-full sm:h-auto sm:max-h-[85vh] flex flex-col rounded-none sm:rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-2xl">
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
        </>
      )}
    </div>
  );
}
