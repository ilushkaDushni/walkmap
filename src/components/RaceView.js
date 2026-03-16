"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Flag, Clock, MapPin, Trophy } from "lucide-react";
import { useUser } from "./UserProvider";
import UserAvatar from "./UserAvatar";
import RaceCountdown from "./RaceCountdown";
import useRaceParticipant from "@/hooks/useRaceParticipant";

function formatTimer(sec) {
  if (sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDuration(sec) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Экран активной гонки.
 * Props: lobbyState, isHost, onComplete (хост вызывает для завершения гонки)
 */
export default function RaceView({ lobbyState, isHost, onComplete, onLeave }) {
  const { user } = useUser();
  const [countdownDone, setCountdownDone] = useState(false);
  const [timer, setTimer] = useState(0);
  const [myFinish, setMyFinish] = useState(null);

  const userId = user?._id || user?.id;
  const raceState = lobbyState?.raceState;
  const startedAt = raceState?.startedAt;
  const participants = lobbyState?.participants || [];
  const participantStates = lobbyState?.participantStates || {};
  const finishedList = raceState?.finishedParticipants || [];
  const finishedIds = new Set(finishedList.map((f) => f.userId));

  const raceParticipant = useRaceParticipant(lobbyState?.id, {
    enabled: countdownDone && !myFinish,
  });

  // Countdown
  useEffect(() => {
    if (!startedAt) return;
    const startTime = new Date(startedAt).getTime();
    if (Date.now() >= startTime) {
      setCountdownDone(true);
    }
  }, [startedAt]);

  // Timer
  useEffect(() => {
    if (!countdownDone || !startedAt) return;
    const startTime = new Date(startedAt).getTime();
    const tick = () => {
      setTimer(Math.floor((Date.now() - startTime) / 1000));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [countdownDone, startedAt]);

  // Check if I already finished
  useEffect(() => {
    if (finishedIds.has(userId)) {
      const f = finishedList.find((p) => p.userId === userId);
      if (f && !myFinish) setMyFinish(f);
    }
  }, [finishedList, userId, myFinish]);

  // Handle finish attempt
  const handleFinish = useCallback(async () => {
    const result = await raceParticipant.finishRace();
    if (result?.ok) {
      setMyFinish(result);
    } else if (result?.error) {
      alert(result.error);
    }
  }, [raceParticipant]);

  // Sort participants by progress (desc) then by finish place
  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      const aFinished = finishedList.find((f) => f.userId === a.userId);
      const bFinished = finishedList.find((f) => f.userId === b.userId);
      if (aFinished && bFinished) return aFinished.place - bFinished.place;
      if (aFinished) return -1;
      if (bFinished) return 1;
      const aProgress = participantStates[a.userId]?.progress || 0;
      const bProgress = participantStates[b.userId]?.progress || 0;
      return bProgress - aProgress;
    });
  }, [participants, finishedList, participantStates]);

  const allFinished = finishedList.length >= participants.length;

  return (
    <div className="space-y-4">
      {/* Countdown overlay */}
      {!countdownDone && startedAt && (
        <RaceCountdown startedAt={startedAt} onComplete={() => setCountdownDone(true)} />
      )}

      {/* Timer */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 text-3xl font-mono font-bold text-[var(--text-primary)] tabular-nums">
          <Clock className="h-6 w-6 text-[var(--text-muted)]" />
          {formatTimer(timer)}
        </div>
        {myFinish && (
          <p className="text-sm font-semibold text-green-500 mt-1">
            Финиш! Место: #{myFinish.place} ({formatDuration(myFinish.duration)})
          </p>
        )}
      </div>

      {/* Participants progress */}
      <div className="space-y-2">
        {sortedParticipants.map((p, idx) => {
          const state = participantStates[p.userId];
          const progress = Math.round((state?.progress || 0) * 100);
          const finished = finishedList.find((f) => f.userId === p.userId);
          const isMe = p.userId === userId;

          return (
            <div
              key={p.userId}
              className={`rounded-2xl border px-3 py-2.5 ${
                isMe ? "border-green-500/30 bg-green-500/5" : "border-[var(--border-color)] bg-[var(--bg-elevated)]"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                {finished && (
                  <span className={`text-xs font-bold ${
                    finished.place === 1 ? "text-amber-500" :
                    finished.place === 2 ? "text-gray-400" :
                    finished.place === 3 ? "text-orange-600" :
                    "text-[var(--text-muted)]"
                  }`}>
                    #{finished.place}
                  </span>
                )}
                <UserAvatar username={p.username} avatarUrl={p.avatarUrl} size="xs" equippedItems={p.equippedItems} />
                <span
                  className="text-sm font-medium truncate"
                  style={{ color: p.equippedItems?.usernameColor?.cssData?.color || "var(--text-primary)" }}
                >
                  {p.username}
                  {isMe && " (вы)"}
                </span>
                <span className="text-xs text-[var(--text-muted)] ml-auto tabular-nums">
                  {finished ? formatDuration(finished.duration) : `${progress}%`}
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-[var(--bg-surface)]">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    finished ? "bg-green-500" :
                    isMe ? "bg-blue-500" : "bg-[var(--text-muted)]"
                  }`}
                  style={{ width: `${finished ? 100 : progress}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* GPS error */}
      {raceParticipant.error && (
        <p className="text-xs text-red-400 text-center">{raceParticipant.error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {/* Finish button */}
        {!myFinish && countdownDone && (
          <button
            onClick={handleFinish}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-green-500 py-3 text-sm font-semibold text-white hover:bg-green-600 transition"
          >
            <Flag className="h-4 w-4" />
            Финиш!
          </button>
        )}

        {/* Host: end race when all finished */}
        {isHost && allFinished && (
          <button
            onClick={onComplete}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3 text-sm font-semibold text-white hover:bg-amber-600 transition"
          >
            <Trophy className="h-4 w-4" />
            Завершить гонку
          </button>
        )}

        {/* Host: can force end if not all finished */}
        {isHost && !allFinished && finishedList.length > 0 && (
          <button
            onClick={onComplete}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-amber-500/30 py-3 text-xs font-semibold text-amber-500 hover:bg-amber-500/10 transition"
          >
            Завершить ({finishedList.length}/{participants.length})
          </button>
        )}
      </div>
    </div>
  );
}
