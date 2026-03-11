"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Users, Check } from "lucide-react";
import { useUser } from "./UserProvider";
import UserAvatar from "./UserAvatar";

export default function CreateGroupModal({ onClose, onCreated }) {
  const { authFetch } = useUser();
  const [name, setName] = useState("");
  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    authFetch("/api/friends")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setFriends(data.friends || []); })
      .catch(() => {});
  }, [authFetch]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name.trim()) { setError("Введите название"); return; }
    if (selected.size === 0) { setError("Выберите участников"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), memberIds: [...selected] }),
      });
      if (res.ok) {
        const group = await res.json();
        onCreated?.(group);
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || "Ошибка");
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-sm rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-xl)] overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Новая группа</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 50))}
            placeholder="Название группы..."
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--text-secondary)] transition"
          />

          <div>
            <p className="text-xs font-medium text-[var(--text-muted)] mb-2">
              Участники ({selected.size})
            </p>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {friends.map((f) => (
                <button
                  key={f.id}
                  onClick={() => toggle(f.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 transition ${
                    selected.has(f.id)
                      ? "bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/30"
                      : "hover:bg-[var(--bg-elevated)]"
                  }`}
                >
                  <UserAvatar username={f.username} avatarUrl={f.avatarUrl} size="sm" equippedItems={f.equippedItems} />
                  <span className="flex-1 text-sm text-[var(--text-primary)] text-left truncate">{f.username}</span>
                  {selected.has(f.id) && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-color)]">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
              {friends.length === 0 && (
                <p className="text-xs text-[var(--text-muted)] text-center py-4">Нет друзей</p>
              )}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full rounded-xl bg-[var(--accent-color)] py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "Создание..." : "Создать группу"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
