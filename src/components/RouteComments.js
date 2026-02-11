"use client";

import { useEffect, useState, useCallback } from "react";
import { Send, Trash2, MessageCircle } from "lucide-react";
import { useUser } from "./UserProvider";
import UserAvatar from "./UserAvatar";
import Link from "next/link";

function timeAgo(date) {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "только что";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days} дн назад`;
  const months = Math.floor(days / 30);
  return `${months} мес назад`;
}

export default function RouteComments({ routeId }) {
  const { user, authFetch, hasPermission } = useUser();
  const [comments, setComments] = useState([]);
  const [total, setTotal] = useState(0);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const loadComments = useCallback(async (offset = 0) => {
    try {
      const res = await fetch(`/api/routes/${routeId}/comments?limit=20&offset=${offset}`);
      const data = await res.json();
      if (offset === 0) {
        setComments(data.comments || []);
      } else {
        setComments((prev) => [...prev, ...(data.comments || [])]);
      }
      setTotal(data.total || 0);
    } catch {
      // ignore
    }
  }, [routeId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setError("");
    setSending(true);
    try {
      const res = await authFetch(`/api/routes/${routeId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setComments((prev) => [data, ...prev]);
      setTotal((t) => t + 1);
      setText("");
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId) => {
    try {
      const res = await authFetch(`/api/routes/${routeId}/comments/${commentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        setTotal((t) => t - 1);
      }
    } catch {
      // ignore
    }
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await loadComments(comments.length);
    setLoadingMore(false);
  };

  const canManage = hasPermission("comments.manage");

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="h-5 w-5 text-[var(--text-secondary)]" />
        <h2 className="text-lg font-bold text-[var(--text-primary)]">
          Комментарии{total > 0 && <span className="text-[var(--text-muted)] font-normal ml-1">({total})</span>}
        </h2>
      </div>

      {/* Form */}
      {user ? (
        <div className="mb-4">
          <div className="flex gap-2">
            <UserAvatar
              username={user.username}
              avatarUrl={user.avatarUrl}
              roleColor={user.roles?.[0]?.color}
              size="sm"
            />
            <div className="flex-1 relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 500))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Написать комментарий..."
                rows={2}
                className="w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-2.5 pr-12 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition focus:border-[var(--text-secondary)] resize-none"
              />
              <button
                onClick={handleSend}
                disabled={!text.trim() || sending}
                className="absolute right-3 bottom-2.5 text-[var(--text-muted)] transition hover:text-green-500 disabled:opacity-30"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between mt-1 ml-10">
            {error && <span className="text-xs text-red-400">{error}</span>}
            <span className="text-[10px] text-[var(--text-muted)] ml-auto">{text.length}/500</span>
          </div>
        </div>
      ) : (
        <div className="mb-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-3 text-center">
          <button
            onClick={() => window.dispatchEvent(new Event("open-profile-modal"))}
            className="text-sm text-green-500 font-medium hover:underline"
          >
            Войдите, чтобы оставить комментарий
          </button>
        </div>
      )}

      {/* Comments list */}
      {comments.length === 0 ? (
        <div className="py-6 text-center text-sm text-[var(--text-muted)]">
          Пока нет комментариев. Будьте первым!
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <UserAvatar
                username={c.username}
                avatarUrl={c.avatarUrl}
                size="sm"
                linkToProfile
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link href={`/users/${c.username}`} className="text-sm font-semibold text-[var(--text-primary)] hover:underline">
                    {c.username}
                  </Link>
                  <span className="text-[10px] text-[var(--text-muted)]">{timeAgo(c.createdAt)}</span>
                  {(user && (user.id === c.userId || canManage)) && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="ml-auto text-[var(--text-muted)] hover:text-red-400 transition shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-[var(--text-secondary)] mt-0.5 break-words">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {comments.length < total && (
        <button
          onClick={handleLoadMore}
          disabled={loadingMore}
          className="mt-3 w-full text-center text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition disabled:opacity-50"
        >
          {loadingMore ? "Загрузка..." : "Показать ещё"}
        </button>
      )}
    </div>
  );
}
