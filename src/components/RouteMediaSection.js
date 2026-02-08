"use client";

import { useUser } from "@/components/UserProvider";
import { Upload, Trash2, Image } from "lucide-react";
import { validateFile } from "@/lib/validateFile";
import AudioPlayer from "@/components/AudioPlayer";

export default function RouteMediaSection({ route, updateRoute }) {
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

  // Обложка
  const handleCoverUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const v = validateFile(file, "photo");
    if (!v.ok) { alert(v.error); e.target.value = ""; return; }
    const url = await uploadFile(file, "photo");
    if (url) updateRoute({ ...route, coverImage: url });
    e.target.value = "";
  };

  // Фото маршрута
  const handlePhotosUpload = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const v = validateFile(file, "photo");
      if (!v.ok) { alert(v.error); continue; }
      const url = await uploadFile(file, "photo");
      if (url) {
        updateRoute((prev) => ({ ...prev, photos: [...prev.photos, url] }));
      }
    }
    e.target.value = "";
  };

  const removePhoto = (index) => {
    updateRoute({ ...route, photos: route.photos.filter((_, i) => i !== index) });
  };

  // Аудио маршрута
  const handleAudioUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const v = validateFile(file, "audio");
    if (!v.ok) { alert(v.error); e.target.value = ""; return; }
    const url = await uploadFile(file, "audio");
    if (url) updateRoute({ ...route, audio: [...route.audio, url] });
    e.target.value = "";
  };

  const removeAudio = (index) => {
    updateRoute({ ...route, audio: route.audio.filter((_, i) => i !== index) });
  };


  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 space-y-4">
      <h3 className="text-sm font-bold text-[var(--text-primary)]">Медиа маршрута</h3>

      {/* Обложка */}
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Обложка</p>
        <div className="flex items-center gap-3">
          {route.coverImage ? (
            <div className="relative h-20 w-32 rounded-xl overflow-hidden">
              <img src={route.coverImage} alt="" className="h-full w-full object-cover" />
              <button
                onClick={() => updateRoute({ ...route, coverImage: "" })}
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition"
              >
                <Trash2 className="h-5 w-5 text-white" />
              </button>
            </div>
          ) : (
            <label className="flex h-20 w-32 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-[var(--border-color)] text-[var(--text-muted)] hover:border-green-500 hover:text-green-500 transition">
              <div className="flex flex-col items-center gap-1">
                <Image className="h-6 w-6" />
                <span className="text-[10px]">Обложка</span>
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleCoverUpload}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {/* Фото */}
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Фото маршрута</p>
        <div className="flex flex-wrap gap-2">
          {route.photos.map((url, i) => (
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
              onChange={handlePhotosUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Аудио */}
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Аудио маршрута</p>
        {route.audio.length > 0 && (
          <AudioPlayer urls={route.audio} variant="compact" className="mb-2" />
        )}
        <div className="space-y-1">
          {route.audio.map((url, i) => (
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
          <input type="file" accept="audio/mpeg,audio/wav,audio/ogg" onChange={handleAudioUpload} className="hidden" />
        </label>
      </div>
    </div>
  );
}
