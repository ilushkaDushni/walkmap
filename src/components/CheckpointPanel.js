"use client";

import { useUser } from "@/components/UserProvider";
import { useState } from "react";
import { Trash2, X, Upload, ChevronUp, ChevronDown } from "lucide-react";
import { validateFile } from "@/lib/validateFile";
import AudioPlayer from "@/components/AudioPlayer";

const PRESET_COLORS = ["#f59e0b", "#ef4444", "#3b82f6", "#22c55e", "#8b5cf6", "#ec4899", "#f97316", "#06b6d4"];

export default function CheckpointPanel({ checkpoint, onUpdate, onDelete, onClose, onReorder, onReorderTo, totalCheckpoints }) {
  const { authFetch } = useUser();

  const uploadFile = async (file, type) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    const res = await authFetch("/api/upload", { method: "POST", body: formData });
    if (res.ok) {
      const { url } = await res.json();
      return url;
    }
    return null;
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const v = validateFile(file, "photo");
      if (!v.ok) { alert(v.error); continue; }
      const url = await uploadFile(file, "photo");
      if (url) onUpdate({ photos: [...checkpoint.photos, url] });
    }
    e.target.value = "";
  };

  const handleAudioUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const v = validateFile(file, "audio");
    if (!v.ok) { alert(v.error); e.target.value = ""; return; }
    const url = await uploadFile(file, "audio");
    if (url) onUpdate({ audio: [...checkpoint.audio, url] });
    e.target.value = "";
  };

  const removePhoto = (index) => {
    onUpdate({ photos: checkpoint.photos.filter((_, i) => i !== index) });
  };

  const removeAudio = (index) => {
    onUpdate({ audio: checkpoint.audio.filter((_, i) => i !== index) });
  };


  return (
    <div className="p-4 space-y-3">
      {/* Шапка */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[var(--text-primary)]">Точка #</span>
          <input
            type="number"
            min="1"
            max={totalCheckpoints}
            value={checkpoint.order + 1}
            onChange={(e) => {
              const newOrder = Math.max(0, Math.min(totalCheckpoints - 1, parseInt(e.target.value) - 1));
              if (!isNaN(newOrder) && newOrder !== checkpoint.order) {
                onReorderTo?.(checkpoint.id, newOrder);
              }
            }}
            className="w-12 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-1.5 py-0.5 text-sm font-bold text-center text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-green-500/50"
          />
          {onReorder && (
            <div className="flex gap-0.5">
              <button
                onClick={() => onReorder(checkpoint.id, "up")}
                disabled={checkpoint.order === 0}
                className="rounded p-0.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)] transition disabled:opacity-30"
                title="Переместить выше"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => onReorder(checkpoint.id, "down")}
                disabled={checkpoint.order >= totalCheckpoints - 1}
                className="rounded p-0.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-secondary)] transition disabled:opacity-30"
                title="Переместить ниже"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Разделитель */}
      <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
        <input
          type="checkbox"
          checked={!!checkpoint.isDivider}
          onChange={(e) => onUpdate({ isDivider: e.target.checked, ...(!e.target.checked && { isEmpty: false }) })}
          className="rounded border-[var(--border-color)] accent-green-600"
        />
        Разделитель (делит маршрут)
      </label>

      {/* Без контента — только если разделитель */}
      {checkpoint.isDivider && (
        <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer ml-4">
          <input
            type="checkbox"
            checked={!!checkpoint.isEmpty}
            onChange={(e) => onUpdate({ isEmpty: e.target.checked })}
            className="rounded border-[var(--border-color)] accent-green-600"
          />
          Без контента (невидим для пользователя)
        </label>
      )}

      {checkpoint.isDivider && checkpoint.isEmpty ? (
        /* Упрощённая панель для разделителя без контента */
        <div className="rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-elevated)] p-3 text-center">
          <p className="text-xs text-[var(--text-muted)]">Невидимая метка — только разделяет маршрут</p>
        </div>
      ) : (
        <>
          {/* Название */}
          <input
            type="text"
            value={checkpoint.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Название точки"
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-green-500/50"
          />

          {/* Описание */}
          <textarea
            value={checkpoint.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Описание точки"
            rows={2}
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-green-500/50 resize-none"
          />

          {/* Настройки */}
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              Радиус (м):
              <input
                type="number"
                min="5"
                max="500"
                value={checkpoint.triggerRadiusMeters}
                onChange={(e) => onUpdate({ triggerRadiusMeters: parseInt(e.target.value) || 20 })}
                className="w-16 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2 py-1 text-sm text-[var(--text-primary)] focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              Монеты:
              <input
                type="number"
                min="0"
                value={checkpoint.coinsReward}
                onChange={(e) => onUpdate({ coinsReward: parseInt(e.target.value) || 0 })}
                className="w-16 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2 py-1 text-sm text-[var(--text-primary)] focus:outline-none"
              />
            </label>
          </div>

          {/* Фото */}
          <div>
            <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Фото</p>
            <div className="flex flex-wrap gap-2">
              {checkpoint.photos.map((url, i) => (
                <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition"
                  >
                    <Trash2 className="h-4 w-4 text-white" />
                  </button>
                </div>
              ))}
              <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-[var(--border-color)] text-[var(--text-muted)] hover:border-green-500 hover:text-green-500 transition">
                <Upload className="h-5 w-5" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Аудио */}
          <div>
            <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Аудио</p>
            {checkpoint.audio.length > 0 && (
              <AudioPlayer urls={checkpoint.audio} variant="compact" className="mb-2" />
            )}
            <div className="space-y-1">
              {checkpoint.audio.map((url, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-[var(--bg-elevated)] px-3 py-2">
                  <span className="flex-1 truncate text-xs text-[var(--text-muted)]">
                    {url.split("/").pop()}
                  </span>
                  <button onClick={() => removeAudio(i)} className="text-[var(--text-muted)] hover:text-red-500 transition">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-color)] px-3 py-2 text-xs text-[var(--text-muted)] hover:border-green-500 hover:text-green-500 transition">
              <Upload className="h-3.5 w-3.5" />
              Загрузить аудио
              <input
                type="file"
                accept="audio/mpeg,audio/wav,audio/ogg"
                onChange={handleAudioUpload}
                className="hidden"
              />
            </label>
          </div>
        </>
      )}

      {/* Цвет */}
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Цвет</p>
        <div className="flex flex-wrap gap-1.5 items-center">
          {/* Прозрачный */}
          <button
            onClick={() => onUpdate({ color: "transparent" })}
            className="rounded-full p-0.5 transition"
            style={{
              outline: checkpoint.color === "transparent" ? "2px solid #9ca3af" : "2px solid transparent",
              outlineOffset: 1,
            }}
            title="Невидимый"
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "repeating-conic-gradient(#d1d5db 0% 25%, white 0% 50%) 50% / 11px 11px",
                border: "1px solid #d1d5db",
              }}
            />
          </button>
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onUpdate({ color: c })}
              className="rounded-full p-0.5 transition"
              style={{
                outline: (checkpoint.color || "#f59e0b") === c ? `2px solid ${c}` : "2px solid transparent",
                outlineOffset: 1,
              }}
            >
              <div
                style={{ width: 22, height: 22, borderRadius: "50%", background: c }}
              />
            </button>
          ))}
          <label className="flex items-center">
            <input
              type="color"
              value={checkpoint.color === "transparent" ? "#f59e0b" : (checkpoint.color || "#f59e0b")}
              onChange={(e) => onUpdate({ color: e.target.value })}
              className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
            />
          </label>
        </div>
      </div>

      {/* Удалить точку */}
      <button
        onClick={() => { if (window.confirm("Удалить точку?")) onDelete(); }}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 px-4 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-500/10"
      >
        <Trash2 className="h-4 w-4" />
        Удалить точку
      </button>
    </div>
  );
}
