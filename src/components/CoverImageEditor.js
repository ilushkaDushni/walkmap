"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut, Move, X, Check, Image, Trash2 } from "lucide-react";

/**
 * Модальный редактор обложки маршрута.
 * Props: { cover: { url, posX, posY, zoom } | null, open, onClose, onSave, onReplace, onDelete }
 */
export default function CoverImageEditor({ cover, open, onClose, onSave, onReplace, onDelete }) {
  const [draft, setDraft] = useState(cover);
  const containerRef = useRef(null);
  const dragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startDraft = useRef({ posX: 50, posY: 50 });

  // Синхронизируем draft при открытии / смене cover
  useEffect(() => {
    if (open && cover) setDraft({ ...cover });
  }, [open, cover]);

  // Закрытие по Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handlePointerDown = useCallback(
    (e) => {
      if (!draft) return;
      e.preventDefault();
      dragging.current = true;
      startPos.current = { x: e.clientX, y: e.clientY };
      startDraft.current = { posX: draft.posX, posY: draft.posY };
      e.target.setPointerCapture(e.pointerId);
    },
    [draft]
  );

  const handlePointerMove = useCallback(
    (e) => {
      if (!dragging.current || !containerRef.current || !draft) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dx = ((e.clientX - startPos.current.x) / rect.width) * 100;
      const dy = ((e.clientY - startPos.current.y) / rect.height) * 100;
      const posX = Math.min(100, Math.max(0, startDraft.current.posX - dx));
      const posY = Math.min(100, Math.max(0, startDraft.current.posY - dy));
      setDraft((d) => ({ ...d, posX: Math.round(posX), posY: Math.round(posY) }));
    },
    [draft]
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  if (!open || !draft) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Модалка */}
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl bg-[var(--bg-surface)] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Редактор обложки</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Preview */}
        <div className="p-4 space-y-3">
          <div
            ref={containerRef}
            className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-[var(--border-color)] cursor-grab active:cursor-grabbing select-none bg-[var(--bg-elevated)]"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <img
              src={draft.url}
              alt=""
              draggable={false}
              className="h-full w-full object-cover pointer-events-none"
              style={{
                objectPosition: `${draft.posX}% ${draft.posY}%`,
                transform: `scale(${draft.zoom})`,
                transformOrigin: `${draft.posX}% ${draft.posY}%`,
              }}
            />
            <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-lg bg-black/50 px-2 py-1 text-[10px] text-white pointer-events-none">
              <Move className="h-3 w-3" />
              Перетащите для позиции
            </div>
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-2">
            <ZoomOut className="h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={draft.zoom}
              onChange={(e) => setDraft((d) => ({ ...d, zoom: parseFloat(e.target.value) }))}
              className="flex-1 accent-green-500"
            />
            <ZoomIn className="h-4 w-4 text-[var(--text-muted)]" />
            <span className="text-xs text-[var(--text-muted)] w-8 text-right">
              {draft.zoom.toFixed(1)}x
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-color)]">
          <div className="flex gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
              <Image className="h-3.5 w-3.5" />
              Заменить
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onReplace}
                className="hidden"
              />
            </label>
            <button
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-red-500 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Удалить
            </button>
          </div>
          <button
            onClick={() => { onSave(draft); onClose(); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition"
          >
            <Check className="h-3.5 w-3.5" />
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
