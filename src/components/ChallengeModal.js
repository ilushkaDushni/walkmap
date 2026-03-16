"use client";

import { useState, useEffect } from "react";
import { X, Swords, Coins, Clock, Search } from "lucide-react";
import { useUser } from "./UserProvider";
import UserAvatar from "./UserAvatar";

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ChallengeModal({ isOpen, onClose, routeId, routeTitle }) {
  const { user, authFetch } = useUser();
  const [friends, setFriends] = useState([]);
  const [selectedFriendId, setSelectedFriendId] = useState(null);
  const [stakeCoins, setStakeCoins] = useState(0);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen || !authFetch) return;
    authFetch("/api/friends")
      .then((r) => (r.ok ? r.json() : { friends: [] }))
      .then((d) => setFriends(d.friends || []))
      .catch(() => {});
  }, [isOpen, authFetch]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFriendId(null);
      setStakeCoins(0);
      setSearch("");
      setError("");
      setCreating(false);
      setSuccess(false);
    }
  }, [isOpen]);

  const handleCreate = async () => {
    if (!selectedFriendId) {
      setError("Выберите друга");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const res = await authFetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengedId: selectedFriendId,
          routeId,
          stakeCoins,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen || !user) return null;

  const filtered = friends.filter((f) =>
    !search || f.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[85] mx-auto max-w-md"
        style={{ animation: "lobby-spring 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)" }}
      >
        <div className="rounded-3xl bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-lg)] max-h-[80vh] overflow-y-auto">
          <button
            onClick={onClose}
            className="absolute right-6 top-6 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
          >
            <X className="h-5 w-5" />
          </button>

          {success ? (
            <div className="py-8 text-center space-y-2">
              <Swords className="h-12 w-12 mx-auto text-orange-500" />
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Вызов отправлен!</h2>
              <p className="text-sm text-[var(--text-muted)]">Ждём ответа соперника</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-4">
                <Swords className="h-8 w-8 mx-auto text-orange-500 mb-2" />
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Вызвать на дуэль</h2>
                <p className="text-xs text-[var(--text-muted)]">{routeTitle}</p>
              </div>

              {/* Поиск друга */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Найти друга..."
                  className="w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-elevated)] pl-10 pr-4 py-2.5 text-sm text-[var(--text-primary)] outline-none"
                />
              </div>

              {/* Список друзей */}
              <div className="space-y-1.5 mb-4 max-h-40 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] text-center py-4">
                    {friends.length === 0 ? "Нет друзей" : "Никого не найдено"}
                  </p>
                ) : (
                  filtered.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setSelectedFriendId(f.id)}
                      className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 transition border ${
                        selectedFriendId === f.id
                          ? "border-orange-500 bg-orange-500/10"
                          : "border-transparent bg-[var(--bg-elevated)] hover:border-[var(--border-color)]"
                      }`}
                    >
                      <UserAvatar username={f.username} avatarUrl={f.avatarUrl} size="sm" equippedItems={f.equippedItems} />
                      <span className="text-sm font-medium text-[var(--text-primary)]">{f.username}</span>
                    </button>
                  ))
                )}
              </div>

              {/* Ставка */}
              <div className="mb-4">
                <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] mb-2">
                  <Coins className="h-3.5 w-3.5" />
                  Ставка (0-500 монет)
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="range"
                    min="0"
                    max="500"
                    step="10"
                    value={stakeCoins}
                    onChange={(e) => setStakeCoins(Number(e.target.value))}
                    className="flex-1 accent-orange-500"
                  />
                  <span className="text-sm font-bold text-[var(--text-primary)] tabular-nums w-12 text-right">
                    {stakeCoins}
                  </span>
                </div>
                {stakeCoins > 0 && (
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    Победитель получит {stakeCoins * 2} монет
                  </p>
                )}
                {stakeCoins > (user.coins || 0) && (
                  <p className="text-xs text-red-400 mt-1">
                    У вас {user.coins || 0} монет
                  </p>
                )}
              </div>

              {/* Дедлайн */}
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-4">
                <Clock className="h-3.5 w-3.5" />
                Дедлайн: 48 часов
              </div>

              {error && <p className="text-xs text-red-400 text-center mb-3">{error}</p>}

              <button
                onClick={handleCreate}
                disabled={creating || !selectedFriendId || stakeCoins > (user.coins || 0)}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3 text-sm font-semibold text-white hover:bg-orange-600 transition disabled:opacity-50"
              >
                <Swords className="h-4 w-4" />
                {creating ? "Отправка..." : "Бросить вызов"}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
