"use client";

import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import useAudioPlayer from "@/hooks/useAudioPlayer";

function formatTime(sec) {
  if (!sec || !isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const RATES = [0.75, 1, 1.25, 1.5];

export default function AudioPlayer({
  urls,
  autoPlay = false,
  variant = "full",
  onEnded,
  className = "",
}) {
  const {
    isPlaying,
    currentTime,
    duration,
    totalCurrentTime,
    totalDuration,
    trackIndex,
    trackCount,
    playbackRate,
    togglePlay,
    seek,
    nextTrack,
    prevTrack,
    setPlaybackRate,
  } = useAudioPlayer({ urls, autoPlay, onEnded });

  if (!urls || urls.length === 0) return null;

  const showPlaylist = trackCount > 1;
  const isFull = variant === "full";

  // Прогресс: для full с несколькими треками показываем общий, иначе текущий трек
  const progressTime = isFull && showPlaylist ? totalCurrentTime : currentTime;
  const progressMax = isFull && showPlaylist ? totalDuration : duration;
  const progressPct = progressMax > 0 ? (progressTime / progressMax) * 100 : 0;

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));

    if (isFull && showPlaylist) {
      // Для общего прогресса seek в рамках текущего трека
      const targetTime = pct * totalDuration;
      // Найти трек и позицию
      let acc = 0;
      for (let i = 0; i < trackCount; i++) {
        const d = urls.length; // просто seek в текущем треке
        if (targetTime <= acc + (duration || 0) || i === trackIndex) {
          seek(Math.max(0, targetTime - acc));
          break;
        }
        acc += duration;
      }
      // Простой fallback: seek в текущем треке пропорционально
      seek(pct * (duration || 0));
    } else {
      seek(pct * (duration || 0));
    }
  };

  // === COMPACT ===
  if (!isFull) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <button
          onClick={togglePlay}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-color)] text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)]"
        >
          {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
        </button>

        <div
          className="flex-1 h-1.5 rounded-full bg-[var(--bg-elevated)] cursor-pointer relative"
          onClick={handleSeek}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-green-600 transition-[width] duration-100"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <span className="shrink-0 text-[10px] tabular-nums text-[var(--text-muted)]">
          {formatTime(currentTime)}/{formatTime(duration)}
        </span>
      </div>
    );
  }

  // === FULL ===
  return (
    <div className={`rounded-xl bg-[var(--bg-elevated)] p-3 space-y-2 ${className}`}>
      {/* Верхняя строка: play + seekbar + время */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-600 text-white transition hover:bg-green-700 active:bg-green-800"
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>

        <div className="flex-1 flex flex-col gap-1">
          <div
            className="h-2 rounded-full bg-[var(--bg-surface)] cursor-pointer relative"
            onClick={handleSeek}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-green-600 transition-[width] duration-100"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] tabular-nums text-[var(--text-muted)]">
            <span>{formatTime(isFull && showPlaylist ? totalCurrentTime : currentTime)}</span>
            <span>{formatTime(isFull && showPlaylist ? totalDuration : duration)}</span>
          </div>
        </div>
      </div>

      {/* Нижняя строка: speed + треки */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {RATES.map((rate) => (
            <button
              key={rate}
              onClick={() => setPlaybackRate(rate)}
              className={`rounded-lg px-2 py-0.5 text-[11px] font-medium transition ${
                playbackRate === rate
                  ? "bg-green-600 text-white"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-surface)]"
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>

        {showPlaylist && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={prevTrack}
              disabled={trackIndex === 0}
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition disabled:opacity-30"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
              {trackIndex + 1}/{trackCount}
            </span>
            <button
              onClick={nextTrack}
              disabled={trackIndex >= trackCount - 1}
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition disabled:opacity-30"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
