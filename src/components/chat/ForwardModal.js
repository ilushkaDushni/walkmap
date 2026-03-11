"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Send } from "lucide-react";
import { useUser } from "../UserProvider";
import UserAvatar from "../UserAvatar";

export default function ForwardModal({ message, onClose }) {
  const { authFetch } = useUser();
  const [friends, setFriends] = useState([]);
  const [sending, setSending] = useState(null);
  const [sent, setSent] = useState(new Set());

  useEffect(() => {
    authFetch("/api/friends")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setFriends(data.friends || []); })
      .catch(() => {});
  }, [authFetch]);

  const handleForward = async (friend) => {
    if (sent.has(friend.id) || sending) return;
    setSending(friend.id);
    try {
      const { user } = await import("../UserProvider").then((m) => m.useUser);
      // Получаем conversationKey
      const res = await authFetch("/api/messages/conversations");
      if (res.ok) {
        const data = await res.json();
        // Определяем ключ
        const convKey = data.conversations?.find((c) => c.friendId === friend.id)?.conversationKey;
        if (convKey || friend.id) {
          const key = convKey || [friend.id].sort().join("_");
          const forwardText = `↗️ Переслано:\n${message.text || "[Медиа]"}`;
          await authFetch(`/api/messages/${key}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: forwardText }),
          });
          setSent((prev) => new Set(prev).add(friend.id));
        }
      }
    } catch { /* ignore */ }
    finally { setSending(null); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-sm rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-xl)] overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Переслать</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Preview */}
        <div className="px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-elevated)]/50">
          <p className="text-xs text-[var(--text-muted)] truncate">{message?.text || "[Медиа]"}</p>
        </div>

        <div className="max-h-60 overflow-y-auto p-2 space-y-1">
          {friends.map((f) => (
            <button
              key={f.id}
              onClick={() => handleForward(f)}
              disabled={sent.has(f.id) || sending === f.id}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 hover:bg-[var(--bg-elevated)] transition disabled:opacity-50"
            >
              <UserAvatar username={f.username} avatarUrl={f.avatarUrl} size="sm" equippedItems={f.equippedItems} />
              <span className="flex-1 text-sm text-[var(--text-primary)] text-left truncate">{f.username}</span>
              {sent.has(f.id) ? (
                <span className="text-xs text-green-500 font-medium">Отправлено</span>
              ) : sending === f.id ? (
                <span className="text-xs text-[var(--text-muted)]">...</span>
              ) : (
                <Send className="h-4 w-4 text-[var(--text-muted)]" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
