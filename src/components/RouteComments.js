"use client";

import { useEffect, useState, useCallback } from "react";
import { Send, Trash2, MessageCircle, Reply, ChevronDown } from "lucide-react";
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

function ReplyForm({ routeId, parentId, onReplyAdded, authFetch }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setError("");
    setSending(true);
    try {
      const res = await authFetch(`/api/routes/${routeId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, parentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      if (data.newAchievements?.length > 0) {
        window.dispatchEvent(new CustomEvent("achievement-unlocked", {
          detail: { slugs: data.newAchievements, rewardCoins: data.achievementRewardCoins },
        }));
      }
      onReplyAdded(data);
      setText("");
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-2 ml-10">
      <div className="flex gap-2">
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
            placeholder="Написать ответ..."
            rows={1}
            className="w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-4 py-2 pr-10 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition focus:border-[var(--text-secondary)] resize-none"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="absolute right-3 bottom-2 text-[var(--text-muted)] transition hover:text-green-500 disabled:opacity-30"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

function CommentItem({ comment, routeId, user, canManage, authFetch, onDelete }) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replies, setReplies] = useState(comment.replies || []);
  const [replyCount, setReplyCount] = useState(comment.replyCount || 0);
  const [loadingMore, setLoadingMore] = useState(false);

  const handleReplyAdded = (reply) => {
    setReplies((prev) => [...prev, reply]);
    setReplyCount((c) => c + 1);
    setShowReplyForm(false);
  };

  const handleDeleteReply = async (replyId) => {
    try {
      const res = await authFetch(`/api/routes/${routeId}/comments/${replyId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setReplies((prev) => prev.filter((r) => r.id !== replyId));
        setReplyCount((c) => c - 1);
      }
    } catch {
      // ignore
    }
  };

  const loadMoreReplies = async () => {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/routes/${routeId}/comments/${comment.id}/replies?limit=20&offset=${replies.length}`);
      const data = await res.json();
      if (data.replies) {
        setReplies((prev) => [...prev, ...data.replies]);
        setReplyCount(data.total);
      }
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  };

  const hasMore = replies.length < replyCount;

  return (
    <div>
      {/* Top-level коммент */}
      <div className="flex gap-2.5">
        <UserAvatar
          username={comment.username}
          avatarUrl={comment.avatarUrl}
          size="sm"
          linkToProfile
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link href={`/users/${comment.username}`} className="text-sm font-semibold text-[var(--text-primary)] hover:underline">
              {comment.username}
            </Link>
            <span className="text-[10px] text-[var(--text-muted)]">{timeAgo(comment.createdAt)}</span>
            {(user && (user.id === comment.userId || canManage)) && (
              <button
                onClick={() => onDelete(comment.id)}
                className="ml-auto text-[var(--text-muted)] hover:text-red-400 transition shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5 break-words">{comment.text}</p>
          {user && (
            <button
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="flex items-center gap-1 mt-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
            >
              <Reply className="h-3 w-3" />
              Ответить
            </button>
          )}
        </div>
      </div>

      {/* Inline reply form */}
      {showReplyForm && (
        <ReplyForm
          routeId={routeId}
          parentId={comment.id}
          onReplyAdded={handleReplyAdded}
          authFetch={authFetch}
        />
      )}

      {/* Ответы */}
      {replies.length > 0 && (
        <div className="ml-5 mt-2 pl-4 border-l-2 border-[var(--border-color)] space-y-2">
          {replies.map((r) => (
            <div key={r.id} className="flex gap-2">
              <UserAvatar
                username={r.username}
                avatarUrl={r.avatarUrl}
                size="sm"
                linkToProfile
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link href={`/users/${r.username}`} className="text-sm font-semibold text-[var(--text-primary)] hover:underline">
                    {r.username}
                  </Link>
                  <span className="text-[10px] text-[var(--text-muted)]">{timeAgo(r.createdAt)}</span>
                  {(user && (user.id === r.userId || canManage)) && (
                    <button
                      onClick={() => handleDeleteReply(r.id)}
                      className="ml-auto text-[var(--text-muted)] hover:text-red-400 transition shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-[var(--text-secondary)] mt-0.5 break-words">{r.text}</p>
              </div>
            </div>
          ))}

          {hasMore && (
            <button
              onClick={loadMoreReplies}
              disabled={loadingMore}
              className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition disabled:opacity-50"
            >
              <ChevronDown className="h-3 w-3" />
              {loadingMore ? "Загрузка..." : `Показать ещё ответов (${replyCount - replies.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
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
      if (data.newAchievements?.length > 0) {
        window.dispatchEvent(new CustomEvent("achievement-unlocked", {
          detail: { slugs: data.newAchievements, rewardCoins: data.achievementRewardCoins },
        }));
      }
      setComments((prev) => [{ ...data, replies: [], replyCount: 0 }, ...prev]);
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
        <div className="space-y-4">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              routeId={routeId}
              user={user}
              canManage={canManage}
              authFetch={authFetch}
              onDelete={handleDelete}
            />
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
