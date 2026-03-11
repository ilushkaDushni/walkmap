"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/UserProvider";
import UserAvatar from "@/components/UserAvatar";
import ChatView from "@/components/ChatView";
import { ArrowLeft, Search, MessageCircle, Shield } from "lucide-react";

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

export default function AdminMessagesPage() {
  const { user, loading, authFetch, hasPermission } = useUser();
  const router = useRouter();
  const [conversations, setConversations] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(null);

  useEffect(() => {
    if (!loading && !hasPermission("feedback.manage")) {
      router.replace("/");
    }
  }, [user, loading, router, hasPermission]);

  const fetchConversations = useCallback(async () => {
    if (!authFetch) return;
    try {
      const res = await authFetch("/api/admin/messages");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingData(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (hasPermission("feedback.manage")) {
      fetchConversations();
    }
  }, [hasPermission, fetchConversations]);

  // Polling каждые 15 секунд
  useEffect(() => {
    if (!hasPermission("feedback.manage")) return;
    const interval = setInterval(fetchConversations, 15000);
    return () => clearInterval(interval);
  }, [hasPermission, fetchConversations]);

  const handleBack = useCallback(() => {
    setSelectedUserId(null);
    fetchConversations();
  }, [fetchConversations]);

  if (loading || !hasPermission("feedback.manage")) return null;

  const filtered = search.trim()
    ? conversations.filter((c) =>
        c.username.toLowerCase().includes(search.trim().toLowerCase())
      )
    : conversations;

  const selectedConv = conversations.find((c) => c.userId === selectedUserId);

  const renderList = () => (
    <>
      {/* Шапка */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => router.back()}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Сообщения</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Чат с пользователями ({conversations.length})
          </p>
        </div>
      </div>

      {/* Поиск */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
        <input
          type="text"
          placeholder="Поиск по нику..."
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] pl-9 pr-4 py-2.5 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Список */}
      {loadingData ? (
        <p className="text-sm text-[var(--text-muted)] py-8 text-center">Загрузка...</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-[var(--text-muted)]">
          <MessageCircle className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">
            {search.trim() ? "Ничего не найдено" : "Нет сообщений"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <button
              key={c.conversationKey}
              onClick={() => setSelectedUserId(c.userId)}
              className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition hover:opacity-80 ${
                selectedUserId === c.userId
                  ? "border-red-500/50 bg-red-500/5"
                  : "border-[var(--border-color)] bg-[var(--bg-surface)]"
              }`}
            >
              <UserAvatar username={c.username} avatarUrl={c.avatarUrl} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {c.username}
                  </p>
                  {c.lastMessage?.type === "admin" && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-500 shrink-0">
                      АДМИН
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                  {c.lastMessage?.type === "admin" && c.lastMessage?.senderUsername
                    ? `${c.lastMessage.senderUsername}: `
                    : ""}
                  {c.lastMessage?.text || "Фото"}
                </p>
                <span className="text-xs text-[var(--text-muted)]">
                  {timeAgo(c.lastMessage?.createdAt)}
                </span>
              </div>
              {c.unread > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white shrink-0">
                  {c.unread > 99 ? "99+" : c.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile: overlay чат */}
      {selectedUserId && (
        <div className="md:hidden">
          <ChatView
            friendId={selectedUserId}
            friend={{ username: selectedConv?.username || "?", avatarUrl: selectedConv?.avatarUrl }}
            onBack={handleBack}
            adminMode
          />
        </div>
      )}

      {/* Desktop: split layout */}
      <div className="hidden md:flex h-[calc(100dvh-57px)] overflow-hidden -mb-24">
        <div className="w-80 border-r border-[var(--border-color)] overflow-y-auto p-4 shrink-0">
          {renderList()}
        </div>

        <div className="flex-1 min-w-0">
          {selectedUserId ? (
            <ChatView
              friendId={selectedUserId}
              friend={{ username: selectedConv?.username || "?", avatarUrl: selectedConv?.avatarUrl }}
              onBack={handleBack}
              inline
              adminMode
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
              <Shield className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-sm">Выберите диалог</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: обычный layout */}
      <div className={`md:hidden ${selectedUserId ? "hidden" : ""}`}>
        <div className="px-4 py-4 max-w-lg mx-auto pb-24">
          {renderList()}
        </div>
      </div>
    </>
  );
}
