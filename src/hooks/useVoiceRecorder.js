"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export default function useVoiceRecorder({ maxDuration = 120 } = {}) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const startTimeRef = useRef(0);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    try {
      setError(null);
      setAudioBlob(null);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        cleanup();
      };

      recorder.onerror = () => {
        setError("Ошибка записи");
        setRecording(false);
        cleanup();
      };

      recorder.start(100); // Запись чанками по 100мс
      startTimeRef.current = Date.now();
      setRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);
        if (elapsed >= maxDuration) {
          recorder.stop();
          setRecording(false);
        }
      }, 200);
    } catch (err) {
      setError("Нет доступа к микрофону");
      setRecording(false);
    }
  }, [maxDuration, cleanup]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  const cancel = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    setAudioBlob(null);
    setDuration(0);
    cleanup();
  }, [cleanup]);

  const reset = useCallback(() => {
    setAudioBlob(null);
    setDuration(0);
    setError(null);
  }, []);

  return { recording, duration, audioBlob, error, start, stop, cancel, reset };
}
