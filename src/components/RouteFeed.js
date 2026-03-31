"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@/components/UserProvider";
import UserAvatar from "@/components/UserAvatar";
import UserName from "@/components/UserName";
import { Heart, Camera, MessageCircle, MapPin, Flag, MoreHorizontal, Trash2, X, Send, Image as ImageIcon } from "lucide-react";

const TYPE_FILTERS = [
  { id: null, label: "Все" },
  { id: "photo", label: "Фото" },
  { id: "comment", label: "Комменты" },
];

const SORT_OPTIONS = [
  { id: "newest", label: "Новые" },
  { id: "popular", label: "Популярные" },
];

const REPORT_REASONS = [
  { id: "spam", label: "Спам" },
  { id: "nsfw", label: "Неприемлемый контент" },
  { id: "offensive", label: "Оскорбление" },
  { id: "other", label: "Другое" },
];

function timeAgo(date) {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} д`;
  return new Date(date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export default function RouteFeed({ routeId, checkpoints = [] }) {
  const { user, authFetch, hasPermission } = useUser();
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState(null);
  const [checkpoint, setCheckpoint] = useState("");
  const [sort, setSort] = useState("newest");
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const [menuPostId, setMenuPostId] = useState(null);
  const [reportPostId, setReportPostId] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [reportComment, setReportComment] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  // Форма нового поста
  const [showForm, setShowForm] = useState(false);
  const [newText, setNewText] = useState("");
  const [newFile, setNewFile] = useState(null);
  const [newPreview, setNewPreview] = useState(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef(null);

  const canModerate = hasPermission("route_posts.moderate");

  const loadPosts = useCallback(async (customOffset) => {
    const o = typeof customOffset === "number" ? customOffset : 0;
    const params = new URLSearchParams({ limit: "20", offset: String(o), sort });
    if (type) params.set("type", type);
    if (checkpoint !== "") params.set("checkpoint", checkpoint);
    if (friendsOnly && user) {
      params.set("friendsOnly", "true");
      params.set("userId", user._id);
    } else if (user) {
      params.set("userId", user._id);
    }

    const res = await fetch(`/api/routes/${routeId}/feed?${params}`);
    if (!res.ok) return;
    const data = await res.json();

    if (o === 0) {
      setPosts(data.posts);
    } else {
      setPosts((prev) => [...prev, ...data.posts]);
    }
    setTotal(data.total);
    setLoading(false);
  }, [routeId, type, checkpoint, sort, friendsOnly, user]);

  useEffect(() => {
    setLoading(true);
    setOffset(0);
    loadPosts(0);
  }, [type, checkpoint, sort, friendsOnly, loadPosts]);

  const handleLike = async (postId) => {
    if (!user) return;
    const res = await authFetch(`/api/routes/${routeId}/feed/${postId}/like`, { method: "POST" });
    if (!res.ok) return;
    const { liked, likes } = await res.json();
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, liked, likes } : p));
  };

  const handleDelete = async (postId) => {
    if (!confirm("Удалить пост?")) return;
    const res = await authFetch(`/api/routes/${routeId}/feed/${postId}`, { method: "DELETE" });
    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setTotal((t) => t - 1);
    }
    setMenuPostId(null);
  };

  const handleReport = async () => {
    if (!reportReason) return;
    setReportSending(true);
    await authFetch(`/api/routes/${routeId}/feed/${reportPostId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reportReason, comment: reportComment }),
    });
    setReportSending(false);
    setReportPostId(null);
    setReportReason("");
    setReportComment("");
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewFile(file);
    setNewPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!newText.trim() && !newFile) return;
    setSending(true);
    const fd = new FormData();
    if (newFile) fd.append("file", newFile);
    if (newText.trim()) fd.append("text", newText.trim());
    fd.append("checkpointIndex", "-1");

    const res = await authFetch(`/api/routes/${routeId}/feed`, {
      method: "POST",
      body: fd,
    });
    if (res.ok) {
      const post = await res.json();
      setPosts((prev) => [post, ...prev]);
      setTotal((t) => t + 1);
      setNewText("");
      setNewFile(null);
      setNewPreview(null);
      setShowForm(false);
    }
    setSending(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-[var(--text-primary)]">Лента</h2>
        {user && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--accent-color)] text-white hover:brightness-110 transition"
          >
            <Camera className="h-3.5 w-3.5" />
            Добавить
          </button>
        )}
      </div>

      {/* New post form */}
      {showForm && user && (
        <div className="glass-card p-3.5 mb-3 space-y-3">
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Поделитесь впечатлениями..."
            maxLength={500}
            rows={2}
            className="w-full resize-none rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-color)]"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileSelect} />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Фото
              </button>
              {newPreview && (
                <div className="relative">
                  <img src={newPreview} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  <button
                    onClick={() => { setNewFile(null); setNewPreview(null); }}
                    className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-red-500 text-white"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={sending || (!newText.trim() && !newFile)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent-color)] text-white disabled:opacity-40 transition"
            >
              <Send className="h-3 w-3" />
              {sending ? "..." : "Отправить"}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-2">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.id || "all"}
            onClick={() => setType(f.id)}
            className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition ${
              type === f.id
                ? "bg-[var(--text-primary)] text-[var(--bg-main)]"
                : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-color)]"
            }`}
          >
            {f.label}
          </button>
        ))}

        {/* Checkpoint filter */}
        {checkpoints.length > 0 && (
          <select
            value={checkpoint}
            onChange={(e) => setCheckpoint(e.target.value)}
            className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-color)] focus:outline-none"
          >
            <option value="">Все точки</option>
            {checkpoints.map((_, i) => (
              <option key={i} value={i}>Точка {i + 1}</option>
            ))}
          </select>
        )}

        {SORT_OPTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSort(s.id)}
            className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition ${
              sort === s.id
                ? "bg-[var(--accent-color)]/15 text-[var(--accent-color)] border border-[var(--accent-color)]/30"
                : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-color)]"
            }`}
          >
            {s.label}
          </button>
        ))}

        {user && (
          <button
            onClick={() => setFriendsOnly((v) => !v)}
            className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition ${
              friendsOnly
                ? "bg-blue-500/15 text-blue-500 border border-blue-500/30"
                : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-color)]"
            }`}
          >
            Друзья
          </button>
        )}
      </div>

      {/* Posts */}
      {loading ? (
        <div className="space-y-3 mt-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-[var(--bg-elevated)]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 bg-[var(--bg-elevated)] rounded" />
                  <div className="h-3 w-full bg-[var(--bg-elevated)] rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="py-10 text-center">
          <Camera className="h-10 w-10 mx-auto text-[var(--text-muted)] opacity-30 mb-2" />
          <p className="text-sm text-[var(--text-muted)]">Пока нет записей</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Будьте первым — поделитесь впечатлениями!</p>
        </div>
      ) : (
        <div className="space-y-3 mt-3">
          {posts.map((post) => (
            <div key={post.id} className="glass-card p-3.5">
              {/* Header */}
              <div className="flex items-center gap-2.5 mb-2">
                <UserAvatar user={post} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <UserName user={post} className="text-sm font-semibold" />
                    <span className="text-xs text-[var(--text-muted)]">{timeAgo(post.createdAt)}</span>
                  </div>
                  {post.checkpointIndex >= 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-[var(--text-muted)]">
                      <Flag className="h-2.5 w-2.5" />
                      Точка {post.checkpointIndex + 1}
                    </span>
                  )}
                </div>
                {/* Menu */}
                {user && (post.userId === user._id || canModerate) && (
                  <div className="relative">
                    <button
                      onClick={() => setMenuPostId(menuPostId === post.id ? null : post.id)}
                      className="p-1 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] transition"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {menuPostId === post.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuPostId(null)} />
                        <div className="absolute right-0 top-full mt-1 z-20 w-36 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-lg)] py-1 overflow-hidden">
                          <button
                            onClick={() => handleDelete(post.id)}
                            className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-500 hover:bg-red-500/5 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Удалить
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Image */}
              {post.imageUrl && (
                <button
                  onClick={() => setLightboxUrl(post.imageUrl)}
                  className="w-full mb-2 rounded-xl overflow-hidden"
                >
                  <img
                    src={post.imageUrl}
                    alt=""
                    className="w-full max-h-72 object-cover rounded-xl"
                    loading="lazy"
                  />
                </button>
              )}

              {/* Text */}
              {post.text && (
                <p className="text-sm text-[var(--text-primary)] leading-relaxed mb-2">{post.text}</p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleLike(post.id)}
                  className={`flex items-center gap-1 text-xs transition ${
                    post.liked ? "text-red-500" : "text-[var(--text-muted)] hover:text-red-500"
                  }`}
                >
                  <Heart className={`h-4 w-4 ${post.liked ? "fill-current" : ""}`} />
                  {post.likes > 0 && post.likes}
                </button>
                {user && post.userId !== user?._id && (
                  <button
                    onClick={() => { setReportPostId(post.id); setMenuPostId(null); }}
                    className="text-xs text-[var(--text-muted)] hover:text-orange-500 transition"
                  >
                    Пожаловаться
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Load more */}
          {posts.length < total && (
            <button
              onClick={() => {
                const newOffset = posts.length;
                setOffset(newOffset);
                loadPosts(newOffset);
              }}
              className="w-full py-2.5 text-xs font-medium text-[var(--accent-color)] hover:bg-[var(--accent-color)]/5 rounded-xl transition"
            >
              Загрузить ещё
            </button>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setLightboxUrl(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white" onClick={() => setLightboxUrl(null)}>
            <X className="h-5 w-5" />
          </button>
          <img src={lightboxUrl} alt="" className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Report modal */}
      {reportPostId && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center" onClick={() => setReportPostId(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm mx-auto bg-[var(--bg-surface)] rounded-t-3xl sm:rounded-3xl p-5 pb-8 sm:pb-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-3">Пожаловаться</h3>
            <div className="space-y-2 mb-3">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setReportReason(r.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm transition ${
                    reportReason === r.id
                      ? "bg-[var(--accent-color)]/10 text-[var(--accent-color)] font-medium border border-[var(--accent-color)]/30"
                      : "bg-[var(--bg-main)] text-[var(--text-secondary)] border border-[var(--border-color)]"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <textarea
              value={reportComment}
              onChange={(e) => setReportComment(e.target.value)}
              placeholder="Подробности (необязательно)"
              maxLength={300}
              rows={2}
              className="w-full resize-none rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none mb-3"
            />
            <div className="flex gap-2">
              <button onClick={() => setReportPostId(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-main)] border border-[var(--border-color)]">
                Отмена
              </button>
              <button
                onClick={handleReport}
                disabled={!reportReason || reportSending}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 disabled:opacity-40 transition"
              >
                {reportSending ? "..." : "Отправить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
