"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export default function useAudioPlayer({ urls = [], autoPlay = false, onEnded }) {
  const audioRef = useRef(null);
  const [trackIndex, setTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [durations, setDurations] = useState([]); // длительности всех треков

  const trackCount = urls.length;

  // Предзагрузка длительностей всех треков
  useEffect(() => {
    if (urls.length === 0) {
      setDurations([]);
      return;
    }

    let cancelled = false;
    const loaded = new Array(urls.length).fill(0);

    urls.forEach((url, i) => {
      const a = new Audio();
      a.preload = "metadata";
      a.onloadedmetadata = () => {
        if (cancelled) return;
        loaded[i] = a.duration;
        setDurations([...loaded]);
      };
      a.src = url;
    });

    return () => { cancelled = true; };
  }, [urls]);

  // Суммарное время по плейлисту
  const totalDuration = durations.reduce((s, d) => s + d, 0);
  const totalCurrentTime =
    durations.slice(0, trackIndex).reduce((s, d) => s + d, 0) + currentTime;

  // Создать/пересоздать Audio при смене urls или trackIndex
  useEffect(() => {
    if (urls.length === 0) return;

    const url = urls[trackIndex];
    if (!url) return;

    // Уничтожить предыдущий
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    const audio = new Audio(url);
    audio.playbackRate = playbackRate;
    audioRef.current = audio;
    setIsLoading(true);
    setCurrentTime(0);
    setDuration(0);

    const onLoadedMeta = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onEnding = () => {
      if (trackIndex < urls.length - 1) {
        setTrackIndex((i) => i + 1);
      } else {
        setIsPlaying(false);
        onEnded?.();
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener("loadedmetadata", onLoadedMeta);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnding);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    // Автоплей при первом треке + autoPlay, или при переключении трека во время воспроизведения
    const shouldPlay = (trackIndex === 0 && autoPlay) || (trackIndex > 0);
    if (shouldPlay) {
      audio.play().catch(() => {
        setIsPlaying(false);
      });
    }

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMeta);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnding);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.pause();
      audio.src = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls, trackIndex]);

  // Применить playbackRate к текущему Audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, []);

  const seek = useCallback((seconds) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || 0));
  }, []);

  const nextTrack = useCallback(() => {
    if (trackIndex < urls.length - 1) setTrackIndex((i) => i + 1);
  }, [trackIndex, urls.length]);

  const prevTrack = useCallback(() => {
    if (trackIndex > 0) setTrackIndex((i) => i - 1);
  }, [trackIndex]);

  const setPlaybackRate = useCallback((rate) => {
    setPlaybackRateState(rate);
  }, []);

  return {
    isPlaying,
    isLoading,
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
  };
}
