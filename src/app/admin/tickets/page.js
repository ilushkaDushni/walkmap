"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/UserProvider";
import UserAvatar from "@/components/UserAvatar";
import { ArrowLeft, Search, LifeBuoy, Send, X, Lock, Unlock, Smile, Paperclip } from "lucide-react";

const EMOJI_LIST = [
  "😊", "👍", "❤️", "🎉", "✅", "👋", "🙏", "💪",
  "🔥", "⭐", "💡", "🚀", "😄", "😅", "🤔", "👀",
  "✨", "💬", "📌", "🛠️", "⚡", "🎯", "📝", "🤝",
  "😉", "👌", "💯", "🙂", "☺️", "🫡",
];

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d} дн`;
  return `${Math.floor(d / 30)} мес`;
}

export default function AdminTicketsPage() {
  const { user, loading, authFetch, hasPermission } = useUser();
  const router = useRouter();
  const [tickets, setTickets] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [tab, setTab] = useState("open"); // "open" | "closed" | "all"
  const [search, setSearch] = useState("");
  const [loadingData, setLoadingData] = useState(true);

  // Detail
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState(null);
  const messagesEndRef = useRef(null);
  const replyInputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!loading && !hasPermission("feedback.manage")) {
      router.replace("/");
    }
  }, [user, loading, router, hasPermission]);

  const fetchTickets = useCallback(async () => {
    setLoadingData(true);
    const params = new URLSearchParams({ page: page.toString() });
    if (tab !== "all") params.set("status", tab);
    if (search.trim()) params.set("search", search.trim());

    try {
      const res = await authFetch(`/api/admin/tickets?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
        setTotal(data.total || 0);
        setPages(data.pages || 1);
      }
    } catch {
      // ignore
    } finally {
      setLoadingData(false);
    }
  }, [authFetch, tab, search, page]);

  useEffect(() => {
    if (hasPermission("feedback.manage")) {
      setPage(1);
      fetchTickets();
    }
  }, [tab, search, hasPermission, authFetch]);

  useEffect(() => {
    if (hasPermission("feedback.manage") && page > 1) {
      fetchTickets();
    }
  }, [page]);

  const loadDetail = async (ticketId) => {
    setSelectedId(ticketId);
    setLoadingDetail(true);
    setReplyText("");
    setShowEmoji(false);
    setPendingImageUrl(null);
    try {
      const res = await authFetch(`/api/admin/tickets/${ticketId}`);
      if (res.ok) setDetail(await res.json());
    } catch {
      // ignore
    } finally {
      setLoadingDetail(false);
    }
  };

  // Polling: обновлять сообщения каждые 5 секунд при открытом тикете
  useEffect(() => {
    if (!selectedId) return;
    const interval = setInterval(async () => {
      try {
        const res = await authFetch(`/api/admin/tickets/${selectedId}`);
        if (res.ok) {
          const data = await res.json();
          setDetail((prev) => {
            if (!prev || data.messages?.length !== prev.messages?.length) return data;
            return prev;
          });
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedId, authFetch]);

  useEffect(() => {
    if (detail?.messages) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [detail?.messages?.length]);

  const handleReply = async () => {
    const text = replyText.trim();
    if ((!text && !pendingImageUrl) || !selectedId) return;
    setReplying(true);
    try {
      const res = await authFetch(`/api/admin/tickets/${selectedId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, imageUrl: pendingImageUrl }),
      });
      if (res.ok) {
        setReplyText("");
        setPendingImageUrl(null);
        setShowEmoji(false);
        await loadDetail(selectedId);
        fetchTickets();
      }
    } catch {
      // ignore
    } finally {
      setReplying(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!detail) return;
    const newStatus = detail.status === "open" ? "closed" : "open";
    try {
      const res = await authFetch(`/api/admin/tickets/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setDetail((prev) => ({ ...prev, status: newStatus }));
        fetchTickets();
      }
    } catch {
      // ignore
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "photo");
      const res = await authFetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) setPendingImageUrl(data.url);
    } catch {
      // ignore
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const insertEmoji = (emoji) => {
    setReplyText((prev) => prev + emoji);
    setShowEmoji(false);
    replyInputRef.current?.focus();
  };

  if (loading || !hasPermission("feedback.manage")) return null;

  const statusBadge = (status) => (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status === "open" ? "bg-green-500/15 text-green-500" : "bg-[var(--text-muted)]/15 text-[var(--text-muted)]"}`}>
      {status === "open" ? "Открыт" : "Закрыт"}
    </span>
  );

  const tabCls = (t) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
      tab === t
        ? "bg-[var(--text-primary)] text-[var(--bg-surface)]"
        : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
    }`;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-24">
      {/* Шапка */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => router.back()}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Обращения</h1>
          <p className="text-sm text-[var(--text-muted)]">Поддержка ({total})</p>
        </div>
      </div>

      {/* Табы */}
      <div className="flex gap-1 mb-3">
        <button onClick={() => setTab("open")} className={tabCls("open")}>Открытые</button>
        <button onClick={() => setTab("closed")} className={tabCls("closed")}>Закрытые</button>
        <button onClick={() => setTab("all")} className={tabCls("all")}>Все</button>
      </div>

      {/* Поиск */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
        <input
          type="text"
          placeholder="Поиск по теме..."
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] pl-9 pr-4 py-2.5 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Детали тикета */}
      {selectedId && (
        <div className="mb-4 rounded-2xl border border-teal-500/30 bg-[var(--bg-surface)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {detail && (
                <>
                  <UserAvatar username={detail.user?.username || "?"} avatarUrl={detail.user?.avatarUrl} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--text-primary)] truncate">
                      {detail.ticketNumber && <span className="text-teal-500">#{detail.ticketNumber} </span>}
                      {detail.subject}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">{detail.user?.username} · {detail.user?.email}</p>
                  </div>
                  {statusBadge(detail.status)}
                </>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {detail && (
                <button
                  onClick={handleToggleStatus}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition ${
                    detail.status === "open"
                      ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                      : "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                  }`}
                >
                  {detail.status === "open" ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  {detail.status === "open" ? "Закрыть" : "Открыть"}
                </button>
              )}
              <button onClick={() => { setSelectedId(null); setDetail(null); }} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {loadingDetail ? (
            <div className="py-8 text-center text-sm text-[var(--text-muted)]">Загрузка...</div>
          ) : detail ? (
            <>
              {/* Сообщения */}
              <div className="px-4 py-3 space-y-2 max-h-[50vh] overflow-y-auto">
                {(detail.messages || []).map((m) => {
                  const isAdmin = m.senderType === "admin";
                  return (
                    <div key={m.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${isAdmin ? "bg-teal-500/15 text-[var(--text-primary)]" : "bg-[var(--bg-elevated)] text-[var(--text-primary)]"}`}>
                        <p className="text-[10px] font-bold mb-0.5" style={{ color: isAdmin ? "#14b8a6" : "var(--text-muted)" }}>
                          {m.sender?.username || "Удалён"} {isAdmin && "· Поддержка"}
                        </p>
                        {m.imageUrl && (
                          <img src={m.imageUrl} alt="" className="rounded-xl max-w-full mb-1 cursor-pointer" onClick={() => window.open(m.imageUrl, "_blank")} />
                        )}
                        {m.text && <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>}
                        <p className="text-[9px] text-[var(--text-muted)] mt-1 text-right">{timeAgo(m.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Ответ */}
              <div className="px-4 py-3 border-t border-[var(--border-color)]">
                {pendingImageUrl && (
                  <div className="relative inline-block mb-2">
                    <img src={pendingImageUrl} alt="" className="h-16 rounded-lg" />
                    <button onClick={() => setPendingImageUrl(null)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {/* Эмодзи-пикер */}
                {showEmoji && (
                  <div className="mb-2 p-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] grid grid-cols-10 gap-1">
                    {EMOJI_LIST.map((e) => (
                      <button key={e} onClick={() => insertEmoji(e)} className="text-lg hover:scale-125 transition p-0.5">
                        {e}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 items-end">
                  <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition disabled:opacity-50"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setShowEmoji((v) => !v)}
                    className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg transition ${showEmoji ? "text-teal-500 bg-teal-500/10" : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"}`}
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                  <input
                    ref={replyInputRef}
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value.slice(0, 1000))}
                    onKeyDown={(e) => e.key === "Enter" && handleReply()}
                    placeholder="Написать ответ..."
                    className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                  />
                  <button
                    onClick={handleReply}
                    disabled={replying || (!replyText.trim() && !pendingImageUrl)}
                    className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-teal-500 text-white transition hover:bg-teal-600 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-sm text-[var(--text-muted)]">Не удалось загрузить</div>
          )}
        </div>
      )}

      {/* Список тикетов */}
      {loadingData ? (
        <p className="text-sm text-[var(--text-muted)] py-8 text-center">Загрузка...</p>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-[var(--text-muted)]">
          <LifeBuoy className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">Обращений не найдено</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => loadDetail(t.id)}
              className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition hover:opacity-80 ${
                selectedId === t.id
                  ? "border-teal-500/50 bg-teal-500/5"
                  : "border-[var(--border-color)] bg-[var(--bg-surface)]"
              }`}
            >
              <UserAvatar username={t.user?.username || "?"} avatarUrl={t.user?.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {t.ticketNumber && <span className="text-[10px] font-bold text-teal-500 shrink-0">#{t.ticketNumber}</span>}
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{t.subject}</p>
                  {statusBadge(t.status)}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-[var(--text-muted)]">{t.user?.username || "Удалён"}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">{timeAgo(t.updatedAt)}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">{t.messageCount} сообщ.</span>
                </div>
              </div>
            </button>
          ))}

          {/* Пагинация */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition disabled:opacity-30"
              >
                Назад
              </button>
              <span className="text-xs text-[var(--text-muted)]">{page} / {pages}</span>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition disabled:opacity-30"
              >
                Далее
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
