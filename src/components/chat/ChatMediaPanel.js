"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Image as ImageIcon, Mic, Loader2 } from "lucide-react";
import { useUser } from "../UserProvider";
import VoiceMessage from "../VoiceMessage";
import MediaGallery from "./MediaGallery";

function formatDate(date) {
  const d = new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (msgDate.getTime() === today.getTime()) return "Сегодня";
  if (msgDate.getTime() === yesterday.getTime()) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function groupByDate(items) {
  const groups = [];
  let current = null;

  for (const item of items) {
    const label = formatDate(item.createdAt);
    if (!current || current.label !== label) {
      current = { label, items: [] };
      groups.push(current);
    }
    current.items.push(item);
  }

  return groups;
}

export default function ChatMediaPanel({ mediaUrl, onClose, getSenderName }) {
  const { authFetch } = useUser();
  const [tab, setTab] = useState("image"); // "image" | "voice"
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(null);
  const scrollRef = useRef(null);

  const fetchMedia = useCallback(async (type, before = null) => {
    const url = new URL(mediaUrl, window.location.origin);
    url.searchParams.set("type", type);
    url.searchParams.set("limit", "50");
    if (before) url.searchParams.set("before", before);

    const res = await authFetch(url.pathname + url.search);
    if (!res.ok) return { items: [], hasMore: false };
    return res.json();
  }, [mediaUrl, authFetch]);

  // Загрузка при смене таба
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setItems([]);

    fetchMedia(tab).then((data) => {
      if (cancelled) return;
      setItems(data.items || []);
      setHasMore(data.hasMore || false);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [tab, fetchMedia]);

  // Подгрузка ещё
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || items.length === 0) return;
    setLoadingMore(true);
    const last = items[items.length - 1];
    const data = await fetchMedia(tab, last.createdAt).catch(() => ({ items: [], hasMore: false }));
    setItems((prev) => [...prev, ...(data.items || [])]);
    setHasMore(data.hasMore || false);
    setLoadingMore(false);
  }, [loadingMore, hasMore, items, tab, fetchMedia]);

  // Infinite scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handler = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
        loadMore();
      }
    };

    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [loadMore]);

  const imageItems = tab === "image" ? items : [];
  const voiceItems = tab === "voice" ? items : [];
  const dateGroups = groupByDate(items);

  // Для MediaGallery: формируем массив в формате messages
  const galleryMessages = imageItems.map((item) => ({
    id: item.id,
    type: "image",
    imageUrl: item.imageUrl,
    senderId: item.senderId,
    senderUsername: item.senderUsername,
    createdAt: item.createdAt,
  }));

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-[var(--bg-surface)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-[var(--border-color)]">
        <h2 className="text-base font-bold text-[var(--text-primary)]">Медиа</h2>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--bg-elevated)] transition"
        >
          <X className="h-5 w-5 text-[var(--text-secondary)]" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex px-4 pt-2 pb-1 gap-2 shrink-0">
        <button
          onClick={() => setTab("image")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition ${
            tab === "image"
              ? "bg-[var(--accent-color)] text-white"
              : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          <ImageIcon className="h-4 w-4" />
          Фото
        </button>
        <button
          onClick={() => setTab("voice")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition ${
            tab === "voice"
              ? "bg-[var(--accent-color)] text-white"
              : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          <Mic className="h-4 w-4" />
          Аудио
        </button>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            {tab === "image" ? (
              <ImageIcon className="h-12 w-12 text-[var(--text-muted)] mb-3 opacity-30" />
            ) : (
              <Mic className="h-12 w-12 text-[var(--text-muted)] mb-3 opacity-30" />
            )}
            <p className="text-sm text-[var(--text-muted)]">
              {tab === "image" ? "Нет фотографий" : "Нет голосовых сообщений"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {dateGroups.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-medium text-[var(--text-muted)] mb-2">{group.label}</p>

                {tab === "image" ? (
                  <div className="grid grid-cols-3 gap-1 rounded-xl overflow-hidden">
                    {group.items.map((item) => {
                      const globalIdx = imageItems.findIndex((i) => i.id === item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => setGalleryIndex(globalIdx)}
                          className="relative aspect-square overflow-hidden bg-[var(--bg-elevated)] hover:opacity-80 transition"
                        >
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-xl bg-[var(--bg-elevated)] p-3"
                      >
                        <div className="flex-1 min-w-0">
                          <VoiceMessage
                            audioUrl={item.audioUrl}
                            duration={item.audioDuration}
                            isMe={false}
                          />
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] text-[var(--text-muted)]">
                            {item.senderUsername || getSenderName?.(item) || ""}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)]">
                            {new Date(item.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loadingMore && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen image gallery */}
      {galleryIndex !== null && galleryMessages.length > 0 && (
        <MediaGallery
          messages={galleryMessages}
          initialMsgId={galleryMessages[galleryIndex]?.id}
          onClose={() => setGalleryIndex(null)}
          getSenderName={getSenderName}
        />
      )}
    </div>
  );
}
