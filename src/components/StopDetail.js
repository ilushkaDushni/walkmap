"use client";

import { X, Info } from "lucide-react";

/**
 * Панель с информацией об остановке: фото, аудио, описание.
 */
export default function StopDetail({ stop, onClose }) {
  if (!stop) return null;

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-lg transition-colors">
      {/* Заголовок */}
      <div className="mb-3 flex items-start justify-between">
        <h3 className="text-lg font-bold text-[var(--text-primary)]">{stop.title}</h3>
        <button
          onClick={onClose}
          className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Фото */}
      {stop.photo && (
        <div className="mb-3 overflow-hidden rounded-xl">
          <img
            src={stop.photo}
            alt={stop.title}
            className="h-48 w-full object-cover"
          />
        </div>
      )}

      {/* Описание */}
      <p className="mb-3 text-sm leading-relaxed text-[var(--text-secondary)]">
        {stop.description}
      </p>

      {/* Аудио-плеер */}
      {stop.audio && (
        <div className="rounded-lg bg-[var(--bg-elevated)] p-3">
          <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">Аудиогид</p>
          <audio
            controls
            src={stop.audio}
            className="w-full"
            preload="none"
          >
            Ваш браузер не поддерживает аудио.
          </audio>
        </div>
      )}

      {/* Заглушка, если нет фото и аудио */}
      {!stop.photo && !stop.audio && (
        <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-elevated)] p-3 text-sm text-[var(--text-muted)]">
          <Info className="h-5 w-5" />
          Медиа для этой остановки пока не загружены
        </div>
      )}
    </div>
  );
}
