"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Copy, Play, Users, Trophy, LogOut, UserPlus, Check, Loader } from "lucide-react";
import { useUser } from "./UserProvider";
import UserAvatar from "./UserAvatar";
import useLobbyHost from "@/hooks/useLobbyHost";
import useLobbyParticipant from "@/hooks/useLobbyParticipant";

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Скопировано" : "Копировать"}
    </button>
  );
}

export default function LobbyModal({ isOpen, onClose, lobbyId, isHost }) {
  const { user, authFetch } = useUser();
  const [screen, setScreen] = useState("loading"); // loading | waiting | active | results | create | join
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [currentLobbyId, setCurrentLobbyId] = useState(lobbyId);
  const [results, setResults] = useState(null);
  const [friends, setFriends] = useState([]);
  const [invitedIds, setInvitedIds] = useState(new Set());

  const hostHook = useLobbyHost(currentLobbyId, { enabled: isHost && screen === "active" });
  const participantHook = useLobbyParticipant(currentLobbyId, {
    enabled: !!currentLobbyId && screen !== "results" && screen !== "create" && screen !== "join",
  });

  const lobbyState = participantHook.lobbyState;

  // Определяем экран по состоянию лобби
  useEffect(() => {
    if (!lobbyState) return;
    if (lobbyState.status === "waiting") setScreen("waiting");
    else if (lobbyState.status === "active") setScreen("active");
    else if (lobbyState.status === "completed") setScreen("results");
  }, [lobbyState?.status]);

  // Начальный экран
  useEffect(() => {
    if (!isOpen) return;
    if (currentLobbyId) {
      setScreen("loading");
    } else {
      setScreen("create");
    }
  }, [isOpen, currentLobbyId]);

  // Загрузить маршруты для создания
  useEffect(() => {
    if (screen !== "create" || !authFetch) return;
    authFetch("/api/routes?status=published&limit=50")
      .then((r) => r.ok ? r.json() : { routes: [] })
      .then((d) => setRoutes(d.routes || []))
      .catch(() => {});
  }, [screen, authFetch]);

  // Загрузить друзей для приглашения
  useEffect(() => {
    if (!["waiting"].includes(screen) || !authFetch || !isHost) return;
    authFetch("/api/friends")
      .then((r) => r.ok ? r.json() : { friends: [] })
      .then((d) => setFriends(d.friends || []))
      .catch(() => {});
  }, [screen, authFetch, isHost]);

  const handleCreate = async () => {
    if (!selectedRouteId) { setError("Выберите маршрут"); return; }
    setCreating(true);
    setError("");
    try {
      const res = await authFetch("/api/lobbies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeId: selectedRouteId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setCurrentLobbyId(data.id);
      setScreen("waiting");
      window.dispatchEvent(new CustomEvent("lobby-created", { detail: data }));
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    if (joinCode.length !== 6) { setError("Введите 6-символьный код"); return; }
    setError("");
    try {
      const res = await authFetch("/api/lobbies/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setCurrentLobbyId(data.id);
      setScreen("waiting");
      window.dispatchEvent(new CustomEvent("lobby-joined", { detail: data }));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleStart = async () => {
    const ok = await hostHook.startLobby();
    if (ok) setScreen("active");
  };

  const handleComplete = async () => {
    const data = await hostHook.completeLobby();
    if (data) {
      setResults(data);
      setScreen("results");
    }
  };

  const handleLeave = async () => {
    if (isHost) {
      await hostHook.leaveLobby();
    } else {
      await participantHook.leaveLobby();
    }
    setCurrentLobbyId(null);
    window.dispatchEvent(new Event("lobby-left"));
    onClose();
  };

  const handleInvite = async (friendId) => {
    if (!currentLobbyId) return;
    try {
      await authFetch(`/api/lobbies/${currentLobbyId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId }),
      });
      setInvitedIds((prev) => new Set([...prev, friendId]));
    } catch {}
  };

  if (!isOpen || !user) return null;

  const backdrop = (
    <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm" onClick={onClose} />
  );

  const modal = (children) => (
    <>
      {backdrop}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[85] mx-auto max-w-md"
        style={{ animation: "lobby-spring 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)" }}
      >
        <div className="rounded-3xl bg-[var(--bg-surface)] p-6 shadow-2xl transition-colors max-h-[80vh] overflow-y-auto">
          <button
            onClick={onClose}
            className="absolute right-6 top-6 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
          >
            <X className="h-5 w-5" />
          </button>
          {children}
        </div>
      </div>
      <style jsx global>{`
        @keyframes lobby-spring {
          0% { transform: translate(0, -50%) scale(0.3); opacity: 0; }
          60% { transform: translate(0, -50%) scale(1.05); opacity: 1; }
          80% { transform: translate(0, -50%) scale(0.98); }
          100% { transform: translate(0, -50%) scale(1); }
        }
      `}</style>
    </>
  );

  // === Экран: Создание ===
  if (screen === "create") {
    return modal(
      <>
        <h2 className="text-lg font-bold text-[var(--text-primary)] text-center mb-4">Создать лобби</h2>

        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
          {routes.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-4">Нет доступных маршрутов</p>
          ) : (
            routes.map((r) => (
              <button
                key={r._id || r.id}
                onClick={() => setSelectedRouteId(r._id || r.id)}
                className={`w-full text-left rounded-2xl px-4 py-3 transition border ${
                  selectedRouteId === (r._id || r.id)
                    ? "border-green-500 bg-green-500/10"
                    : "border-[var(--border-color)] bg-[var(--bg-elevated)] hover:border-[var(--text-muted)]"
                }`}
              >
                <p className="text-sm font-medium text-[var(--text-primary)]">{r.title}</p>
                {r.distance && (
                  <p className="text-xs text-[var(--text-muted)]">{(r.distance / 1000).toFixed(1)} км</p>
                )}
              </button>
            ))
          )}
        </div>

        {/* Или войти по коду */}
        <div className="border-t border-[var(--border-color)] pt-4 mt-4">
          <p className="text-xs text-[var(--text-muted)] text-center mb-2">Или войти по коду</p>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={6}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="ABCDEF"
              className="flex-1 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--text-primary)] text-center tracking-widest placeholder:text-[var(--text-muted)] outline-none"
            />
            <button
              onClick={handleJoin}
              disabled={joinCode.length !== 6}
              className="rounded-2xl bg-purple-500 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-600 transition disabled:opacity-50"
            >
              Войти
            </button>
          </div>
        </div>

        {error && <p className="text-center text-xs text-red-400 mt-2">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={creating || !selectedRouteId}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-green-500 py-3 text-sm font-semibold text-white hover:bg-green-600 transition disabled:opacity-50"
        >
          <Users className="h-4 w-4" />
          {creating ? "Создание..." : "Создать лобби"}
        </button>
      </>
    );
  }

  // === Экран: Загрузка ===
  if (screen === "loading") {
    return modal(
      <div className="py-8 text-center">
        <Loader className="h-8 w-8 mx-auto text-[var(--text-muted)] animate-spin" />
        <p className="text-sm text-[var(--text-muted)] mt-3">Загрузка лобби...</p>
      </div>
    );
  }

  // === Экран: Ожидание ===
  if (screen === "waiting" && lobbyState) {
    return modal(
      <>
        <h2 className="text-lg font-bold text-[var(--text-primary)] text-center mb-1">
          {lobbyState.routeTitle || "Лобби"}
        </h2>

        {/* Код */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="text-2xl font-mono font-bold tracking-[0.3em] text-[var(--text-primary)]">
            {lobbyState.joinCode}
          </span>
          <CopyButton text={lobbyState.joinCode} />
        </div>

        {/* Участники */}
        <div className="space-y-2 mb-4">
          <p className="text-xs font-medium text-[var(--text-muted)]">
            Участники ({lobbyState.participants.length}/{lobbyState.maxParticipants})
          </p>
          {lobbyState.participants.map((p) => (
            <div key={p.userId} className="flex items-center gap-2 rounded-xl bg-[var(--bg-elevated)] px-3 py-2">
              <UserAvatar username={p.username} avatarUrl={p.avatarUrl} size="sm" />
              <span className="text-sm text-[var(--text-primary)]">{p.username}</span>
              {p.userId === lobbyState.hostId && (
                <span className="text-[10px] text-amber-500 font-medium ml-auto">Хост</span>
              )}
            </div>
          ))}
        </div>

        {/* Пригласить друзей (только хост) */}
        {isHost && friends.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Пригласить друзей</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {friends.map((f) => {
                const alreadyIn = lobbyState.participants.some((p) => p.userId === f.id);
                const invited = invitedIds.has(f.id);
                return (
                  <div key={f.id} className="flex items-center gap-2 rounded-xl bg-[var(--bg-elevated)] px-3 py-2">
                    <UserAvatar username={f.username} avatarUrl={f.avatarUrl} size="sm" />
                    <span className="text-sm text-[var(--text-secondary)] flex-1">{f.username}</span>
                    {alreadyIn ? (
                      <span className="text-[10px] text-green-500">В лобби</span>
                    ) : invited ? (
                      <span className="text-[10px] text-[var(--text-muted)]">Приглашён</span>
                    ) : (
                      <button
                        onClick={() => handleInvite(f.id)}
                        className="flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] text-purple-500 font-medium hover:bg-purple-500/20 transition"
                      >
                        <UserPlus className="h-3 w-3" />
                        Пригласить
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleLeave}
            className="flex-1 rounded-2xl border border-[var(--border-color)] py-3 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition"
          >
            Выйти
          </button>
          {isHost && (
            <button
              onClick={handleStart}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-green-500 py-3 text-sm font-semibold text-white hover:bg-green-600 transition"
            >
              <Play className="h-4 w-4" />
              Старт
            </button>
          )}
        </div>
      </>
    );
  }

  // === Экран: Активное прохождение ===
  if (screen === "active" && lobbyState) {
    const progress = Math.round((lobbyState.hostState?.progress || 0) * 100);

    return modal(
      <>
        <h2 className="text-lg font-bold text-[var(--text-primary)] text-center mb-2">
          Прохождение
        </h2>

        {/* Прогресс */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
            <span>Прогресс</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--bg-elevated)]">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Предупреждение о хосте */}
        {lobbyState.hostOffline && (
          <div className="mb-3 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2 text-xs text-red-400 text-center">
            Хост не отвечает. Ожидание переподключения...
          </div>
        )}

        {/* Участники */}
        <div className="space-y-2 mb-4">
          {lobbyState.participants.map((p) => (
            <div key={p.userId} className="flex items-center gap-2 rounded-xl bg-[var(--bg-elevated)] px-3 py-2">
              <UserAvatar username={p.username} avatarUrl={p.avatarUrl} size="sm" />
              <span className="text-sm text-[var(--text-primary)]">{p.username}</span>
              {p.userId === lobbyState.hostId && (
                <span className="text-[10px] text-amber-500 font-medium ml-auto">Хост</span>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleLeave}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-red-400/30 py-3 text-sm font-semibold text-red-400 hover:bg-red-400/10 transition"
          >
            <LogOut className="h-4 w-4" />
            Выйти
          </button>
          {isHost && (
            <button
              onClick={handleComplete}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-green-500 py-3 text-sm font-semibold text-white hover:bg-green-600 transition"
            >
              <Trophy className="h-4 w-4" />
              Завершить
            </button>
          )}
        </div>
      </>
    );
  }

  // === Экран: Результаты ===
  if (screen === "results" && results) {
    return modal(
      <>
        <div className="text-center mb-4">
          <Trophy className="h-12 w-12 mx-auto text-amber-500 mb-2" />
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Маршрут пройден!</h2>
          <p className="text-sm text-[var(--text-muted)]">{results.routeTitle}</p>
        </div>

        <div className="space-y-2 mb-4">
          {results.results?.map((r) => (
            <div key={r.userId} className="flex items-center gap-3 rounded-2xl bg-[var(--bg-elevated)] px-4 py-3">
              <span className="text-sm font-semibold text-[var(--text-primary)] flex-1">{r.username}</span>
              <div className="text-right">
                {!r.alreadyCompleted && (
                  <p className="text-sm text-yellow-500 font-medium">+{r.coins} монет</p>
                )}
                {r.newAchievements?.length > 0 && (
                  <p className="text-xs text-purple-500">+{r.newAchievements.length} ачивок</p>
                )}
                {r.alreadyCompleted && (
                  <p className="text-xs text-[var(--text-muted)]">Уже пройден</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            setCurrentLobbyId(null);
            setResults(null);
            window.dispatchEvent(new Event("lobby-left"));
            onClose();
          }}
          className="flex w-full items-center justify-center rounded-2xl bg-[var(--text-primary)] py-3 text-sm font-semibold text-[var(--bg-surface)] hover:opacity-90 transition"
        >
          Отлично!
        </button>
      </>
    );
  }

  // Fallback: загрузка
  return modal(
    <div className="py-8 text-center">
      <Loader className="h-8 w-8 mx-auto text-[var(--text-muted)] animate-spin" />
    </div>
  );
}
