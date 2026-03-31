"use client";

import { useState, useRef } from "react";
import { X, Send, Camera } from "lucide-react";
import { useUser } from "@/components/UserProvider";

export default function RoutePhotoCapture({ routeId, checkpointIndex, coordinates, onClose, onPosted }) {
  const { authFetch } = useUser();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError(null);
  };

  const handleSubmit = async () => {
    if (!file && !text.trim()) return;
    setSending(true);
    setError(null);

    const fd = new FormData();
    if (file) fd.append("file", file);
    if (text.trim()) fd.append("text", text.trim());
    fd.append("checkpointIndex", String(checkpointIndex ?? -1));
    if (coordinates) {
      fd.append("lat", String(coordinates.lat));
      fd.append("lng", String(coordinates.lng));
    }

    const res = await authFetch(`/api/routes/${routeId}/feed`, {
      method: "POST",
      body: fd,
    });

    if (res.ok) {
      onPosted?.();
      onClose();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Ошибка отправки");
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm mx-auto bg-[var(--bg-surface)] rounded-t-3xl sm:rounded-3xl p-5 pb-8 sm:pb-5 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-[var(--text-primary)]">Новая запись</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--bg-main)] text-[var(--text-muted)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Photo */}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={handleFile} />
        {preview ? (
          <div className="relative mb-3">
            <img src={preview} alt="" className="w-full rounded-xl max-h-52 object-cover" />
            <button
              onClick={() => { setFile(null); setPreview(null); }}
              className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-black/50 text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full mb-3 flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition"
          >
            <Camera className="h-8 w-8" />
            <span className="text-xs font-medium">Сделать фото или выбрать</span>
          </button>
        )}

        {/* Text */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Комментарий (необязательно)"
          maxLength={500}
          rows={2}
          className="w-full resize-none rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)] mb-3"
        />

        {error && (
          <p className="text-xs text-red-500 mb-3">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={sending || (!file && !text.trim())}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white bg-[var(--accent-color)] disabled:opacity-40 transition hover:brightness-110"
        >
          <Send className="h-4 w-4" />
          {sending ? "Отправка..." : "Опубликовать"}
        </button>
      </div>
    </div>
  );
}
