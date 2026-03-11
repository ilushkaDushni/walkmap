"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Play, Pause } from "lucide-react";

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VoiceMessage({ audioUrl, duration: totalDuration, isMe, theme }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const audioRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const updateProgress = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    setProgress(pct);
    setCurrentTime(audio.currentTime);
    if (!audio.paused) {
      animRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    } else {
      audio.play().then(() => {
        setPlaying(true);
        animRef.current = requestAnimationFrame(updateProgress);
      }).catch(() => {});
    }
  }, [playing, updateProgress]);

  const handleEnded = useCallback(() => {
    setPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    if (animRef.current) cancelAnimationFrame(animRef.current);
  }, []);

  const handleSeek = useCallback((e) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * audio.duration;
    setProgress(pct * 100);
    setCurrentTime(audio.currentTime);
  }, []);

  // Генерируем "волну" (визуализация статична, основана на хеше URL)
  const bars = 24;
  const waveform = Array.from({ length: bars }, (_, i) => {
    const hash = audioUrl ? audioUrl.charCodeAt(i % audioUrl.length) : 50;
    return 0.2 + 0.8 * ((hash * (i + 1) * 7) % 100) / 100;
  });

  const displayDuration = totalDuration || 0;
  const timeDisplay = loaded && currentTime > 0 ? formatTime(currentTime) : formatTime(displayDuration);

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onEnded={handleEnded}
        onLoadedMetadata={() => setLoaded(true)}
      />

      <button
        onClick={toggle}
        className="flex h-8 w-8 items-center justify-center rounded-full shrink-0 transition"
        style={isMe
          ? { backgroundColor: "rgba(255,255,255,0.25)" }
          : { backgroundColor: (theme?.accent || "var(--accent-color)") + "20" }
        }
      >
        {playing ? (
          <Pause className="h-3.5 w-3.5" style={isMe ? { color: "#fff" } : { color: theme?.accent || "var(--accent-color)" }} />
        ) : (
          <Play className="h-3.5 w-3.5 ml-0.5" style={isMe ? { color: "#fff" } : { color: theme?.accent || "var(--accent-color)" }} />
        )}
      </button>

      <div className="flex-1 min-w-0">
        {/* Waveform */}
        <div
          className="flex items-center gap-[1px] h-6 cursor-pointer"
          onClick={handleSeek}
        >
          {waveform.map((h, i) => {
            const filled = progress > (i / bars) * 100;
            return (
              <div
                key={i}
                className="flex-1 rounded-full transition-colors duration-150"
                style={{
                  height: `${h * 100}%`,
                  minWidth: "2px",
                  backgroundColor: isMe
                    ? filled ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)"
                    : filled ? (theme?.accent || "var(--accent-color)") : "var(--border-color)",
                }}
              />
            );
          })}
        </div>

        <span
          className="text-xs mt-0.5 block"
          style={isMe ? { color: "rgba(255,255,255,0.6)" } : { color: "var(--text-muted)" }}
        >
          {timeDisplay}
        </span>
      </div>
    </div>
  );
}
