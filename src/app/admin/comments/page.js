"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/UserProvider";
import { ArrowLeft, Search, Trash2, MessageCircle } from "lucide-react";

export default function AdminCommentsPage() {
  const { user, loading, authFetch, hasPermission } = useUser();
  const router = useRouter();
  const [comments, setComments] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [skip, setSkip] = useState(0);

  useEffect(() => {
    if (!loading && !hasPermission("comments.manage")) {
      router.replace("/");
    }
  }, [user, loading, router, hasPermission]);

  const fetchComments = useCallback(async (reset = false) => {
    const currentSkip = reset ? 0 : skip;
    const params = new URLSearchParams({ skip: currentSkip.toString() });
    if (search.trim()) params.set("q", search.trim());

    const res = await authFetch(`/api/admin/comments?${params}`);
    if (res.ok) {
      const data = await res.json();
      if (reset) {
        setComments(data.items);
        setSkip(data.items.length);
      } else {
        setComments((prev) => [...prev, ...data.items]);
        setSkip(currentSkip + data.items.length);
      }
      setTotal(data.total);
    }
    setLoadingData(false);
  }, [authFetch, search, skip]);

  useEffect(() => {
    if (hasPermission("comments.manage")) {
      setLoadingData(true);
      setSkip(0);
      fetchComments(true);
    }
  }, [user, search, hasPermission, authFetch]);

  const handleDelete = async (commentId) => {
    if (!confirm("Удалить комментарий? Ответы тоже будут удалены.")) return;
    const res = await authFetch(`/api/admin/comments/${commentId}`, { method: "DELETE" });
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c._id !== commentId));
      setTotal((t) => t - 1);
    }
  };

  if (loading || !hasPermission("comments.manage")) return null;

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-24">
      {/* Шапка */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => router.back()}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Комментарии</h1>
          <p className="text-sm text-[var(--text-muted)]">Модерация ({total})</p>
        </div>
      </div>

      {/* Поиск */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
        <input
          type="text"
          placeholder="Поиск по тексту или логину..."
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] pl-9 pr-4 py-2.5 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Список */}
      {loadingData ? (
        <p className="text-sm text-[var(--text-muted)] py-8 text-center">Загрузка...</p>
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-[var(--text-muted)]">
          <MessageCircle className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">Комментарии не найдены</p>
        </div>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => (
            <div
              key={c._id}
              className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3"
            >
              <div className="flex items-start gap-3">
                {/* Аватар */}
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white font-bold text-xs"
                >
                  {(c.user?.username || "?")[0].toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {c.user?.username || "Удалён"}
                    </span>
                    {c.parentId && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                        ответ
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--text-primary)] break-words mb-1">{c.text}</p>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span>{c.route?.title || "Маршрут удалён"}</span>
                    <span>{formatDate(c.createdAt)}</span>
                  </div>
                </div>

                {/* Удалить */}
                <button
                  onClick={() => handleDelete(c._id)}
                  className="shrink-0 rounded-lg p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                  title="Удалить"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          {/* Загрузить ещё */}
          {comments.length < total && (
            <button
              onClick={() => fetchComments(false)}
              className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            >
              Загрузить ещё
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function formatDate(d) {
  if (!d) return "";
  const date = new Date(d);
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return "только что";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} дн назад`;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
