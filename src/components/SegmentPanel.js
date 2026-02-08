"use client";

import { useUser } from "@/components/UserProvider";
import { Trash2, X, Upload } from "lucide-react";
import { validateFile } from "@/lib/validateFile";
import AudioPlayer from "@/components/AudioPlayer";

export default function SegmentPanel({ segment, onUpdate, onDelete, onClose }) {
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
      if (url) onUpdate({ photos: [...(segment.photos || []), url] });
    }
    e.target.value = "";
  };

  const handleAudioUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const v = validateFile(file, "audio");
    if (!v.ok) { alert(v.error); e.target.value = ""; return; }
    const url = await uploadFile(file, "audio");
    if (url) onUpdate({ audio: [...segment.audio, url] });
    e.target.value = "";
  };

  const removePhoto = (index) => {
    onUpdate({ photos: (segment.photos || []).filter((_, i) => i !== index) });
  };

  const removeAudio = (index) => {
    onUpdate({ audio: segment.audio.filter((_, i) => i !== index) });
  };


  return (
    <div className="p-4 space-y-3">
      {/* Шапка */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">
          Отрезок #{segment.pathIndex + 1}
        </h3>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Заголовок */}
      <input
        type="text"
        value={segment.title}
        onChange={(e) => onUpdate({ title: e.target.value })}
        placeholder="Заголовок отрезка"
        className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-green-500/50"
      />

      {/* Текст */}
      <textarea
        value={segment.text}
        onChange={(e) => onUpdate({ text: e.target.value })}
        placeholder="Нарративный текст отрезка..."
        rows={8}
        className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-green-500/50 resize-y"
      />

      {/* Фото */}
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Фото</p>
        <div className="flex flex-wrap gap-2">
          {(segment.photos || []).map((url, i) => (
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
        {segment.audio.length > 0 && (
          <AudioPlayer urls={segment.audio} variant="compact" className="mb-2" />
        )}
        <div className="space-y-1">
          {segment.audio.map((url, i) => (
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

      {/* Удалить отрезок */}
      <button
        onClick={() => { if (window.confirm("Удалить отрезок?")) onDelete(); }}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 px-4 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-500/10"
      >
        <Trash2 className="h-4 w-4" />
        Удалить отрезок
      </button>
    </div>
  );
}
